package studio

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type profileConfig struct {
	modelConfig
	Fallback string `json:"fallback_model"`
	Name     string `json:"name"`
}

func (a *App) profile(ctx context.Context, p, role string) (profileConfig, error) {
	if role == "" {
		role = "chat"
	}
	var c profileConfig
	c.Role = role
	e := a.db.QueryRow(ctx, "SELECT provider,model,max_steps,max_tokens,timeout_seconds,max_cost_usd::float8,fallback_model,name FROM model_profiles WHERE product_id::text=$1 AND role=$2", p, role).Scan(&c.Provider, &c.Model, &c.MaxSteps, &c.MaxTokens, &c.Timeout, &c.MaxCost, &c.Fallback, &c.Name)
	if e != nil {
		e = a.db.QueryRow(ctx, "SELECT provider,model,max_steps,max_tokens,timeout_seconds,max_cost_usd::float8 FROM model_settings WHERE role=$1", role).Scan(&c.Provider, &c.Model, &c.MaxSteps, &c.MaxTokens, &c.Timeout, &c.MaxCost)
	}
	return c, e
}
func (a *App) profiles(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT *,max_cost_usd::float8 AS max_cost_usd FROM model_profiles WHERE product_id::text=ANY($1) ORDER BY role", a.productIDs(r.Context(), r.URL.Query().Get("product")))
}
func (a *App) saveProfile(w http.ResponseWriter, r *http.Request) {
	var v struct {
		profileConfig
		Product string `json:"product_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	if validateProduct(r.Context(), a, v.Product) != nil || !validConfig(v.modelConfig) || strings.TrimSpace(v.Role) == "" || len(v.Role) > 80 || (v.Provider != "openrouter" && v.Provider != "typesafe" && v.Provider != "external") || len(v.Fallback) > 150 {
		fail(w, 400, "Ugyldig modellprofil")
		return
	}
	_, e := a.db.Exec(r.Context(), "INSERT INTO model_profiles(product_id,role,name,provider,model,fallback_model,max_steps,max_tokens,timeout_seconds,max_cost_usd) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(product_id,role) DO UPDATE SET name=excluded.name,provider=excluded.provider,model=excluded.model,fallback_model=excluded.fallback_model,max_steps=excluded.max_steps,max_tokens=excluded.max_tokens,timeout_seconds=excluded.timeout_seconds,max_cost_usd=excluded.max_cost_usd", v.Product, v.Role, v.Name, v.Provider, v.Model, v.Fallback, v.MaxSteps, v.MaxTokens, v.Timeout, v.MaxCost)
	if e != nil {
		fail(w, 400, "Kunne ikke lagre profilen")
		return
	}
	ok(w)
}
func (a *App) chatSnapshot(ctx context.Context, p, campaign string, versions []string) (map[string]any, error) {
	if len(versions) > 20 {
		return nil, fmt.Errorf("maks 20 vedlegg")
	}
	pack, e := a.contextPack(ctx, p)
	if e != nil {
		return nil, e
	}
	attached := []map[string]any{}
	for _, id := range versions {
		rows, e := a.query(ctx, "SELECT v.id,v.title,v.body,v.file_name,v.mime FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND i.product_id::text=$2 AND i.deleted_at IS NULL", id, p)
		if e != nil || len(rows) == 0 {
			return nil, fmt.Errorf("vedlegget finnes ikke i produktet")
		}
		segs, _ := a.query(ctx, "SELECT start_seconds,kind,body FROM segments WHERE version_id::text=$1 ORDER BY start_seconds LIMIT 150", id)
		rows[0]["segments"] = segs
		attached = append(attached, rows[0])
	}
	pack["attachments"] = attached
	if campaign != "" {
		rows, e := a.query(ctx, "SELECT * FROM campaigns WHERE id::text=$1 AND product_id::text=$2", campaign, p)
		if e != nil || len(rows) == 0 {
			return nil, fmt.Errorf("ukjent kampanje")
		}
		pack["campaign"] = rows[0]
	}
	return pack, nil
}
func (a *App) runStream(w http.ResponseWriter, r *http.Request) {
	var owner string
	if a.db.QueryRow(r.Context(), "SELECT user_id::text FROM runs WHERE id::text=$1", r.PathValue("id")).Scan(&owner) != nil || owner != actor(r).ID {
		fail(w, 404, "Ukjent jobb")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher, ok := w.(http.Flusher)
	if !ok {
		return
	}
	ticker := time.NewTicker(400 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.NewTimer(25 * time.Second)
	defer deadline.Stop()
	last := ""
	for {
		rows, e := a.query(r.Context(), "SELECT id,status,partial,steps,cost_usd::float8 AS cost_usd,stop_reason FROM runs WHERE id::text=$1", r.PathValue("id"))
		if e != nil || len(rows) == 0 {
			return
		}
		data := string(jsonBytes(rows[0]))
		if data != last {
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
			last = data
		}
		s := fmt.Sprint(rows[0]["status"])
		if s != "running" && s != "queued" {
			return
		}
		select {
		case <-r.Context().Done():
			return
		case <-deadline.C:
			return
		case <-ticker.C:
		}
	}
}
func (a *App) draftTask(ctx context.Context, u Actor, p, title, brief string) (any, error) {
	if strings.TrimSpace(title) == "" || len(title) > 300 || len(brief) > 16000 {
		return nil, fmt.Errorf("ugyldig oppgave")
	}
	var id string
	e := a.db.QueryRow(ctx, "INSERT INTO tasks(product_id,title,brief,status,executor) VALUES($1,$2,$3,'idea','external') RETURNING id::text", p, title, brief).Scan(&id)
	return map[string]string{"id": id, "status": "idea", "next": "Et menneske må sette oppgaven klar før en ekstern agent kan hente den."}, e
}
