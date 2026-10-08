package studio

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
)

type adInput struct {
	Product string `json:"product_id"`
	Title   string `json:"title"`
	Type    string `json:"ad_type"`
	Key     string `json:"external_key"`
	Brief   string `json:"brief"`
	Item    string `json:"item_id"`
	Rights  string `json:"rights"`
	Folder  string `json:"folder_id"`
}

const adSelect = `SELECT i.id,i.product_id,i.title,i.kind,i.status,i.current_version_id,i.updated_at,
 a.ad_type,a.external_key,a.brief,a.folder_id,a.channels,
 (SELECT name FROM ad_folders WHERE id=a.folder_id) AS folder_name,
 coalesce((SELECT channels FROM ad_version_channels WHERE version_id=v.id),'{}'::text[]) AS version_channels,
 v.number,v.mime,v.file_name,
 EXISTS(SELECT 1 FROM favorites f WHERE f.item_id=i.id AND f.user_id=nullif($2,'')::uuid) AS favorite,
 (SELECT count(*) FROM versions WHERE item_id=i.id) AS version_count,
 EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind='thumbnail') AS has_thumbnail,
 EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind='proxy') AS has_proxy,
 coalesce((SELECT status FROM ad_reviews WHERE version_id=v.id ORDER BY created_at DESC,id DESC LIMIT 1),CASE WHEN i.status='approved' THEN 'approved' ELSE 'review' END) AS review_status
 FROM ads a JOIN items i ON i.id=a.item_id LEFT JOIN versions v ON v.id=i.current_version_id `

func (a *App) listAds(ctx context.Context, product string) ([]map[string]any, error) {
	u, _ := ctx.Value(actorKey{}).(Actor)
	rows, err := a.query(ctx, adSelect+`WHERE i.product_id::text=$1 AND i.deleted_at IS NULL ORDER BY i.updated_at DESC`, product, u.ID)
	if rows == nil {
		rows = []map[string]any{}
	}
	return rows, err
}
func (a *App) ads(w http.ResponseWriter, r *http.Request) {
	product := r.URL.Query().Get("product")
	if !a.productAccess(r.Context(), product, false) {
		fail(w, 403, "Ingen tilgang til produktet")
		return
	}
	rows, err := a.listAds(r.Context(), product)
	if err != nil {
		fail(w, 500, "Kunne ikke hente annonser")
		return
	}
	write(w, 200, rows)
}
func (a *App) createAd(ctx context.Context, u Actor, v adInput) (map[string]any, error) {
	if u.Agent {
		v.Product = u.Product
	}
	if validateProduct(ctx, a, v.Product) != nil {
		return nil, fmt.Errorf("ingen tilgang til produktet")
	}
	v.Title = strings.TrimSpace(v.Title)
	v.Type = strings.TrimSpace(v.Type)
	v.Key = strings.TrimSpace(v.Key)
	if v.Type == "" {
		v.Type = "Annet"
	}
	if v.Key == "" {
		v.Key = token()
	}
	if v.Rights == "" {
		v.Rights = "unknown"
	}
	if v.Title == "" || len(v.Title) > 300 || len(v.Key) > 160 || len(v.Type) > 80 || len(v.Brief) > 20000 {
		return nil, fmt.Errorf("oppgi annonsetittel, type og en kort, stabil nøkkel")
	}
	if !slices.Contains([]string{"unknown", "owned", "licensed", "reference_only"}, v.Rights) {
		return nil, fmt.Errorf("ukjente rettigheter")
	}
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	// A stable product-scoped key makes retries and concurrent agent setup idempotent.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, v.Product+":ad:"+v.Key); err != nil {
		return nil, err
	}
	var existing, current string
	err = tx.QueryRow(ctx, `SELECT i.id::text,coalesce(i.current_version_id::text,'') FROM ads a JOIN items i ON i.id=a.item_id WHERE a.product_id::text=$1 AND a.external_key=$2 AND i.deleted_at IS NULL`, v.Product, v.Key).Scan(&existing, &current)
	if err == nil {
		if v.Item != "" && v.Item != existing {
			return nil, fmt.Errorf("nøkkelen brukes allerede av en annen annonse")
		}
		return map[string]any{"id": existing, "current_version_id": current, "existing": true}, nil
	}
	if err != pgx.ErrNoRows {
		return nil, err
	}
	id := v.Item
	if id != "" {
		var kind string
		if err = tx.QueryRow(ctx, `SELECT kind,coalesce(current_version_id::text,'') FROM items WHERE id::text=$1 AND product_id::text=$2 AND deleted_at IS NULL FOR UPDATE`, id, v.Product).Scan(&kind, &current); err != nil {
			return nil, fmt.Errorf("innholdet finnes ikke i dette produktet")
		}
		if kind != "video" && kind != "image" && kind != "carousel" {
			return nil, fmt.Errorf("velg video eller bilde")
		}
	} else {
		if err = tx.QueryRow(ctx, `INSERT INTO items(product_id,title,kind,rights,created_by) VALUES($1,$2,'video',$3,$4) RETURNING id::text`, v.Product, v.Title, v.Rights, u.Name).Scan(&id); err != nil {
			return nil, err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO ads(item_id,product_id,external_key,ad_type,brief,folder_id) VALUES($1,$2,$3,$4,$5,nullif($6,'')::uuid)`, id, v.Product, v.Key, v.Type, v.Brief, v.Folder); err != nil {
		return nil, fmt.Errorf("innholdet eller nøkkelen er allerede knyttet til en annonse")
	}
	if _, err = tx.Exec(ctx, `UPDATE items SET title=$1,updated_at=now() WHERE id::text=$2`, v.Title, id); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO ad_reviews(version_id,status,author) SELECT current_version_id,'approved',$2 FROM items WHERE id::text=$1 AND status='approved' AND current_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ad_reviews WHERE version_id=items.current_version_id)`, id, u.Name); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "current_version_id": current, "existing": false}, nil
}
func (a *App) addAd(w http.ResponseWriter, r *http.Request) {
	var v adInput
	if !decode(w, r, &v) {
		return
	}
	out, err := a.createAd(r.Context(), actor(r), v)
	if err != nil {
		fail(w, 400, err.Error())
		return
	}
	write(w, 201, out)
}
func (a *App) adData(ctx context.Context, id, product string) (map[string]any, error) {
	var found string
	if err := a.db.QueryRow(ctx, `SELECT item_id::text FROM ads WHERE item_id::text=$1 AND ($2='' OR product_id::text=$2)`, id, product).Scan(&found); err != nil {
		return nil, fmt.Errorf("annonsen finnes ikke")
	}
	return a.itemData(ctx, id, product)
}
func (a *App) ad(w http.ResponseWriter, r *http.Request) {
	out, err := a.adData(r.Context(), r.PathValue("id"), "")
	if err != nil {
		fail(w, 404, err.Error())
		return
	}
	write(w, 200, out)
}
func (a *App) editAd(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Title string `json:"title"`
		Type  string `json:"ad_type"`
		Brief string `json:"brief"`
	}
	if !decode(w, r, &v) {
		return
	}
	v.Title = strings.TrimSpace(v.Title)
	v.Type = strings.TrimSpace(v.Type)
	if v.Title == "" || len(v.Title) > 300 || v.Type == "" || len(v.Type) > 80 || len(v.Brief) > 20000 {
		fail(w, 400, "Kontroller tittel, type og brief")
		return
	}
	ctx := r.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE ads SET ad_type=$1,brief=$2 WHERE item_id::text=$3`, v.Type, v.Brief, r.PathValue("id"))
	if err != nil || tag.RowsAffected() != 1 {
		fail(w, 404, "Fant ikke annonsen")
		return
	}
	if _, err = tx.Exec(ctx, `UPDATE items SET title=$1,updated_at=now() WHERE id::text=$2`, v.Title, r.PathValue("id")); err != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Kunne ikke lagre annonsen")
		return
	}
	ok(w)
}

// Copy existing immutable file references instead of moving/deleting library content.
func (a *App) attachAdVersion(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Source   string `json:"source_version_id"`
		Expected string `json:"expected_version_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	ctx := r.Context()
	id := r.PathValue("id")
	tx, err := a.db.Begin(ctx)
	if err != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	var current, product string
	err = tx.QueryRow(ctx, `SELECT coalesce(i.current_version_id::text,''),i.product_id::text FROM items i JOIN ads a ON a.item_id=i.id WHERE i.id::text=$1 AND i.deleted_at IS NULL FOR UPDATE OF i`, id).Scan(&current, &product)
	if err != nil {
		fail(w, 404, "Fant ikke annonsen")
		return
	}
	var version string
	if tx.QueryRow(ctx, `SELECT id::text FROM versions WHERE item_id::text=$1 AND provenance->>'imported_version'=$2`, id, v.Source).Scan(&version) == nil {
		write(w, 200, map[string]string{"version_id": version})
		return
	}
	if current != v.Expected {
		fail(w, 409, "En annen versjon er lagret. Last inn på nytt.")
		return
	}
	var kind string
	if tx.QueryRow(ctx, `SELECT i.kind FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND i.product_id::text=$2 AND i.id::text<>$3 AND i.deleted_at IS NULL AND v.file_key<>'' AND (v.mime LIKE 'video/%' OR v.mime LIKE 'image/%')`, v.Source, product, id).Scan(&kind) != nil {
		fail(w, 400, "Velg en medieversjon fra samme produkt")
		return
	}
	err = tx.QueryRow(ctx, `INSERT INTO versions(item_id,number,title,body,file_key,file_name,mime,checksum,bytes,created_by,provenance)
 SELECT $1,(SELECT coalesce(max(number),0)+1 FROM versions WHERE item_id=$1),title,body,file_key,file_name,mime,checksum,bytes,$3,provenance||jsonb_build_object('imported_version',id::text) FROM versions WHERE id::text=$2 RETURNING id::text`, id, v.Source, actor(r).Name).Scan(&version)
	if err == nil {
		_, err = tx.Exec(ctx, `INSERT INTO media_artifacts(version_id,kind,file_key,mime,bytes) SELECT $1,kind,file_key,mime,bytes FROM media_artifacts WHERE version_id::text=$2`, version, v.Source)
	}
	if err == nil {
		_, err = tx.Exec(ctx, `UPDATE items SET current_version_id=$1,kind=$2,status='review',updated_at=now() WHERE id::text=$3`, version, kind, id)
	}
	if err != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Kunne ikke legge til versjonen")
		return
	}
	a.queueMedia(ctx, product, version, actor(r).ID)
	write(w, 201, map[string]string{"version_id": version})
}

func (a *App) reviewAd(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Version string `json:"version_id"`
		Status  string `json:"status"`
		Body    string `json:"body"`
	}
	if !decode(w, r, &v) {
		return
	}
	if (v.Status != "approved" && v.Status != "changes_requested") || len(v.Body) > 10000 || (v.Status == "changes_requested" && strings.TrimSpace(v.Body) == "") {
		fail(w, 400, "Skriv hva som må endres")
		return
	}
	ctx := r.Context()
	tx, err := a.db.Begin(ctx)
	if err != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	var current string
	err = tx.QueryRow(ctx, `SELECT coalesce(i.current_version_id::text,'') FROM items i JOIN ads a ON a.item_id=i.id WHERE i.id::text=$1 AND i.deleted_at IS NULL FOR UPDATE OF i`, r.PathValue("id")).Scan(&current)
	if err != nil || current == "" || current != v.Version {
		fail(w, 409, "En ny versjon er kommet. Åpne den før du godkjenner eller ber om endringer.")
		return
	}
	_, err = tx.Exec(ctx, `INSERT INTO ad_reviews(version_id,status,body,author) VALUES($1,$2,$3,$4)`, v.Version, v.Status, v.Body, actor(r).Name)
	if err == nil {
		status := "review"
		if v.Status == "approved" {
			status = "approved"
		}
		_, err = tx.Exec(ctx, `UPDATE items SET status=$1,updated_at=now() WHERE id::text=$2`, status, r.PathValue("id"))
	}
	if err != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Kunne ikke lagre vurderingen")
		return
	}
	ok(w)
}
