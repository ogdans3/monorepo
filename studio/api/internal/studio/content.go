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
	a.list(w, r, "SELECT * FROM products ORDER BY created_at")
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
	tag, e := a.db.Exec(r.Context(), "UPDATE products SET brand=$1,audience=$2,description=$3 WHERE id::text=$4", v.Brand, v.Audience, v.Description, r.PathValue("id"))
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 404, "Produktet finnes ikke")
		return
	}
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

const itemSelect = "SELECT i.id,i.product_id,i.title,i.kind,i.body,i.source_url,i.tags,i.rights,i.status,i.current_version_id,i.created_by,i.created_at,i.updated_at,v.mime,v.file_name FROM items i LEFT JOIN versions v ON v.id=i.current_version_id "

func (a *App) items(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Query().Get("product")
	a.list(w, r, itemSelect+"WHERE ($1='' OR i.product_id::text=$1) ORDER BY i.updated_at DESC LIMIT 300", p)
}
func (a *App) itemData(ctx context.Context, id, product string) (map[string]any, error) {
	items, e := a.query(ctx, itemSelect+"WHERE i.id::text=$1 AND ($2='' OR i.product_id::text=$2)", id, product)
	if e != nil || len(items) == 0 {
		return nil, fmt.Errorf("innholdet finnes ikke")
	}
	versions, e := a.query(ctx, "SELECT id,number,title,body,file_name,mime,created_by,created_at FROM versions WHERE item_id::text=$1 ORDER BY number DESC", id)
	if e != nil {
		return nil, e
	}
	notes, e := a.query(ctx, "SELECT * FROM notes WHERE item_id::text=$1 ORDER BY created_at", id)
	if e != nil {
		return nil, e
	}
	return map[string]any{"item": items[0], "versions": versions, "notes": notes}, nil
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
	e = tx.QueryRow(r.Context(), "SELECT current_version_id::text FROM items WHERE id::text=$1 FOR UPDATE", id).Scan(&current)
	if e != nil {
		fail(w, 404, "Innholdet finnes ikke")
		return
	}
	if current != v.Expected {
		fail(w, 409, "Innholdet er endret av noen andre. Åpne det på nytt.")
		return
	}
	var version string
	e = tx.QueryRow(r.Context(), "INSERT INTO versions(item_id,number,title,body,file_key,file_name,mime,created_by) SELECT item_id,number+1,$1,$2,file_key,file_name,mime,$3 FROM versions WHERE id=$4 RETURNING id::text", v.Title, v.Body, actor(r).Name, current).Scan(&version)
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
	tag, e := a.db.Exec(r.Context(), "UPDATE items SET status='approved',updated_at=now() WHERE id::text=$1 AND current_version_id::text=$2", r.PathValue("id"), v.Version)
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 409, "Versjonen er endret. Åpne innholdet på nytt.")
		return
	}
	a.audit(r.Context(), actor(r).Name, "version.approved", v.Version)
	write(w, 200, map[string]bool{"ok": true})
}
func (a *App) addNote(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Body string   `json:"body"`
		At   *float64 `json:"at_seconds"`
	}
	if !decode(w, r, &v) {
		return
	}
	if strings.TrimSpace(v.Body) == "" || v.At != nil && *v.At < 0 {
		fail(w, 400, "Skriv en kommentar")
		return
	}
	tag, e := a.db.Exec(r.Context(), "INSERT INTO notes(item_id,version_id,body,at_seconds,author) SELECT id,current_version_id,$1,$2,$3 FROM items WHERE id::text=$4", v.Body, v.At, actor(r).Name, r.PathValue("id"))
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 404, "Innholdet finnes ikke")
		return
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
	write(w, 201, result)
}
func (a *App) file(w http.ResponseWriter, r *http.Request) {
	var key, name, mt string
	e := a.db.QueryRow(r.Context(), "SELECT v.file_key,v.file_name,v.mime FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND ($2='' OR i.product_id::text=$2)", r.PathValue("id"), actor(r).Product).Scan(&key, &name, &mt)
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
	http.ServeFile(w, r, filepath.Join(a.storage, key))
}
func (a *App) searchData(ctx context.Context, q, product, user string) ([]map[string]any, error) {
	if strings.TrimSpace(q) == "" {
		return []map[string]any{}, nil
	}
	if len(q) > 300 {
		return nil, fmt.Errorf("søket er for langt")
	}
	return a.query(ctx, `WITH docs AS (
 SELECT id::text,id::text AS target_id,product_id::text,'item' AS entity,kind,title,body,status FROM items
 UNION ALL SELECT n.id::text,n.item_id::text,i.product_id::text,'note','note',i.title,n.body,i.status FROM notes n JOIN items i ON i.id=n.item_id
 UNION ALL SELECT id::text,id::text,product_id::text,'task','task',title,brief,status FROM tasks
 UNION ALL SELECT id::text,id::text,product_id::text,'publication','publication',title,caption,status FROM publications
 UNION ALL SELECT m.id::text,c.id::text,c.product_id::text,'message','message',c.title,m.body,'chat' FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.created_by::text=$3
 UNION ALL SELECT id::text,id::text,id::text,'product','knowledge',name,description||' '||brand||' '||audience,'active' FROM products
 ), ranked AS (
 SELECT *, ts_rank_cd(to_tsvector('norwegian',title||' '||body),websearch_to_tsquery('norwegian',$1))+similarity(title,$1) AS rank
 FROM docs WHERE ($2='' OR product_id=$2) AND (to_tsvector('norwegian',title||' '||body) @@ websearch_to_tsquery('norwegian',$1) OR title ILIKE '%'||replace(replace(replace($1,'\','\\'),'%','\%'),'_','\_')||'%' OR similarity(title,$1)>0.18)
 ) SELECT id,target_id,product_id,entity,kind,title,left(body,260) AS excerpt,status,rank FROM ranked ORDER BY rank DESC,title LIMIT 60`, q, product, user)
}
func (a *App) search(w http.ResponseWriter, r *http.Request) {
	rows, e := a.searchData(r.Context(), r.URL.Query().Get("q"), r.URL.Query().Get("product"), actor(r).ID)
	if e != nil {
		fail(w, 400, "Kunne ikke søke")
		return
	}
	if rows == nil {
		rows = []map[string]any{}
	}
	write(w, 200, rows)
}
