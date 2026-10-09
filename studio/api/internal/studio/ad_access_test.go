package studio

import (
	"context"
	"strings"
	"testing"
)

func TestInvitedEditorAdAccess(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	editor := userCookie(t, a, admin, "invited-editor@example.test", "editor")
	product := productID(t, a)
	status, ad, _ := request(t, a, "POST", "/api/ads", adInput{Product: product, Title: "Shared ad"}, admin, "")
	if status != 201 {
		t.Fatal(status, ad)
	}
	id := ad["id"].(string)
	status, folder, _ := request(t, a, "POST", "/api/ad-folders", adFolderInput{Product: product, Name: "In review"}, admin, "")
	if status != 200 {
		t.Fatal(status, folder)
	}
	var userID string
	if err := a.db.QueryRow(context.Background(), "SELECT id::text FROM users WHERE email='invited-editor@example.test'").Scan(&userID); err != nil {
		t.Fatal(err)
	}
	for _, restricted := range []bool{false, true} {
		role := ""
		if restricted {
			role = "editor"
		}
		status, out, _ := request(t, a, "PUT", "/api/products/"+product+"/members", map[string]any{"restricted": restricted, "user_id": userID, "role": role}, admin, "")
		if status != 200 {
			t.Fatal(status, out)
		}
		for _, path := range []string{"/api/items?product=" + product, "/api/ads?product=" + product, "/api/ad-folders?product=" + product} {
			if rows := listRequest(t, a, path, editor); len(rows) != 1 {
				t.Fatalf("editor cannot list shared content (restricted=%v): %s: %v", restricted, path, rows)
			}
		}
		status, detail, _ := request(t, a, "GET", "/api/ads/"+id, nil, editor, "")
		if status != 200 || detail["item"].(map[string]any)["id"] != id {
			t.Fatal("editor cannot review shared ad", status, detail)
		}
		status, out, _ = request(t, a, "PATCH", "/api/ads/"+id, map[string]string{"title": "Edited shared ad", "ad_type": "UGC", "brief": "Updated by invited editor"}, editor, "")
		if status != 200 {
			t.Fatal("editor cannot edit shared ad", status, out)
		}
	}
	status, out, _ := request(t, a, "PUT", "/api/products/"+product+"/members", map[string]string{"user_id": userID, "role": ""}, admin, "")
	if status != 200 {
		t.Fatal(status, out)
	}
	for _, path := range []string{"/api/items?product=" + product, "/api/ads?product=" + product, "/api/ad-folders?product=" + product, "/api/ads/" + id} {
		status, _, _ := request(t, a, "GET", path, nil, editor, "")
		if status != 403 {
			t.Fatal("revoked product access allowed", path, status)
		}
	}
}

func TestProjectInvitesGrantOnlySelectedProduct(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	status, selected, _ := request(t, a, "POST", "/api/products", map[string]any{"name": "Selected project", "restricted": true}, admin, "")
	if status != 201 {
		t.Fatal(status, selected)
	}
	product := selected["id"].(string)
	status, other, _ := request(t, a, "POST", "/api/products", map[string]any{"name": "Another private project", "restricted": true}, admin, "")
	if status != 201 {
		t.Fatal(status, other)
	}
	status, ad, _ := request(t, a, "POST", "/api/ads", adInput{Product: product, Title: "Private ad"}, admin, "")
	if status != 201 {
		t.Fatal(status, ad)
	}
	for _, role := range []string{"editor", "reader", "unscoped"} {
		t.Run(role, func(t *testing.T) {
			email := role + "-project@example.test"
			input := map[string]string{"email": email, "role": role, "product_id": product}
			if role == "unscoped" {
				input["role"] = "editor"
				delete(input, "product_id") // Invitations created by older clients keep their original scope.
			}
			status, inv, _ := request(t, a, "POST", "/api/invites", input, admin, "")
			if status != 201 {
				t.Fatal(status, inv)
			}
			key := strings.Split(inv["url"].(string), "#invite=")[1]
			credentials := credentials{Email: email, Name: role, Password: "safe-test-password", Token: key}
			status, out, cookies := request(t, a, "POST", "/api/auth/accept", credentials, nil, "")
			if status != 200 || len(cookies) != 1 {
				t.Fatal(status, out)
			}
			cookie := cookies[0]
			want := 200
			if role == "unscoped" {
				want = 403
			}
			for _, path := range []string{"/api/ads?product=" + product, "/api/ad-folders?product=" + product, "/api/items?product=" + product, "/api/ads/" + ad["id"].(string)} {
				status, out, _ := request(t, a, "GET", path, nil, cookie, "")
				if status != want {
					t.Fatal(path, status, out)
				}
			}
			want = 403
			if role == "editor" {
				want = 200
			}
			status, out, _ = request(t, a, "PATCH", "/api/ads/"+ad["id"].(string), map[string]string{"title": "Changed ad", "ad_type": "UGC", "brief": "Changed by editor"}, cookie, "")
			if status != want {
				t.Fatal("incorrect write access", status, out)
			}
			status, _, _ = request(t, a, "GET", "/api/ads?product="+other["id"].(string), nil, cookie, "")
			if status != 403 {
				t.Fatal("unrelated private project exposed", status)
			}
			status, _, _ = request(t, a, "POST", "/api/auth/accept", credentials, nil, "")
			if status != 400 {
				t.Fatal("project invitation reused", status)
			}
			var memberships int
			if err := a.db.QueryRow(context.Background(), "SELECT count(*) FROM product_members m JOIN users u ON u.id=m.user_id WHERE u.email=$1", email).Scan(&memberships); err != nil {
				t.Fatal(err)
			}
			wantMembers := 1
			if role == "unscoped" {
				wantMembers = 0
			}
			if memberships != wantMembers {
				t.Fatal("unexpected memberships", memberships)
			}
		})
	}
	for _, input := range []map[string]string{
		{"email": "invalid@example.test", "role": "editor", "product_id": "invalid"},
		{"email": "missing@example.test", "role": "editor", "product_id": "00000000-0000-0000-0000-000000000000"},
		{"email": "admin@example.test", "role": "admin", "product_id": product},
	} {
		status, _, _ := request(t, a, "POST", "/api/invites", input, admin, "")
		if status != 400 {
			t.Fatal("invalid project invitation accepted", status)
		}
	}
	for _, inv := range listRequest(t, a, "/api/invites", admin) {
		if inv["email"] == "editor-project@example.test" && (inv["product_id"] != product || inv["product_name"] != "Selected project") {
			t.Fatal("invitation does not display its project", inv)
		}
	}
}
