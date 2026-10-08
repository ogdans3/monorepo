package studio

import (
	"context"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (a *App) products(w http.ResponseWriter, r *http.Request) {
	rows, e := a.query(r.Context(), "SELECT * FROM products WHERE id::text=ANY($1) ORDER BY created_at", a.productIDs(r.Context(), ""))
	if e != nil {
		fail(w, 500, "Kunne ikke hente produkter")
		return
	}
	for _, p := range rows {
		p["can_edit"] = a.productAccess(r.Context(), p["id"].(string), true)
	}
	if rows == nil {
		rows = []map[string]any{}
	}
	write(w, 200, rows)
}
func (a *App) updateProduct(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Brand       string `json:"brand"`
		Audience    string `json:"audience"`
		Description string `json:"description"`
	}
	if !decode(w, r, &v) {
		return
	}
	tag, e := a.db.Exec(r.Context(), "UPDATE products SET brand=$1,audience=$2,description=$3,revision=revision+1 WHERE id::text=$4", v.Brand, v.Audience, v.Description, r.PathValue("id"))
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 404, "Produktet finnes ikke")
		return
	}
	a.snapshotProduct(r.Context(), r.PathValue("id"), actor(r).Name)
	write(w, 200, map[string]bool{"ok": true})
}

type itemInput struct {
	Product string   `json:"product_id"`
	Title   string   `json:"title"`
	Kind    string   `json:"kind"`
	Body    string   `json:"body"`
	Source  string   `json:"source_url"`
	Tags    []string `json:"tags"`
	Rights  string   `json:"rights"`
}

func validKind(k string) bool {
	return strings.Contains("|video|image|audio|hook|script|copy|brief|reference|template|knowledge|carousel|", "|"+k+"|") && k != ""
}
func (a *App) insertItem(ctx context.Context, u Actor, v itemInput, fileKey, fileName, mimeType string) (map[string]string, error) {
	if strings.TrimSpace(v.Title) == "" || len(v.Title) > 300 || !validKind(v.Kind) {
		return nil, fmt.Errorf("oppgi tittel og innholdstype")
	}
	if v.Source != "" && !strings.HasPrefix(v.Source, "https://") && !strings.HasPrefix(v.Source, "http://") {
		return nil, fmt.Errorf("kildelenker må starte med https:// eller http://")
	}
	if u.Agent {
		v.Product = u.Product
	}
	if e := validateProduct(ctx, a, v.Product); e != nil {
		return nil, e
	}
	if v.Rights == "" {
		v.Rights = "unknown"
	}
	if v.Tags == nil {
		v.Tags = []string{}
	}
	if !(v.Rights == "unknown" || v.Rights == "owned" || v.Rights == "licensed" || v.Rights == "reference_only") {
		return nil, fmt.Errorf("ugyldige rettigheter")
	}
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	var id, version string
	e = tx.QueryRow(ctx, "INSERT INTO items(product_id,title,kind,body,source_url,tags,rights,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text", v.Product, v.Title, v.Kind, v.Body, v.Source, v.Tags, v.Rights, u.Name).Scan(&id)
	if e != nil {
		return nil, e
	}
	e = tx.QueryRow(ctx, "INSERT INTO versions(item_id,number,title,body,file_key,file_name,mime,created_by) VALUES($1,1,$2,$3,$4,$5,$6,$7) RETURNING id::text", id, v.Title, v.Body, fileKey, fileName, mimeType, u.Name).Scan(&version)
	if e != nil {
		return nil, e
	}
	if _, e = tx.Exec(ctx, "UPDATE items SET current_version_id=$1 WHERE id=$2", version, id); e != nil {
		return nil, e
	}
	if e = tx.Commit(ctx); e != nil {
		return nil, e
	}
	a.audit(ctx, u.Name, "item.created", id)
	return map[string]string{"id": id, "version_id": version}, nil
}
func (a *App) createItem(w http.ResponseWriter, r *http.Request) {
	var v itemInput
	if !decode(w, r, &v) {
		return
	}
	result, e := a.insertItem(r.Context(), actor(r), v, "", "", "")
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	write(w, 201, result)
}

const itemSelect = `SELECT i.id,i.product_id,i.title,i.kind,i.body,i.source_url,i.tags,i.rights,i.status,i.current_version_id,i.created_by,i.created_at,i.updated_at,i.inbox,i.metadata,i.rights_details,i.deleted_at,v.mime,v.file_name,v.checksum,v.bytes,
 EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind='thumbnail') AS has_thumbnail,
 EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind='proxy') AS has_proxy,
 EXISTS(SELECT 1 FROM ads WHERE item_id=i.id) AS is_ad FROM items i LEFT JOIN versions v ON v.id=i.current_version_id `

func (a *App) items(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("product")
	a.list(w, r, itemSelect+"WHERE i.product_id::text=ANY($1) AND i.deleted_at IS NULL ORDER BY i.updated_at DESC LIMIT 1000", a.productIDs(r.Context(), p))
}
func (a *App) itemData(ctx context.Context, id, product string) (map[string]any, error) {
	items, e := a.query(ctx, itemSelect+"WHERE i.id::text=$1 AND i.deleted_at IS NULL AND ($2='' OR i.product_id::text=$2)", id, product)
	if e != nil || len(items) == 0 {
		return nil, fmt.Errorf("innholdet finnes ikke")
	}
	versions, e := a.query(ctx, `SELECT v.id,v.number,v.title,v.body,v.file_name,v.mime,v.checksum,v.bytes,v.provenance,v.created_by,v.created_at,
 coalesce((SELECT channels FROM ad_version_channels WHERE version_id=v.id),'{}'::text[]) AS channels,
 EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind='thumbnail') AS has_thumbnail,
 EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind='proxy') AS has_proxy,
 coalesce((SELECT status FROM ad_reviews WHERE version_id=v.id ORDER BY created_at DESC,id DESC LIMIT 1),'review') AS review_status
 FROM versions v WHERE v.item_id::text=$1 ORDER BY v.number DESC`, id)
	if e != nil {
		return nil, e
	}
	notes, e := a.query(ctx, "SELECT * FROM notes WHERE item_id::text=$1 ORDER BY created_at", id)
	if e != nil {
		return nil, e
	}
	ads, err := a.query(ctx, "SELECT ad_type,external_key,brief,folder_id,channels,(SELECT name FROM ad_folders WHERE id=ads.folder_id) AS folder_name FROM ads WHERE item_id::text=$1", id)
	if err != nil {
		return nil, err
	}
	reviews, err := a.query(ctx, "SELECT r.* FROM ad_reviews r JOIN versions v ON v.id=r.version_id WHERE v.item_id::text=$1 ORDER BY r.created_at DESC,r.id DESC", id)
	if err != nil {
		return nil, err
	}
	var ad any
	if len(ads) > 0 {
		ad = ads[0]
	}
	return map[string]any{"item": items[0], "versions": versions, "notes": notes, "reviews": reviews, "ad": ad, "extra": a.extraItemData(ctx, id)}, nil
}
func (a *App) item(w http.ResponseWriter, r *http.Request) {
	v, e := a.itemData(r.Context(), r.PathValue("id"), "")
	if e != nil {
		fail(w, 404, e.Error())
		return
	}
	write(w, 200, v)
}
func (a *App) newVersion(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Title    string `json:"title"`
		Body     string `json:"body"`
		Expected string `json:"expected_version_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	if v.Title == "" || len(v.Title) > 300 {
		fail(w, 400, "Oppgi en tittel")
		return
	}
	id := r.PathValue("id")
	tx, e := a.db.Begin(r.Context())
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(r.Context())
	var current string
	var isAd bool
	e = tx.QueryRow(r.Context(), "SELECT coalesce(current_version_id::text,''),EXISTS(SELECT 1 FROM ads WHERE item_id=items.id) FROM items WHERE id::text=$1 FOR UPDATE", id).Scan(&current, &isAd)
	if isAd {
		fail(w, 400, "Last opp en ny filversjon til annonsen, eller rediger annonsebriefen")
		return
	}
	if e != nil {
		fail(w, 404, "Innholdet finnes ikke")
		return
	}
	if current != v.Expected {
		fail(w, 409, "Innholdet er endret av noen andre. Åpne det på nytt.")
		return
	}
	var version string
	e = tx.QueryRow(r.Context(), "INSERT INTO versions(item_id,number,title,body,file_key,file_name,mime,checksum,bytes,created_by) SELECT item_id,number+1,$1,$2,file_key,file_name,mime,checksum,bytes,$3 FROM versions WHERE id=$4 RETURNING id::text", v.Title, v.Body, actor(r).Name, current).Scan(&version)
	if e != nil {
		fail(w, 500, "Kunne ikke lagre versjon")
		return
	}
	_, e = tx.Exec(r.Context(), "UPDATE items SET title=$1,body=$2,current_version_id=$3,status='draft',updated_at=now() WHERE id::text=$4", v.Title, v.Body, version, id)
	if e != nil || tx.Commit(r.Context()) != nil {
		fail(w, 500, "Kunne ikke lagre versjon")
		return
	}
	a.audit(r.Context(), actor(r).Name, "version.created", version)
	write(w, 201, map[string]string{"id": version})
}
func (a *App) approve(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Version string `json:"version_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	ctx := r.Context()
	tx, e := a.db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	tag, e := tx.Exec(ctx, "UPDATE items SET status='approved',updated_at=now() WHERE id::text=$1 AND current_version_id::text=$2 AND deleted_at IS NULL", r.PathValue("id"), v.Version)
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 409, "Versjonen er endret. Åpne innholdet på nytt.")
		return
	}
	// The legacy approval endpoint must preserve the same exact-version ad history.
	_, e = tx.Exec(ctx, "INSERT INTO ad_reviews(version_id,status,author) SELECT $1,'approved',$2 WHERE EXISTS(SELECT 1 FROM ads WHERE item_id::text=$3)", v.Version, actor(r).Name, r.PathValue("id"))
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Kunne ikke godkjenne versjonen")
		return
	}
	a.audit(r.Context(), actor(r).Name, "version.approved", v.Version)
	write(w, 200, map[string]bool{"ok": true})
}
func (a *App) addNote(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Body     string   `json:"body"`
		Mentions []string `json:"mentions"`
		Version  string   `json:"version_id"`
		At       *float64 `json:"at_seconds"`
	}
	if !decode(w, r, &v) {
		return
	}
	if strings.TrimSpace(v.Body) == "" || len(v.Mentions) > 20 || v.At != nil && *v.At < 0 {
		fail(w, 400, "Skriv en kommentar")
		return
	}
	tag, e := a.db.Exec(r.Context(), "INSERT INTO notes(item_id,version_id,body,at_seconds,author,mentions) SELECT i.id,coalesce(nullif($6,'')::uuid,i.current_version_id),$1,$2,$3,$5 FROM items i WHERE i.id::text=$4 AND ($6='' OR EXISTS(SELECT 1 FROM versions WHERE id::text=$6 AND item_id=i.id))", v.Body, v.At, actor(r).Name, r.PathValue("id"), emptyStrings(v.Mentions), v.Version)
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 404, "Innholdet finnes ikke")
		return
	}
	var p string
	a.db.QueryRow(r.Context(), "SELECT product_id::text FROM items WHERE id::text=$1", r.PathValue("id")).Scan(&p)
	for _, mention := range v.Mentions {
		var agentName string
		if a.db.QueryRow(r.Context(), "SELECT name FROM agent_tokens WHERE id::text=$1 AND product_id::text=$2 AND revoked_at IS NULL AND expires_at>now()", mention, p).Scan(&agentName) == nil {
			a.notify(r.Context(), p, "", "agent_mention", actor(r).Name+" nevnte "+agentName+": "+v.Body, r.PathValue("id"), "")
			continue
		}
		if !badID(mention) && a.productAccess(context.WithValue(r.Context(), actorKey{}, Actor{ID: mention, Role: "editor"}), p, false) {
			a.notify(r.Context(), p, mention, "mention", actor(r).Name+" nevnte deg: "+v.Body, r.PathValue("id"), "")
		}
	}
	write(w, 201, map[string]bool{"ok": true})
}
func (a *App) upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<20)
	if e := r.ParseMultipartForm(8 << 20); e != nil {
		fail(w, 400, "Filen kunne ikke lastes opp. Maks 250 MB.")
		return
	}
	defer r.MultipartForm.RemoveAll()
	f, h, e := r.FormFile("file")
	if e != nil {
		fail(w, 400, "Velg en fil")
		return
	}
	defer f.Close()
	quotaTx, e := a.db.Begin(r.Context())
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer quotaTx.Rollback(r.Context())
	if _, e = quotaTx.Exec(r.Context(), "SELECT singleton FROM workspace_limits FOR UPDATE"); e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	if e := a.storageAllowed(r.Context(), h.Size); e != nil {
		fail(w, 409, e.Error())
		return
	}
	head := make([]byte, 512)
	n, _ := f.Read(head)
	f.Seek(0, 0)
	mt := http.DetectContentType(head[:n])
	kind := "reference"
	switch {
	case strings.HasPrefix(mt, "image/"):
		kind = "image"
	case strings.HasPrefix(mt, "video/"):
		kind = "video"
	case strings.HasPrefix(mt, "audio/"):
		kind = "audio"
	}
	key := token()
	out, e := os.OpenFile(filepath.Join(a.storage, key), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		fail(w, 500, "Kunne ikke lagre filen")
		return
	}
	_, e = io.Copy(out, f)
	closeErr := out.Close()
	if e != nil || closeErr != nil {
		os.Remove(filepath.Join(a.storage, key))
		fail(w, 500, "Opplastingen ble avbrutt")
		return
	}
	title := r.FormValue("title")
	if title == "" {
		title = h.Filename
	}
	result, e := a.insertItem(r.Context(), actor(r), itemInput{Product: r.FormValue("product_id"), Title: title, Kind: kind, Body: r.FormValue("body"), Rights: r.FormValue("rights")}, key, filepath.Base(h.Filename), mt)
	if e != nil {
		os.Remove(filepath.Join(a.storage, key))
		fail(w, 400, e.Error())
		return
	}
	a.recordFile(r.Context(), result["version_id"], key)
	p := r.FormValue("product_id")
	if actor(r).Agent {
		p = actor(r).Product
	}
	a.queueMedia(r.Context(), p, result["version_id"], actor(r).ID)
	write(w, 201, result)
}
func (a *App) file(w http.ResponseWriter, r *http.Request) {
	var key, name, mt string
	e := a.db.QueryRow(r.Context(), "SELECT v.file_key,v.file_name,v.mime FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND i.deleted_at IS NULL AND ($2='' OR i.product_id::text=$2)", r.PathValue("id"), actor(r).Product).Scan(&key, &name, &mt)
	if e != nil || key == "" {
		fail(w, 404, "Filen finnes ikke")
		return
	}
	w.Header().Set("Content-Security-Policy", "default-src 'none'; sandbox")
	disposition := "attachment"
	if (strings.HasPrefix(mt, "video/") || strings.HasPrefix(mt, "audio/") || mt == "image/jpeg" || mt == "image/png" || mt == "image/webp" || mt == "image/gif") && r.URL.Query().Get("download") == "" {
		disposition = "inline"
	}
	w.Header().Set("Content-Type", mt)
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": name}))
	mediaCache(w, r, key)
	http.ServeFile(w, r, filepath.Join(a.storage, key))
}
func (a *App) searchData(ctx context.Context, q, product, user string) ([]map[string]any, error) {
	return a.searchResults(ctx, q, product, user, searchFilter{Mode: "all"}, nil)
}
func (a *App) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := searchFilter{Kind: q.Get("kind"), Status: q.Get("status"), Rights: q.Get("rights"), Author: q.Get("author"), Campaign: q.Get("campaign"), Tag: q.Get("tag"), Mode: q.Get("mode"), MinViews: int(parseFloat(q.Get("min_views")))}
	if f.Mode == "" {
		f.Mode = "all"
	}
	rows, e := a.searchResults(r.Context(), q.Get("q"), q.Get("product"), actor(r).ID, f, nil)
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	write(w, 200, rows)
}
