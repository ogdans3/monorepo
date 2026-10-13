package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed ui
var uiFiles embed.FS

// sessionCookie holds Podium's admin session, for this site only.
const sessionCookie = "testpublikum_session"

// trustFor is how long Podium's word that a session is its admin's is taken
// before it is asked again. The page asks for news every second, and Podium
// need not be asked every second too.
const trustFor = 5 * time.Minute

var codePattern = regexp.MustCompile(`^[A-Z0-9]{3,12}$`)

type server struct {
	podium *podium
	log    *slog.Logger

	mu   sync.Mutex
	runs map[string]*run

	tmu     sync.Mutex
	trusted map[string]time.Time
}

func newServer(p *podium, log *slog.Logger) *server {
	return &server{podium: p, log: log, runs: map[string]*run{}, trusted: map[string]time.Time{}}
}

func (s *server) routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})
	m.HandleFunc("POST /api/login", s.login)
	m.HandleFunc("POST /api/logout", s.logout)
	m.HandleFunc("GET /api/me", s.me)
	m.HandleFunc("GET /api/presentations", s.signedIn(s.listPresentations))
	m.HandleFunc("GET /api/runs", s.signedIn(s.listRuns))
	m.HandleFunc("POST /api/runs", s.signedIn(s.startRun))
	m.HandleFunc("PATCH /api/runs/{code}", s.signedIn(s.resizeRun))
	m.HandleFunc("DELETE /api/runs/{code}", s.signedIn(s.stopRun))

	ui, _ := fs.Sub(uiFiles, "ui")
	files := http.FileServerFS(ui)
	m.Handle("GET /", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Small files, and changed by every deploy: always asked about.
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	}))
	return headers(m)
}

// headers are what every answer says about itself: what it is, and that it
// is not to be framed, sniffed, or given scripts from anywhere else.
func headers(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "same-origin")
		h.Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
		next.ServeHTTP(w, r)
	})
}

// secure says whether a cookie can be marked Secure: on HTTPS, which behind a
// proxy is what the proxy says it was.
func secure(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	session, expires, err := s.podium.signIn(ctx, body.Password)
	if isStatus(err, http.StatusUnauthorized) {
		fail(w, http.StatusUnauthorized, "wrong_password", "Feil passord.")
		return
	}
	if err != nil {
		s.log.Warn("sign in", "err", err)
		fail(w, http.StatusBadGateway, "podium_down", "Får ikke kontakt med Podium akkurat nå.")
		return
	}
	s.trust(session)
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: session, Path: "/", Expires: expires,
		HttpOnly: true, Secure: secure(r), SameSite: http.SameSiteStrictMode,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"signedIn": true})
}

func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		s.tmu.Lock()
		delete(s.trusted, c.Value)
		s.tmu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: secure(r), SameSite: http.SameSiteStrictMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

// me says whether this browser is signed in, and what the page needs to
// know besides: where Podium is, for the links to its screen and its ballot,
// and the tempos a room can answer in.
func (s *server) me(w http.ResponseWriter, r *http.Request) {
	_, err := s.session(r)
	if err != nil && !errors.Is(err, errSignedOut) {
		fail(w, http.StatusBadGateway, "podium_down", "Får ikke kontakt med Podium akkurat nå.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"signedIn": err == nil, "podium": s.podium.base, "paces": paces, "maxPhones": maxPhones,
	})
}

var errSignedOut = errors.New("signed out")

// session is this browser's Podium session, if Podium says it is its admin's.
func (s *server) session(r *http.Request) (string, error) {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return "", errSignedOut
	}
	// Podium's session starts with when it runs out: one that has is out
	// without asking.
	if at, _, ok := strings.Cut(c.Value, "."); ok {
		if expiry, err := strconv.ParseInt(at, 10, 64); err == nil && time.Now().Unix() > expiry {
			return "", errSignedOut
		}
	}
	s.tmu.Lock()
	seen, ok := s.trusted[c.Value]
	s.tmu.Unlock()
	if ok && time.Since(seen) < trustFor {
		return c.Value, nil
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	admin, err := s.podium.isAdmin(ctx, c.Value)
	if err != nil {
		return "", err
	}
	if !admin {
		return "", errSignedOut
	}
	s.trust(c.Value)
	return c.Value, nil
}

func (s *server) trust(session string) {
	s.tmu.Lock()
	defer s.tmu.Unlock()
	now := time.Now()
	for k, at := range s.trusted {
		if now.Sub(at) > trustFor {
			delete(s.trusted, k)
		}
	}
	s.trusted[session] = now
}

// signedIn guards a handler: Podium's admin, or a 401 the page turns into
// the sign-in.
func (s *server) signedIn(h func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, err := s.session(r)
		if errors.Is(err, errSignedOut) {
			fail(w, http.StatusUnauthorized, "not_signed_in", "Logg inn først.")
			return
		}
		if err != nil {
			s.log.Warn("session", "err", err)
			fail(w, http.StatusBadGateway, "podium_down", "Får ikke kontakt med Podium akkurat nå.")
			return
		}
		h(w, r, session)
	}
}

func (s *server) listPresentations(w http.ResponseWriter, r *http.Request, session string) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	list, err := s.podium.presentations(ctx, session)
	if err != nil {
		s.log.Warn("presentations", "err", err)
		fail(w, http.StatusBadGateway, "podium_down", "Får ikke kontakt med Podium akkurat nå.")
		return
	}
	type item struct {
		Title  string `json:"title"`
		Code   string `json:"code"`
		Live   bool   `json:"live"`
		Slides int    `json:"slides"`
	}
	out := make([]item, 0, len(list))
	for _, p := range list {
		out = append(out, item{Title: p.Title, Code: p.Code, Live: p.LiveSlideID != nil, Slides: p.SlideCount})
	}
	// The one that is running first: it is the one to test. After that,
	// Podium's own order, the latest change first.
	sort.SliceStable(out, func(i, j int) bool { return out[i].Live && !out[j].Live })
	writeJSON(w, http.StatusOK, map[string]any{"presentations": out})
}

func (s *server) listRuns(w http.ResponseWriter, r *http.Request, _ string) {
	s.mu.Lock()
	runs := make([]*run, 0, len(s.runs))
	for code, rn := range s.runs {
		// A stopped run is kept a while, so the page can say why it stopped.
		if rn.isStopped() && time.Since(rn.started) > 6*time.Hour {
			delete(s.runs, code)
			continue
		}
		runs = append(runs, rn)
	}
	s.mu.Unlock()
	sort.Slice(runs, func(i, j int) bool { return runs[i].started.After(runs[j].started) })
	out := make([]runView, 0, len(runs))
	for _, rn := range runs {
		out = append(out, rn.view())
	}
	writeJSON(w, http.StatusOK, map[string]any{"runs": out})
}

func (s *server) startRun(w http.ResponseWriter, r *http.Request, _ string) {
	var body struct {
		Code   string `json:"code"`
		Phones int    `json:"phones"`
		Pace   string `json:"pace"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	code := strings.ToUpper(strings.TrimSpace(body.Code))
	if !codePattern.MatchString(code) {
		fail(w, http.StatusBadRequest, "bad_code", "Velg en presentasjon.")
		return
	}
	if body.Phones < 1 || body.Phones > maxPhones {
		fail(w, http.StatusBadRequest, "bad_phones", fmt.Sprintf("Velg mellom 1 og %d telefoner.", maxPhones))
		return
	}
	pc, ok := paceNamed(body.Pace)
	if !ok {
		fail(w, http.StatusBadRequest, "bad_pace", "Velg et tempo.")
		return
	}
	// Whether it is there, the way a phone finds out.
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	b, err := s.podium.ballot(ctx, s.podium.phone(), code)
	if isStatus(err, http.StatusNotFound) {
		fail(w, http.StatusNotFound, "not_found", fmt.Sprintf("Fant ingen presentasjon med koden %s.", code))
		return
	}
	if err != nil {
		s.log.Warn("ballot", "err", err)
		fail(w, http.StatusBadGateway, "podium_down", "Får ikke kontakt med Podium akkurat nå.")
		return
	}

	rn := newRun(s.podium, s.log, code, pc.Name, pc.tempo, b.Title, b.Marks)
	s.mu.Lock()
	old := s.runs[code]
	s.runs[code] = rn
	s.mu.Unlock()
	if old != nil {
		old.stop("Byttet ut med en ny test.")
	}
	rn.note(fmt.Sprintf("Startet med %d telefoner, i tempoet %s.", body.Phones, strings.ToLower(pc.Label)))
	rn.resize(body.Phones)
	s.log.Info("started", "code", code, "phones", body.Phones, "pace", body.Pace)
	writeJSON(w, http.StatusCreated, rn.view())
}

func (s *server) runFor(w http.ResponseWriter, r *http.Request) *run {
	s.mu.Lock()
	rn := s.runs[strings.ToUpper(r.PathValue("code"))]
	s.mu.Unlock()
	if rn == nil {
		fail(w, http.StatusNotFound, "not_found", "Den testen finnes ikke lenger.")
	}
	return rn
}

func (s *server) resizeRun(w http.ResponseWriter, r *http.Request, _ string) {
	var body struct {
		Phones int `json:"phones"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.Phones < 1 || body.Phones > maxPhones {
		fail(w, http.StatusBadRequest, "bad_phones", fmt.Sprintf("Velg mellom 1 og %d telefoner.", maxPhones))
		return
	}
	rn := s.runFor(w, r)
	if rn == nil {
		return
	}
	if rn.isStopped() {
		fail(w, http.StatusConflict, "stopped", "Testen er stoppet.")
		return
	}
	rn.resize(body.Phones)
	writeJSON(w, http.StatusOK, rn.view())
}

// stopRun stops a run, or takes away one that has stopped already.
func (s *server) stopRun(w http.ResponseWriter, r *http.Request, _ string) {
	rn := s.runFor(w, r)
	if rn == nil {
		return
	}
	if !rn.isStopped() {
		rn.stop("Stoppet.")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	s.mu.Lock()
	if s.runs[rn.code] == rn {
		delete(s.runs, rn.code)
	}
	s.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) stopAll(why string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, rn := range s.runs {
		rn.stop(why)
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

// fail answers with a code to switch on and a sentence to show, as Podium does.
func fail(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}

// readJSON reads a small JSON body, and only one that says it is JSON: with
// the session cookie SameSite=Strict besides, a form on another site has no
// way in.
func readJSON(w http.ResponseWriter, r *http.Request, into any) bool {
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		fail(w, http.StatusUnsupportedMediaType, "not_json", "Forespørselen må være JSON.")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	if err := json.NewDecoder(r.Body).Decode(into); err != nil {
		fail(w, http.StatusBadRequest, "bad_request", "Forespørselen kunne ikke leses.")
		return false
	}
	return true
}
