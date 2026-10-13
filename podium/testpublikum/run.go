package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"math/rand/v2"
	"sync"
	"time"
)

const (
	maxPhones = 300
	// A run stops by itself after this long, so a room left on after a
	// rehearsal is not still voting in the real talk.
	runFor = 3 * time.Hour
	// How many lines of what has happened the page is shown.
	keepLines = 40
)

// tempo is how a room answers.
type tempo struct {
	// Phones arrive over this long, the way a room scans the code.
	Join time.Duration
	// Nobody answers sooner than this after a question comes up, since they
	// read it first.
	First time.Duration
	// Half the room has answered by First+Median. The rest come after, fewer
	// and fewer the longer it goes: Spread is how far they straggle.
	Median time.Duration
	Spread float64
	// And nobody takes longer than this.
	Last time.Duration
	// The share of the room that answers at all.
	Turnout float64
}

// pace is a tempo with a name, and what the page says it is. The sentence
// is worked out from the numbers (First + Median·e^±Spread is where two
// thirds of a room answer), so a change to one is a change to the other.
type pace struct {
	Name  string `json:"name"`
	Label string `json:"label"`
	About string `json:"about"`
	tempo `json:"-"`
}

var paces = []pace{
	{"rolig", "Rolig", "Telefonene kommer inn i løpet av 20 sekunder. De fleste svarer 6 til 18 sekunder etter at spørsmålet kommer opp, og 85 av 100 svarer.",
		tempo{Join: 20 * time.Second, First: 2 * time.Second, Median: 8 * time.Second, Spread: 0.7, Last: 45 * time.Second, Turnout: 0.85}},
	{"vanlig", "Vanlig", "Telefonene kommer inn i løpet av 8 sekunder. De fleste svarer 3 til 8 sekunder etter at spørsmålet kommer opp, og 92 av 100 svarer.",
		tempo{Join: 8 * time.Second, First: time.Second, Median: 4 * time.Second, Spread: 0.6, Last: 20 * time.Second, Turnout: 0.92}},
	{"lynrask", "Lynrask", "Telefonene kommer inn med en gang, og alle svarer innen 4 sekunder.",
		tempo{Join: 2 * time.Second, First: 200 * time.Millisecond, Median: time.Second, Spread: 0.5, Last: 4 * time.Second, Turnout: 1}},
}

func paceNamed(name string) (pace, bool) {
	for _, p := range paces {
		if p.Name == name {
			return p, true
		}
	}
	return pace{}, false
}

func (t tempo) join() time.Duration {
	return time.Duration(rand.Int64N(int64(t.Join) + 1))
}

func (t tempo) delay() time.Duration {
	d := t.First + time.Duration(float64(t.Median)*math.Exp(t.Spread*rand.NormFloat64()))
	return min(d, t.Last)
}

// run is one room of phones on one presentation.
type run struct {
	code    string
	pace    string
	tempo   tempo
	podium  *podium
	log     *slog.Logger
	started time.Time
	stopsAt time.Time
	ctx     context.Context
	cancel  context.CancelFunc

	mu        sync.Mutex
	title     string
	marks     string
	phones    []*phone
	next      int
	connected int
	screen    *liveState
	leans     map[string]map[string]float64
	tallies   map[string]*tally
	lines     []line
	stopped   string
	troubleAt time.Time
	resetAt   map[string]time.Time
}

// tally is what the room did with one question.
type tally struct {
	title   string
	options []option
	votes   map[int]string // phone → its answer, as Podium has it
	waiting map[int]bool   // phones that are about to answer
	passed  map[int]bool   // phones that let it go by
	told    bool           // the log has said how it went
}

type line struct {
	At   time.Time `json:"at"`
	Text string    `json:"text"`
}

func newRun(p *podium, log *slog.Logger, code, pace string, t tempo, title, marks string) *run {
	ctx, cancel := context.WithTimeout(context.Background(), runFor)
	r := &run{
		code: code, pace: pace, tempo: t, podium: p, log: log.With("code", code),
		started: time.Now(), ctx: ctx, cancel: cancel, title: title, marks: marks,
		leans: map[string]map[string]float64{}, tallies: map[string]*tally{}, resetAt: map[string]time.Time{},
	}
	r.stopsAt = r.started.Add(runFor)
	go func() {
		<-ctx.Done()
		r.stop("Stoppet av seg selv etter tre timer.")
	}()
	return r
}

// stop sends the phones home, and the first reason given is the one that stands.
func (r *run) stop(why string) {
	r.mu.Lock()
	if r.stopped == "" {
		r.stopped = why
		r.say(why)
		r.log.Info("stopped", "why", why)
	}
	r.mu.Unlock()
	r.cancel()
}

func (r *run) isStopped() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.stopped != ""
}

// resize makes the room [n] phones: new ones arrive the way the first did,
// and the last to arrive are the first to leave.
func (r *run) resize(n int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stopped != "" {
		return
	}
	before := len(r.phones)
	for len(r.phones) < n {
		ph := newPhone(r, r.next)
		r.next++
		r.phones = append(r.phones, ph)
		go ph.live()
	}
	for len(r.phones) > n {
		last := r.phones[len(r.phones)-1]
		last.cancel()
		r.phones = r.phones[:len(r.phones)-1]
	}
	if before > 0 && before != n {
		r.say(fmt.Sprintf("Endret til %d telefoner.", n))
	}
}

// say adds a line to what the page shows has happened. The caller holds mu.
func (r *run) say(text string) {
	r.lines = append(r.lines, line{At: time.Now(), Text: text})
	if len(r.lines) > keepLines {
		r.lines = r.lines[len(r.lines)-keepLines:]
	}
}

func (r *run) note(text string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.say(text)
}

func (r *run) connect(d int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.connected += d
}

// trouble is a call to Podium that failed. A room of phones failing at once
// is one line on the page, not three hundred.
func (r *run) trouble(err error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.stopped != "" || time.Since(r.troubleAt) < 30*time.Second {
		return
	}
	r.troubleAt = time.Now()
	r.log.Warn("podium", "err", err)
	var pr *problem
	if errors.As(err, &pr) && pr.Message != "" {
		r.say(fmt.Sprintf("Podium sa nei: %s", pr.Message))
		return
	}
	r.say("Får ikke kontakt med Podium. Telefonene prøver igjen.")
}

// saw is a phone's look at the screen. Every phone sees every change, so a
// change is told once: when the screen is not what it was.
func (r *run) saw(st liveState) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var was, now *liveSlide
	if r.screen != nil {
		was = r.screen.Slide
	}
	now = st.Slide
	// A question that leaves the screen is told how it went, if it was not
	// already: the phones still about to answer did not get to.
	if was != nil && len(was.Options) > 0 && (now == nil || now.ID != was.ID) {
		if t := r.tallies[was.ID]; t != nil && !t.told && len(t.votes)+len(t.passed)+len(t.waiting) > 0 {
			t.told = true
			r.say(summary(t, len(t.waiting)))
		}
	}
	r.screen = &st
	if st.Title != "" {
		r.title = st.Title
	}
	if st.Marks != "" {
		r.marks = st.Marks
	}
	switch {
	case now == nil && was != nil:
		r.say("Presentasjonen ble stoppet.")
	case now != nil && (was == nil || was.ID != now.ID) && len(now.Options) > 0:
		r.say(fmt.Sprintf("Spørsmål på skjermen: «%s».", titled(now.Title)))
	case now != nil && was == nil:
		r.say(fmt.Sprintf("Presentasjonen er i gang, på side %d av %d.", st.Index, st.Count))
	}
}

func titled(t string) string {
	if t == "" {
		return "uten tittel"
	}
	return t
}

// lean is how the room leans on a question: a weight for each answer, drawn
// the first time the question is seen and shared by every phone, so a room
// agrees with itself the way rooms do. An answer added later gets its own.
func (r *run) lean(q question) map[string]float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	l := r.leans[q.SlideID]
	if l == nil {
		l = map[string]float64{}
		r.leans[q.SlideID] = l
	}
	out := make(map[string]float64, len(q.Options))
	for _, o := range q.Options {
		if _, ok := l[o.ID]; !ok {
			// A gamma(2) weight each, taken as shares: a room that mostly has
			// a favourite, sometimes a close race, and only now and then one
			// answer nearly everyone gives.
			l[o.ID] = rand.ExpFloat64() + rand.ExpFloat64()
		}
		out[o.ID] = l[o.ID]
	}
	return out
}

func pick(lean map[string]float64, options []option) string {
	var sum float64
	for _, o := range options {
		sum += lean[o.ID]
	}
	x := rand.Float64() * sum
	for _, o := range options {
		x -= lean[o.ID]
		if x < 0 {
			return o.ID
		}
	}
	return options[len(options)-1].ID
}

// tallyFor is the question's tally, made the first time. The caller holds mu.
func (r *run) tallyFor(q question) *tally {
	t := r.tallies[q.SlideID]
	if t == nil {
		t = &tally{votes: map[int]string{}, waiting: map[int]bool{}, passed: map[int]bool{}}
		r.tallies[q.SlideID] = t
	}
	t.title, t.options = q.Title, q.Options
	return t
}

func (r *run) waits(n int, q question) {
	r.mu.Lock()
	defer r.mu.Unlock()
	t := r.tallyFor(q)
	t.waiting[n] = true
	delete(t.passed, n)
}

func (r *run) passes(n int, q question) {
	r.mu.Lock()
	defer r.mu.Unlock()
	t := r.tallyFor(q)
	t.passed[n] = true
	delete(t.waiting, n)
	r.tell(t)
}

func (r *run) voted(n int, q question, optionID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	t := r.tallyFor(q)
	t.votes[n] = optionID
	delete(t.waiting, n)
	delete(t.passed, n)
	r.tell(t)
}

// gaveUp is a phone that was about to answer and did not: the question went
// first, or the phone did.
func (r *run) gaveUp(n int, slideID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if t := r.tallies[slideID]; t != nil {
		delete(t.waiting, n)
		r.tell(t)
	}
}

// lost is a phone whose answer Podium no longer has: the votes were reset.
// The phone answers again, as a person would whose phone asks again.
func (r *run) lost(n int, q question) {
	r.mu.Lock()
	defer r.mu.Unlock()
	t := r.tallyFor(q)
	delete(t.votes, n)
	t.told = false
	if time.Since(r.resetAt[q.SlideID]) > 10*time.Second {
		r.resetAt[q.SlideID] = time.Now()
		r.say(fmt.Sprintf("Stemmene på «%s» ble nullstilt. Telefonene svarer på nytt.", titled(q.Title)))
	}
}

// tell says how a question went, once every phone in the room has either
// answered it or let it go. The caller holds mu.
func (r *run) tell(t *tally) {
	decided := len(t.votes) + len(t.passed)
	if t.told || len(t.waiting) > 0 || decided == 0 || decided < len(r.phones) {
		return
	}
	t.told = true
	r.say(summary(t, 0))
}

// summary is how a question went, in a line: [late] is the phones that were
// still about to answer when it left the screen.
func summary(t *tally, late int) string {
	voted, passed := len(t.votes), len(t.passed)
	if passed == 0 && late == 0 {
		return fmt.Sprintf("«%s»: alle %d svarte.", titled(t.title), voted)
	}
	s := fmt.Sprintf("«%s»: %d svarte", titled(t.title), voted)
	if passed > 0 {
		s += fmt.Sprintf(", %d lot være", passed)
	}
	if late > 0 {
		s += fmt.Sprintf(", %d rakk det ikke", late)
	}
	return s + "."
}

type runView struct {
	Code      string      `json:"code"`
	Title     string      `json:"title"`
	Marks     string      `json:"marks"`
	Pace      string      `json:"pace"`
	Phones    int         `json:"phones"`
	Connected int         `json:"connected"`
	StartedAt time.Time   `json:"startedAt"`
	StopsAt   time.Time   `json:"stopsAt"`
	Stopped   string      `json:"stopped,omitempty"`
	Screen    *screenView `json:"screen"`
	Log       []line      `json:"log"`
}

type screenView struct {
	Live     bool          `json:"live"`
	Index    int           `json:"index"`
	Count    int           `json:"count"`
	Question *questionView `json:"question"`
}

type questionView struct {
	Title   string       `json:"title"`
	Options []optionView `json:"options"`
	Voted   int          `json:"voted"`
	Waiting int          `json:"waiting"`
	Passed  int          `json:"passed"`
}

type optionView struct {
	Label string `json:"label"`
	Color string `json:"color"`
	// The room's answers to it: this run's phones only, not anyone else's.
	Votes int `json:"votes"`
}

func (r *run) view() runView {
	r.mu.Lock()
	defer r.mu.Unlock()
	v := runView{
		Code: r.code, Title: r.title, Marks: r.marks, Pace: r.pace, Phones: len(r.phones), Connected: r.connected,
		StartedAt: r.started, StopsAt: r.stopsAt, Stopped: r.stopped, Log: make([]line, 0, len(r.lines)),
	}
	for i := len(r.lines) - 1; i >= 0; i-- {
		v.Log = append(v.Log, r.lines[i])
	}
	if r.screen == nil {
		return v
	}
	s := &screenView{Live: r.screen.Slide != nil, Index: r.screen.Index, Count: r.screen.Count}
	if sl := r.screen.Slide; sl != nil && len(sl.Options) > 0 {
		q := &questionView{Title: sl.Title, Options: make([]optionView, 0, len(sl.Options))}
		counts := map[string]int{}
		if t := r.tallies[sl.ID]; t != nil {
			for _, id := range t.votes {
				counts[id]++
			}
			q.Voted, q.Waiting, q.Passed = len(t.votes), len(t.waiting), len(t.passed)
		}
		for _, o := range sl.Options {
			q.Options = append(q.Options, optionView{Label: o.Label, Color: o.Color, Votes: counts[o.ID]})
		}
		s.Question = q
	}
	v.Screen = s
	return v
}
