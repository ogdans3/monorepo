package studio

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Count stored files once even when several immutable versions reference them.
const storageUsedSQL = `(SELECT coalesce(sum(bytes),0) FROM (SELECT file_key,max(bytes) AS bytes FROM (SELECT file_key,bytes FROM versions WHERE file_key<>'' UNION ALL SELECT file_key,bytes FROM media_artifacts) files GROUP BY file_key) unique_files)+(SELECT coalesce(sum(size),0) FROM upload_sessions WHERE completed_at IS NULL AND expires_at>now())`

func (a *App) startUpload(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Product  string `json:"product_id"`
		Title    string `json:"title"`
		Name     string `json:"file_name"`
		Body     string `json:"body"`
		Rights   string `json:"rights"`
		Size     int64  `json:"size"`
		Item     string `json:"item_id"`
		Expected string `json:"expected_version_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	u := actor(r)
	if u.Agent {
		v.Product = u.Product
	}
	if validateProduct(r.Context(), a, v.Product) != nil || v.Size <= 0 || v.Size > 2<<30 || len(v.Title) > 300 || v.Name == "" {
		fail(w, 400, "Velg produkt og en fil på maks 2 GB")
		return
	}
	if v.Title == "" {
		v.Title = filepath.Base(v.Name)
	}
	if v.Rights == "" {
		v.Rights = "unknown"
	}
	if v.Item != "" {
		var current string
		if a.db.QueryRow(r.Context(), "SELECT current_version_id::text FROM items WHERE id::text=$1 AND product_id::text=$2 AND deleted_at IS NULL", v.Item, v.Product).Scan(&current) != nil || current != v.Expected {
			fail(w, 409, "Innholdet er endret eller utilgjengelig")
			return
		}
	}
	ctx := r.Context()
	tx, e := a.db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	var limit, used int64
	e = tx.QueryRow(ctx, "SELECT storage_bytes FROM workspace_limits WHERE singleton FOR UPDATE").Scan(&limit)
	if e == nil {
		e = tx.QueryRow(ctx, "SELECT "+storageUsedSQL).Scan(&used)
	}
	if e != nil || used+v.Size > limit {
		fail(w, 409, "Lagringsgrensen er nådd")
		return
	}
	var id string
	key := token()
	e = tx.QueryRow(ctx, "INSERT INTO upload_sessions(product_id,actor_id,title,file_name,body,rights,size,file_key,item_id,expected_version_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,nullif($9,'')::uuid,nullif($10,'')::uuid) RETURNING id::text", v.Product, u.ID, v.Title, filepath.Base(v.Name), v.Body, v.Rights, v.Size, key, v.Item, v.Expected).Scan(&id)
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 400, "Kunne ikke starte opplasting")
		return
	}
	write(w, 201, map[string]any{"id": id, "offset_bytes": 0, "chunk_size": 8 << 20})
}
func (a *App) uploadStatus(w http.ResponseWriter, r *http.Request) {
	rows, e := a.query(r.Context(), "SELECT id,offset_bytes,size,completed_at,result,expires_at FROM upload_sessions WHERE id::text=$1 AND actor_id=$2 AND expires_at>now()", r.PathValue("id"), actor(r).ID)
	if e != nil || len(rows) == 0 {
		fail(w, 404, "Opplastingen finnes ikke")
		return
	}
	write(w, 200, rows[0])
}
func (a *App) uploadChunk(w http.ResponseWriter, r *http.Request) {
	offset, e := strconv.ParseInt(r.Header.Get("Upload-Offset"), 10, 64)
	if e != nil || offset < 0 {
		fail(w, 400, "Upload-Offset mangler")
		return
	}
	b, e := io.ReadAll(http.MaxBytesReader(w, r.Body, 8<<20))
	if e != nil || len(b) == 0 {
		fail(w, 400, "Send 1–8 MB per del")
		return
	}
	ctx := r.Context()
	tx, e := a.db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	var key string
	var current, size int64
	e = tx.QueryRow(ctx, "SELECT file_key,offset_bytes,size FROM upload_sessions WHERE id::text=$1 AND actor_id=$2 AND expires_at>now() AND completed_at IS NULL FOR UPDATE", r.PathValue("id"), actor(r).ID).Scan(&key, &current, &size)
	if e != nil {
		fail(w, 404, "Opplastingen finnes ikke")
		return
	}
	if current != offset || offset+int64(len(b)) > size {
		fail(w, 409, "Feil posisjon. Hent opplastingsstatus og fortsett derfra.")
		return
	}
	f, e := os.OpenFile(filepath.Join(a.storage, key), os.O_CREATE|os.O_WRONLY, 0600)
	if e != nil {
		fail(w, 500, "Kunne ikke åpne filen")
		return
	}
	_, e = f.WriteAt(b, offset)
	if e == nil {
		e = f.Sync()
	}
	f.Close()
	if e != nil {
		fail(w, 500, "Kunne ikke lagre delen")
		return
	}
	_, e = tx.Exec(ctx, "UPDATE upload_sessions SET offset_bytes=$1 WHERE id::text=$2", offset+int64(len(b)), r.PathValue("id"))
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Kunne ikke lagre posisjonen")
		return
	}
	write(w, 200, map[string]any{"offset_bytes": offset + int64(len(b))})
}
func fileMetadata(path string) (string, string, int64, error) {
	f, e := os.Open(path)
	if e != nil {
		return "", "", 0, e
	}
	defer f.Close()
	h := sha256.New()
	head := make([]byte, 512)
	n, _ := f.Read(head)
	mt := http.DetectContentType(head[:n])
	f.Seek(0, 0)
	size, e := io.Copy(h, f)
	return hex.EncodeToString(h.Sum(nil)), mt, size, e
}
func kindForMime(mt string) string {
	for _, k := range []string{"image", "audio", "video"} {
		if strings.HasPrefix(mt, k+"/") {
			return k
		}
	}
	return "reference"
}
func (a *App) completeUpload(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	u := actor(r)
	tx, e := a.db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	var product, title, name, body, rights, key, item, expected string
	var size, offset int64
	var result []byte
	e = tx.QueryRow(ctx, "SELECT product_id::text,title,file_name,body,rights,file_key,coalesce(item_id::text,''),coalesce(expected_version_id::text,''),size,offset_bytes,result FROM upload_sessions WHERE id::text=$1 AND actor_id=$2 AND expires_at>now() FOR UPDATE", r.PathValue("id"), u.ID).Scan(&product, &title, &name, &body, &rights, &key, &item, &expected, &size, &offset, &result)
	if e != nil {
		fail(w, 404, "Opplastingen er utløpt")
		return
	}
	if len(result) > 0 {
		var out any
		json.Unmarshal(result, &out)
		write(w, 200, out)
		return
	}
	if offset != size {
		fail(w, 409, "Alle delene er ikke lastet opp")
		return
	}
	checksum, mt, actual, e := fileMetadata(filepath.Join(a.storage, key))
	if e != nil || actual != size {
		fail(w, 409, "Filen er ufullstendig")
		return
	}
	var existingID, existingVersion string
	if item == "" && tx.QueryRow(ctx, "SELECT i.id::text,v.id::text FROM versions v JOIN items i ON i.current_version_id=v.id WHERE i.product_id=$1 AND i.deleted_at IS NULL AND v.checksum=$2 LIMIT 1", product, checksum).Scan(&existingID, &existingVersion) == nil {
		out := map[string]any{"id": existingID, "version_id": existingVersion, "duplicate": true}
		_, e = tx.Exec(ctx, "UPDATE upload_sessions SET completed_at=now(),result=$1 WHERE id::text=$2", jsonBytes(out), r.PathValue("id"))
		if e != nil || tx.Commit(ctx) != nil {
			fail(w, 500, "Kunne ikke fullføre")
			return
		}
		os.Remove(filepath.Join(a.storage, key))
		write(w, 200, out)
		return
	}
	var version string
	if item == "" {
		e = tx.QueryRow(ctx, "INSERT INTO items(product_id,title,kind,body,rights,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text", product, title, kindForMime(mt), body, rights, u.Name).Scan(&item)
		if e == nil {
			e = tx.QueryRow(ctx, "INSERT INTO versions(item_id,number,title,body,file_key,file_name,mime,checksum,bytes,created_by) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text", item, title, body, key, name, mt, checksum, size, u.Name).Scan(&version)
		}
	} else {
		var current string
		e = tx.QueryRow(ctx, "SELECT current_version_id::text FROM items WHERE id=$1 FOR UPDATE", item).Scan(&current)
		if e != nil || current != expected {
			fail(w, 409, "En ny versjon er allerede lagret")
			return
		}
		e = tx.QueryRow(ctx, "INSERT INTO versions(item_id,number,title,body,file_key,file_name,mime,checksum,bytes,created_by) SELECT item_id,number+1,$2,$3,$4,$5,$6,$7,$8,$9 FROM versions WHERE id=$1 RETURNING id::text", current, title, body, key, name, mt, checksum, size, u.Name).Scan(&version)
	}
	if e == nil {
		_, e = tx.Exec(ctx, "UPDATE items SET current_version_id=$1,title=$2,body=$3,kind=$4,status='draft',updated_at=now() WHERE id=$5", version, title, body, kindForMime(mt), item)
	}
	out := map[string]string{"id": item, "version_id": version}
	if e == nil {
		_, e = tx.Exec(ctx, "UPDATE upload_sessions SET completed_at=now(),result=$1 WHERE id::text=$2", jsonBytes(out), r.PathValue("id"))
	}
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 400, "Kunne ikke fullføre opplastingen")
		return
	}
	a.queueMedia(ctx, product, version, u.ID)
	write(w, 201, out)
}
func (a *App) recordFile(ctx context.Context, version, key string) {
	checksum, _, size, e := fileMetadata(filepath.Join(a.storage, key))
	if e == nil {
		a.db.Exec(ctx, "UPDATE versions SET checksum=$1,bytes=$2 WHERE id::text=$3", checksum, size, version)
	}
}
func (a *App) queueMedia(ctx context.Context, product, version, user string) {
	// Local processing never initiates paid API calls or child agent runs.
	var known bool
	a.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE id::text=$1)", user).Scan(&known)
	if !known {
		user = ""
	}
	a.db.Exec(ctx, "INSERT INTO jobs(product_id,version_id,user_id,kind) VALUES($1,$2,nullif($3,'')::uuid,'media') ON CONFLICT DO NOTHING", product, version, user)
}
func (a *App) storageAllowed(ctx context.Context, size int64) error {
	var limit, used int64
	e := a.db.QueryRow(ctx, "SELECT storage_bytes,"+storageUsedSQL+" FROM workspace_limits").Scan(&limit, &used)
	if e != nil {
		return e
	}
	if used+size > limit {
		return fmt.Errorf("lagringsgrensen er nådd")
	}
	return nil
}
