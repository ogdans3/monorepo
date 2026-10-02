package studio

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestNormalizeSocialURL(t *testing.T) {
	for raw, want := range map[string]string{
		"instagram.com/reel/AbC/?igsh=x#hi":               "https://www.instagram.com/reel/AbC/",
		"https://m.tiktok.com/@user/video/1234?track=yes": "https://www.tiktok.com/@user/video/1234",
		"https://vm.tiktok.com/abc":                       "https://vm.tiktok.com/abc/",
		"https://snapchat.com/spotlight/ABC_/":            "https://www.snapchat.com/spotlight/ABC_",
	} {
		got, _, e := normalizeSocialURL(raw)
		if e != nil || got != want {
			t.Fatalf("%q: %q %v", raw, got, e)
		}
	}
	for _, raw := range []string{"http://instagram.com/reel/x/", "https://127.0.0.1/reel/x/", "https://instagram.com.evil.test/reel/x/", "https://x@instagram.com/reel/x/", "https://instagram.com:22/reel/x/", "https://instagram.com/person", "https://instagram.com/reel/%2e%2e/", "https://snapchat.com/add/person", "file:///tmp/video"} {
		if _, _, e := normalizeSocialURL(raw); e == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}
func queuedImport(t *testing.T, a *App, c *http.Cookie, p, url string) string {
	t.Helper()
	status, out, _ := request(t, a, "POST", "/api/imports", importInput{Product: p, URL: url}, c, "")
	if status != 202 {
		t.Fatalf("enqueue %d %v", status, out)
	}
	return out["id"].(string)
}
func claimImport(t *testing.T, a *App, id string) importRecord {
	t.Helper()
	var m importRecord
	e := a.db.QueryRow(context.Background(), `UPDATE media_imports SET status='downloading' WHERE id=$1 RETURNING id::text,product_id::text,source_url,platform,actor_id,actor_name,actor_agent,title,rights,coalesce(collection_id::text,''),reserved_bytes`, id).Scan(&m.ID, &m.Product, &m.URL, &m.Platform, &m.ActorID, &m.ActorName, &m.Agent, &m.Title, &m.Rights, &m.Collection, &m.Reserved)
	if e != nil {
		t.Fatal(e)
	}
	return m
}
func fixtureImport(ctx context.Context, url, dir string, max int64, progress func(int64, int64)) (downloadedVideo, error) {
	data := append([]byte{0, 0, 0, 32}, []byte("ftypiso5\x00\x00\x00\x01iso5dsmsmsixdash")...)
	silent := false
	e := os.WriteFile(filepath.Join(dir, "media.mp4"), data, 0600)
	progress(int64(len(data)), int64(len(data)))
	return downloadedVideo{FileName: "media.mp4", MIME: "video/mp4", HasAudio: &silent, Title: "Merkevare og emballasjedesign", Description: "Typografi og logo for bakeri", Uploader: "Designer", Tags: []string{"design"}, Height: 1080, Width: 720, Duration: 15, Extractor: "Instagram"}, e
}
func TestImportStoresOnceAndKeepsProvenance(t *testing.T) {
	a := testApp(t)
	c := setupAdmin(t, a)
	p := productID(t, a)
	ctx := context.Background()
	a.importDownload = fixtureImport
	id := queuedImport(t, a, c, p, "https://instagram.com/reel/Example/")
	if same := queuedImport(t, a, c, p, "https://www.instagram.com/reel/Example/?igsh=tracking"); same != id {
		t.Fatal("URL duplicate queued", same)
	}
	a.executeImport(ctx, claimImport(t, a, id))
	rows := listRequest(t, a, "/api/imports?product="+p, c)
	if len(rows) != 1 || rows[0]["status"] != "completed" || rows[0]["media_status"] != "queued" {
		t.Fatal(rows)
	}
	var item, version, rights, status, source, key, category string
	var reserved int64
	e := a.db.QueryRow(ctx, `SELECT i.id::text,v.id::text,i.rights,i.status,i.source_url,v.file_key,i.metadata->'classification'->>'status',m.reserved_bytes FROM media_imports m JOIN items i ON i.id=m.item_id JOIN versions v ON v.id=m.version_id WHERE m.id=$1`, id).Scan(&item, &version, &rights, &status, &source, &key, &category, &reserved)
	if e != nil || rights != "reference_only" || status != "draft" || category != "pending" || reserved != 0 || source != "https://www.instagram.com/reel/Example/" {
		t.Fatal(e, rights, status, category, reserved, source)
	}
	if _, e = os.Stat(filepath.Join(a.storage, key)); e != nil {
		t.Fatal(e)
	}
	var provenance string
	a.db.QueryRow(ctx, "SELECT provenance->>'uploader' FROM versions WHERE id=$1", version).Scan(&provenance)
	if provenance != "Designer" {
		t.Fatal("provenance lost", provenance)
	}
	if _, e := a.transcribe(ctx, jobRecord{Version: version}); e != nil {
		t.Fatal("silent imported video must skip speech inference", e)
	}
	second := queuedImport(t, a, c, p, "https://www.tiktok.com/@author/video/1234")
	a.executeImport(ctx, claimImport(t, a, second))
	var duplicate bool
	var secondItem string
	a.db.QueryRow(ctx, "SELECT duplicate,item_id::text FROM media_imports WHERE id=$1", second).Scan(&duplicate, &secondItem)
	if !duplicate || secondItem != item {
		t.Fatal("byte duplicate stored again", duplicate, secondItem)
	}
	var count int
	a.db.QueryRow(ctx, "SELECT count(*) FROM jobs").Scan(&count)
	if count != 1 {
		t.Fatal("duplicate media job", count)
	}
	code, _, _ := request(t, a, "POST", "/api/imports/"+id+"/retry", nil, c, "")
	if code != 409 {
		t.Fatal("retried completed", code)
	}
}
func TestImportPermissionsAndAgentScope(t *testing.T) {
	a := testApp(t)
	c := setupAdmin(t, a)
	p := productID(t, a)
	reader := userCookie(t, a, c, "reader@test.example", "reader")
	code, _, _ := request(t, a, "POST", "/api/imports", importInput{Product: p, URL: "https://instagram.com/reel/test/"}, reader, "")
	if code != 403 {
		t.Fatal("reader imported", code)
	}
	editor := userCookie(t, a, c, "editor@test.example", "editor")
	_, private, _ := request(t, a, "POST", "/api/products", map[string]any{"name": "Private", "restricted": true}, c, "")
	privateID := private["id"].(string)
	id := queuedImport(t, a, c, privateID, "https://instagram.com/reel/private/")
	code, _, _ = request(t, a, "GET", "/api/imports?product="+privateID, nil, editor, "")
	if code != 403 {
		t.Fatal("private import list allowed", code)
	}
	code, _, _ = request(t, a, "POST", "/api/imports/"+id+"/cancel", nil, editor, "")
	if code != 403 {
		t.Fatal("cross-product cancellation", code)
	}
	code, _, _ = request(t, a, "POST", "/api/imports", importInput{Product: privateID, URL: "https://instagram.com/reel/other/"}, editor, "")
	if code != 400 {
		t.Fatal("private import allowed", code)
	}
	_, key, _ := request(t, a, "POST", "/api/agent-tokens", map[string]string{"name": "Importer", "product_id": p}, c, "")
	if key["id"] == nil {
		t.Fatal("agent token setup", key)
	}
	u := Actor{ID: key["id"].(string), Name: "Importer", Product: p, Role: "editor", Agent: true}
	out, e := a.callMCP(context.Background(), u, "studio_import_url", map[string]string{"url": "https://instagram.com/reel/agent/", "product_id": privateID})
	if e != nil {
		t.Fatal(e)
	}
	mid := out.(map[string]any)["id"].(string)
	var actual string
	a.db.QueryRow(context.Background(), "SELECT product_id::text FROM media_imports WHERE id=$1", mid).Scan(&actual)
	if actual != p {
		t.Fatal("agent escaped scope")
	}
	a.db.Exec(context.Background(), "UPDATE agent_tokens SET revoked_at=now() WHERE id=$1", u.ID)
	a.importDownload = func(context.Context, string, string, int64, func(int64, int64)) (downloadedVideo, error) {
		t.Error("revoked agent downloaded")
		return downloadedVideo{}, fmt.Errorf("unexpected")
	}
	a.executeImport(context.Background(), claimImport(t, a, mid))
	var errorCode string
	a.db.QueryRow(context.Background(), "SELECT error_code FROM media_imports WHERE id=$1", mid).Scan(&errorCode)
	if errorCode != "access_revoked" {
		t.Fatal(errorCode)
	}
}
func TestImportCancellationReleasesStorageAndRetry(t *testing.T) {
	a := testApp(t)
	c := setupAdmin(t, a)
	p := productID(t, a)
	ctx := context.Background()
	id := queuedImport(t, a, c, p, "https://instagram.com/reel/cancel/")
	started, done := make(chan struct{}), make(chan struct{})
	a.importDownload = func(ctx context.Context, url, dir string, max int64, progress func(int64, int64)) (downloadedVideo, error) {
		os.WriteFile(filepath.Join(dir, "media.part"), []byte("partial"), 0600)
		close(started)
		<-ctx.Done()
		return downloadedVideo{}, ctx.Err()
	}
	m := claimImport(t, a, id)
	go func() { a.executeImport(ctx, m); close(done) }()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("download did not start")
	}
	code, _, _ := request(t, a, "POST", "/api/imports/"+id+"/cancel", nil, c, "")
	if code != 200 {
		t.Fatal(code)
	}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("cancel did not stop worker")
	}
	var state string
	var reserved int64
	a.db.QueryRow(ctx, "SELECT status,reserved_bytes FROM media_imports WHERE id=$1", id).Scan(&state, &reserved)
	if state != "cancelled" || reserved != 0 {
		t.Fatal(state, reserved)
	}
	if _, e := os.Stat(filepath.Join(a.storage, ".imports", id)); !os.IsNotExist(e) {
		t.Fatal("temporary files retained", e)
	}
	var n int
	a.db.QueryRow(ctx, "SELECT count(*) FROM items").Scan(&n)
	if n != 0 {
		t.Fatal("cancelled import created item")
	}
	code, out, _ := request(t, a, "POST", "/api/imports/"+id+"/retry", nil, c, "")
	if code != 202 || out["id"] == id {
		t.Fatal(code, out)
	}
}
func TestConcurrentImportQuotaAndJobLimit(t *testing.T) {
	a := testApp(t)
	c := setupAdmin(t, a)
	p := productID(t, a)
	ctx := context.Background()
	var original int64
	var jobs int
	a.db.QueryRow(ctx, "SELECT storage_bytes,max_active_jobs FROM workspace_limits").Scan(&original, &jobs)
	t.Cleanup(func() {
		a.db.Exec(ctx, "UPDATE workspace_limits SET storage_bytes=$1,max_active_jobs=$2", original, jobs)
	})
	a.db.Exec(ctx, "UPDATE workspace_limits SET storage_bytes=$1,max_active_jobs=20", maxImportBytes)
	var u Actor
	a.db.QueryRow(ctx, "SELECT id::text,name,role FROM users LIMIT 1").Scan(&u.ID, &u.Name, &u.Role)
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		go func(i int) {
			_, e := a.enqueueImport(ctx, u, importInput{Product: p, URL: fmt.Sprintf("https://instagram.com/reel/quota%d/", i)})
			results <- e
		}(i)
	}
	success := 0
	for i := 0; i < 2; i++ {
		if <-results == nil {
			success++
		}
	}
	if success != 1 {
		t.Fatal("overreserved storage", success)
	}
	code, _, _ := request(t, a, "POST", "/api/upload-sessions", map[string]any{"product_id": p, "file_name": "other.mp4", "size": 1000, "title": "Upload", "rights": "owned"}, c, "")
	if code == 201 || code == 200 {
		t.Fatal("upload ignored import reservation")
	}
	a.db.Exec(ctx, "UPDATE workspace_limits SET storage_bytes=$1,max_active_jobs=1", original)
	if _, e := a.enqueueImport(ctx, u, importInput{Product: p, URL: "https://instagram.com/reel/queuefull/"}); e == nil || !strings.Contains(e.Error(), "Jobbkøen") {
		t.Fatal("job limit ignored", e)
	}
}
func TestImportedCategoryManualChoiceWinsDuringInference(t *testing.T) {
	a := testApp(t)
	c := setupAdmin(t, a)
	p := productID(t, a)
	ctx := context.Background()
	a.importDownload = fixtureImport
	id := queuedImport(t, a, c, p, "https://instagram.com/reel/classify/")
	a.executeImport(ctx, claimImport(t, a, id))
	var item, version string
	a.db.QueryRow(ctx, "SELECT item_id::text,version_id::text FROM media_imports WHERE id=$1", id).Scan(&item, &version)
	entered, release := make(chan struct{}), make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/categorize" {
			fail(w, 422, "Not used in this test")
			return
		}
		close(entered)
		<-release
		write(w, 200, map[string]string{"category": "mat_drikke", "status": "suggested"})
	}))
	defer server.Close()
	t.Setenv("INTELLIGENCE_URL", server.URL)
	done := make(chan error, 1)
	go func() { done <- a.classifyImported(ctx, version) }()
	<-entered
	code, out, _ := request(t, a, "PATCH", "/api/items/"+item+"/category", map[string]string{"category": "merkevare_design"}, c, "")
	close(release)
	if e := <-done; e != nil {
		t.Fatal(e)
	}
	if code != 200 {
		t.Fatal(code, out)
	}
	var category, status string
	a.db.QueryRow(ctx, "SELECT metadata->'classification'->>'category',metadata->'classification'->>'status' FROM items WHERE id=$1", item).Scan(&category, &status)
	if category != "merkevare_design" || status != "manual" {
		t.Fatal("model overwrote manual category", category, status)
	}
	if e := a.classifyImported(ctx, version); e != nil {
		t.Fatal(e)
	} // must not call the server a second time
	reader := userCookie(t, a, c, "reader@test.example", "reader")
	code, _, _ = request(t, a, "PATCH", "/api/items/"+item+"/category", map[string]string{"category": "mat_drikke"}, reader, "")
	if code != 403 {
		t.Fatal("reader edited category", code)
	}
	if hits := listRequest(t, a, "/api/search?q=merkevare&product="+p, c); len(hits) == 0 {
		t.Fatal("category not searchable")
	}
}
