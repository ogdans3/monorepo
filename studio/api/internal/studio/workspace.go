package studio

import (
	"context"
	"encoding/json"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"math"
	"net/http"
	"strings"
	"time"
)

type writeKey struct{}

func (a *App) productAccess(ctx context.Context, id string, write bool) bool {
	u, _ := ctx.Value(actorKey{}).(Actor)
	if u.Agent {
		return u.Product == id
	}
	if u.Role == "admin" || u.ID == "" {
		return true
	} // internal workers always receive an explicit product
	if write && u.Role == "reader" {
		return false
	}
	var restricted bool
	var role string
	e := a.db.QueryRow(ctx, `SELECT p.restricted,coalesce(m.role,'') FROM products p LEFT JOIN product_members m ON m.product_id=p.id AND m.user_id::text=$2 WHERE p.id::text=$1`, id, u.ID).Scan(&restricted, &role)
	return e == nil && (!restricted || role != "") && (!write || role != "reader")
}
func (a *App) productIDs(ctx context.Context, requested string) []string {
	ids := []string{}
	rows, e := a.query(ctx, "SELECT id::text AS id FROM products WHERE ($1='' OR id::text=$1)", requested)
	if e != nil {
		return ids
	}
	for _, p := range rows {
		id := p["id"].(string)
		if a.productAccess(ctx, id, false) {
			ids = append(ids, id)
		}
	}
	return ids
}
func (a *App) resourceAccess(ctx context.Context, path, id string, write bool) bool {
	if id == "" {
		return true
	}
	table := ""
	column := "product_id::text"
	for prefix, t := range map[string]string{"/api/ad-folders/": "ad_folders", "/api/ads/": "items", "/api/imports/": "media_imports", "/api/items/": "items", "/api/tasks/": "tasks", "/api/publications/": "publications", "/api/conversations/": "conversations", "/api/campaigns/": "campaigns", "/api/experiments/": "experiments", "/api/claims/": "claims", "/api/templates/": "templates", "/api/collections/": "collections", "/api/jobs/": "jobs", "/api/upload-sessions/": "upload_sessions", "/api/products/": "products"} {
		if strings.HasPrefix(path, prefix) {
			table = t
			break
		}
	}
	if table == "products" {
		column = "id::text"
	}
	var p string
	if strings.HasPrefix(path, "/api/files/") || strings.HasPrefix(path, "/api/previews/") || strings.HasPrefix(path, "/api/versions/") {
		e := a.db.QueryRow(ctx, "SELECT i.product_id::text FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1", id).Scan(&p)
		return e == nil && a.productAccess(ctx, p, write)
	}
	if table == "" {
		return true
	}
	e := a.db.QueryRow(ctx, "SELECT "+column+" FROM "+table+" WHERE id::text=$1", id).Scan(&p)
	return e == nil && a.productAccess(ctx, p, write)
}
func ok(w http.ResponseWriter) { write(w, 200, map[string]bool{"ok": true}) }
func (a *App) createProduct(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Restricted  bool   `json:"restricted"`
	}
	if !decode(w, r, &v) {
		return
	}
	if strings.TrimSpace(v.Name) == "" || len(v.Name) > 100 {
		fail(w, 400, "Oppgi et produktnavn")
		return
	}
	var id string
	e := a.db.QueryRow(r.Context(), "INSERT INTO products(name,description,restricted) VALUES($1,$2,$3) RETURNING id::text", v.Name, v.Description, v.Restricted).Scan(&id)
	if e != nil {
		fail(w, 409, "Produktnavnet er allerede i bruk")
		return
	}
	a.snapshotProduct(r.Context(), id, actor(r).Name)
	write(w, 201, map[string]string{"id": id})
}
func (a *App) snapshotProduct(ctx context.Context, id, author string) {
	a.db.Exec(ctx, "INSERT INTO product_history(product_id,revision,snapshot,author) SELECT id,revision,to_jsonb(p),$2 FROM products p WHERE id::text=$1 ON CONFLICT DO NOTHING", id, author)
}
func (a *App) productHistory(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT * FROM product_history WHERE product_id::text=$1 ORDER BY revision DESC", r.PathValue("id"))
}
func (a *App) members(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, `SELECT u.id,u.name,u.email,u.role AS workspace_role,m.role FROM users u LEFT JOIN product_members m ON m.user_id=u.id AND m.product_id::text=$1 ORDER BY u.name`, r.PathValue("id"))
}
func (a *App) updateMember(w http.ResponseWriter, r *http.Request) {
	var v struct {
		User       string `json:"user_id"`
		Role       string `json:"role"`
		Restricted *bool  `json:"restricted"`
	}
	if !decode(w, r, &v) {
		return
	}
	ctx := r.Context()
	p := r.PathValue("id")
	if v.Restricted != nil {
		_, e := a.db.Exec(ctx, "UPDATE products SET restricted=$1 WHERE id::text=$2", *v.Restricted, p)
		if e != nil {
			fail(w, 400, "Kunne ikke endre tilgang")
			return
		}
	}
	if v.User != "" {
		if badID(v.User) || (v.Role != "" && v.Role != "reader" && v.Role != "editor") {
			fail(w, 400, "Ugyldig rolle")
			return
		}
		var e error
		if v.Role == "" {
			_, e = a.db.Exec(ctx, "DELETE FROM product_members WHERE product_id::text=$1 AND user_id::text=$2", p, v.User)
		} else {
			_, e = a.db.Exec(ctx, "INSERT INTO product_members(product_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(product_id,user_id) DO UPDATE SET role=excluded.role", p, v.User, v.Role)
		}
		if e != nil {
			fail(w, 400, "Ukjent bruker")
			return
		}
	}
	a.audit(ctx, actor(r).Name, "product.access", p)
	ok(w)
}
func (a *App) revokeInvite(w http.ResponseWriter, r *http.Request) {
	a.db.Exec(r.Context(), "UPDATE invites SET revoked_at=now() WHERE id::text=$1 AND used_at IS NULL", r.PathValue("id"))
	ok(w)
}
func (a *App) resetLink(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Email string `json:"email"`
	}
	if !decode(w, r, &v) {
		return
	}
	t := token()
	tag, e := a.db.Exec(r.Context(), "INSERT INTO password_resets(token_hash,user_id,expires_at) SELECT $1,id,now()+interval '30 minutes' FROM users WHERE email=lower($2)", hash(t), v.Email)
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 404, "Brukeren finnes ikke")
		return
	}
	a.audit(r.Context(), actor(r).Name, "password.reset.created", v.Email)
	write(w, 201, map[string]string{"url": a.origin + "/#reset=" + t})
}
func (a *App) resetPassword(w http.ResponseWriter, r *http.Request) {
	var v credentials
	if !decode(w, r, &v) {
		return
	}
	if len(v.Password) < 12 || len(v.Password) > 72 {
		fail(w, 400, "Passordet må være 12–72 tegn")
		return
	}
	h, e := bcrypt.GenerateFromPassword([]byte(v.Password), 12)
	if e != nil {
		fail(w, 400, "Ugyldig passord")
		return
	}
	tx, e := a.db.Begin(r.Context())
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(r.Context())
	var id string
	e = tx.QueryRow(r.Context(), "UPDATE password_resets SET used_at=now() WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL RETURNING user_id::text", hash(v.Token)).Scan(&id)
	if e != nil {
		fail(w, 400, "Lenken er brukt eller utløpt")
		return
	}
	if _, e = tx.Exec(r.Context(), "UPDATE users SET password_hash=$1 WHERE id=$2", string(h), id); e == nil {
		_, e = tx.Exec(r.Context(), "DELETE FROM sessions WHERE user_id=$1", id)
	}
	if e != nil || tx.Commit(r.Context()) != nil {
		fail(w, 500, "Kunne ikke bytte passord")
		return
	}
	ok(w)
}
func (a *App) notify(ctx context.Context, product, user, kind, title, entity, dedup string) {
	a.db.Exec(ctx, "INSERT INTO notifications(product_id,user_id,kind,title,entity_id,dedup) VALUES(nullif($1,'')::uuid,nullif($2,'')::uuid,$3,$4,$5,nullif($6,'')) ON CONFLICT(dedup) DO NOTHING", product, user, kind, title, entity, dedup)
}
func (a *App) notifications(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT *, $2::uuid=ANY(read_by) AS read FROM notifications WHERE (product_id IS NULL OR product_id::text=ANY($1)) AND (user_id IS NULL OR user_id=$2::uuid) ORDER BY created_at DESC LIMIT 100", a.productIDs(r.Context(), ""), actor(r).ID)
}
func (a *App) readNotification(w http.ResponseWriter, r *http.Request) {
	a.db.Exec(r.Context(), "UPDATE notifications SET read_by=array_append(read_by,$1::uuid) WHERE id::text=$2 AND (product_id IS NULL OR product_id::text=ANY($3)) AND (user_id IS NULL OR user_id=$1::uuid) AND NOT $1::uuid=ANY(read_by)", actor(r).ID, r.PathValue("id"), a.productIDs(r.Context(), ""))
	ok(w)
}
func (a *App) contextPack(ctx context.Context, p string) (map[string]any, error) {
	product, e := a.query(ctx, "SELECT * FROM products WHERE id::text=$1", p)
	if e != nil || len(product) == 0 {
		return nil, fmt.Errorf("ukjent produkt")
	}
	claims, e := a.query(ctx, "SELECT * FROM claims WHERE product_id::text=$1 ORDER BY created_at DESC LIMIT 100", p)
	if e != nil {
		return nil, e
	}
	hooks, e := a.query(ctx, "SELECT i.id,i.current_version_id,i.title,i.body,coalesce(sum(r.value),0) AS rating FROM items i LEFT JOIN ratings r ON r.version_id=i.current_version_id WHERE i.product_id::text=$1 AND i.deleted_at IS NULL AND i.kind IN('hook','knowledge') GROUP BY i.id ORDER BY rating DESC,i.updated_at DESC LIMIT 40", p)
	files, _ := a.query(ctx, "SELECT id,current_version_id,title,kind,left(body,200) AS summary FROM items WHERE product_id::text=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200", p)
	return map[string]any{"product": product[0], "claims": claims, "hooks": hooks, "files": files, "generated_at": time.Now().UTC()}, e
}
func (a *App) getContext(w http.ResponseWriter, r *http.Request) {
	v, e := a.contextPack(r.Context(), r.PathValue("id"))
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	write(w, 200, v)
}
func (a *App) limitsStatus(w http.ResponseWriter, r *http.Request) {
	limits, _ := a.query(r.Context(), "SELECT * FROM workspace_limits")
	usage, _ := a.query(r.Context(), "SELECT "+storageUsedSQL+" AS bytes")
	costs, _ := a.query(r.Context(), "SELECT coalesce(sum(coalesce(actual,reserved)),0)::float8 AS today FROM ai_ledger WHERE created_at>=date_trunc('day',now())")
	jobs, _ := a.query(r.Context(), "SELECT kind,status,count(*) FROM jobs GROUP BY kind,status")
	runs, _ := a.query(r.Context(), "SELECT model,status,sum(cost_usd)::float8 AS cost_usd,count(*) FROM runs GROUP BY model,status")
	events, _ := a.query(r.Context(), "SELECT * FROM audit ORDER BY id DESC LIMIT 100")
	write(w, 200, map[string]any{"limits": limits, "storage": usage, "cost": costs, "jobs": jobs, "runs": runs, "audit": events})
}
func (a *App) updateLimits(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Storage int64   `json:"storage_bytes"`
		Daily   float64 `json:"daily_ai_usd"`
		Active  int     `json:"max_active_jobs"`
	}
	if !decode(w, r, &v) {
		return
	}
	if v.Storage < 1<<20 || v.Daily <= 0 || v.Daily > 1000 || v.Active < 1 || v.Active > 100 {
		fail(w, 400, "Ugyldige grenser")
		return
	}
	_, e := a.db.Exec(r.Context(), "UPDATE workspace_limits SET storage_bytes=$1,daily_ai_usd=$2,max_active_jobs=$3", v.Storage, v.Daily, v.Active)
	if e != nil {
		fail(w, 400, "Kunne ikke lagre grenser")
		return
	}
	ok(w)
}
func (a *App) reserveAI(ctx context.Context, p, operation string, amount float64) (string, error) {
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return "", e
	}
	defer tx.Rollback(ctx)
	var limit, spent float64
	e = tx.QueryRow(ctx, "SELECT daily_ai_usd::float8 FROM workspace_limits WHERE singleton FOR UPDATE").Scan(&limit)
	if e != nil {
		return "", e
	}
	e = tx.QueryRow(ctx, "SELECT coalesce(sum(coalesce(actual,reserved)),0)::float8 FROM ai_ledger WHERE created_at>=date_trunc('day',now())").Scan(&spent)
	if e != nil {
		return "", e
	}
	if math.IsNaN(amount) || math.IsInf(amount, 0) || amount < 0 || spent+amount > limit {
		return "", fmt.Errorf("arbeidsrommets dagsbudsjett er nådd")
	}
	var id string
	e = tx.QueryRow(ctx, "INSERT INTO ai_ledger(product_id,operation,reserved) VALUES($1,$2,$3) RETURNING id::text", p, operation, amount).Scan(&id)
	if e != nil {
		return "", e
	}
	return id, tx.Commit(ctx)
}
func (a *App) settleAI(id string, cost float64) {
	if cost >= 0 {
		a.db.Exec(context.Background(), "UPDATE ai_ledger SET actual=$1 WHERE id=$2", cost, id)
	}
}
func jsonBytes(v any) []byte { b, _ := json.Marshal(v); return b }

func (a *App) people(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, `SELECT u.id,u.name FROM users u JOIN products p ON p.id::text=$1 LEFT JOIN product_members m ON m.product_id=p.id AND m.user_id=u.id WHERE u.role='admin' OR NOT p.restricted OR m.user_id IS NOT NULL UNION ALL SELECT id,name||' (agent)' AS name FROM agent_tokens WHERE product_id::text=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY name`, r.PathValue("id"))
}
