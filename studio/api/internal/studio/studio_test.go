package studio

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestGuardStopsRepeatsAndBudget(t *testing.T) {
	g := guard{MaxSteps: 3, MaxCost: .1, Seen: map[string]int{}}
	if e := g.reserve(3, 0); e == nil {
		t.Fatal("step cap bypassed")
	}
	if e := g.reserve(0, .11); e == nil {
		t.Fatal("budget cap bypassed")
	}
	if e := g.tool("search", []byte(`{"b":2,"a":1}`)); e != nil {
		t.Fatal(e)
	}
	if e := g.tool("search", []byte(`{ "a":1,"b":2 }`)); e == nil {
		t.Fatal("semantic duplicate not stopped")
	}
	if e := g.tool("bad", []byte(`not-json`)); e == nil {
		t.Fatal("invalid args accepted")
	}
}
func TestConfigBounds(t *testing.T) {
	base := modelConfig{MaxSteps: 6, MaxTokens: 2048, Timeout: 120, MaxCost: .1}
	if !validConfig(base) {
		t.Fatal("valid config rejected")
	}
	base.MaxSteps = 100
	if validConfig(base) {
		t.Fatal("unbounded steps accepted")
	}
	base.MaxSteps = 1
	base.MaxCost = 0
	if validConfig(base) {
		t.Fatal("zero budget accepted")
	}
}
func testApp(t *testing.T) *App {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
	}
	if !strings.Contains(url, "/studio_test") {
		t.Fatal("tests require isolated studio_test database")
	}
	t.Setenv("DATABASE_URL", url)
	t.Setenv("STORAGE_PATH", t.TempDir())
	t.Setenv("BOOTSTRAP_TOKEN", "test-setup-code")
	t.Setenv("APP_ORIGIN", "http://localhost:5178")
	t.Setenv("AI_ENABLED", "false")
	a, e := New(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(a.Close)
	_, e = a.db.Exec(context.Background(), "TRUNCATE users,products,items,versions,notes,tasks,publications,conversations,messages,runs,run_events,agent_tokens,invites,sessions,audit RESTART IDENTITY CASCADE; INSERT INTO products(name) VALUES('Teorimester')")
	if e != nil {
		t.Fatal(e)
	}
	return a
}
func request(t *testing.T, a *App, method, path string, body any, cookie *http.Cookie, auth string) (int, map[string]any, []*http.Cookie) {
	t.Helper()
	b, _ := json.Marshal(body)
	r := httptest.NewRequest(method, path, bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", a.origin)
	if cookie != nil {
		r.AddCookie(cookie)
	}
	if auth != "" {
		r.Header.Set("Authorization", "Bearer "+auth)
	}
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	var out map[string]any
	json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out, w.Result().Cookies()
}
func setupAdmin(t *testing.T, a *App) *http.Cookie {
	t.Helper()
	status, out, cookies := request(t, a, "POST", "/api/auth/bootstrap", credentials{Email: "owner@example.test", Name: "Owner", Password: "long-secure-password", Token: "test-setup-code"}, nil, "")
	if status != 200 || len(cookies) != 1 {
		t.Fatalf("setup %d: %v", status, out)
	}
	return cookies[0]
}
func productID(t *testing.T, a *App) string {
	t.Helper()
	var p string
	if e := a.db.QueryRow(context.Background(), "SELECT id::text FROM products LIMIT 1").Scan(&p); e != nil {
		t.Fatal(e)
	}
	return p
}
func TestInvitesAndReadOnlyAccess(t *testing.T) {
	a := testApp(t)
	cookie := setupAdmin(t, a)
	status, _, _ := request(t, a, "POST", "/api/auth/bootstrap", credentials{Email: "other@example.test", Name: "Other", Password: "long-secure-password", Token: "test-setup-code"}, nil, "")
	if status != 409 {
		t.Fatalf("bootstrap reuse %d", status)
	}
	status, out, _ := request(t, a, "POST", "/api/invites", map[string]string{"email": "reader@example.test", "role": "reader"}, cookie, "")
	if status != 201 {
		t.Fatalf("invite %v", out)
	}
	invite := strings.Split(out["url"].(string), "#invite=")[1]
	wrong := credentials{Email: "wrong@example.test", Name: "Reader", Password: "long-reader-password", Token: invite}
	status, _, _ = request(t, a, "POST", "/api/auth/accept", wrong, nil, "")
	if status != 400 {
		t.Fatal("invite accepted with wrong email")
	}
	wrong.Email = "reader@example.test"
	status, out, cookies := request(t, a, "POST", "/api/auth/accept", wrong, nil, "")
	if status != 200 {
		t.Fatalf("accept %v", out)
	}
	status, _, _ = request(t, a, "POST", "/api/auth/accept", wrong, nil, "")
	if status != 400 {
		t.Fatal("invite reused")
	}
	status, _, _ = request(t, a, "POST", "/api/items", itemInput{Product: productID(t, a), Title: "No", Kind: "hook"}, cookies[0], "")
	if status != 403 {
		t.Fatalf("reader can write: %d", status)
	}
	req := httptest.NewRequest("POST", "/api/items", strings.NewReader(`{}`))
	req.AddCookie(cookie)
	req.Header.Set("Origin", "https://evil.test")
	rec := httptest.NewRecorder()
	a.Handler().ServeHTTP(rec, req)
	if rec.Code != 403 {
		t.Fatal("cross-origin write accepted")
	}
}
func TestVersionApprovalAndSearch(t *testing.T) {
	a := testApp(t)
	cookie := setupAdmin(t, a)
	p := productID(t, a)
	rows, e := a.query(context.Background(), "SELECT id FROM products")
	if e != nil || badID(rows[0]["id"].(string)) {
		t.Fatal("JSON UUID encoding broken")
	}
	status, item, _ := request(t, a, "POST", "/api/items", itemInput{Product: p, Title: "Bremselengde på glatt føre", Kind: "script", Body: "Slik øver du til teoriprøven"}, cookie, "")
	if status != 201 {
		t.Fatalf("create %v", item)
	}
	id := item["id"].(string)
	version := item["version_id"].(string)
	status, _, _ = request(t, a, "POST", "/api/items/"+id+"/approve", map[string]string{"version_id": version}, cookie, "")
	if status != 200 {
		t.Fatal("approve failed")
	}
	status, pub, _ := request(t, a, "POST", "/api/publications", map[string]any{"product_id": p, "title": "Teoriprøven", "channel": "Instagram", "scheduled_at": time.Now().Add(time.Hour).Format(time.RFC3339), "item_id": id}, cookie, "")
	if status != 201 {
		t.Fatalf("schedule %v", pub)
	}
	edit := map[string]string{"title": "Ny hook", "body": "Bremselengde på vinterføre", "expected_version_id": version}
	status, _, _ = request(t, a, "POST", "/api/items/"+id+"/versions", edit, cookie, "")
	if status != 201 {
		t.Fatal("version failed")
	}
	status, _, _ = request(t, a, "POST", "/api/items/"+id+"/versions", edit, cookie, "")
	if status != 409 {
		t.Fatal("stale update allowed")
	}
	status, _, _ = request(t, a, "PATCH", "/api/publications/"+pub["id"].(string), map[string]string{"status": "published", "url": "https://instagram.com/p/test"}, cookie, "")
	if status != 409 {
		t.Fatal("outdated approval allowed publication")
	}
	results, e := a.searchData(context.Background(), "bremselengde", p, "")
	if e != nil || len(results) == 0 {
		t.Fatalf("search: %v %v", results, e)
	}
	results, e = a.searchData(context.Background(), "definitelymissing_%%%", p, "")
	if e != nil || len(results) != 0 {
		t.Fatalf("wildcard input not escaped: %v %v", results, e)
	}
}
func TestMCPClaimsAndProductIsolation(t *testing.T) {
	a := testApp(t)
	cookie := setupAdmin(t, a)
	p := productID(t, a)
	status, out, _ := request(t, a, "POST", "/api/agent-tokens", map[string]string{"name": "Editor", "product_id": p}, cookie, "")
	if status != 201 {
		t.Fatal(out)
	}
	key := out["token"].(string)
	u := Actor{ID: out["id"].(string), Name: "Editor", Product: p, Role: "editor", Agent: true}
	status, _, _ = request(t, a, "POST", "/api/items", itemInput{Product: p, Title: "Unauthorized route", Kind: "hook"}, nil, key)
	if status != 403 {
		t.Fatal("agent reached human route")
	}
	status, init, _ := request(t, a, "POST", "/mcp", map[string]any{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": map[string]string{"protocolVersion": "2025-06-18"}}, nil, key)
	if status != 200 || init["result"] == nil {
		t.Fatal("MCP initialization failed")
	}
	_, task, _ := request(t, a, "POST", "/api/tasks", taskInput{Product: p, Title: "Produce video", Status: "ready", Executor: "external"}, cookie, "")
	taskID := task["id"].(string)
	var wg sync.WaitGroup
	var wins atomic.Int32
	var claim map[string]any
	var mu sync.Mutex
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			result, err := a.callMCP(context.Background(), u, "studio_claim_task", map[string]string{"task_id": taskID})
			if err == nil {
				wins.Add(1)
				mu.Lock()
				claim = result.(map[string]any)
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if wins.Load() != 1 {
		t.Fatalf("claims: %d", wins.Load())
	}
	var other string
	a.db.QueryRow(context.Background(), "INSERT INTO products(name) VALUES('Other') RETURNING id::text").Scan(&other)
	foreign, e := a.insertItem(context.Background(), Actor{Name: "Owner"}, itemInput{Product: other, Title: "Secret", Kind: "script"}, "", "", "")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = a.callMCP(context.Background(), u, "studio_get_item", map[string]string{"item_id": foreign["id"]}); e == nil {
		t.Fatal("cross-product read allowed")
	}
	args := map[string]string{"task_id": taskID, "lease_id": claim["lease_id"].(string), "version_id": foreign["version_id"]}
	if _, e = a.callMCP(context.Background(), u, "studio_deliver_task", args); e == nil {
		t.Fatal("cross-product delivery allowed")
	}
	own, e := a.insertItem(context.Background(), u, itemInput{Product: p, Title: "Video brief", Kind: "brief"}, "", "", "")
	if e != nil {
		t.Fatal(e)
	}
	args["version_id"] = own["version_id"]
	a.db.Exec(context.Background(), "UPDATE tasks SET lease_until=now()-interval '1 minute' WHERE id=$1", taskID)
	if _, e = a.callMCP(context.Background(), u, "studio_deliver_task", args); e == nil {
		t.Fatal("expired claim delivered")
	}
	_, _, _ = request(t, a, "DELETE", "/api/agent-tokens/"+u.ID, nil, cookie, "")
	status, _, _ = request(t, a, "POST", "/mcp", map[string]any{"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, nil, key)
	if status != 401 {
		t.Fatal("revoked key worked")
	}
}

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestAgentStopsRepeatedTools(t *testing.T) {
	a := testApp(t)
	cookie := setupAdmin(t, a)
	p := productID(t, a)
	t.Setenv("AI_ENABLED", "true")
	t.Setenv("OPENROUTER_API_KEY", "fake-for-test")
	a.db.Exec(context.Background(), "UPDATE model_settings SET model='test/model' WHERE role='chat'")
	_, convo, _ := request(t, a, "POST", "/api/conversations", map[string]string{"product_id": p, "title": "Test"}, cookie, "")
	cid := convo["id"].(string)
	status, started, _ := request(t, a, "POST", "/api/conversations/"+cid+"/messages", map[string]string{"body": "Find hooks"}, cookie, "")
	if status != 202 {
		t.Fatal(started)
	}
	var uid string
	a.db.QueryRow(context.Background(), "SELECT id::text FROM users LIMIT 1").Scan(&uid)
	id := started["run_id"].(string)
	a.db.Exec(context.Background(), "UPDATE runs SET status='running' WHERE id=$1", id)
	calls := 0
	a.http = &http.Client{Transport: transportFunc(func(req *http.Request) (*http.Response, error) {
		body := ""
		switch req.URL.Path {
		case "/api/v1/key":
			body = `{"data":{"limit":1,"limit_remaining":1}}`
		case "/api/v1/models":
			body = `{"data":[{"id":"test/model","pricing":{"prompt":"0.000001","completion":"0.000001"},"supported_parameters":["tools"]}]}`
		default:
			calls++
			body = `{"model":"test/model","choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","tool_calls":[{"id":"one","type":"function","function":{"name":"search_library","arguments":"{\"query\":\"hooks\"}"}}]}}],"usage":{"cost":0.001}}`
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
	a.executeRun(context.Background(), run{ID: id, Conversation: cid, User: uid, Product: p, Model: "test/model", MaxSteps: 6, MaxTokens: 500, Timeout: 30, MaxCost: .1})
	var runStatus, reason string
	a.db.QueryRow(context.Background(), "SELECT status,stop_reason FROM runs WHERE id=$1", id).Scan(&runStatus, &reason)
	if runStatus != "limited" || !strings.Contains(reason, "gjentatt") || calls != 2 {
		t.Fatalf("status=%s reason=%s calls=%d", runStatus, reason, calls)
	}
}
