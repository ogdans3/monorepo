package studio

import (
	"archive/zip"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func (a *App) libraryExtras(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("product")
	ids := a.productIDs(r.Context(), p)
	collections, _ := a.query(r.Context(), "SELECT c.*,coalesce((SELECT jsonb_agg(item_id) FROM collection_items WHERE collection_id=c.id),'[]') AS items FROM collections c WHERE product_id::text=ANY($1) ORDER BY name", ids)
	favorites, _ := a.query(r.Context(), "SELECT f.item_id FROM favorites f JOIN items i ON i.id=f.item_id WHERE f.user_id=$1 AND i.product_id::text=ANY($2)", actor(r).ID, ids)
	searches, _ := a.query(r.Context(), "SELECT * FROM saved_searches WHERE user_id=$1 AND product_id::text=ANY($2) ORDER BY name", actor(r).ID, ids)
	trash, _ := a.query(r.Context(), itemSelect+"WHERE i.product_id::text=ANY($1) AND i.deleted_at IS NOT NULL ORDER BY i.deleted_at DESC", ids)
	write(w, 200, map[string]any{"collections": collections, "favorites": favorites, "searches": searches, "trash": trash})
}
func (a *App) saveCollection(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Product string `json:"product_id"`
		Name    string `json:"name"`
	}
	if !decode(w, r, &v) {
		return
	}
	if validateProduct(r.Context(), a, v.Product) != nil || strings.TrimSpace(v.Name) == "" || len(v.Name) > 100 {
		fail(w, 400, "Oppgi produkt og navn")
		return
	}
	var id string
	e := a.db.QueryRow(r.Context(), "INSERT INTO collections(product_id,name) VALUES($1,$2) RETURNING id::text", v.Product, v.Name).Scan(&id)
	if e != nil {
		fail(w, 409, "Samlingen finnes allerede")
		return
	}
	write(w, 201, map[string]string{"id": id})
}
func (a *App) favorite(w http.ResponseWriter, r *http.Request) {
	if r.Method == "DELETE" {
		a.db.Exec(r.Context(), "DELETE FROM favorites WHERE item_id::text=$1 AND user_id=$2", r.PathValue("id"), actor(r).ID)
	} else {
		_, e := a.db.Exec(r.Context(), "INSERT INTO favorites(item_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", r.PathValue("id"), actor(r).ID)
		if e != nil {
			fail(w, 400, "Kunne ikke lagre favoritten")
			return
		}
	}
	ok(w)
}
func (a *App) savedSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method == "DELETE" {
		a.db.Exec(r.Context(), "DELETE FROM saved_searches WHERE id::text=$1 AND user_id=$2", r.PathValue("id"), actor(r).ID)
		ok(w)
		return
	}
	var v struct {
		Product string            `json:"product_id"`
		Name    string            `json:"name"`
		Query   map[string]string `json:"query"`
	}
	if !decode(w, r, &v) {
		return
	}
	if validateProduct(r.Context(), a, v.Product) != nil || strings.TrimSpace(v.Name) == "" {
		fail(w, 400, "Oppgi navn og produkt")
		return
	}
	_, e := a.db.Exec(r.Context(), "INSERT INTO saved_searches(user_id,product_id,name,query) VALUES($1,$2,$3,$4)", actor(r).ID, v.Product, v.Name, jsonBytes(v.Query))
	if e != nil {
		fail(w, 400, "Kunne ikke lagre søket")
		return
	}
	ok(w)
}
func (a *App) bulkItems(w http.ResponseWriter, r *http.Request) {
	var v struct {
		IDs    []string `json:"ids"`
		Action string   `json:"action"`
		Value  string   `json:"value"`
	}
	if !decode(w, r, &v) {
		return
	}
	if len(v.IDs) == 0 || len(v.IDs) > 200 {
		fail(w, 400, "Velg 1–200 elementer")
		return
	}
	ctx := r.Context()
	tx, e := a.db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	for _, id := range v.IDs {
		var p string
		if tx.QueryRow(ctx, "SELECT product_id::text FROM items WHERE id::text=$1 FOR UPDATE", id).Scan(&p) != nil || !a.productAccess(ctx, p, true) {
			fail(w, 403, "Ingen tilgang til ett av elementene")
			return
		}
		switch v.Action {
		case "trash":
			_, e = tx.Exec(ctx, "UPDATE items SET deleted_at=now() WHERE id::text=$1", id)
		case "restore":
			_, e = tx.Exec(ctx, "UPDATE items SET deleted_at=NULL WHERE id::text=$1", id)
		case "sort":
			_, e = tx.Exec(ctx, "UPDATE items SET inbox=false WHERE id::text=$1", id)
		case "tag":
			if len(v.Value) > 80 || strings.TrimSpace(v.Value) == "" {
				fail(w, 400, "Oppgi en etikett")
				return
			}
			_, e = tx.Exec(ctx, "UPDATE items SET tags=array(SELECT DISTINCT unnest(tags||ARRAY[$2::text])) WHERE id::text=$1", id, v.Value)
		case "collection":
			var cp string
			if tx.QueryRow(ctx, "SELECT product_id::text FROM collections WHERE id::text=$1", v.Value).Scan(&cp) != nil || cp != p {
				fail(w, 400, "Velg en samling i samme produkt")
				return
			}
			_, e = tx.Exec(ctx, "INSERT INTO collection_items(collection_id,item_id) VALUES($1,$2) ON CONFLICT DO NOTHING", v.Value, id)
		case "uncollect":
			_, e = tx.Exec(ctx, "DELETE FROM collection_items WHERE collection_id::text=$1 AND item_id::text=$2", v.Value, id)
		default:
			fail(w, 400, "Ukjent handling")
			return
		}
		if e != nil {
			fail(w, 400, "Kunne ikke oppdatere elementene")
			return
		}
	}
	if tx.Commit(ctx) != nil {
		fail(w, 500, "Kunne ikke lagre")
		return
	}
	a.audit(ctx, actor(r).Name, "items."+v.Action, strings.Join(v.IDs, ","))
	ok(w)
}
func (a *App) itemMetadata(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Tags     []string       `json:"tags"`
		Rights   string         `json:"rights"`
		Details  map[string]any `json:"rights_details"`
		Metadata map[string]any `json:"metadata"`
		Inbox    bool           `json:"inbox"`
	}
	if !decode(w, r, &v) {
		return
	}
	if len(v.Tags) > 40 || !strings.Contains("|owned|licensed|reference_only|unknown|", "|"+v.Rights+"|") || v.Rights == "" {
		fail(w, 400, "Ugyldige rettigheter eller etiketter")
		return
	}
	for _, t := range v.Tags {
		if len(t) > 80 {
			fail(w, 400, "Etikett for lang")
			return
		}
	}
	if expiry, yes := v.Details["expires_at"].(string); yes && expiry != "" {
		if _, e := time.Parse("2006-01-02", expiry); e != nil {
			fail(w, 400, "Ugyldig utløpsdato")
			return
		}
	}
	if v.Tags == nil {
		v.Tags = []string{}
	}
	if v.Details == nil {
		v.Details = map[string]any{}
	}
	if v.Metadata == nil {
		v.Metadata = map[string]any{}
	}
	_, e := a.db.Exec(r.Context(), "UPDATE items SET tags=$1,rights=$2,rights_details=$3,metadata=$4,inbox=$5,updated_at=now() WHERE id::text=$6", v.Tags, v.Rights, jsonBytes(v.Details), jsonBytes(v.Metadata), v.Inbox, r.PathValue("id"))
	if e != nil {
		fail(w, 400, "Kunne ikke lagre metadata")
		return
	}
	ok(w)
}
func (a *App) extraItemData(ctx context.Context, id string) map[string]any {
	u, _ := ctx.Value(actorKey{}).(Actor)
	var favorite bool
	a.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM favorites WHERE item_id::text=$1 AND user_id::text=$2)", id, u.ID).Scan(&favorite)
	relations, _ := a.query(ctx, `SELECT r.*,i.title AS target_title,i.kind AS target_kind FROM relations r JOIN items i ON i.id=r.target_id WHERE r.source_id::text=$1 AND i.deleted_at IS NULL`, id)
	ratings, _ := a.query(ctx, "SELECT r.*,u.name FROM ratings r JOIN users u ON u.id=r.user_id WHERE item_id::text=$1", id)
	segments, _ := a.query(ctx, "SELECT s.* FROM segments s JOIN items i ON i.current_version_id=s.version_id WHERE i.id::text=$1 ORDER BY start_seconds", id)
	evaluations, _ := a.query(ctx, "SELECT e.* FROM evaluations e JOIN versions v ON v.id=e.version_id WHERE v.item_id::text=$1 ORDER BY e.created_at DESC", id)
	jobs, _ := a.query(ctx, "SELECT j.id,j.kind,j.status,j.progress,j.version_id,j.created_at,j.result FROM jobs j JOIN versions v ON v.id=j.version_id WHERE v.item_id::text=$1 ORDER BY created_at DESC LIMIT 20", id)
	shares, _ := a.query(ctx, "SELECT s.id,s.version_id,s.expires_at,s.revoked_at FROM shares s JOIN versions v ON v.id=s.version_id WHERE v.item_id::text=$1", id)
	artifacts, _ := a.query(ctx, "SELECT m.version_id,m.kind,m.mime FROM media_artifacts m JOIN versions v ON v.id=m.version_id WHERE v.item_id::text=$1", id)
	return map[string]any{"favorite": favorite, "relations": relations, "ratings": ratings, "segments": segments, "evaluations": evaluations, "jobs": jobs, "shares": shares, "artifacts": artifacts}
}
func (a *App) relation(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Target string `json:"target_id"`
		Kind   string `json:"kind"`
	}
	if !decode(w, r, &v) {
		return
	}
	tag, e := a.db.Exec(r.Context(), `INSERT INTO relations(source_id,target_id,kind,version_id) SELECT s.id,t.id,$3,t.current_version_id FROM items s JOIN items t ON t.product_id=s.product_id WHERE s.id::text=$1 AND t.id::text=$2 AND t.deleted_at IS NULL ON CONFLICT DO NOTHING`, r.PathValue("id"), v.Target, v.Kind)
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 400, "Velg et annet element i samme produkt og en gyldig kobling")
		return
	}
	ok(w)
}
func (a *App) rateItem(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Version string `json:"version_id"`
		Value   int    `json:"value"`
	}
	if !decode(w, r, &v) {
		return
	}
	if v.Value != -1 && v.Value != 1 {
		fail(w, 400, "Velg tommel opp eller ned")
		return
	}
	tag, e := a.db.Exec(r.Context(), "INSERT INTO ratings(item_id,version_id,user_id,value) SELECT id,current_version_id,$3,$4 FROM items WHERE id::text=$1 AND current_version_id::text=$2 ON CONFLICT(version_id,user_id) DO UPDATE SET value=excluded.value,created_at=now()", r.PathValue("id"), v.Version, actor(r).ID, v.Value)
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 409, "Versjonen er endret")
		return
	}
	ok(w)
}
func (a *App) resolveNote(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Resolved bool `json:"resolved"`
	}
	if !decode(w, r, &v) {
		return
	}
	_, e := a.db.Exec(r.Context(), "UPDATE notes SET resolved_at=CASE WHEN $1 THEN now() ELSE NULL END WHERE id::text=$2 AND item_id::text=$3", v.Resolved, r.PathValue("note"), r.PathValue("id"))
	if e != nil {
		fail(w, 400, "Kunne ikke oppdatere notatet")
		return
	}
	ok(w)
}
func (a *App) shareItem(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Version string `json:"version_id"`
		Days    int    `json:"days"`
	}
	if !decode(w, r, &v) {
		return
	}
	if v.Days < 1 || v.Days > 30 {
		fail(w, 400, "Velg 1–30 dager")
		return
	}
	t := token()
	var id string
	e := a.db.QueryRow(r.Context(), "INSERT INTO shares(token_hash,version_id,expires_at,created_by) SELECT $1,v.id,now()+$2*interval '1 day',$3 FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$4 AND i.id::text=$5 AND i.deleted_at IS NULL RETURNING id::text", hash(t), v.Days, actor(r).ID, v.Version, r.PathValue("id")).Scan(&id)
	if e != nil {
		fail(w, 400, "Ugyldig versjon")
		return
	}
	write(w, 201, map[string]string{"id": id, "url": a.origin + "/share#" + t})
}
func (a *App) revokeShare(w http.ResponseWriter, r *http.Request) {
	a.db.Exec(r.Context(), "UPDATE shares SET revoked_at=now() WHERE id::text=$1 AND version_id IN(SELECT id FROM versions WHERE item_id::text=$2)", r.PathValue("share"), r.PathValue("id"))
	ok(w)
}
func (a *App) shared(w http.ResponseWriter, r *http.Request) {
	var id, key, mt, name string
	var data []byte
	e := a.db.QueryRow(r.Context(), `SELECT v.id::text,v.file_key,v.mime,v.file_name,jsonb_build_object('title',v.title,'body',v.body,'mime',v.mime,'number',v.number,'expires_at',s.expires_at) FROM shares s JOIN versions v ON v.id=s.version_id JOIN items i ON i.id=v.item_id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL AND i.deleted_at IS NULL`, hash(r.PathValue("token"))).Scan(&id, &key, &mt, &name, &data)
	if e != nil {
		fail(w, 404, "Delingslenken er utløpt eller fjernet")
		return
	}
	if r.URL.Query().Get("file") == "1" {
		if key == "" {
			fail(w, 404, "Ingen fil")
			return
		}
		a.serveStored(w, r, key, name, mt)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}
func (a *App) serveStored(w http.ResponseWriter, r *http.Request, key, name, mt string) {
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	w.Header().Set("Content-Type", mt)
	disp := "attachment"
	if strings.HasPrefix(mt, "video/") || strings.HasPrefix(mt, "audio/") || mt == "image/jpeg" || mt == "image/png" || mt == "image/webp" {
		disp = "inline"
	}
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disp, map[string]string{"filename": name}))
	mediaCache(w, r, key)
	http.ServeFile(w, r, filepath.Join(a.storage, key))
}
func csvSafe(s string) string {
	if strings.ContainsAny(strings.TrimSpace(s[:min(len(s), 1)]), "=+-@\t\r") {
		return "'" + s
	}
	return s
}
func (a *App) exportCSV(w http.ResponseWriter, r *http.Request) {
	rows, e := a.query(r.Context(), "SELECT title,kind,body,source_url,rights,tags FROM items WHERE product_id::text=ANY($1) AND deleted_at IS NULL AND ($2='' OR kind=$2) ORDER BY created_at", a.productIDs(r.Context(), r.URL.Query().Get("product")), r.URL.Query().Get("kind"))
	if e != nil {
		fail(w, 500, "Eksport feilet")
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="studio.csv"`)
	c := csv.NewWriter(w)
	c.Write([]string{"title", "kind", "body", "source_url", "rights", "tags"})
	for _, row := range rows {
		tags := []string{}
		if v, ok := row["tags"].([]any); ok {
			for _, t := range v {
				tags = append(tags, fmt.Sprint(t))
			}
		}
		c.Write([]string{csvSafe(fmt.Sprint(row["title"])), fmt.Sprint(row["kind"]), csvSafe(fmt.Sprint(row["body"])), csvSafe(fmt.Sprint(row["source_url"])), fmt.Sprint(row["rights"]), strings.Join(tags, ",")})
	}
	c.Flush()
}
func (a *App) importCSV(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Product string `json:"product_id"`
		CSV     string `json:"csv"`
	}
	if !decode(w, r, &v) {
		return
	}
	if validateProduct(r.Context(), a, v.Product) != nil {
		fail(w, 403, "Ukjent produkt")
		return
	}
	rows, e := csv.NewReader(strings.NewReader(v.CSV)).ReadAll()
	if e != nil || len(rows) < 2 || len(rows) > 501 {
		fail(w, 400, "CSV må ha overskrifter og 1–500 rader")
		return
	}
	fields := map[string]int{}
	for i, h := range rows[0] {
		fields[strings.TrimSpace(h)] = i
	}
	if _, ok := fields["title"]; !ok {
		fail(w, 400, "CSV trenger kolonnen title")
		return
	}
	inputs := []itemInput{}
	for n, row := range rows[1:] {
		get := func(k string) string {
			if i, ok := fields[k]; ok && i < len(row) {
				return row[i]
			}
			return ""
		}
		in := itemInput{Product: v.Product, Title: get("title"), Kind: get("kind"), Body: get("body"), Source: get("source_url"), Rights: get("rights"), Tags: strings.FieldsFunc(get("tags"), func(r rune) bool { return r == ',' || r == ';' })}
		if in.Kind == "" {
			in.Kind = "hook"
		}
		if !validKind(in.Kind) || strings.TrimSpace(in.Title) == "" || len(in.Title) > 300 {
			fail(w, 400, fmt.Sprintf("Ugyldig rad %d", n+2))
			return
		}
		inputs = append(inputs, in)
	}
	// Each row is independently versioned; return IDs so retry never hides partial success.
	ids := []string{}
	for _, in := range inputs {
		out, e := a.insertItem(r.Context(), actor(r), in, "", "", "")
		if e != nil {
			write(w, 400, map[string]any{"error": e.Error(), "imported_ids": ids})
			return
		}
		ids = append(ids, out["id"])
	}
	write(w, 201, map[string]any{"count": len(ids), "ids": ids})
}
func (a *App) exportPackage(w http.ResponseWriter, r *http.Request) {
	ids := strings.Split(r.URL.Query().Get("ids"), ",")
	if len(ids) > 100 {
		fail(w, 400, "Maks 100 elementer")
		return
	}
	ctx := r.Context()
	rows, e := a.query(ctx, "SELECT i.*,v.file_key,v.file_name,v.mime,v.number FROM items i JOIN versions v ON v.id=i.current_version_id WHERE i.id::text=ANY($1) AND i.product_id::text=ANY($2) AND i.deleted_at IS NULL", ids, a.productIDs(ctx, ""))
	if e != nil || len(rows) == 0 {
		fail(w, 404, "Ingen elementer")
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="studio-pakke.zip"`)
	z := zip.NewWriter(w)
	defer z.Close()
	manifest := []map[string]any{}
	for i, row := range rows {
		key, _ := row["file_key"].(string)
		delete(row, "file_key")
		entry := fmt.Sprintf("%03d-%s", i+1, filepath.Base(fmt.Sprint(row["file_name"])))
		if key != "" {
			f, e := os.Open(filepath.Join(a.storage, key))
			if e == nil {
				out, e := z.Create("files/" + entry)
				if e == nil {
					io.Copy(out, f)
				}
				f.Close()
				row["export_path"] = "files/" + entry
			}
		}
		extra := a.extraItemData(ctx, fmt.Sprint(row["id"]))
		row["details"] = extra
		manifest = append(manifest, row)
	}
	out, e := z.Create("manifest.json")
	if e == nil {
		json.NewEncoder(out).Encode(manifest)
	}
}
func (a *App) listSegments(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT * FROM segments WHERE version_id::text=$1 ORDER BY start_seconds", r.PathValue("id"))
}

type segmentInput struct {
	Start float64  `json:"start_seconds"`
	End   *float64 `json:"end_seconds"`
	Kind  string   `json:"kind"`
	Body  string   `json:"body"`
}

func (a *App) putSegments(ctx context.Context, version, source string, parts []segmentInput) error {
	if len(parts) > 2000 {
		return fmt.Errorf("maks 2000 segmenter")
	}
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	if _, e = tx.Exec(ctx, "DELETE FROM segments WHERE version_id::text=$1 AND source=$2", version, source); e != nil {
		return e
	}
	for _, s := range parts {
		if len(s.Body) > 16000 || s.Start < 0 || (s.End != nil && *s.End < s.Start) {
			return fmt.Errorf("ugyldig segment")
		}
		if _, e = tx.Exec(ctx, "INSERT INTO segments(version_id,start_seconds,end_seconds,kind,body,source) VALUES($1,$2,$3,$4,$5,$6)", version, s.Start, s.End, s.Kind, s.Body, source); e != nil {
			return e
		}
	}
	return tx.Commit(ctx)
}
func (a *App) saveSegments(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Segments []segmentInput `json:"segments"`
	}
	if !decode(w, r, &v) {
		return
	}
	e := a.putSegments(r.Context(), r.PathValue("id"), "manual", v.Segments)
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	ok(w)
}
func stringID(v any) string       { return fmt.Sprint(v) }
func parseFloat(s string) float64 { v, _ := strconv.ParseFloat(s, 64); return v }
