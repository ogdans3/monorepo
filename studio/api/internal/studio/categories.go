package studio

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

var categories = map[string]string{
	"ukategorisert": "Ukategorisert", "merkevare_design": "Merkevare og design", "mat_drikke": "Mat og drikke", "mote_skjonnhet": "Mote og skjønnhet", "teknologi": "Teknologi", "bil_transport": "Bil og transport", "trening_helse": "Trening og helse", "reise_natur": "Reise og natur", "hjem_interior": "Hjem og interiør", "laering": "Læring", "humor_underholdning": "Humor og underholdning", "bedrift_markedsforing": "Bedrift og markedsføring",
}

func (a *App) classifyImported(ctx context.Context, version string) error {
	var title, body, key string
	e := a.db.QueryRow(ctx, "SELECT v.title,v.body,coalesce((SELECT file_key FROM media_artifacts WHERE version_id=v.id AND kind='thumbnail'),'') FROM versions v JOIN items i ON i.current_version_id=v.id WHERE v.id=$1 AND i.metadata ? 'import' AND coalesce(i.metadata->'classification'->>'status','')<>'manual'", version).Scan(&title, &body, &key)
	if e == pgx.ErrNoRows {
		return nil
	} // Ordinary local uploads and human categories are unchanged.
	if e != nil {
		return e
	}
	rows, e := a.query(ctx, "SELECT body FROM segments WHERE version_id=$1 ORDER BY start_seconds LIMIT 60", version)
	if e != nil {
		return e
	}
	text := title + "\n" + body
	for _, r := range rows {
		text += "\n" + fmt.Sprint(r["body"])
	}
	text = truncateText(text, 16000)
	payload := map[string]string{"text": text}
	if key != "" {
		payload["key"] = key
	}
	var result map[string]any
	c, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	if e = a.localJSON(c, "/categorize", payload, &result); e != nil {
		a.db.Exec(ctx, "UPDATE items SET metadata=jsonb_set(metadata,'{classification}', $1) WHERE current_version_id=$2 AND coalesce(metadata->'classification'->>'status','')<>'manual'", jsonBytes(map[string]string{"status": "failed", "category": "ukategorisert"}), version)
		return e
	}
	category, _ := result["category"].(string)
	label, ok := categories[category]
	if !ok {
		return fmt.Errorf("ukjent kategori")
	}
	result["label"] = label
	result["version_id"] = version
	result["classified_at"] = time.Now().UTC().Format(time.RFC3339)
	_, e = a.db.Exec(ctx, "UPDATE items SET metadata=jsonb_set(metadata,'{classification}',$1),updated_at=now() WHERE current_version_id=$2 AND coalesce(metadata->'classification'->>'status','')<>'manual'", jsonBytes(result), version)
	return e
}
func (a *App) setCategory(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Category string `json:"category"`
	}
	if !decode(w, r, &v) {
		return
	}
	label, ok := categories[v.Category]
	if !ok {
		fail(w, 400, "Velg en gyldig kategori")
		return
	}
	result := map[string]any{"category": v.Category, "label": label, "status": "manual", "author": actor(r).Name, "classified_at": time.Now().UTC().Format(time.RFC3339)}
	tag, e := a.db.Exec(r.Context(), "UPDATE items SET metadata=jsonb_set(metadata,'{classification}',$1),updated_at=now() WHERE id::text=$2 AND deleted_at IS NULL", jsonBytes(result), r.PathValue("id"))
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 404, "Innholdet finnes ikke")
		return
	}
	okResponse := map[string]bool{"ok": true}
	write(w, 200, okResponse)
}
