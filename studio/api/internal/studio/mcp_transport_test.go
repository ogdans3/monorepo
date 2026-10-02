package studio

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMCPPublicEndpointAndTransport(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	a.origin = "https://studio.freelunch.no"
	status, key, _ := request(t, a, "POST", "/api/agent-tokens", map[string]string{"name": "Transport test", "product_id": productID(t, a)}, admin, "")
	if status != 201 || key["endpoint"] != a.origin+"/mcp" {
		t.Fatal("agent must receive the configured public endpoint", status, key["endpoint"])
	}
	bearer := "Bearer " + key["token"].(string)
	for _, test := range []struct {
		name, method, authorization, origin, version string
		status                                       int
	}{
		{"missing key without origin", "POST", "", "", "", 401},
		{"invalid key", "POST", "Bearer invalid", "", "", 401},
		{"external client", "POST", bearer, "", "2025-11-25", 200},
		{"same origin client", "POST", bearer, a.origin, "2025-06-18", 200},
		{"foreign origin", "POST", bearer, "https://foreign.example", "", 403},
		{"unsupported version", "POST", bearer, "", "invalid", 400},
		{"no standalone SSE stream", "GET", bearer, "", "", 405},
		{"stateless session", "DELETE", bearer, "", "", 405},
	} {
		t.Run(test.name, func(t *testing.T) {
			r := httptest.NewRequest(test.method, "/mcp", bytes.NewBufferString(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Accept", "application/json, text/event-stream")
			r.Header.Set("Authorization", test.authorization)
			r.Header.Set("Origin", test.origin)
			r.Header.Set("MCP-Protocol-Version", test.version)
			w := httptest.NewRecorder()
			a.Handler().ServeHTTP(w, r)
			if w.Code != test.status {
				t.Fatalf("got %d want %d: %s", w.Code, test.status, w.Body.String())
			}
			if test.status == http.StatusUnauthorized && w.Header().Get("WWW-Authenticate") == "" {
				t.Fatal("missing bearer challenge")
			}
			if test.status == http.StatusMethodNotAllowed && w.Header().Get("Allow") != "POST" {
				t.Fatal("missing supported method")
			}
		})
	}
}
