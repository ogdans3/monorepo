package studio

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func adPNG(t *testing.T) []byte {
	t.Helper()
	im := image.NewRGBA(image.Rect(0, 0, 32, 32))
	im.Set(1, 1, color.RGBA{240, 120, 30, 255})
	var b bytes.Buffer
	if err := png.Encode(&b, im); err != nil {
		t.Fatal(err)
	}
	return b.Bytes()
}

func adAgent(t *testing.T, a *App, admin *http.Cookie, p string) (Actor, string) {
	t.Helper()
	status, key, _ := request(t, a, "POST", "/api/agent-tokens", map[string]string{"name": "Ad renderer", "product_id": p}, admin, "")
	if status != 201 {
		t.Fatal(status, key)
	}
	return Actor{ID: key["id"].(string), Name: "Ad renderer", Role: "editor", Agent: true, Product: p}, key["token"].(string)
}

func prepareAdFile(t *testing.T, a *App, agent Actor, bearer, ad, expected string) map[string]any {
	t.Helper()
	content := adPNG(t)
	result, err := a.callMCP(context.Background(), agent, "studio_prepare_ad_upload", map[string]string{
		"ad_id": ad, "expected_version_id": expected, "file_name": "very-long-render-name-with-hook-and-cta-iteration.png", "size": fmt.Sprint(len(content)), "body": "Shorter introduction",
	})
	if err != nil {
		t.Fatal(err)
	}
	start := result.(map[string]any)
	r := httptest.NewRequest("PATCH", start["upload_path"].(string), bytes.NewReader(content))
	r.Header.Set("Authorization", "Bearer "+bearer)
	r.Header.Set("Upload-Offset", "0")
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	return start
}

func TestAdAgentVersionsAndExactReviews(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	p := productID(t, a)
	ctx := context.Background()
	agent, bearer := adAgent(t, a, admin, p)
	args := map[string]string{"title": "One stable ad concept", "external_key": "theory-ugc-01", "ad_type": "UGC"}
	// Concurrent retries must create one concept, without a placeholder v1.
	type answer struct {
		value any
		err   error
	}
	results := make(chan answer, 2)
	for range 2 {
		go func() { v, e := a.callMCP(ctx, agent, "studio_create_ad", args); results <- answer{v, e} }()
	}
	var id string
	for range 2 {
		r := <-results
		if r.err != nil {
			t.Fatal(r.err)
		}
		got := r.value.(map[string]any)["id"].(string)
		if id != "" && id != got {
			t.Fatal("duplicate ad")
		}
		id = got
	}
	var count int
	a.db.QueryRow(ctx, "SELECT count(*) FROM versions WHERE item_id=$1", id).Scan(&count)
	if count != 0 {
		t.Fatal("empty ad created a phantom render")
	}
	first := prepareAdFile(t, a, agent, bearer, id, "")
	status, v1, _ := request(t, a, "POST", first["complete_path"].(string), map[string]any{}, nil, bearer)
	if status != 201 || v1["id"] != id {
		t.Fatal(status, v1)
	}
	status, again, _ := request(t, a, "POST", first["complete_path"].(string), map[string]any{}, nil, bearer)
	if status != 200 || again["version_id"] != v1["version_id"] {
		t.Fatal("upload completion is not idempotent", again)
	}
	version := v1["version_id"].(string)
	status, out, _ := request(t, a, "POST", "/api/ads/"+id+"/review", map[string]string{"version_id": version, "status": "changes_requested", "body": "Show the product earlier"}, admin, "")
	if status != 200 {
		t.Fatal(status, out)
	}
	status, out, _ = request(t, a, "POST", "/api/items/"+id+"/notes", map[string]any{"version_id": version, "body": "Cut this pause", "at_seconds": 1.5}, admin, "")
	if status != 201 {
		t.Fatal(status, out)
	}
	// Legacy human approval must also persist history before another render arrives.
	status, out, _ = request(t, a, "POST", "/api/items/"+id+"/approve", map[string]string{"version_id": version}, admin, "")
	if status != 200 {
		t.Fatal(status, out)
	}
	second := prepareAdFile(t, a, agent, bearer, id, version)
	concurrent := prepareAdFile(t, a, agent, bearer, id, version)
	status, v2, _ := request(t, a, "POST", second["complete_path"].(string), map[string]any{}, nil, bearer)
	if status != 201 || v2["id"] != id {
		t.Fatal(status, v2)
	}
	status, _, _ = request(t, a, "POST", concurrent["complete_path"].(string), map[string]any{}, nil, bearer)
	if status != 409 {
		t.Fatal("stale render overwrote the new version", status)
	}
	status, _, _ = request(t, a, "POST", "/api/ads/"+id+"/review", map[string]string{"version_id": version, "status": "approved"}, admin, "")
	if status != 409 {
		t.Fatal("stale approval accepted", status)
	}
	status, _, _ = request(t, a, "POST", "/api/ads/"+id+"/review", map[string]string{"version_id": v2["version_id"].(string), "status": "approved"}, nil, bearer)
	if status != 403 {
		t.Fatal("agent can approve", status)
	}
	data, err := a.adData(ctx, id, p)
	if err != nil {
		t.Fatal(err)
	}
	item := data["item"].(map[string]any)
	if item["title"] != args["title"] || item["status"] != "review" || item["current_version_id"] != v2["version_id"] {
		t.Fatal(item)
	}
	versions := data["versions"].([]map[string]any)
	if len(versions) != 2 || fmt.Sprint(versions[0]["number"]) != "2" || fmt.Sprint(versions[1]["number"]) != "1" {
		t.Fatal(versions)
	}
	if len(data["reviews"].([]map[string]any)) != 2 || len(data["notes"].([]map[string]any)) != 1 {
		t.Fatal("review history lost")
	}
	if _, err = a.callMCP(ctx, agent, "studio_create_version", map[string]string{"payload": fmt.Sprintf(`{"item_id":%q,"expected_version_id":%q,"title":"Fake new render"}`, id, v2["version_id"])}); err == nil {
		t.Fatal("text-only ad render accepted")
	}
	// A scoped agent cannot read or upload into another product.
	var other string
	a.db.QueryRow(ctx, "INSERT INTO products(name) VALUES('Other') RETURNING id::text").Scan(&other)
	outsider := agent
	outsider.Product = other
	if _, err = a.callMCP(ctx, outsider, "studio_get_ad", map[string]string{"ad_id": id}); err == nil {
		t.Fatal("cross-product ad read")
	}
	if _, err = a.callMCP(ctx, outsider, "studio_prepare_ad_upload", map[string]string{"ad_id": id, "expected_version_id": v2["version_id"].(string), "file_name": "a.png", "size": "100"}); err == nil {
		t.Fatal("cross-product upload")
	}
	reader := userCookie(t, a, admin, "reader@example.test", "reader")
	status, _, _ = request(t, a, "POST", "/api/ads/"+id+"/review", map[string]string{"version_id": v2["version_id"].(string), "status": "approved"}, reader, "")
	if status != 403 {
		t.Fatal("reader can approve", status)
	}
}

func TestAdGroupingPreviewsAndPrivateMediaCache(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	p := productID(t, a)
	ctx := context.Background()
	agent, bearer := adAgent(t, a, admin, p)
	result, err := a.createAd(ctx, agent, adInput{Product: p, Title: "Source", Key: "source"})
	if err != nil {
		t.Fatal(err)
	}
	source := result["id"].(string)
	start := prepareAdFile(t, a, agent, bearer, source, "")
	status, out, _ := request(t, a, "POST", start["complete_path"].(string), map[string]any{}, nil, bearer)
	if status != 201 {
		t.Fatal(status, out)
	}
	v := out["version_id"].(string)
	a.queueMedia(ctx, p, v, "")
	a.backfillPreviews(ctx)
	a.backfillPreviews(ctx)
	var count int
	a.db.QueryRow(ctx, "SELECT count(*) FROM jobs WHERE version_id=$1 AND kind='thumbnail'", v).Scan(&count)
	if count != 1 {
		t.Fatal("unbounded preview jobs", count)
	}
	a.db.Exec(ctx, "UPDATE jobs SET status='failed' WHERE version_id=$1 AND kind='thumbnail'", v)
	a.backfillPreviews(ctx)
	a.db.QueryRow(ctx, "SELECT count(*) FROM jobs WHERE version_id=$1 AND kind='thumbnail'", v).Scan(&count)
	if count != 1 {
		t.Fatal("failed previews retried automatically")
	}
	key := "shared-preview.png"
	if err = os.WriteFile(filepath.Join(a.storage, key), adPNG(t), 0600); err != nil {
		t.Fatal(err)
	}
	if err = a.saveArtifact(ctx, v, "thumbnail", key, "image/png"); err != nil {
		t.Fatal(err)
	}
	result, err = a.createAd(ctx, agent, adInput{Product: p, Title: "Grouped", Key: "grouped"})
	if err != nil {
		t.Fatal(err)
	}
	id := result["id"].(string)
	body := map[string]string{"source_version_id": v, "expected_version_id": ""}
	status, copy, _ := request(t, a, "POST", "/api/ads/"+id+"/versions/from-item", body, admin, "")
	if status != 201 {
		t.Fatal(status, copy)
	}
	status, retry, _ := request(t, a, "POST", "/api/ads/"+id+"/versions/from-item", body, admin, "")
	if status != 200 || copy["version_id"] != retry["version_id"] {
		t.Fatal("group retry duplicated version", retry)
	}
	if err = os.WriteFile(filepath.Join(a.storage, "replacement.png"), adPNG(t), 0600); err != nil {
		t.Fatal(err)
	}
	if err = a.saveArtifact(ctx, v, "thumbnail", "replacement.png", "image/png"); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(filepath.Join(a.storage, key)); err != nil {
		t.Fatal("grouped preview was deleted", err)
	}
	// Both original files and generated previews revalidate authorization on cache hits.
	for _, path := range []string{"/api/files/" + copy["version_id"].(string), "/api/previews/" + copy["version_id"].(string) + "?kind=thumbnail"} {
		get := func(cookie *http.Cookie, etag, byteRange string) *httptest.ResponseRecorder {
			r := httptest.NewRequest("GET", path, nil)
			if cookie != nil {
				r.AddCookie(cookie)
			}
			r.Header.Set("If-None-Match", etag)
			r.Header.Set("Range", byteRange)
			w := httptest.NewRecorder()
			a.Handler().ServeHTTP(w, r)
			return w
		}
		full := get(admin, "", "")
		etag := full.Header().Get("ETag")
		if full.Code != 200 || etag == "" || !strings.Contains(full.Header().Get("Cache-Control"), "private") {
			t.Fatal(full.Code, full.Header())
		}
		if got := get(admin, etag, ""); got.Code != 304 {
			t.Fatal("cache not revalidated", got.Code)
		}
		if got := get(nil, etag, ""); got.Code != 401 {
			t.Fatal("cached media bypasses auth", got.Code)
		}
		if got := get(admin, "", "bytes=0-7"); got.Code != 206 || !bytes.Equal(got.Body.Bytes(), adPNG(t)[:8]) {
			t.Fatal("range broken", got.Code)
		}
	}
	a.db.Exec(ctx, "UPDATE items SET deleted_at=now() WHERE id=$1", id)
	status, _, _ = request(t, a, "GET", "/api/previews/"+copy["version_id"].(string)+"?kind=thumbnail", nil, admin, "")
	if status != 404 && status != 403 {
		t.Fatal("deleted media accessible", status)
	}
}

// Page navigation rechecks the session; it must not consume the strict login limit.
func TestReviewNavigationAuthStatusLimit(t *testing.T) {
	a := testApp(t)
	for n := 0; n < 35; n++ {
		status, _, _ := request(t, a, "GET", "/api/auth/status", nil, nil, "")
		if status != 200 {
			t.Fatalf("session status blocked after %d reads: %d", n, status)
		}
	}
	for n := 0; n < 31; n++ {
		status, _, _ := request(t, a, "POST", "/api/auth/login", credentials{Email: "missing@example.test", Password: "wrong"}, nil, "")
		want := 401
		if n == 30 {
			want = 429
		}
		if status != want {
			t.Fatalf("login %d: got %d want %d", n, status, want)
		}
	}
}
