package studio

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

func extraMCPTools() []map[string]any {
	s := map[string]string{"type": "string"}
	out := []map[string]any{}
	for _, v := range []struct {
		name, description string
		fields            []string
	}{
		{"studio_create_item", "Create a draft. payload is JSON with title, kind, body, source_url, rights and tags.", []string{"payload"}},
		{"studio_create_version", "Create an immutable text version. payload JSON: item_id, expected_version_id, title, body, model, prompt.", []string{"payload"}},
		{"studio_get_task", "Read task specification, exact source versions, feedback and previous deliveries.", []string{"task_id"}},
		{"studio_progress", "Update stage and renew a currently owned claim. payload JSON: task_id, lease_id, stage, percent. Cannot activate tasks.", []string{"payload"}},
		{"studio_deliver", "Deliver all requested formats and source projects. payload JSON: task_id, lease_id, version_id, files, source_files, formats (format to version_id), checklist (requirement to boolean), notes.", []string{"payload"}},
		{"studio_add_note", "Add a timestamped note. payload JSON: item_id, body, at_seconds.", []string{"payload"}},
		{"studio_submit_analysis", "Store source-labelled transcript/OCR/scenes. payload JSON: version_id, model, segments [{start_seconds,end_seconds,kind,body}]. Never approves content.", []string{"payload"}},
		{"studio_rate", "Rate an exact version. payload JSON: version_id, score (0–100), criteria, model. Agent judgments remain separate from human approval.", []string{"payload"}},
		{"studio_results", "Read measurements and conversion aggregates in this product.", []string{}},
		{"studio_events", "Read recent product events. Does not automatically spawn tasks.", []string{}},
		{"studio_templates", "Read versioned production templates and their locked brand fields.", []string{}},
	} {
		props := map[string]any{}
		for _, f := range v.fields {
			props[f] = s
		}
		out = append(out, mcpTool(v.name, v.description, props, v.fields...))
	}
	return out
}
func parsePayload(args map[string]string, v any) error {
	d := json.NewDecoder(strings.NewReader(args["payload"]))
	d.DisallowUnknownFields()
	return d.Decode(v)
}
func (a *App) callExtraMCP(ctx context.Context, u Actor, name string, args map[string]string) (any, error) {
	ctx = context.WithValue(ctx, actorKey{}, u)
	ctx = context.WithValue(ctx, writeKey{}, true)
	switch name {
	case "studio_create_item":
		var v itemInput
		if e := parsePayload(args, &v); e != nil {
			return nil, e
		}
		v.Product = u.Product
		return a.insertItem(ctx, u, v, "", "", "")
	case "studio_get_task":
		return a.taskData(ctx, args["task_id"], u.Product)
	case "studio_templates":
		return a.query(ctx, "SELECT * FROM templates WHERE product_id=$1 ORDER BY name", u.Product)
	case "studio_results":
		return a.insightsData(ctx, []string{u.Product}, "NOK")
	case "studio_events":
		return a.query(ctx, "SELECT id,kind,title,entity_id,created_at FROM notifications WHERE product_id=$1 AND user_id IS NULL ORDER BY created_at DESC LIMIT 30", u.Product)
	case "studio_deliver":
		var v deliveryInput
		if e := parsePayload(args, &v); e != nil {
			return nil, e
		}
		e := a.deliver(ctx, u, v)
		return map[string]string{"status": "review"}, e
	case "studio_progress":
		var v struct {
			Task    string `json:"task_id"`
			Lease   string `json:"lease_id"`
			Stage   string `json:"stage"`
			Percent int    `json:"percent"`
		}
		if e := parsePayload(args, &v); e != nil {
			return nil, e
		}
		if v.Percent < 0 || v.Percent > 100 || len(v.Stage) > 200 {
			return nil, fmt.Errorf("ugyldig fremdrift")
		}
		tag, e := a.db.Exec(ctx, "UPDATE tasks SET progress=$1,lease_until=least(now()+interval '30 minutes',claim_started_at+interval '4 hours'),updated_at=now() WHERE id::text=$2 AND product_id=$3 AND claimed_by=$4 AND lease_id::text=$5 AND lease_until>now() AND status='running' AND claim_started_at>now()-interval '4 hours'", jsonBytes(v), v.Task, u.Product, u.ID, v.Lease)
		if e == nil && tag.RowsAffected() == 0 {
			e = fmt.Errorf("reservasjonen er utløpt")
		}
		return map[string]bool{"ok": e == nil}, e
	case "studio_add_note":
		var v struct {
			Item string   `json:"item_id"`
			Body string   `json:"body"`
			At   *float64 `json:"at_seconds"`
		}
		if e := parsePayload(args, &v); e != nil {
			return nil, e
		}
		if strings.TrimSpace(v.Body) == "" || v.At != nil && *v.At < 0 {
			return nil, fmt.Errorf("ugyldig notat")
		}
		tag, e := a.db.Exec(ctx, "INSERT INTO notes(item_id,version_id,body,at_seconds,author) SELECT id,current_version_id,$1,$2,$3 FROM items WHERE id::text=$4 AND product_id=$5 AND deleted_at IS NULL", v.Body, v.At, u.Name, v.Item, u.Product)
		if e == nil && tag.RowsAffected() == 0 {
			e = fmt.Errorf("ukjent innhold")
		}
		return map[string]bool{"ok": e == nil}, e
	case "studio_submit_analysis":
		var v struct {
			Version  string         `json:"version_id"`
			Model    string         `json:"model"`
			Segments []segmentInput `json:"segments"`
		}
		if e := parsePayload(args, &v); e != nil {
			return nil, e
		}
		var p string
		if a.db.QueryRow(ctx, "SELECT i.product_id::text FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND i.deleted_at IS NULL", v.Version).Scan(&p) != nil || p != u.Product {
			return nil, fmt.Errorf("ukjent versjon")
		}
		e := a.putSegments(ctx, v.Version, "agent:"+u.ID+":"+v.Model, v.Segments)
		return map[string]bool{"ok": e == nil}, e
	case "studio_rate":
		var v struct {
			Version  string  `json:"version_id"`
			Score    float64 `json:"score"`
			Criteria string  `json:"criteria"`
			Model    string  `json:"model"`
		}
		if e := parsePayload(args, &v); e != nil {
			return nil, e
		}
		if v.Score < 0 || v.Score > 100 || v.Criteria == "" {
			return nil, fmt.Errorf("oppgi kriterier og score 0–100")
		}
		tag, e := a.db.Exec(ctx, "INSERT INTO agent_ratings(version_id,agent_id,score,criteria,model) SELECT v.id,$2,$3,$4,$5 FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND i.product_id=$6 AND i.deleted_at IS NULL", v.Version, u.ID, v.Score, v.Criteria, v.Model, u.Product)
		if e == nil && tag.RowsAffected() == 0 {
			e = fmt.Errorf("ukjent versjon")
		}
		return map[string]bool{"ok": e == nil}, e
	case "studio_create_version":
		var v struct {
			Item     string `json:"item_id"`
			Expected string `json:"expected_version_id"`
			Title    string `json:"title"`
			Body     string `json:"body"`
			Model    string `json:"model"`
			Prompt   string `json:"prompt"`
		}
		if e := parsePayload(args, &v); e != nil {
			return nil, e
		}
		if v.Title == "" || len(v.Title) > 300 {
			return nil, fmt.Errorf("oppgi tittel")
		}
		tx, e := a.db.Begin(ctx)
		if e != nil {
			return nil, e
		}
		defer tx.Rollback(ctx)
		var current string
		if tx.QueryRow(ctx, "SELECT current_version_id::text FROM items WHERE id::text=$1 AND product_id=$2 AND deleted_at IS NULL FOR UPDATE", v.Item, u.Product).Scan(&current) != nil || current != v.Expected {
			return nil, fmt.Errorf("versjonen er endret eller utilgjengelig")
		}
		var id string
		e = tx.QueryRow(ctx, "INSERT INTO versions(item_id,number,title,body,file_key,file_name,mime,checksum,bytes,created_by,provenance) SELECT item_id,number+1,$2,$3,file_key,file_name,mime,checksum,bytes,$4,$5 FROM versions WHERE id=$1 RETURNING id::text", current, v.Title, v.Body, u.Name, jsonBytes(map[string]string{"agent": u.ID, "model": v.Model, "prompt": v.Prompt})).Scan(&id)
		if e == nil {
			_, e = tx.Exec(ctx, "UPDATE items SET title=$1,body=$2,current_version_id=$3,status='draft',updated_at=now() WHERE id::text=$4", v.Title, v.Body, id, v.Item)
		}
		if e != nil {
			return nil, e
		}
		return map[string]string{"version_id": id}, tx.Commit(ctx)
	}
	return nil, fmt.Errorf("verktøyet er ikke tilgjengelig")
}
