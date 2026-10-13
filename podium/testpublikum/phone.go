package main

import (
	"context"
	"math/rand/v2"
	"net/http"
	"time"
)

// phone is one person in the room, holding the ballot page open.
//
// It does what the page does. It holds the presentation's stream open and
// starts it again when it ends. When the screen shows a question it looks at
// the ballot, which is where Podium gives it its cookie and says whether it
// has answered. Then it answers, after a while, or lets the question go by.
type phone struct {
	n      int
	run    *run
	client *http.Client
	ctx    context.Context
	cancel context.CancelFunc
	// The latest thing the screen did, and only the latest: a phone that is
	// busy answering has no use for a change that has already been undone.
	states chan liveState

	// Kept by the phone's worker alone.
	plan   *plan
	done   map[string]string // slide → the answer this phone gave it
	passed map[string]bool   // slides it let go by
}

// plan is an answer the phone is about to give.
type plan struct {
	q      question
	option string
	at     time.Time
}

func newPhone(r *run, n int) *phone {
	ctx, cancel := context.WithCancel(r.ctx)
	return &phone{
		n: n, run: r, client: r.podium.phone(), ctx: ctx, cancel: cancel,
		states: make(chan liveState, 1), done: map[string]string{}, passed: map[string]bool{},
	}
}

// live is the phone's stream, held open for as long as the phone is in the room.
func (ph *phone) live() {
	r := ph.run
	go ph.work()
	if !sleep(ph.ctx, r.tempo.join()) {
		return
	}
	failures := 0
	for {
		opened, began := false, time.Now()
		err := r.podium.listen(ph.ctx, ph.client, r.code, func() {
			opened = true
			r.connect(1)
		}, func(st liveState) {
			if st.Ended {
				r.stop("Presentasjonen ble slettet.")
				return
			}
			r.saw(st)
			ph.push(st)
		})
		if opened {
			r.connect(-1)
		}
		if ph.ctx.Err() != nil {
			return
		}
		if isStatus(err, http.StatusNotFound) {
			r.stop("Presentasjonen finnes ikke lenger.")
			return
		}
		if opened && time.Since(began) > 10*time.Second {
			failures = 0
		} else {
			failures++
			if err != nil {
				r.trouble(err)
			}
		}
		if !sleep(ph.ctx, backoff(failures)) {
			return
		}
	}
}

// backoff is how long a phone waits to connect again: half a second after a
// stream that simply ended, as Podium asks, and longer for every time in a row
// it could not get one, up to half a minute. Never exactly that, so a room
// that lost its streams together does not come back together.
func backoff(failures int) time.Duration {
	d := min(500*time.Millisecond<<min(failures, 6), 30*time.Second)
	return d/2 + time.Duration(rand.Int64N(int64(d)))
}

// push hands the phone's worker what the screen just did, in place of
// anything it has not got to yet. Only the stream calls it, one at a time.
func (ph *phone) push(st liveState) {
	select {
	case ph.states <- st:
	default:
		select {
		case <-ph.states:
		default:
		}
		ph.states <- st
	}
}

// work is the phone's mind: it looks at each new screen and answers when it
// means to.
func (ph *phone) work() {
	var timer *time.Timer
	var fire <-chan time.Time
	var armed *plan
	defer func() {
		if timer != nil {
			timer.Stop()
		}
		ph.letGo()
	}()
	for {
		select {
		case <-ph.ctx.Done():
			return
		case st := <-ph.states:
			ph.see(st)
		case <-fire:
			ph.answer()
		}
		if ph.plan != armed {
			if timer != nil {
				timer.Stop()
				timer, fire = nil, nil
			}
			if ph.plan != nil {
				timer = time.NewTimer(time.Until(ph.plan.at))
				fire = timer.C
			}
			armed = ph.plan
		}
	}
}

func (ph *phone) see(st liveState) {
	r := ph.run
	if st.Slide == nil || len(st.Slide.Options) == 0 {
		ph.letGo()
		return
	}
	// As the page does: what is on screen comes with the push, and whether
	// this phone has answered it from the ballot, a moment after.
	ctx, cancel := context.WithTimeout(ph.ctx, 15*time.Second)
	defer cancel()
	b, err := r.podium.ballot(ctx, ph.client, r.code)
	if err != nil {
		if ph.ctx.Err() == nil {
			r.trouble(err)
		}
		return
	}
	if b.Question == nil || b.Question.SlideID != st.Slide.ID {
		return // the screen has moved on since; the next push says where to
	}
	ph.consider(*b.Question, b.Voted, st.Slide.Total)
}

// consider decides what to do about the question on screen, given whether
// Podium has an answer from this phone, and how many it has from everyone.
func (ph *phone) consider(q question, voted *string, total int) {
	r := ph.run
	if ph.plan != nil && ph.plan.q.SlideID != q.SlideID {
		ph.letGo()
	}
	if voted != nil {
		ph.plan = nil
		ph.done[q.SlideID] = *voted
		r.voted(ph.n, q, *voted)
		return
	}
	// Podium has no answer from it. If it had one, the votes were reset.
	if _, had := ph.done[q.SlideID]; had {
		delete(ph.done, q.SlideID)
		r.lost(ph.n, q)
	}
	if ph.passed[q.SlideID] {
		// A phone that let it go lets it go, unless nobody has an answer on
		// it any more, which is a reset too, and everybody's second chance.
		if total > 0 {
			return
		}
		delete(ph.passed, q.SlideID)
	}
	if ph.plan != nil {
		return
	}
	if rand.Float64() >= r.tempo.Turnout {
		ph.passed[q.SlideID] = true
		r.passes(ph.n, q)
		return
	}
	ph.plan = &plan{q: q, option: pick(r.lean(q), q.Options), at: time.Now().Add(r.tempo.delay())}
	r.waits(ph.n, q)
}

// letGo drops an answer the phone was about to give.
func (ph *phone) letGo() {
	if ph.plan != nil {
		ph.run.gaveUp(ph.n, ph.plan.q.SlideID)
		ph.plan = nil
	}
}

func (ph *phone) answer() {
	p := ph.plan
	ph.plan = nil
	r := ph.run
	ctx, cancel := context.WithTimeout(ph.ctx, 15*time.Second)
	defer cancel()
	err := r.podium.vote(ctx, ph.client, r.code, p.option)
	switch {
	case err == nil:
		ph.done[p.q.SlideID] = p.option
		r.voted(ph.n, p.q, p.option)
	case isCode(err, "already_voted"):
		// Podium has one from this phone already; the next look says which.
		ph.done[p.q.SlideID] = ""
		r.gaveUp(ph.n, p.q.SlideID)
	case isCode(err, "not_open"):
		// The question went before the answer got there.
		r.gaveUp(ph.n, p.q.SlideID)
	default:
		r.gaveUp(ph.n, p.q.SlideID)
		if ph.ctx.Err() == nil {
			r.trouble(err)
		}
	}
}

// sleep waits [d], or less if [ctx] ends first, and says whether it waited.
func sleep(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}
