package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"time"
)

// adminCookie is Podium's admin session. Testpublikum hands it back to Podium
// as it got it, and never makes or reads one itself.
const adminCookie = "podium_admin"

// silent is how long a stream may say nothing before it counts as dead.
// Podium pings every 20 seconds, so this is two pings missed and then some.
const silent = 45 * time.Second

// podium is Podium over HTTP: the few calls a phone makes, and the admin's
// sign-in, which Testpublikum borrows.
type podium struct {
	base string
	// One transport for every phone. Their cookies are their own, which is
	// all Podium tells phones apart by; the connections to it are shared.
	transport http.RoundTripper
	admin     *http.Client
}

func newPodium(base string) *podium {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.MaxIdleConnsPerHost = 64
	named := signed{t}
	return &podium{base: base, transport: named, admin: &http.Client{Transport: named, Timeout: 15 * time.Second}}
}

// userAgent says who is calling, so the room's traffic is plain to see in
// Podium's logs and in Cloudflare's, and easy to tell from a real room's.
const userAgent = "Testpublikum (+https://testpublikum.freelunch.no)"

type signed struct{ next http.RoundTripper }

func (s signed) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("User-Agent", userAgent)
	return s.next.RoundTrip(r)
}

// phone is a new phone: a client with a cookie jar of its own, so Podium
// gives it a voter id of its own the first time it asks, and counts it once.
// It has no timeout of its own, because it holds a stream open; every other
// call it makes has one.
func (p *podium) phone() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Transport: p.transport, Jar: jar}
}

// problem is Podium saying no: a code to act on, and a sentence in Norwegian
// that can be shown as it is.
type problem struct {
	Status  int    `json:"-"`
	Code    string `json:"error"`
	Message string `json:"message"`
}

func (e *problem) Error() string {
	return fmt.Sprintf("podium answered %d %s: %s", e.Status, e.Code, e.Message)
}

func isStatus(err error, status int) bool {
	var pr *problem
	return errors.As(err, &pr) && pr.Status == status
}

func isCode(err error, code string) bool {
	var pr *problem
	return errors.As(err, &pr) && pr.Code == code
}

func (p *podium) call(ctx context.Context, c *http.Client, method, path string, body, into any, session string) (*http.Response, error) {
	var rd io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, p.base+path, rd)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	if session != "" {
		req.AddCookie(&http.Cookie{Name: adminCookie, Value: session})
	}
	res, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		pr := &problem{Status: res.StatusCode}
		json.NewDecoder(io.LimitReader(res.Body, 64<<10)).Decode(pr)
		return res, pr
	}
	if into != nil {
		if err := json.NewDecoder(io.LimitReader(res.Body, 8<<20)).Decode(into); err != nil {
			return res, err
		}
	}
	return res, nil
}

// signIn checks a password with Podium, and returns the session Podium gives
// for it and when that runs out.
func (p *podium) signIn(ctx context.Context, password string) (string, time.Time, error) {
	res, err := p.call(ctx, p.admin, "POST", "/api/admin/login", map[string]string{"password": password}, nil, "")
	if err != nil {
		return "", time.Time{}, err
	}
	for _, c := range res.Cookies() {
		if c.Name == adminCookie && c.Value != "" {
			return c.Value, c.Expires, nil
		}
	}
	return "", time.Time{}, errors.New("podium said yes without a session")
}

// isAdmin asks Podium whether a session is still its admin's.
func (p *podium) isAdmin(ctx context.Context, session string) (bool, error) {
	var me struct {
		Admin bool `json:"admin"`
	}
	if _, err := p.call(ctx, p.admin, "GET", "/api/admin/me", nil, &me, session); err != nil {
		return false, err
	}
	return me.Admin, nil
}

type presentation struct {
	Title       string  `json:"title"`
	Code        string  `json:"code"`
	LiveSlideID *string `json:"liveSlideId"`
	SlideCount  int     `json:"slideCount"`
}

// presentations is the admin's list, newest change first, as Podium has it.
func (p *podium) presentations(ctx context.Context, session string) ([]presentation, error) {
	var out struct {
		Presentations []presentation `json:"presentations"`
	}
	_, err := p.call(ctx, p.admin, "GET", "/api/admin/presentations", nil, &out, session)
	return out.Presentations, err
}

type option struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Color string `json:"color"`
}

type question struct {
	SlideID string   `json:"slideId"`
	Title   string   `json:"title"`
	Options []option `json:"options"`
}

// ballot is the phone page's look at Podium: the question on screen, if
// there is one, and this phone's answer to it, if it has given one.
type ballot struct {
	Title    string    `json:"title"`
	Code     string    `json:"code"`
	Marks    string    `json:"marks"`
	Live     bool      `json:"live"`
	Question *question `json:"question"`
	Voted    *string   `json:"voted"`
}

func (p *podium) ballot(ctx context.Context, c *http.Client, code string) (ballot, error) {
	var b ballot
	_, err := p.call(ctx, c, "GET", "/api/stem/"+url.PathEscape(code), nil, &b, "")
	return b, err
}

func (p *podium) vote(ctx context.Context, c *http.Client, code, optionID string) error {
	_, err := p.call(ctx, c, "POST", "/api/stem/"+url.PathEscape(code), map[string]string{"optionId": optionID}, nil, "")
	return err
}

// liveState is what a phone is told when the screen changes: the slide on it,
// if there is one, with its answers and how many have voted on it.
type liveState struct {
	Title string     `json:"title"`
	Code  string     `json:"code"`
	Marks string     `json:"marks"`
	Slide *liveSlide `json:"slide"`
	Index int        `json:"index"`
	Count int        `json:"count"`
	Ended bool       `json:"ended"`
}

type liveSlide struct {
	ID      string   `json:"id"`
	Title   string   `json:"title"`
	Options []option `json:"options"`
	Total   int      `json:"total"`
}

// listen holds a phone's stream open, the ballot page's, and hands every state
// it is told to [onState]. It calls [opened] once the stream is open, and
// returns when it ends: when Podium or a proxy on the way closes it, which in
// production is every two minutes, or when nothing at all, not even a ping,
// has come for [silent].
func (p *podium) listen(ctx context.Context, c *http.Client, code string, opened func(), onState func(liveState)) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", p.base+"/api/live/"+url.PathEscape(code)+"/events?ballot", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "text/event-stream")
	res, err := c.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		pr := &problem{Status: res.StatusCode}
		json.NewDecoder(io.LimitReader(res.Body, 64<<10)).Decode(pr)
		return pr
	}
	opened()
	quiet := time.AfterFunc(silent, cancel)
	defer quiet.Stop()
	return readEvents(res.Body, func(event string, data []byte) {
		quiet.Reset(silent)
		if event != "state" {
			return
		}
		var st liveState
		if json.Unmarshal(data, &st) == nil {
			onState(st)
		}
	})
}

// readEvents reads a server-sent event stream and hands each event to [on]:
// its name, "message" when it has none, and its data, which [on] must not
// keep. Comments, the lines that start with a colon, are nothing, and so is
// the retry field: the phone keeps its own time. It returns nil when the
// stream ends.
func readEvents(body io.Reader, on func(event string, data []byte)) error {
	sc := bufio.NewScanner(body)
	sc.Buffer(make([]byte, 64<<10), 8<<20)
	var event string
	var data bytes.Buffer
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			if data.Len() > 0 {
				name := event
				if name == "" {
					name = "message"
				}
				on(name, bytes.TrimSuffix(data.Bytes(), []byte("\n")))
			}
			event = ""
			data.Reset()
			continue
		}
		if line[0] == ':' {
			continue
		}
		field, value, _ := bytes.Cut(line, []byte(":"))
		value = bytes.TrimPrefix(value, []byte(" "))
		switch string(field) {
		case "event":
			event = string(value)
		case "data":
			data.Write(value)
			data.WriteByte('\n')
		}
	}
	return sc.Err()
}
