package studio

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func listRequest(t *testing.T, a *App, path string, cookie *http.Cookie) []map[string]any {
	t.Helper()
	r := httptest.NewRequest("GET", path, nil)
	r.AddCookie(cookie)
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("GET %s %d: %s", path, w.Code, w.Body.String())
	}
	var rows []map[string]any
	if json.Unmarshal(w.Body.Bytes(), &rows) != nil {
		t.Fatalf("not a list %s", w.Body.String())
	}
	return rows
}
func userCookie(t *testing.T, a *App, admin *http.Cookie, email, role string) *http.Cookie {
	t.Helper()
	status, inv, _ := request(t, a, "POST", "/api/invites", map[string]string{"email": email, "role": role}, admin, "")
	if status != 201 {
		t.Fatal(inv)
	}
	key := strings.Split(inv["url"].(string), "#invite=")[1]
	status, out, cookies := request(t, a, "POST", "/api/auth/accept", credentials{Email: email, Name: email, Password: "safe-test-password", Token: key}, nil, "")
	if status != 200 {
		t.Fatal(out)
	}
	return cookies[0]
}
func createTestItem(t *testing.T, a *App, c *http.Cookie, p string) map[string]any {
	t.Helper()
	status, item, _ := request(t, a, "POST", "/api/items", itemInput{Product: p, Title: "Vintervideo", Kind: "script", Body: "Lang bremselengde i snø", Rights: "owned"}, c, "")
	if status != 201 {
		t.Fatal(item)
	}
	return item
}
func TestProductPermissionsSearchAndExports(t *testing.T) {
	a := testApp(t)
	ctx := context.Background()
	admin := setupAdmin(t, a)
	reader := userCookie(t, a, admin, "reader@test.example", "editor")
	p := productID(t, a)
	var uid string
	a.db.QueryRow(ctx, "SELECT id::text FROM users WHERE email='reader@test.example'").Scan(&uid)
	status, newProduct, _ := request(t, a, "POST", "/api/products", map[string]any{"name": "Private", "restricted": true}, admin, "")
	if status != 201 {
		t.Fatal(newProduct)
	}
	private := newProduct["id"].(string)
	item := createTestItem(t, a, admin, private)
	id := item["id"].(string)
	status, _, _ = request(t, a, "GET", "/api/items/"+id, nil, reader, "")
	if status != 403 {
		t.Fatal("private item leaked", status)
	}
	if rows := listRequest(t, a, "/api/search?q=bremselengde", reader); len(rows) != 0 {
		t.Fatal("private search leaked", rows)
	}
	request(t, a, "PUT", "/api/products/"+private+"/members", map[string]string{"user_id": uid, "role": "reader"}, admin, "")
	if rows := listRequest(t, a, "/api/search?q=bremselengde&product="+private, reader); len(rows) == 0 {
		t.Fatal("reader cannot search granted product")
	}
	status, _, _ = request(t, a, "POST", "/api/items", itemInput{Product: private, Title: "Forbidden", Kind: "hook"}, reader, "")
	if status != 400 {
		t.Fatal("member reader wrote item", status)
	}
	status, _, _ = request(t, a, "POST", "/api/items/bulk", map[string]any{"ids": []string{id}, "action": "trash"}, reader, "")
	if status != 403 {
		t.Fatal("member reader bulk write", status)
	}
	publicItem := createTestItem(t, a, reader, p)
	if publicItem["id"] == nil {
		t.Fatal("open product denied")
	}
}
func TestLibraryTrashSharesCSVAndReset(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	p := productID(t, a)
	item := createTestItem(t, a, admin, p)
	id := item["id"].(string)
	version := item["version_id"].(string)
	status, share, _ := request(t, a, "POST", "/api/items/"+id+"/shares", map[string]any{"version_id": version, "days": 2}, admin, "")
	if status != 201 {
		t.Fatal(share)
	}
	key := strings.Split(share["url"].(string), "#")[1]
	status, _, _ = request(t, a, "GET", "/api/shared/"+key, nil, nil, "")
	if status != 200 {
		t.Fatal("share inaccessible", status)
	}
	request(t, a, "POST", "/api/items/bulk", map[string]any{"ids": []string{id}, "action": "trash"}, admin, "")
	status, _, _ = request(t, a, "GET", "/api/shared/"+key, nil, nil, "")
	if status != 404 {
		t.Fatal("trashed content share leaked")
	}
	if rows := listRequest(t, a, "/api/search?q=bremselengde&product="+p, admin); len(rows) != 0 {
		t.Fatal("trash searchable")
	}
	request(t, a, "POST", "/api/items/bulk", map[string]any{"ids": []string{id}, "action": "restore"}, admin, "")
	status, _, _ = request(t, a, "GET", "/api/shared/"+key, nil, nil, "")
	if status != 200 {
		t.Fatal("restore failed")
	}
	request(t, a, "DELETE", "/api/items/"+id+"/shares/"+share["id"].(string), nil, admin, "")
	status, _, _ = request(t, a, "GET", "/api/shared/"+key, nil, nil, "")
	if status != 404 {
		t.Fatal("revoked share works")
	}
	status, out, _ := request(t, a, "POST", "/api/import/csv", map[string]string{"product_id": p, "csv": "title,kind,body,rights\nNy hook,hook,Hei verden,owned\n"}, admin, "")
	if status != 201 || out["count"] != float64(1) {
		t.Fatal("csv failed", out)
	}
	var email string
	a.db.QueryRow(context.Background(), "SELECT email FROM users LIMIT 1").Scan(&email)
	status, out, _ = request(t, a, "POST", "/api/password-resets", map[string]string{"email": email}, admin, "")
	if status != 201 {
		t.Fatal(out)
	}
	reset := strings.Split(out["url"].(string), "#reset=")[1]
	status, out, _ = request(t, a, "POST", "/api/auth/reset", credentials{Token: reset, Password: "new-safe-test-password"}, nil, "")
	if status != 200 {
		t.Fatal(out)
	}
	status, _, _ = request(t, a, "GET", "/api/items?product="+p, nil, admin, "")
	if status != 401 {
		t.Fatal("password reset did not revoke old sessions")
	}
	status, _, _ = request(t, a, "POST", "/api/auth/reset", credentials{Token: reset, Password: "second-safe-password"}, nil, "")
	if status != 400 {
		t.Fatal("reset reused")
	}
}
func TestResumableUploadAndExactVersion(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	p := productID(t, a)
	content := []byte("hello studio: original file")
	status, start, _ := request(t, a, "POST", "/api/upload-sessions", map[string]any{"product_id": p, "title": "A file", "file_name": "a.txt", "size": len(content), "rights": "owned"}, admin, "")
	if status != 201 {
		t.Fatal(start)
	}
	id := start["id"].(string)
	chunk := func(offset int, b []byte) int {
		r := httptest.NewRequest("PATCH", "/api/upload-sessions/"+id, bytes.NewReader(b))
		r.Header.Set("Origin", a.origin)
		r.Header.Set("Upload-Offset", fmt.Sprint(offset))
		r.AddCookie(admin)
		w := httptest.NewRecorder()
		a.Handler().ServeHTTP(w, r)
		return w.Code
	}
	if chunk(0, content[:10]) != 200 || chunk(0, content[:10]) != 409 {
		t.Fatal("offset conflict unguarded")
	}
	status, state, _ := request(t, a, "GET", "/api/upload-sessions/"+id, nil, admin, "")
	if status != 200 || state["offset_bytes"] != float64(10) {
		t.Fatal(state)
	}
	if chunk(10, content[10:]) != 200 {
		t.Fatal("resume failed")
	}
	status, out, _ := request(t, a, "POST", "/api/upload-sessions/"+id+"/complete", map[string]any{}, admin, "")
	if status != 201 {
		t.Fatal(out)
	}
	status, again, _ := request(t, a, "POST", "/api/upload-sessions/"+id+"/complete", map[string]any{}, admin, "")
	if status != 200 || again["version_id"] != out["version_id"] {
		t.Fatal("completion was not idempotent")
	}
	var checksum string
	var size int
	a.db.QueryRow(context.Background(), "SELECT checksum,bytes FROM versions WHERE id=$1", out["version_id"]).Scan(&checksum, &size)
	if checksum != hash(string(content)) || size != len(content) {
		t.Fatal("file checksum wrong")
	}
}
func TestProductionTemplateLeaseAndDelivery(t *testing.T) {
	a := testApp(t)
	ctx := context.Background()
	admin := setupAdmin(t, a)
	p := productID(t, a)
	item := createTestItem(t, a, admin, p)
	status, templ, _ := request(t, a, "POST", "/api/templates", templateInput{Product: p, Name: "Brand", Kind: "visual", Fields: []templateField{{Name: "headline", Label: "Overskrift", Required: true}}, Locked: map[string]string{"color": "green"}}, admin, "")
	if status != 201 {
		t.Fatal(templ)
	}
	in := productionInput{Product: p, Title: "Video", Kind: "video", Template: templ["id"].(string), Fields: map[string]string{"headline": "Hei"}, Formats: []string{"9:16"}, Requirements: []string{"Kildefiler"}, Sources: []string{item["version_id"].(string)}}
	status, task, _ := request(t, a, "POST", "/api/production", in, admin, "")
	if status != 201 {
		t.Fatal(task)
	}
	id := task["id"].(string)
	_, key, _ := request(t, a, "POST", "/api/agent-tokens", map[string]string{"name": "Renderer", "product_id": p}, admin, "")
	agent := Actor{ID: key["id"].(string), Name: "Renderer", Agent: true, Role: "editor", Product: p}
	claim, e := a.callMCP(ctx, agent, "studio_claim_task", map[string]string{"task_id": id})
	if e != nil {
		t.Fatal(e)
	}
	lease := claim.(map[string]any)["lease_id"].(string)
	d := deliveryInput{Task: id, Lease: lease, Version: item["version_id"].(string)}
	if a.deliver(ctx, agent, d) == nil {
		t.Fatal("missing formats accepted")
	}
	d.Formats = map[string]string{"9:16": d.Version}
	d.Checklist = map[string]bool{"Kildefiler": true}
	d.SourceFiles = []string{d.Version}
	if e = a.deliver(ctx, agent, d); e != nil {
		t.Fatal(e)
	}
	status, out, _ := request(t, a, "POST", "/api/tasks/"+id+"/revise", map[string]string{"body": "Kort ned introen"}, admin, "")
	if status != 200 {
		t.Fatal(out)
	}
	if a.deliver(ctx, agent, d) == nil {
		t.Fatal("stale lease accepted after revision")
	}
	var rev int
	a.db.QueryRow(ctx, "SELECT revision FROM tasks WHERE id=$1", id).Scan(&rev)
	if rev != 2 {
		t.Fatal("revision not incremented")
	}
	in.Fields = map[string]string{"headline": "Hei", "color": "red"}
	status, _, _ = request(t, a, "POST", "/api/production", in, admin, "")
	if status != 400 {
		t.Fatal("locked template field overridden", status)
	}
}
func TestConversionsDedupeRefundAndCurrency(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	p := productID(t, a)
	_, key, _ := request(t, a, "POST", "/api/conversion-keys", map[string]string{"product_id": p}, admin, "")
	bearer := key["token"].(string)
	event := map[string]any{"event_id": "purchase-1", "order_id": "order-1", "kind": "purchase", "amount": 100, "currency": "NOK", "occurred_at": "2026-10-02T12:00:00Z"}
	status, out, _ := request(t, a, "POST", "/api/conversions", event, nil, bearer)
	if status != 201 {
		t.Fatal(out)
	}
	status, _, _ = request(t, a, "POST", "/api/conversions", event, nil, bearer)
	if status != 200 {
		t.Fatal("duplicate failed")
	}
	event["amount"] = 200
	status, _, _ = request(t, a, "POST", "/api/conversions", event, nil, bearer)
	if status != 409 {
		t.Fatal("changed duplicate accepted")
	}
	event["event_id"] = "refund-1"
	event["kind"] = "refund"
	status, _, _ = request(t, a, "POST", "/api/conversions", event, nil, bearer)
	if status != 409 {
		t.Fatal("over refund accepted")
	}
	event["amount"] = 60
	status, _, _ = request(t, a, "POST", "/api/conversions", event, nil, bearer)
	if status != 201 {
		t.Fatal("valid refund failed")
	}
	event["event_id"] = "refund-2"
	status, _, _ = request(t, a, "POST", "/api/conversions", event, nil, bearer)
	if status != 409 {
		t.Fatal("multiple refunds exceed order")
	}
}
func TestJevContractAndBudget(t *testing.T) {
	a := testApp(t)
	ctx := context.Background()
	admin := setupAdmin(t, a)
	p := productID(t, a)
	item := createTestItem(t, a, admin, p)
	t.Setenv("AI_ENABLED", "true")
	t.Setenv("TYPESAFE_API_KEY", "fake-for-test")
	var uid string
	a.db.QueryRow(ctx, "SELECT id::text FROM users LIMIT 1").Scan(&uid)
	var id string
	a.db.QueryRow(ctx, "INSERT INTO jobs(product_id,version_id,user_id,kind,status) VALUES($1,$2,$3,'ranking','running') RETURNING id::text", p, item["version_id"], uid).Scan(&id)
	calls := 0
	a.http = &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.Host != "api.typesafe.ai" || r.URL.Path != "/v1/systemone" {
			t.Error("wrong endpoint")
		}
		var payload map[string]any
		json.NewDecoder(r.Body).Decode(&payload)
		q := payload["questions"].(map[string]any)
		if q["quality"].(map[string]any)["type"] != "score" {
			t.Error("wrong scoring shape")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"model":"jev-1.13.0","answers":{"quality":{"type":"score","score":2.4,"confidence":0.8,"legend":{"0":"bad","3":"great"}},"brand_fit":{"type":"noul","noul":0.9}},"usage":{"input_tokens":100}}`))}, nil
	})}
	j := jobRecord{ID: id, Product: p, Version: item["version_id"].(string), User: uid, Kind: "ranking", Config: profileConfig{modelConfig: modelConfig{Model: "jev-1.13.0", MaxCost: .1, Timeout: 30}}}
	if _, e := a.rankJev(ctx, j); e != nil {
		t.Fatal(e)
	}
	if calls != 1 {
		t.Fatal("unexpected extra calls")
	}
	j.Config.MaxCost = .00000001
	if _, e := a.rankJev(ctx, j); e == nil {
		t.Fatal("budget bypass")
	}
	if calls != 1 {
		t.Fatal("over budget made call")
	}
}
func TestSharedDailyBudget(t *testing.T) {
	a := testApp(t)
	p := productID(t, a)
	ctx := context.Background()
	a.db.Exec(ctx, "UPDATE workspace_limits SET daily_ai_usd=.1")
	id, e := a.reserveAI(ctx, p, "test", .08)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = a.reserveAI(ctx, p, "test", .03); e == nil {
		t.Fatal("reservation exceeded limit")
	}
	a.settleAI(id, .01)
	if _, e = a.reserveAI(ctx, p, "test", .03); e != nil {
		t.Fatal("settled funds not released")
	}
	a.db.Exec(ctx, "UPDATE workspace_limits SET daily_ai_usd=5")
}
func TestTimeStampedSearch(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	p := productID(t, a)
	item := createTestItem(t, a, admin, p)
	end := 12.0
	if e := a.putSegments(context.Background(), item["version_id"].(string), "test", []segmentInput{{Start: 7.5, End: &end, Kind: "speech", Body: "Mørkekjøring med nærlys"}}); e != nil {
		t.Fatal(e)
	}
	rows := listRequest(t, a, "/api/search?q=mørkekjøring&product="+p, admin)
	if len(rows) == 0 || rows[0]["start_seconds"] != 7.5 {
		t.Fatal("missing timestamp", rows)
	}
}
func TestTrackingURL(t *testing.T) {
	s, e := trackingURL("https://example.test/pay?coupon=summer", "Instagram", "c1", "p1")
	if e != nil || !strings.Contains(s, "utm_content=p1") || !strings.Contains(s, "coupon=summer") {
		t.Fatal(s, e)
	}
	if _, e = trackingURL("javascript:alert(1)", "", "", ""); e == nil {
		t.Fatal("unsafe URL accepted")
	}
	_ = time.Second
}

func TestWorkspaceEndpointsAndNotifications(t *testing.T) {
	a := testApp(t)
	c := setupAdmin(t, a)
	p := productID(t, a)
	for _, path := range []string{"/api/templates?product=", "/api/campaigns?product=", "/api/experiments?product=", "/api/claims?product=", "/api/jobs?product=", "/api/profiles?product="} {
		listRequest(t, a, path+p, c)
	}
	listRequest(t, a, "/api/notifications", c)
	var uid string
	a.db.QueryRow(context.Background(), "SELECT id::text FROM users LIMIT 1").Scan(&uid)
	a.notify(context.Background(), p, uid, "test", "A notification", "", "test-notification")
	rows := listRequest(t, a, "/api/notifications", c)
	if len(rows) != 1 {
		t.Fatal(rows)
	}
	status, out, _ := request(t, a, "POST", "/api/notifications/"+rows[0]["id"].(string)+"/read", map[string]any{}, c, "")
	if status != 200 {
		t.Fatal(out)
	}
	rows = listRequest(t, a, "/api/notifications", c)
	if rows[0]["read"] != true {
		t.Fatal("read marker missing")
	}
	for _, path := range []string{"/api/operations", "/api/insights?product=" + p, "/api/library?product=" + p} {
		status, out, _ := request(t, a, "GET", path, nil, c, "")
		if status != 200 {
			t.Fatal(path, out)
		}
	}
}

func TestArtifactQuotaAndReplacement(t *testing.T) {
	a := testApp(t)
	c := setupAdmin(t, a)
	ctx := context.Background()
	p := productID(t, a)
	item := createTestItem(t, a, c, p)
	v := item["version_id"].(string)
	a.db.Exec(ctx, "UPDATE workspace_limits SET storage_bytes=1000")
	defer a.db.Exec(ctx, "UPDATE workspace_limits SET storage_bytes=21474836480")
	writeFile := func(key string, n int) {
		t.Helper()
		if e := os.WriteFile(filepath.Join(a.storage, key), bytes.Repeat([]byte("a"), n), 0600); e != nil {
			t.Fatal(e)
		}
	}
	first := token()
	writeFile(first, 600)
	if e := a.saveArtifact(ctx, v, "thumbnail", first, "image/jpeg"); e != nil {
		t.Fatal(e)
	}
	next := token()
	writeFile(next, 800)
	if e := a.saveArtifact(ctx, v, "thumbnail", next, "image/jpeg"); e != nil {
		t.Fatal(e)
	}
	if _, e := os.Stat(filepath.Join(a.storage, first)); !os.IsNotExist(e) {
		t.Fatal("replaced preview leaked")
	}
	over := token()
	writeFile(over, 300)
	if e := a.saveArtifact(ctx, v, "proxy", over, "video/mp4"); e == nil {
		t.Fatal("artifact bypassed quota")
	}
	if _, e := os.Stat(filepath.Join(a.storage, over)); !os.IsNotExist(e) {
		t.Fatal("failed artifact not removed")
	}
	status, _, _ := request(t, a, "POST", "/api/upload-sessions", map[string]any{"product_id": p, "file_name": "too-big.bin", "size": 300}, c, "")
	if status != 409 {
		t.Fatal("upload did not count artifacts", status)
	}
}

func TestStreamingCompletionAndBoundedTools(t *testing.T) {
	a := testApp(t)
	setupAdmin(t, a)
	stream := `data: {"model":"test/model","choices":[{"delta":{"content":"Hei "}}]}

data: {"choices":[{"delta":{"content":"Studio"},"finish_reason":"stop"}]}

data: {"usage":{"cost":0.001},"choices":[]}

data: [DONE]

`
	a.http = &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": []string{"text/event-stream"}}, Body: io.NopCloser(strings.NewReader(stream))}, nil
	})}
	var out completion
	if e := a.streamCompletion(context.Background(), "00000000-0000-0000-0000-000000000000", map[string]any{}, &out); e != nil {
		t.Fatal(e)
	}
	if len(out.Choices) != 1 || out.Choices[0].Message.Content != "Hei Studio" || out.Usage.Cost == nil || *out.Usage.Cost != .001 {
		t.Fatal(out)
	}
	stream = `data: {"choices":[{"delta":{"tool_calls":[{"index":4,"id":"bad"}]}}]}` + "\n"
	if e := a.streamCompletion(context.Background(), "00000000-0000-0000-0000-000000000000", map[string]any{}, &out); e == nil {
		t.Fatal("unbounded stream tool calls")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	a.http = &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) { return nil, r.Context().Err() })}
	if e := a.streamCompletion(ctx, "", map[string]any{}, &out); e == nil {
		t.Fatal("canceled stream accepted")
	}
}

func TestChatRevisionRequiresHumanActivation(t *testing.T) {
	a := testApp(t)
	c := setupAdmin(t, a)
	p := productID(t, a)
	ctx := context.Background()
	_, task, _ := request(t, a, "POST", "/api/tasks", map[string]any{"product_id": p, "title": "Revision", "status": "review", "executor": "external"}, c, "")
	id := task["id"].(string)
	out, e := a.draftRevision(ctx, Actor{Name: "Studio"}, p, id, "Shorter opening")
	if e != nil || out["status"] != "idea" {
		t.Fatal(out, e)
	}
	a.db.Exec(ctx, "UPDATE tasks SET status='running' WHERE id=$1", id)
	if _, e = a.draftRevision(ctx, Actor{Name: "Studio"}, p, id, "Interrupt active work"); e == nil {
		t.Fatal("active work overwritten")
	}
}
