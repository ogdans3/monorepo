package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakePodium is Podium as far as a phone and the admin's sign-in can tell:
// the ballot, the vote, the phone's stream, and the admin's three calls.
type fakePodium struct {
	mu       sync.Mutex
	code     string
	title    string
	slides   int
	live     *liveSlide
	index    int
	votes    map[string]map[string]string // slide → voter → option
	attempts map[string]int               // slide → votes asked for
	streams  map[chan []byte]bool
	phones   int
	gone     bool
	voterN   int
	srv      *httptest.Server
}

const (
	fakeCode     = "TEST1"
	fakePassword = "riktig passord"
	fakeSession  = "4102444800.signature"
)

func newFake(t *testing.T) *fakePodium {
	f := &fakePodium{
		code: fakeCode, title: "Prøven", slides: 9,
		votes: map[string]map[string]string{}, attempts: map[string]int{}, streams: map[chan []byte]bool{},
	}
	m := http.NewServeMux()
	m.HandleFunc("GET /api/stem/{code}", f.ballot)
	m.HandleFunc("POST /api/stem/{code}", f.vote)
	m.HandleFunc("GET /api/live/{code}/events", f.events)
	m.HandleFunc("POST /api/admin/login", f.login)
	m.HandleFunc("GET /api/admin/me", f.me)
	m.HandleFunc("GET /api/admin/presentations", f.presentations)
	f.srv = httptest.NewServer(m)
	t.Cleanup(func() {
		f.cut()
		f.srv.Close()
	})
	return f
}

func (f *fakePodium) client() *podium { return newPodium(f.srv.URL) }

func (f *fakePodium) send(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func (f *fakePodium) refuse(w http.ResponseWriter, status int, code string) {
	f.send(w, status, map[string]string{"error": code, "message": "Nei: " + code})
}

// voter is Podium's: the phone's cookie, or a new one.
func (f *fakePodium) voter(w http.ResponseWriter, r *http.Request) string {
	if c, err := r.Cookie("podium_voter"); err == nil && len(c.Value) >= 16 {
		return c.Value
	}
	f.voterN++
	id := fmt.Sprintf("voter-%016d", f.voterN)
	http.SetCookie(w, &http.Cookie{Name: "podium_voter", Value: id, Path: "/"})
	return id
}

func (f *fakePodium) here(r *http.Request) bool {
	return !f.gone && r.PathValue("code") == f.code
}

func (f *fakePodium) ballot(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	me := f.voter(w, r)
	if !f.here(r) {
		f.refuse(w, http.StatusNotFound, "not_found")
		return
	}
	b := ballot{Title: f.title, Code: f.code, Marks: "letters", Live: f.live != nil}
	if f.live != nil && len(f.live.Options) > 0 {
		b.Question = &question{SlideID: f.live.ID, Title: f.live.Title, Options: f.live.Options}
		if o, ok := f.votes[f.live.ID][me]; ok {
			b.Voted = &o
		}
	}
	f.send(w, http.StatusOK, b)
}

func (f *fakePodium) vote(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	me := f.voter(w, r)
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		f.refuse(w, http.StatusUnsupportedMediaType, "not_json")
		return
	}
	var body struct {
		OptionID string `json:"optionId"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if !f.here(r) {
		f.refuse(w, http.StatusNotFound, "not_found")
		return
	}
	if f.live == nil {
		f.refuse(w, http.StatusConflict, "not_open")
		return
	}
	f.attempts[f.live.ID]++
	found := false
	for _, o := range f.live.Options {
		found = found || o.ID == body.OptionID
	}
	if !found {
		f.refuse(w, http.StatusConflict, "not_open")
		return
	}
	if f.votes[f.live.ID] == nil {
		f.votes[f.live.ID] = map[string]string{}
	}
	if _, ok := f.votes[f.live.ID][me]; ok {
		f.refuse(w, http.StatusConflict, "already_voted")
		return
	}
	f.votes[f.live.ID][me] = body.OptionID
	f.send(w, http.StatusOK, map[string]string{"voted": body.OptionID})
}

// state is what Podium pushes when the screen changes. The caller holds mu.
func (f *fakePodium) state() []byte {
	st := liveState{Title: f.title, Code: f.code, Marks: "letters", Count: f.slides}
	if f.live != nil {
		s := *f.live
		s.Total = len(f.votes[s.ID])
		st.Slide, st.Index = &s, f.index
	}
	b, _ := json.Marshal(st)
	return []byte("event: state\ndata: " + string(b) + "\n\n")
}

func (f *fakePodium) publish(frame []byte) {
	for ch := range f.streams {
		select {
		case ch <- frame:
		default:
		}
	}
}

func (f *fakePodium) events(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	if !f.here(r) {
		f.refuse(w, http.StatusNotFound, "not_found")
		f.mu.Unlock()
		return
	}
	_, phone := r.URL.Query()["ballot"]
	ch := make(chan []byte, 16)
	f.streams[ch] = true
	if phone {
		f.phones++
	}
	first := f.state()
	f.mu.Unlock()
	defer func() {
		f.mu.Lock()
		delete(f.streams, ch)
		if phone {
			f.phones--
		}
		f.mu.Unlock()
	}()

	w.Header().Set("Content-Type", "text/event-stream")
	w.WriteHeader(http.StatusOK)
	io.WriteString(w, "retry: 500\n\n: a comment, which is nothing\n\n")
	w.Write(first)
	w.(http.Flusher).Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case frame, ok := <-ch:
			if !ok {
				return
			}
			w.Write(frame)
			w.(http.Flusher).Flush()
		}
	}
}

func (f *fakePodium) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Password != fakePassword {
		f.refuse(w, http.StatusUnauthorized, "wrong_password")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: adminCookie, Value: fakeSession, Path: "/", Expires: time.Unix(4102444800, 0)})
	f.send(w, http.StatusOK, map[string]bool{"admin": true})
}

func (f *fakePodium) isAdmin(r *http.Request) bool {
	c, err := r.Cookie(adminCookie)
	return err == nil && c.Value == fakeSession
}

func (f *fakePodium) me(w http.ResponseWriter, r *http.Request) {
	f.send(w, http.StatusOK, map[string]bool{"admin": f.isAdmin(r)})
}

func (f *fakePodium) presentations(w http.ResponseWriter, r *http.Request) {
	if !f.isAdmin(r) {
		f.refuse(w, http.StatusUnauthorized, "not_signed_in")
		return
	}
	live := "x"
	f.send(w, http.StatusOK, map[string]any{"presentations": []presentation{
		{Title: "Gammel", Code: "OLD11", SlideCount: 3},
		{Title: f.title, Code: f.code, LiveSlideID: &live, SlideCount: f.slides},
	}})
}

// show puts a slide on the screen, a question if it has answers.
func (f *fakePodium) show(id, title string, answers ...string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	s := &liveSlide{ID: id, Title: title, Options: []option{}}
	for i, a := range answers {
		s.Options = append(s.Options, option{ID: fmt.Sprintf("%s-%d", id, i), Label: a, Color: "#D0273A"})
	}
	f.live = s
	f.index++
	f.publish(f.state())
}

// reset takes every vote off the slide on screen, and says so, as Podium does.
func (f *fakePodium) reset() {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.votes, f.live.ID)
	f.publish(f.state())
}

// cut ends every stream, as the proxy in production does every two minutes.
func (f *fakePodium) cut() {
	f.mu.Lock()
	defer f.mu.Unlock()
	for ch := range f.streams {
		close(ch)
		delete(f.streams, ch)
	}
}

// remove deletes the presentation while the phones are on it.
func (f *fakePodium) remove() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.publish([]byte(`event: state` + "\n" + `data: {"ended":true}` + "\n\n"))
	f.gone = true
}

func (f *fakePodium) count(what func() int) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return what()
}

func (f *fakePodium) openPhones() int { return f.count(func() int { return f.phones }) }
func (f *fakePodium) voters(slide string) int {
	return f.count(func() int { return len(f.votes[slide]) })
}
func (f *fakePodium) tries(slide string) int {
	return f.count(func() int { return f.attempts[slide] })
}

func eventually(t *testing.T, within time.Duration, what string, ok func() bool) {
	t.Helper()
	end := time.Now().Add(within)
	for !ok() {
		if time.Now().After(end) {
			t.Fatalf("waited %s for %s", within, what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

// quick is a room that answers at once, every one of it.
var quick = tempo{Join: 50 * time.Millisecond, First: 5 * time.Millisecond, Median: 20 * time.Millisecond, Spread: 0.3, Last: 100 * time.Millisecond, Turnout: 1}

func start(t *testing.T, f *fakePodium, phones int, pace tempo) *run {
	t.Helper()
	r := newRun(f.client(), quiet, fakeCode, "test", pace, "", "")
	t.Cleanup(func() { r.stop("Ferdig.") })
	r.resize(phones)
	eventually(t, 5*time.Second, "every phone to connect", func() bool {
		return f.openPhones() == phones && r.view().Connected == phones
	})
	return r
}

func TestEveryPhoneAnswersEachQuestionOnce(t *testing.T) {
	f := newFake(t)
	r := start(t, f, 20, quick)

	f.show("a", "Er vi fucked?", "Ja", "Nei", "Kanskje")
	eventually(t, 5*time.Second, "20 votes on a", func() bool { return f.voters("a") == 20 })
	f.show("b", "Kaffe?", "Ja", "Nei")
	eventually(t, 5*time.Second, "20 votes on b", func() bool { return f.voters("b") == 20 })

	if f.tries("a") != 20 || f.tries("b") != 20 {
		t.Errorf("a phone asked to vote twice: %d on a and %d on b", f.tries("a"), f.tries("b"))
	}
	v := r.view()
	if v.Screen == nil || v.Screen.Question == nil || v.Screen.Question.Title != "Kaffe?" {
		t.Fatalf("the page is not shown the question on screen: %+v", v.Screen)
	}
	q, sum := v.Screen.Question, 0
	for _, o := range q.Options {
		sum += o.Votes
	}
	if q.Voted != 20 || sum != 20 || q.Waiting != 0 || q.Passed != 0 {
		t.Errorf("the tally is %d voted (%d in the answers), %d waiting, %d passed; want 20, 20, 0, 0", q.Voted, sum, q.Waiting, q.Passed)
	}
	if !logged(v, "«Er vi fucked?»: alle 20 svarte.") {
		t.Errorf("the log does not say how the question went: %+v", v.Log)
	}

	r.stop("Stoppet.")
	eventually(t, 5*time.Second, "the phones to leave", func() bool { return f.openPhones() == 0 })
}

func TestAnAnswerNotYetGivenIsLetGoWhenTheQuestionGoes(t *testing.T) {
	f := newFake(t)
	slow := tempo{Join: 10 * time.Millisecond, First: 400 * time.Millisecond, Median: 10 * time.Millisecond, Spread: 0.1, Last: 500 * time.Millisecond, Turnout: 1}
	r := start(t, f, 10, slow)

	f.show("a", "Rask?", "Ja", "Nei")
	eventually(t, 2*time.Second, "every phone to mean to answer", func() bool {
		v := r.view()
		return v.Screen != nil && v.Screen.Question != nil && v.Screen.Question.Waiting == 10
	})
	f.show("text", "Bare tekst")
	time.Sleep(700 * time.Millisecond)

	if n := f.tries("a"); n != 0 {
		t.Errorf("%d phones answered a question that had gone", n)
	}
	v := r.view()
	if v.Screen == nil || v.Screen.Question != nil {
		t.Errorf("the page shows a question while a text slide is up: %+v", v.Screen)
	}
	if !logged(v, "«Rask?»: 0 svarte, 10 rakk det ikke.") {
		t.Errorf("the log does not say the question went before the room answered: %+v", v.Log)
	}
}

func TestPhonesComeBackWhenTheirStreamEnds(t *testing.T) {
	f := newFake(t)
	r := start(t, f, 15, quick)

	f.cut()
	eventually(t, 5*time.Second, "every phone to be back", func() bool {
		return f.openPhones() == 15 && r.view().Connected == 15
	})
	f.show("a", "Tilbake?", "Ja", "Nei")
	eventually(t, 5*time.Second, "15 votes", func() bool { return f.voters("a") == 15 })
}

func TestTheRoomAnswersAgainAfterAReset(t *testing.T) {
	f := newFake(t)
	r := start(t, f, 12, quick)

	f.show("a", "Igjen?", "Ja", "Nei")
	eventually(t, 5*time.Second, "12 votes", func() bool { return f.voters("a") == 12 })
	f.reset()
	eventually(t, 5*time.Second, "12 votes again", func() bool { return f.voters("a") == 12 && f.tries("a") == 24 })
	eventually(t, 2*time.Second, "the log to say", func() bool {
		return logged(r.view(), "Stemmene på «Igjen?» ble nullstilt. Telefonene svarer på nytt.")
	})
}

func TestSomeOfTheRoomLetsAQuestionGoBy(t *testing.T) {
	f := newFake(t)
	half := quick
	half.Turnout = 0.5
	r := start(t, f, 200, half)

	f.show("a", "Halvparten?", "Ja", "Nei")
	eventually(t, 5*time.Second, "everyone to have decided", func() bool {
		q := r.view().Screen.Question
		return q != nil && q.Waiting == 0 && q.Voted+q.Passed == 200
	})
	q := r.view().Screen.Question
	// Two hundred coin tosses: outside 60 to 140 is a one in a hundred
	// million chance, so this is a broken turnout, not bad luck.
	if q.Voted < 60 || q.Voted > 140 || f.voters("a") != q.Voted {
		t.Errorf("%d of 200 voted, and Podium has %d; want about half, and the same", q.Voted, f.voters("a"))
	}
}

func TestADeletedPresentationEndsTheRun(t *testing.T) {
	f := newFake(t)
	r := start(t, f, 5, quick)

	f.remove()
	eventually(t, 5*time.Second, "the run to stop", r.isStopped)
	if v := r.view(); v.Stopped != "Presentasjonen ble slettet." {
		t.Errorf("stopped for %q", v.Stopped)
	}
	eventually(t, 5*time.Second, "the phones to leave", func() bool { return f.openPhones() == 0 })
}

func TestTheRoomLeansTheWayItsLeanSays(t *testing.T) {
	options := []option{{ID: "a"}, {ID: "b"}}
	lean := map[string]float64{"a": 3, "b": 1}
	a := 0
	for range 20000 {
		if pick(lean, options) == "a" {
			a++
		}
	}
	if share := float64(a) / 20000; math.Abs(share-0.75) > 0.02 {
		t.Errorf("a was picked %.3f of the time; want 0.75", share)
	}
}

func TestReadEventsReadsWhatPodiumSends(t *testing.T) {
	stream := "retry: 500\n\n: comment\n\nid: 1.2\nevent: state\ndata: {\"a\":\ndata: 1}\n\nevent: ping\ndata: {}\n\n\n"
	var got []string
	readEvents(strings.NewReader(stream), func(event string, data []byte) {
		got = append(got, event+" "+string(data))
	})
	want := []string{"state {\"a\":\n1}", "ping {}"}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("got %q, want %q", got, want)
	}
}

func logged(v runView, text string) bool {
	for _, l := range v.Log {
		if l.Text == text {
			return true
		}
	}
	return false
}

// The server: signing in is Podium's, and only its admin starts a room.
func TestOnlyPodiumsAdminStartsARoom(t *testing.T) {
	f := newFake(t)
	s := newServer(f.client(), quiet)
	h := s.routes()
	t.Cleanup(func() { s.stopAll("Ferdig.") })

	do := func(method, path, contentType, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		if contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
		if cookie != nil {
			req.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		return w
	}

	if w := do("POST", "/api/login", "application/json", `{"password":"feil"}`, nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("a wrong password: %d", w.Code)
	}
	w := do("POST", "/api/login", "application/json", `{"password":"`+fakePassword+`"}`, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("the right password: %d %s", w.Code, w.Body)
	}
	var session *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == sessionCookie {
			session = c
		}
	}
	if session == nil || session.Value != fakeSession || !session.HttpOnly || session.SameSite != http.SameSiteStrictMode {
		t.Fatalf("the session cookie is %+v", session)
	}

	if w := do("GET", "/api/runs", "", "", nil); w.Code != http.StatusUnauthorized {
		t.Errorf("runs without signing in: %d", w.Code)
	}
	if w := do("GET", "/api/runs", "", "", &http.Cookie{Name: sessionCookie, Value: "4102444800.forged"}); w.Code != http.StatusUnauthorized {
		t.Errorf("runs with a session Podium does not know: %d", w.Code)
	}
	if w := do("POST", "/api/runs", "text/plain", `{"code":"TEST1","phones":3,"pace":"lynrask"}`, session); w.Code != http.StatusUnsupportedMediaType {
		t.Errorf("a start that is not JSON: %d", w.Code)
	}
	if w := do("POST", "/api/runs", "application/json", `{"code":"NOPE9","phones":3,"pace":"lynrask"}`, session); w.Code != http.StatusNotFound {
		t.Errorf("a start for a code that is not there: %d", w.Code)
	}
	if w := do("POST", "/api/runs", "application/json", `{"code":"TEST1","phones":301,"pace":"lynrask"}`, session); w.Code != http.StatusBadRequest {
		t.Errorf("a start with too many phones: %d", w.Code)
	}

	w = do("GET", "/api/presentations", "", "", session)
	var list struct {
		Presentations []struct {
			Code string `json:"code"`
			Live bool   `json:"live"`
		} `json:"presentations"`
	}
	json.NewDecoder(w.Body).Decode(&list)
	if len(list.Presentations) != 2 || list.Presentations[0].Code != fakeCode || !list.Presentations[0].Live {
		t.Errorf("the presentations, the live one first: %+v", list.Presentations)
	}

	if w := do("POST", "/api/runs", "application/json", `{"code":"test1","phones":3,"pace":"lynrask"}`, session); w.Code != http.StatusCreated {
		t.Fatalf("a start: %d %s", w.Code, w.Body)
	}
	eventually(t, 5*time.Second, "three phones", func() bool { return f.openPhones() == 3 })
	if w := do("PATCH", "/api/runs/TEST1", "application/json", `{"phones":5}`, session); w.Code != http.StatusOK {
		t.Errorf("more phones: %d", w.Code)
	}
	eventually(t, 5*time.Second, "five phones", func() bool { return f.openPhones() == 5 })

	if w := do("DELETE", "/api/runs/TEST1", "", "", session); w.Code != http.StatusNoContent {
		t.Errorf("a stop: %d", w.Code)
	}
	eventually(t, 5*time.Second, "no phones", func() bool { return f.openPhones() == 0 })
	w = do("GET", "/api/runs", "", "", session)
	if !strings.Contains(w.Body.String(), `"stopped":"Stoppet."`) {
		t.Errorf("a stopped run says why: %s", w.Body)
	}
	if w := do("DELETE", "/api/runs/TEST1", "", "", session); w.Code != http.StatusNoContent {
		t.Errorf("taking a stopped run away: %d", w.Code)
	}
	if w := do("GET", "/api/runs", "", "", session); !strings.Contains(w.Body.String(), `"runs":[]`) {
		t.Errorf("a run taken away is gone: %s", w.Body)
	}
}
