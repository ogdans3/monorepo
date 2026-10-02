package app

// The API end to end, over HTTP, against a real Postgres: the unique vote, the
// cascade that takes votes with an answer and the positions a slide keeps are
// the database's behaviour, and a mock would only test the mock.

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const password = "riktig-passord"

var testDB *pgxpool.Pool

// TestMain refuses any database that does not say it is for tests, since
// every test empties it.
func TestMain(m *testing.M) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://podium:podium@127.0.0.1:5452/podium_test"
	}
	if !strings.Contains(dsn[strings.LastIndex(dsn, "/"):], "test") {
		panic("TEST_DATABASE_URL must name a database with «test» in it: the tests empty it")
	}
	if err := ensureDatabase(dsn); err != nil {
		panic(err)
	}
	var err error
	testDB, err = Connect(context.Background(), dsn)
	if err != nil {
		panic(err)
	}
	code := m.Run()
	testDB.Close()
	os.Exit(code)
}

// ensureDatabase makes the test database the first time, beside the
// development one, so that `go test ./...` is all a fresh clone needs.
func ensureDatabase(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	name := strings.TrimPrefix(u.Path, "/")
	u.Path = "/postgres"
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, u.String())
	if err != nil {
		return err
	}
	defer conn.Close(ctx)
	var exists bool
	if err := conn.QueryRow(ctx, `select exists (select 1 from pg_database where datname = $1)`, name).Scan(&exists); err != nil || exists {
		return err
	}
	_, err = conn.Exec(ctx, `create database `+pgx.Identifier{name}.Sanitize())
	return err
}

type env struct {
	t     *testing.T
	srv   *httptest.Server
	admin *http.Client
	media string
}

func setup(t *testing.T) *env {
	t.Helper()
	if _, err := testDB.Exec(context.Background(), `truncate presentations, media, slides, options, votes cascade`); err != nil {
		t.Fatal(err)
	}
	media := t.TempDir()
	cfg := Config{DatabaseURL: "test", MediaDir: media, AdminPassword: password, MaxUploadBytes: 1 << 20}
	srv := httptest.NewServer(NewServer(cfg, testDB, nil, slog.New(slog.NewTextHandler(io.Discard, nil))))
	t.Cleanup(srv.Close)
	e := &env{t: t, srv: srv, admin: phone(), media: media}
	if st, _ := e.call(e.admin, "POST", "/api/admin/login", map[string]string{"password": password}, nil); st != 200 {
		t.Fatalf("login: %d", st)
	}
	return e
}

// phone is a client with a cookie jar of its own: one voter.
func phone() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar, Timeout: 10 * time.Second}
}

func (e *env) call(c *http.Client, method, path string, body any, into any) (int, map[string]any) {
	e.t.Helper()
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, r)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var generic map[string]any
	json.Unmarshal(raw, &generic)
	if into != nil {
		json.Unmarshal(raw, into)
	}
	return res.StatusCode, generic
}

type presentationBody struct {
	Presentation Presentation `json:"presentation"`
}

func (e *env) newPresentation(title string) Presentation {
	var out presentationBody
	if st, _ := e.call(e.admin, "POST", "/api/admin/presentations", map[string]string{"title": title}, &out); st != 201 {
		e.t.Fatalf("create: %d", st)
	}
	return out.Presentation
}

func (e *env) get(id string) Presentation {
	var out presentationBody
	e.call(e.admin, "GET", "/api/admin/presentations/"+id, nil, &out)
	return out.Presentation
}

func (e *env) addSlide(id, kind string) Slide {
	var made struct{ ID string }
	if st, _ := e.call(e.admin, "POST", "/api/admin/presentations/"+id+"/slides", map[string]string{"kind": kind}, &made); st != 201 {
		e.t.Fatalf("add slide: %d", st)
	}
	for _, s := range e.get(id).Slides {
		if s.ID == made.ID {
			return s
		}
	}
	e.t.Fatal("the new slide is not in the presentation")
	return Slide{}
}

func TestAdminIsBehindThePassword(t *testing.T) {
	e := setup(t)
	stranger := phone()
	if st, _ := e.call(stranger, "GET", "/api/admin/presentations", nil, nil); st != 401 {
		t.Fatalf("without the cookie: %d", st)
	}
	if st, body := e.call(stranger, "POST", "/api/admin/login", map[string]string{"password": "feil"}, nil); st != 401 || body["message"] != "Feil passord." {
		t.Fatalf("wrong password: %d %v", st, body)
	}
	if st, _ := e.call(e.admin, "GET", "/api/admin/presentations", nil, nil); st != 200 {
		t.Fatalf("signed in: %d", st)
	}
	// A cookie made up by hand is not a session.
	forged := phone()
	u, _ := url.Parse(e.srv.URL)
	forged.Jar.SetCookies(u, []*http.Cookie{{Name: adminCookie, Value: "9999999999.deadbeef"}})
	if st, _ := e.call(forged, "GET", "/api/admin/presentations", nil, nil); st != 401 {
		t.Fatalf("a forged cookie: %d", st)
	}
}

func TestAFormOnAnotherSiteCannotPassForJSON(t *testing.T) {
	e := setup(t)
	req, _ := http.NewRequest("POST", e.srv.URL+"/api/admin/presentations", strings.NewReader(`{"title":"Fra et skjema"}`))
	req.Header.Set("Content-Type", "text/plain")
	res, err := e.admin.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 415 {
		t.Fatalf("text/plain that parses as JSON: %d", res.StatusCode)
	}
}

// codes are the QR codes on a slide.
func codes(s Slide) []Element {
	var out []Element
	for _, e := range s.Elements {
		if e.Type == "qr" {
			out = append(out, e)
		}
	}
	return out
}

func TestAPresentationOpensWithTheWayIn(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Er vi fucked?")
	if len(p.Code) != 5 || strings.ContainsAny(p.Code, "01ILO") {
		t.Fatalf("code %q", p.Code)
	}
	if p.Marks != "letters" {
		t.Fatalf("answers are marked with letters to begin with: %q", p.Marks)
	}
	// The first slide is the title and the code, big.
	if len(p.Slides) != 1 || p.Slides[0].Elements[0].Text != "Er vi fucked?" {
		t.Fatalf("slides %+v", p.Slides)
	}
	if c := codes(p.Slides[0]); len(c) != 1 || c[0].W < 20 {
		t.Fatalf("the way in has its code big: %+v", c)
	}

	q := e.addSlide(p.ID, "question")
	if q.Title != "Hva tror du?" || len(q.Options) != 2 || q.Options[0].Label != "Ja" {
		t.Fatalf("question %+v", q)
	}
	if q.Options[0].Color != answerColours[0] || q.Options[1].Color != answerColours[1] {
		t.Fatalf("the answers have the first two colours: %+v", q.Options)
	}
	// Every slide after it has the code small, in its corner.
	for _, s := range []Slide{q, e.addSlide(p.ID, "content")} {
		if c := codes(s); len(c) != 1 || c[0] != cornerCode {
			t.Fatalf("the corner code on %q: %+v", s.Title, c)
		}
	}
}

func TestAnswersHaveColoursAndMarks(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Farger")
	q := e.addSlide(p.ID, "question")
	var saved struct{ Slide Slide }
	e.call(e.admin, "PUT", "/api/admin/slides/"+q.ID, map[string]any{
		"title": "Hvilken?", "background": "#111418", "elements": q.Elements,
		"options": []map[string]any{
			{"id": q.Options[0].ID, "label": "Egen", "color": "#12ab34", "x": 10, "y": 50, "w": 20, "h": 30},
			{"id": q.Options[1].ID, "label": "Ugyldig", "color": "rød", "x": 40, "y": 50, "w": 20, "h": 30},
			{"id": "ny-1", "label": "Ingen", "x": 70, "y": 50, "w": 20, "h": 30},
		},
	}, &saved)
	got := saved.Slide.Options
	if len(got) != 3 || got[0].Color != "#12AB34" || got[1].Color != answerColours[1] || got[2].Color != answerColours[2] {
		t.Fatalf("a colour of its own, and the answers' next where it is not one: %+v", got)
	}

	if st, _ := e.call(e.admin, "PATCH", "/api/admin/presentations/"+p.ID, map[string]string{"marks": "roman"}, nil); st != 400 {
		t.Fatalf("marks are letters or numbers: %d", st)
	}
	var updated presentationBody
	e.call(e.admin, "PATCH", "/api/admin/presentations/"+p.ID, map[string]string{"marks": "numbers"}, &updated)
	if updated.Presentation.Marks != "numbers" {
		t.Fatalf("numbers: %+v", updated.Presentation)
	}
	var live liveState
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": q.ID}, &live)
	if live.Marks != "numbers" {
		t.Fatalf("the display is told the marks: %+v", live)
	}
	_, ballot := e.call(phone(), "GET", "/api/stem/"+p.Code, nil, nil)
	options := ballot["question"].(map[string]any)["options"].([]any)
	if ballot["marks"] != "numbers" || options[0].(map[string]any)["color"] != "#12AB34" {
		t.Fatalf("the phone is told the colours and the marks: %v", ballot)
	}
}

// scratchDatabase makes an empty database of its own for one test, beside the
// test database, and takes it away after.
func scratchDatabase(t *testing.T, name string) string {
	t.Helper()
	u, _ := url.Parse(testDB.Config().ConnString())
	admin := *u
	admin.Path = "/postgres"
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, admin.String())
	if err != nil {
		t.Fatal(err)
	}
	ident := pgx.Identifier{name}.Sanitize()
	conn.Exec(ctx, `drop database if exists `+ident+` with (force)`)
	if _, err := conn.Exec(ctx, `create database `+ident); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		conn.Exec(ctx, `drop database if exists `+ident+` with (force)`)
		conn.Close(ctx)
	})
	u.Path = "/" + name
	return u.String()
}

func TestOldPresentationsAreBroughtToTheWayIn(t *testing.T) {
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, scratchDatabase(t, "podium_test_migrate"))
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	// A database as the first version left it, with a presentation as the
	// first version made it.
	first, _ := migrations.ReadFile("migrations/001_init.sql")
	for _, sql := range []string{string(first),
		`create table schema_migrations (name text primary key, applied_at timestamptz not null default now())`,
		`insert into schema_migrations (name) values ('migrations/001_init.sql')`} {
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	var p, content, question string
	pool.QueryRow(ctx, `insert into presentations (title, code) values ('Gammel', 'GAMLE') returning id`).Scan(&p)
	pool.QueryRow(ctx, `insert into slides (presentation_id, position, title, elements) values ($1, 0, '', $2) returning id`, p,
		`[{"id":"heading","type":"text","x":8,"y":38,"w":84,"h":24,"text":"Overskrift","size":10,"weight":700,"align":"left"}]`).Scan(&content)
	pool.QueryRow(ctx, `insert into slides (presentation_id, position, title, elements) values ($1, 1, 'Hva tror du?', $2) returning id`, p,
		`[{"id":"q-title","type":"text","x":6,"y":8,"w":64,"h":24,"text":"Hva tror du?","size":8,"weight":700,"align":"left"},
		  {"id":"q-code","type":"qr","x":77,"y":8,"w":17,"h":44}]`).Scan(&question)
	pool.Exec(ctx, `insert into options (slide_id, position, label, x, y, w, h)
		values ($1, 0, 'Ja', 6, 42, 32, 44), ($1, 1, 'Nei', 41, 42, 32, 44)`, question)

	if err := Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	all, err := slides(ctx, pool, p)
	if err != nil || len(all) != 3 {
		t.Fatalf("three slides: %v %+v", err, all)
	}
	if c := codes(all[0]); all[0].Elements[0].Text != "Gammel" || len(c) != 1 || c[0].W != 25 {
		t.Fatalf("the way in comes first, with the title: %+v", all[0])
	}
	if all[1].ID != content || len(codes(all[1])) != 1 || codes(all[1])[0] != cornerCode {
		t.Fatalf("the old first slide is second, with the code in its corner: %+v", all[1])
	}
	q := all[2]
	if c := codes(q); q.ID != question || len(c) != 1 || c[0].ID != "q-code" || c[0].X != 87.5 || c[0].W != 9.375 {
		t.Fatalf("the question's own code moves to the corner, and no second one is added: %+v", c)
	}
	if q.Options[0].Color != answerColours[0] || q.Options[1].Color != answerColours[1] {
		t.Fatalf("the answers have colours: %+v", q.Options)
	}
	if pres, _ := presentationByID(ctx, pool, p); pres.Marks != "letters" {
		t.Fatalf("marks: %+v", pres)
	}
}

func TestSavingASlideKeepsItsAnswersAndTheirVotes(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Spørsmål")
	q := e.addSlide(p.ID, "question")
	yes, no := q.Options[0], q.Options[1]
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": q.ID}, nil)
	e.call(phone(), "POST", "/api/stem/"+p.Code, map[string]string{"optionId": yes.ID}, nil)

	// «Ja» renamed and moved, «Nei» taken off, a new answer added.
	var saved struct{ Slide Slide }
	st, body := e.call(e.admin, "PUT", "/api/admin/slides/"+q.ID, map[string]any{
		"title": "Hvem vinner?", "background": "#202020",
		"elements": []map[string]any{{"id": "t", "type": "text", "x": 5, "y": 5, "w": 50, "h": 10, "text": "Hvem vinner?", "size": 7}},
		"options": []map[string]any{
			{"id": yes.ID, "label": "Mennesket", "x": 10, "y": 50, "w": 30, "h": 30},
			{"id": "ny-1", "label": "Maskinen", "x": 60, "y": 50, "w": 30, "h": 30},
		},
	}, &saved)
	if st != 200 {
		t.Fatalf("save: %d %v", st, body)
	}
	got := saved.Slide
	if got.Title != "Hvem vinner?" || got.Background != "#202020" || len(got.Options) != 2 {
		t.Fatalf("saved %+v", got)
	}
	if got.Options[0].ID != yes.ID || got.Options[0].Label != "Mennesket" || got.Options[0].Count != 1 {
		t.Fatalf("«Ja» should keep its id and its vote: %+v", got.Options[0])
	}
	if got.Options[1].ID == no.ID || got.Options[1].Label != "Maskinen" || got.Options[1].Count != 0 {
		t.Fatalf("the new answer: %+v", got.Options[1])
	}
	if got.Total != 1 {
		t.Fatalf("total %d", got.Total)
	}
}

func TestASlideOnlyTakesWhatTheStageCanShow(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Grenser")
	s := p.Slides[0]
	st, body := e.call(e.admin, "PUT", "/api/admin/slides/"+s.ID, map[string]any{
		"title": "", "background": "#000000",
		"elements": []map[string]any{{"id": "x", "type": "script", "x": 0, "y": 0, "w": 10, "h": 10}},
		"options":  []any{},
	}, nil)
	if st != 400 || !strings.Contains(body["message"].(string), "Ukjent type") {
		t.Fatalf("an unknown type: %d %v", st, body)
	}
	// A box off the stage is put back on it, and a size that cannot render is
	// brought into range.
	var saved struct{ Slide Slide }
	e.call(e.admin, "PUT", "/api/admin/slides/"+s.ID, map[string]any{
		"title": "", "background": "#000000",
		"elements": []map[string]any{{"id": "t", "type": "text", "x": 120, "y": -5, "w": 80, "h": 200, "text": "Hei", "size": 999}},
		"options":  []any{},
	}, &saved)
	el := saved.Slide.Elements[0]
	if el.X != 99 || el.Y != 0 || el.W != 1 || el.H != 100 || el.Size != 40 {
		t.Fatalf("clamped %+v", el)
	}
}

func TestOnePhoneOneVoteOnTheQuestionOnScreen(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Avstemning")
	q := e.addSlide(p.ID, "question")
	first := p.Slides[0]
	a, b := phone(), phone()

	// Nothing is up yet.
	_, ballot := e.call(a, "GET", "/api/stem/"+p.Code, nil, nil)
	if ballot["question"] != nil || ballot["live"] != false {
		t.Fatalf("before the start: %v", ballot)
	}
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": q.ID}, nil)
	_, ballot = e.call(a, "GET", "/api/stem/"+strings.ToLower(p.Code), nil, nil)
	question := ballot["question"].(map[string]any)
	if question["title"] != "Hva tror du?" || len(question["options"].([]any)) != 2 || ballot["voted"] != nil {
		t.Fatalf("the ballot: %v", ballot)
	}

	yes := q.Options[0].ID
	if st, _ := e.call(a, "POST", "/api/stem/"+p.Code, map[string]string{"optionId": yes}, nil); st != 200 {
		t.Fatalf("a vote: %d", st)
	}
	if st, body := e.call(a, "POST", "/api/stem/"+p.Code, map[string]string{"optionId": q.Options[1].ID}, nil); st != 409 || body["error"] != "already_voted" {
		t.Fatalf("a second vote from the same phone: %d %v", st, body)
	}
	if st, _ := e.call(b, "POST", "/api/stem/"+p.Code, map[string]string{"optionId": yes}, nil); st != 200 {
		t.Fatalf("another phone: %d", st)
	}
	_, ballot = e.call(a, "GET", "/api/stem/"+p.Code, nil, nil)
	if ballot["voted"] != yes {
		t.Fatalf("the phone remembers its vote: %v", ballot)
	}
	for _, s := range e.get(p.ID).Slides {
		if s.ID == q.ID && (s.Options[0].Count != 2 || s.Total != 2) {
			t.Fatalf("counts %+v", s.Options)
		}
	}

	// Back to the first slide: the question is gone from the phones, and so
	// is voting on it.
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": first.ID}, nil)
	c := phone()
	if st, body := e.call(c, "POST", "/api/stem/"+p.Code, map[string]string{"optionId": yes}, nil); st != 409 || body["error"] != "not_open" {
		t.Fatalf("a vote on a question that is down: %d %v", st, body)
	}

	// Asked again: the votes go, and the phones may answer anew.
	e.call(e.admin, "DELETE", "/api/admin/slides/"+q.ID+"/votes", nil, nil)
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": q.ID}, nil)
	if st, _ := e.call(a, "POST", "/api/stem/"+p.Code, map[string]string{"optionId": yes}, nil); st != 200 {
		t.Fatalf("a vote after the reset: %d", st)
	}
}

func TestSteppingThroughTheSlides(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Steg")
	q := e.addSlide(p.ID, "question")
	var st liveState
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]int{"step": 1}, &st)
	if st.Slide == nil || st.Index != 1 || st.Count != 2 {
		t.Fatalf("starting starts at the first: %+v", st)
	}
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]int{"step": 1}, &st)
	if st.Slide.ID != q.ID || st.Index != 2 {
		t.Fatalf("next: %+v", st)
	}
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]int{"step": 1}, &st)
	if st.Slide.ID != q.ID {
		t.Fatalf("past the last stays on the last: %+v", st)
	}
	e.call(e.admin, "DELETE", "/api/admin/presentations/"+p.ID+"/live", nil, &st)
	if st.Slide != nil {
		t.Fatalf("stopped: %+v", st)
	}
}

// stream is a presentation's event stream as a test reads it.
type stream struct {
	t      *testing.T
	events chan [3]string
	close  func()
}

// listen opens a presentation's event stream, as a returning watcher if
// [lastID] is given.
func (e *env) listen(path, lastID string) *stream {
	ctx, cancel := context.WithCancel(context.Background())
	req, _ := http.NewRequestWithContext(ctx, "GET", e.srv.URL+path, nil)
	if lastID != "" {
		req.Header.Set("Last-Event-ID", lastID)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		cancel()
		e.t.Fatal(err)
	}
	if res.Header.Get("Content-Type") != "text/event-stream" {
		e.t.Fatalf("content type %q", res.Header.Get("Content-Type"))
	}
	s := &stream{t: e.t, events: make(chan [3]string, 64)}
	s.close = func() {
		cancel()
		res.Body.Close()
	}
	e.t.Cleanup(s.close)
	go func() {
		scan := bufio.NewScanner(res.Body)
		var id, name string
		for scan.Scan() {
			line := scan.Text()
			if v, ok := strings.CutPrefix(line, "id: "); ok {
				id = v
			} else if v, ok := strings.CutPrefix(line, "event: "); ok {
				name = v
			} else if v, ok := strings.CutPrefix(line, "data: "); ok {
				s.events <- [3]string{name, v, id}
				id = ""
			}
		}
	}()
	return s
}

// next is the next event: its name, its data and its id, if it has one.
func (s *stream) next() (string, string, string) {
	s.t.Helper()
	select {
	case ev := <-s.events:
		return ev[0], ev[1], ev[2]
	case <-time.After(5 * time.Second):
		s.t.Fatal("nothing came down the stream")
		return "", "", ""
	}
}

func TestTheStreamCarriesTheSlideAndEveryVote(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Strøm")
	q := e.addSlide(p.ID, "question")
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": q.ID}, nil)

	screen := e.listen("/api/live/"+p.Code+"/events", "")
	name, data, id := screen.next()
	var st liveState
	json.Unmarshal([]byte(data), &st)
	if name != "state" || st.Slide == nil || st.Slide.ID != q.ID || id == "" {
		t.Fatalf("the first frame is where things stand, numbered: %s %s %q", name, data, id)
	}
	if name, data, _ = screen.next(); name != "room" || data != `{"phones":0}` {
		t.Fatalf("then how many phones are in: %s %s", name, data)
	}

	e.call(phone(), "POST", "/api/stem/"+p.Code, map[string]string{"optionId": q.Options[1].ID}, nil)
	name, data, _ = screen.next()
	var v voteEvent
	json.Unmarshal([]byte(data), &v)
	if name != "vote" || v.OptionID != q.Options[1].ID || v.Counts[q.Options[1].ID] != 1 || v.Total != 1 {
		t.Fatalf("a vote: %s %s", name, data)
	}

	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": p.Slides[0].ID}, nil)
	name, data, _ = screen.next()
	json.Unmarshal([]byte(data), &st)
	if name != "state" || st.Slide.ID != p.Slides[0].ID {
		t.Fatalf("a new slide on screen: %s %s", name, data)
	}
}

func TestAPhoneIsToldOnlyWhatIsOnScreen(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Rommet")
	q := e.addSlide(p.ID, "question")
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": q.ID}, nil)

	screen := e.listen("/api/live/"+p.Code+"/events", "")
	screen.next()
	screen.next()
	ballot := e.listen("/api/live/"+p.Code+"/events?ballot", "")
	if name, _, _ := ballot.next(); name != "state" {
		t.Fatalf("a phone starts from what is on screen: %s", name)
	}
	if name, data, _ := screen.next(); name != "room" || data != `{"phones":1}` {
		t.Fatalf("the screen hears a phone come in: %s %s", name, data)
	}

	e.call(phone(), "POST", "/api/stem/"+p.Code, map[string]string{"optionId": q.Options[0].ID}, nil)
	if name, _, _ := screen.next(); name != "vote" {
		t.Fatalf("the screen hears the vote: %s", name)
	}
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]int{"step": -1}, nil)
	if name, data, _ := ballot.next(); name != "state" || strings.Contains(data, `"phones"`) {
		t.Fatalf("the phone hears the next slide, and no vote before it: %s %s", name, data)
	}
}

func TestAScreenThatComesBackIsToldWhatItMissed(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Tilbake")
	q := e.addSlide(p.ID, "question")
	e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/live", map[string]string{"slideId": q.ID}, nil)
	path := "/api/live/" + p.Code + "/events"

	first := e.listen(path, "")
	_, _, last := first.next()
	first.next()
	first.close()

	// Two votes while the screen is away, the way a proxy ends a stream.
	e.call(phone(), "POST", "/api/stem/"+p.Code, map[string]string{"optionId": q.Options[0].ID}, nil)
	e.call(phone(), "POST", "/api/stem/"+p.Code, map[string]string{"optionId": q.Options[1].ID}, nil)

	back := e.listen(path, last)
	var v voteEvent
	name, data, id := back.next()
	json.Unmarshal([]byte(data), &v)
	if name != "vote" || v.OptionID != q.Options[0].ID || v.Total != 1 || id == "" {
		t.Fatalf("the first missed vote, not a fresh start: %s %s %q", name, data, id)
	}
	name, data, _ = back.next()
	json.Unmarshal([]byte(data), &v)
	if name != "vote" || v.OptionID != q.Options[1].ID || v.Total != 2 {
		t.Fatalf("then the second: %s %s", name, data)
	}

	// A number from another run of the server is a fresh start.
	if name, _, _ := e.listen(path, "andre.3").next(); name != "state" {
		t.Fatalf("an unknown number starts from where things stand: %s", name)
	}
	// So is a phone, whatever it says.
	if name, _, _ := e.listen(path+"?ballot", last).next(); name != "state" {
		t.Fatalf("a phone starts fresh: %s", name)
	}
}

func upload(e *env, presentation, name string, content []byte) (int, map[string]any) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", name)
	fw.Write(content)
	mw.Close()
	req, _ := http.NewRequest("POST", e.srv.URL+"/api/admin/presentations/"+presentation+"/media", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	res, err := e.admin.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer res.Body.Close()
	var body map[string]any
	json.NewDecoder(res.Body).Decode(&body)
	return res.StatusCode, body
}

// A PNG's signature and header: enough for the sniffer to know it.
var png = append([]byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"), bytes.Repeat([]byte{7}, 64)...)

func TestPicturesGoUpAndComeBackInPieces(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Bilder")
	st, body := upload(e, p.ID, "foto.png", png)
	if st != 201 {
		t.Fatalf("upload: %d %v", st, body)
	}
	m := body["media"].(map[string]any)
	if m["kind"] != "image" || m["mime"] != "image/png" || m["name"] != "foto.png" {
		t.Fatalf("media %v", m)
	}
	if _, err := os.Stat(filepath.Join(e.media, m["id"].(string))); err != nil {
		t.Fatalf("the file: %v", err)
	}

	req, _ := http.NewRequest("GET", e.srv.URL+m["url"].(string), nil)
	req.Header.Set("Range", "bytes=0-3")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	part, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if res.StatusCode != 206 || !bytes.Equal(part, png[:4]) || res.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("a range: %d %q %q", res.StatusCode, part, res.Header.Get("Content-Type"))
	}

	if st, body := upload(e, p.ID, "notat.txt", []byte("bare tekst")); st != 415 {
		t.Fatalf("a text file: %d %v", st, body)
	}
	if st, _ := upload(e, p.ID, "stor.png", append(png, bytes.Repeat([]byte{1}, 2<<20)...)); st != 413 {
		t.Fatalf("over the limit: %d", st)
	}

	// Another presentation's picture is not this one's to show.
	other := e.newPresentation("Annen")
	st, body = e.call(e.admin, "PUT", "/api/admin/slides/"+other.Slides[0].ID, map[string]any{
		"title": "", "background": "#000000", "options": []any{},
		"elements": []map[string]any{{"id": "i", "type": "image", "x": 0, "y": 0, "w": 50, "h": 50, "media": m["id"]}},
	}, nil)
	if st != 400 {
		t.Fatalf("someone else's picture: %d %v", st, body)
	}

	// Deleting the presentation takes the file with it.
	e.call(e.admin, "DELETE", "/api/admin/presentations/"+p.ID, nil, nil)
	if _, err := os.Stat(filepath.Join(e.media, m["id"].(string))); !os.IsNotExist(err) {
		t.Fatalf("the file outlived its presentation: %v", err)
	}
}

func TestTakingAnUploadAwayEmptiesItsBoxes(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Opprydding")
	_, body := upload(e, p.ID, "foto.png", png)
	picture := body["media"].(map[string]any)["id"].(string)
	_, body = upload(e, p.ID, "pling.mp3", append([]byte("ID3\x04\x00\x00\x00\x00\x00\x00"), bytes.Repeat([]byte{0}, 64)...))
	sound := body["media"].(map[string]any)
	if sound["kind"] != "audio" {
		t.Fatalf("a sound: %v", sound)
	}
	if st, body := e.call(e.admin, "PATCH", "/api/admin/presentations/"+p.ID, map[string]any{"soundMediaId": sound["id"]}, nil); st != 200 {
		t.Fatalf("the vote sound: %d %v", st, body)
	}
	slide := p.Slides[0].ID
	if st, body := e.call(e.admin, "PUT", "/api/admin/slides/"+slide, map[string]any{
		"title": "", "background": "#000000", "options": []any{},
		"elements": []map[string]any{
			{"id": "a", "type": "text", "x": 0, "y": 0, "w": 50, "h": 20, "text": "Bildet under"},
			{"id": "b", "type": "image", "x": 0, "y": 30, "w": 50, "h": 50, "media": picture, "fit": "cover"},
		},
	}, nil); st != 200 {
		t.Fatalf("a slide with the picture: %d %v", st, body)
	}

	if st, _ := e.call(e.admin, "DELETE", "/api/admin/media/"+picture, nil, nil); st != 204 {
		t.Fatalf("delete the picture: %d", st)
	}
	if st, _ := e.call(e.admin, "DELETE", "/api/admin/media/"+sound["id"].(string), nil, nil); st != 204 {
		t.Fatalf("delete the sound: %d", st)
	}
	if _, err := os.Stat(filepath.Join(e.media, picture)); !os.IsNotExist(err) {
		t.Fatalf("the file is still there: %v", err)
	}
	got := e.get(p.ID)
	els := got.Slides[0].Elements
	if len(els) != 2 || els[0].Text != "Bildet under" || els[1].Media != "" || els[1].Fit != "cover" {
		t.Fatalf("the box stays, empty: %+v", els)
	}
	if got.SoundMediaID != nil || len(got.Media) != 0 {
		t.Fatalf("the sound is back to the chime: %+v", got)
	}
	if st, _ := e.call(phone(), "GET", "/media/"+picture, nil, nil); st != 404 {
		t.Fatalf("the picture is gone: %d", st)
	}
	if st, _ := e.call(phone(), "DELETE", "/api/admin/media/"+picture, nil, nil); st != 401 {
		t.Fatalf("not for phones: %d", st)
	}
}

func TestOrderDuplicateAndDelete(t *testing.T) {
	e := setup(t)
	p := e.newPresentation("Rekkefølge")
	q := e.addSlide(p.ID, "question")
	first := p.Slides[0].ID

	if st, _ := e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/order", map[string][]string{"slideIds": {q.ID, first}}, nil); st != 200 {
		t.Fatalf("reorder: %d", st)
	}
	if got := e.get(p.ID).Slides; got[0].ID != q.ID || got[1].ID != first {
		t.Fatalf("order %v %v", got[0].ID, got[1].ID)
	}
	if st, _ := e.call(e.admin, "PUT", "/api/admin/presentations/"+p.ID+"/order", map[string][]string{"slideIds": {q.ID}}, nil); st != 400 {
		t.Fatalf("an order missing a slide: %d", st)
	}

	var made struct{ ID string }
	e.call(e.admin, "POST", "/api/admin/slides/"+q.ID+"/duplicate", nil, &made)
	got := e.get(p.ID).Slides
	if len(got) != 3 || got[1].ID != made.ID || len(got[1].Options) != 2 || got[1].Options[0].ID == q.Options[0].ID {
		t.Fatalf("a copy right after, with answers of its own: %+v", got)
	}

	e.call(e.admin, "DELETE", "/api/admin/slides/"+q.ID, nil, nil)
	got = e.get(p.ID).Slides
	if len(got) != 2 || got[0].Position != 0 || got[1].Position != 1 {
		t.Fatalf("positions close up: %+v", got)
	}
}
