package studio

import (
	"context"
	"fmt"
	"sync"
	"testing"
)

func TestAdFoldersAndIndependentVersionChannels(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	p := productID(t, a)
	agent, bearer := adAgent(t, a, admin, p)
	ctx := context.Background()
	call := func(name string, payload any) any {
		t.Helper()
		out, err := a.callMCP(ctx, agent, name, map[string]string{"payload": string(jsonBytes(payload))})
		if err != nil {
			t.Fatal(err)
		}
		return out
	}
	create := func(key string) string {
		t.Helper()
		out, err := a.createAd(ctx, agent, adInput{Title: key, Key: key})
		if err != nil {
			t.Fatal(err)
		}
		return out["id"].(string)
	}
	id := create("platform-ad")
	folder := call("studio_save_ad_folder", map[string]string{"name": "Ferdig"}).(map[string]string)["id"]
	if _, err := a.callMCP(ctx, agent, "studio_save_ad_folder", map[string]string{"payload": `{"name":" ferdig "}`}); err == nil {
		t.Fatal("duplicate folder accepted")
	}
	first := prepareAdFile(t, a, agent, bearer, id, "")
	status, v1, _ := request(t, a, "POST", first["complete_path"].(string), map[string]any{}, nil, bearer)
	if status != 201 {
		t.Fatal(status, v1)
	}
	second := prepareAdFile(t, a, agent, bearer, id, v1["version_id"].(string))
	status, v2, _ := request(t, a, "POST", second["complete_path"].(string), map[string]any{}, nil, bearer)
	if status != 201 {
		t.Fatal(status, v2)
	}
	status, _, _ = request(t, a, "POST", "/api/ads/"+id+"/review", map[string]any{"version_id": v2["version_id"], "status": "approved"}, admin, "")
	if status != 200 {
		t.Fatal(status)
	}
	call("studio_organize_ad", map[string]any{"ad_id": id, "folder_id": folder, "channels": []string{"instagram", "tiktok", "tiktok"}})
	call("studio_organize_ad", map[string]any{"ad_id": id, "version_id": v1["version_id"], "channels": []string{"snapchat"}})
	call("studio_organize_ad", map[string]any{"ad_id": id, "version_id": v2["version_id"], "channels": []string{"linkedin", "x"}})
	status, detail, _ := request(t, a, "GET", "/api/ads/"+id, nil, admin, "")
	if status != 200 {
		t.Fatal(status, detail)
	}
	ad := detail["ad"].(map[string]any)
	versions := detail["versions"].([]any)
	if ad["folder_id"] != folder || fmt.Sprint(ad["channels"]) != "[instagram tiktok]" {
		t.Fatal(ad)
	}
	if fmt.Sprint(versions[0].(map[string]any)["channels"]) != "[linkedin x]" || fmt.Sprint(versions[1].(map[string]any)["channels"]) != "[snapchat]" {
		t.Fatal(versions)
	}
	if len(versions) != 2 || detail["item"].(map[string]any)["status"] != "approved" || versions[0].(map[string]any)["id"] != v2["version_id"] {
		t.Fatal("organization altered immutable versions or approval", detail)
	}
	list := listRequest(t, a, "/api/ads?product="+p, admin)
	if list[0]["folder_name"] != "Ferdig" || fmt.Sprint(list[0]["version_channels"]) != "[linkedin x]" {
		t.Fatal(list)
	}
	call("studio_save_ad_folder", map[string]string{"folder_id": folder, "name": "Levert"})
	call("studio_organize_ad", map[string]any{"ad_id": id, "version_id": v1["version_id"], "channels": []string{}})
	status, _, _ = request(t, a, "DELETE", "/api/ad-folders/"+folder, nil, admin, "")
	if status != 200 {
		t.Fatal(status)
	}
	status, detail, _ = request(t, a, "GET", "/api/ads/"+id, nil, admin, "")
	if detail["ad"].(map[string]any)["folder_id"] != nil || len(detail["versions"].([]any)) != 2 || detail["item"].(map[string]any)["status"] != "approved" {
		t.Fatal("folder deletion lost ad data", detail)
	}
	versions = detail["versions"].([]any)
	if fmt.Sprint(versions[1].(map[string]any)["channels"]) != "[]" || fmt.Sprint(versions[0].(map[string]any)["channels"]) != "[linkedin x]" {
		t.Fatal("clearing one version affected another", versions)
	}
	// Folder moves may race with folder removal: no dangling folder or lost ad.
	actorCtx := context.WithValue(ctx, actorKey{}, agent)
	for n := 0; n < 5; n++ {
		f, err := a.saveAdFolder(actorCtx, adFolderInput{Product: p, Name: fmt.Sprint("Concurrent ", n)})
		if err != nil {
			t.Fatal(err)
		}
		folder := f["id"]
		var wg sync.WaitGroup
		wg.Add(2)
		go func() { defer wg.Done(); _ = a.organizeAd(actorCtx, adOrganizationInput{Ad: id, Folder: &folder}) }()
		go func() {
			defer wg.Done()
			if err := a.removeAdFolder(actorCtx, folder); err != nil {
				t.Error(err)
			}
		}()
		wg.Wait()
		var empty bool
		if err := a.db.QueryRow(ctx, "SELECT folder_id IS NULL FROM ads WHERE item_id=$1", id).Scan(&empty); err != nil || !empty {
			t.Fatal("dangling folder", err)
		}
	}
}

func TestAdOrganizationAccessAndAtomicValidation(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	p := productID(t, a)
	ctx := context.Background()
	agent, bearer := adAgent(t, a, admin, p)
	out, err := a.createAd(ctx, agent, adInput{Title: "Scoped ad", Key: "scoped"})
	if err != nil {
		t.Fatal(err)
	}
	id := out["id"].(string)
	reader := userCookie(t, a, admin, "ad-reader@example.test", "reader")
	editor := userCookie(t, a, admin, "ad-editor@example.test", "editor")
	status, private, _ := request(t, a, "POST", "/api/products", map[string]any{"name": "Private ad product", "restricted": true}, admin, "")
	if status != 201 {
		t.Fatal(status, private)
	}
	other := private["id"].(string)
	status, folder, _ := request(t, a, "POST", "/api/ad-folders", map[string]string{"product_id": other, "name": "Private"}, admin, "")
	if status != 200 {
		t.Fatal(status, folder)
	}
	folderID := folder["id"].(string)
	// Creating inside a folder is atomic, including product ownership validation.
	status, _, _ = request(t, a, "POST", "/api/ads", map[string]string{"product_id": p, "title": "Wrong folder", "external_key": "wrong-folder", "folder_id": folderID}, admin, "")
	if status != 400 {
		t.Fatal("created ad in another product's folder", status)
	}
	var count int
	if err := a.db.QueryRow(ctx, "SELECT count(*) FROM items WHERE title='Wrong folder'").Scan(&count); err != nil || count != 0 {
		t.Fatal("failed creation left a partial item", err, count)
	}
	status, privateAd, _ := request(t, a, "POST", "/api/ads", map[string]string{"product_id": other, "title": "Private ad"}, admin, "")
	if status != 201 {
		t.Fatal(status, privateAd)
	}
	for _, v := range []map[string]any{
		{"ad_id": id, "folder_id": folderID, "channels": []string{"tiktok"}},
		{"ad_id": privateAd["id"], "channels": []string{"x"}},
		{"ad_id": id, "channels": []string{"not-a-channel"}},
	} {
		if _, err := a.callMCP(ctx, agent, "studio_organize_ad", map[string]string{"payload": string(jsonBytes(v))}); err == nil {
			t.Fatal("agent accepted unauthorized/invalid change", v)
		}
	}
	start := prepareAdFile(t, a, agent, bearer, id, "")
	status, version, _ := request(t, a, "POST", start["complete_path"].(string), map[string]any{}, nil, bearer)
	if status != 201 {
		t.Fatal(status)
	}
	out, err = a.createAd(ctx, agent, adInput{Title: "Another ad", Key: "another"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := a.callMCP(ctx, agent, "studio_organize_ad", map[string]string{"payload": string(jsonBytes(map[string]any{"ad_id": out["id"], "version_id": version["version_id"], "channels": []string{"x"}}))}); err == nil {
		t.Fatal("labeled another ad's version")
	}
	for _, path := range []string{"/api/ads/" + id + "/organization", "/api/ad-folders/" + folderID} {
		status, _, _ = request(t, a, "PATCH", path, map[string]any{"channels": []string{"x"}, "product_id": other, "name": "Blocked"}, reader, "")
		if status != 403 {
			t.Fatal("reader wrote metadata", status)
		}
	}
	status, _, _ = request(t, a, "POST", "/api/ad-folders", map[string]string{"product_id": other, "name": "Blocked"}, editor, "")
	if status < 400 {
		t.Fatal("editor entered restricted product")
	}
	status, _, _ = request(t, a, "GET", "/api/ad-folders?product="+other, nil, editor, "")
	if status != 403 {
		t.Fatal("restricted folders leaked", status)
	}
	status, _, _ = request(t, a, "DELETE", "/api/ad-folders/"+folderID, nil, editor, "")
	if status != 403 {
		t.Fatal("restricted folder deleted", status)
	}
	status, _, _ = request(t, a, "PATCH", "/api/ads/"+privateAd["id"].(string)+"/organization", map[string]any{"channels": []string{"x"}}, editor, "")
	if status != 403 {
		t.Fatal("restricted ad changed", status)
	}
	list := listRequest(t, a, "/api/ads?product="+p, reader)
	for _, ad := range list {
		if ad["folder_id"] != nil || fmt.Sprint(ad["channels"]) != "[]" {
			t.Fatal("failed change partially applied", ad)
		}
	}
	if _, err := a.callMCP(ctx, agent, "studio_save_ad_folder", map[string]string{"payload": string(jsonBytes(map[string]string{"folder_id": folderID, "name": "Stolen"}))}); err == nil {
		t.Fatal("agent renamed foreign folder")
	}
}
