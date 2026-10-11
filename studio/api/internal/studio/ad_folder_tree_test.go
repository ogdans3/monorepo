package studio

import (
	"context"
	"fmt"
	"sync"
	"testing"
)

func TestNestedAdFoldersThroughMCP(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	product := productID(t, a)
	agent, _ := adAgent(t, a, admin, product)
	ctx := context.Background()
	save := func(payload map[string]string) string {
		t.Helper()
		out, err := a.callMCP(ctx, agent, "studio_save_ad_folder", map[string]string{"payload": string(jsonBytes(payload))})
		if err != nil {
			t.Fatal(err)
		}
		return out.(map[string]string)["id"]
	}
	reject := func(payload map[string]string) {
		t.Helper()
		if _, err := a.callMCP(ctx, agent, "studio_save_ad_folder", map[string]string{"payload": string(jsonBytes(payload))}); err == nil {
			t.Fatal("invalid folder change accepted", payload)
		}
	}
	root := save(map[string]string{"name": "Campaign"})
	other := save(map[string]string{"name": "Archive"})
	child := save(map[string]string{"name": "Ferdig", "parent_id": root})
	save(map[string]string{"name": "Ferdig", "parent_id": other})
	reject(map[string]string{"name": " ferdig ", "parent_id": root})
	reject(map[string]string{"name": " campaign "})
	// Old clients that omit parent_id can still rename without moving the folder.
	save(map[string]string{"folder_id": child, "name": "Reviewed"})
	parent := child
	for n := 0; n < 128; n++ {
		parent = save(map[string]string{"name": "Nested", "parent_id": parent})
	}
	leaf := parent
	reject(map[string]string{"folder_id": root, "name": "Campaign", "parent_id": leaf})
	reject(map[string]string{"folder_id": child, "name": "Reviewed", "parent_id": child})

	status, ad, _ := request(t, a, "POST", "/api/ads", adInput{Product: product, Title: "Nested ad", Folder: leaf}, admin, "")
	if status != 201 {
		t.Fatal(status, ad)
	}
	save(map[string]string{"folder_id": child, "name": "Reviewed", "parent_id": other})
	rows := listRequest(t, a, "/api/ad-folders?product="+product, admin)
	byID := map[string]map[string]any{}
	for _, row := range rows {
		byID[row["id"].(string)] = row
	}
	if len(rows) != 132 || byID[child]["parent_id"] != other || byID[root]["parent_id"] != nil || byID[leaf]["ad_count"] != float64(1) || byID[child]["folder_count"] != float64(1) {
		t.Fatal("incorrect tree metadata", len(rows), byID[child], byID[leaf])
	}
	depth := 0
	for id := leaf; id != ""; {
		depth++
		p, _ := byID[id]["parent_id"].(string)
		id = p
	}
	if depth != 130 {
		t.Fatal("deep folder hierarchy lost", depth)
	}
	status, detail, _ := request(t, a, "GET", "/api/ads/"+ad["id"].(string), nil, admin, "")
	if status != 200 || detail["ad"].(map[string]any)["folder_id"] != leaf {
		t.Fatal("moving subtree moved the ad out of its folder", status, detail)
	}
	// A non-leaf cannot be removed accidentally; leaf deletion preserves its ads.
	status, _, _ = request(t, a, "DELETE", "/api/ad-folders/"+child, nil, admin, "")
	if status != 400 {
		t.Fatal("deleted a folder with children", status)
	}
	status, _, _ = request(t, a, "DELETE", "/api/ad-folders/"+leaf, nil, admin, "")
	if status != 200 {
		t.Fatal("could not delete leaf folder", status)
	}
	status, detail, _ = request(t, a, "GET", "/api/ads/"+ad["id"].(string), nil, admin, "")
	if status != 200 || detail["ad"].(map[string]any)["folder_id"] != nil {
		t.Fatal("deleting leaf lost its ad", status, detail)
	}
	save(map[string]string{"folder_id": child, "name": "Reviewed", "parent_id": ""})
	var isRoot bool
	if err := a.db.QueryRow(ctx, "SELECT parent_id IS NULL FROM ad_folders WHERE id=$1", child).Scan(&isRoot); err != nil || !isRoot {
		t.Fatal("could not move subtree to root", err)
	}
	status, foreignProduct, _ := request(t, a, "POST", "/api/products", map[string]any{"name": "Other product", "restricted": true}, admin, "")
	if status != 201 {
		t.Fatal(status, foreignProduct)
	}
	status, foreignFolder, _ := request(t, a, "POST", "/api/ad-folders", adFolderInput{Product: foreignProduct["id"].(string), Name: "Private"}, admin, "")
	if status != 200 {
		t.Fatal(status, foreignFolder)
	}
	reject(map[string]string{"folder_id": child, "name": "Reviewed", "parent_id": foreignFolder["id"].(string)})
	reject(map[string]string{"name": "Cross-product child", "parent_id": foreignFolder["id"].(string)})
	reject(map[string]string{"name": "Missing parent", "parent_id": "00000000-0000-0000-0000-000000000000"})
	reader := userCookie(t, a, admin, "folder-reader@example.test", "reader")
	status, _, _ = request(t, a, "PATCH", "/api/ad-folders/"+child, map[string]string{"product_id": product, "name": "Reviewed", "parent_id": root}, reader, "")
	if status != 403 {
		t.Fatal("reader moved a folder", status)
	}
	if len(listRequest(t, a, "/api/ad-folders?product="+product, reader)) != 131 {
		t.Fatal("reader cannot browse nested folders")
	}
}

func TestConcurrentFolderMovesDoNotCreateCycles(t *testing.T) {
	a := testApp(t)
	admin := setupAdmin(t, a)
	product := productID(t, a)
	agent, _ := adAgent(t, a, admin, product)
	ctx := context.WithValue(context.Background(), actorKey{}, agent)
	for n := 0; n < 5; n++ {
		leftName, rightName := fmt.Sprintf("Left %d", n), fmt.Sprintf("Right %d", n)
		left, err := a.saveAdFolder(ctx, adFolderInput{Product: product, Name: leftName})
		if err != nil {
			t.Fatal(err)
		}
		right, err := a.saveAdFolder(ctx, adFolderInput{Product: product, Name: rightName})
		if err != nil {
			t.Fatal(err)
		}
		leftID, rightID := left["id"], right["id"]
		start := make(chan struct{})
		errors := make(chan error, 2)
		var wg sync.WaitGroup
		for _, v := range []adFolderInput{
			{Product: product, ID: leftID, Name: leftName, Parent: &rightID},
			{Product: product, ID: rightID, Name: rightName, Parent: &leftID},
		} {
			wg.Add(1)
			go func(v adFolderInput) {
				defer wg.Done()
				<-start
				_, err := a.saveAdFolder(ctx, v)
				errors <- err
			}(v)
		}
		close(start)
		wg.Wait()
		first, second := <-errors, <-errors
		if (first == nil) == (second == nil) {
			t.Fatal("exactly one reciprocal move must succeed", first, second)
		}
		var roots int
		if err := a.db.QueryRow(ctx, "SELECT count(*) FROM ad_folders WHERE id::text=ANY($1) AND parent_id IS NULL", []string{leftID, rightID}).Scan(&roots); err != nil || roots != 1 {
			t.Fatal("concurrent move created a cycle", roots, err)
		}
	}
}
