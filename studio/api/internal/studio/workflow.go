package studio

import (
	"net/http"
	"strings"
	"time"
)

func (a *App) tasks(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT * FROM tasks WHERE ($1='' OR product_id::text=$1) ORDER BY created_at DESC", r.URL.Query().Get("product"))
}

type taskInput struct {
	Product  string     `json:"product_id"`
	Title    string     `json:"title"`
	Brief    string     `json:"brief"`
	Status   string     `json:"status"`
	Executor string     `json:"executor"`
	Assignee string     `json:"assignee"`
	Due      *time.Time `json:"due_at"`
}

func validTaskState(s string) bool {
	return s == "idea" || s == "ready" || s == "running" || s == "review" || s == "done"
}
func (a *App) createTask(w http.ResponseWriter, r *http.Request) {
	var v taskInput
	if !decode(w, r, &v) {
		return
	}
	if v.Status == "" {
		v.Status = "idea"
	}
	if v.Executor == "" {
		v.Executor = "external"
	}
	if strings.TrimSpace(v.Title) == "" || len(v.Title) > 300 || !validTaskState(v.Status) || validateProduct(r.Context(), a, v.Product) != nil {
		fail(w, 400, "Oppgi tittel og produkt")
		return
	}
	var id string
	e := a.db.QueryRow(r.Context(), "INSERT INTO tasks(product_id,title,brief,status,executor,assignee,due_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text", v.Product, v.Title, v.Brief, v.Status, v.Executor, v.Assignee, v.Due).Scan(&id)
	if e != nil {
		fail(w, 400, "Kunne ikke opprette oppgaven")
		return
	}
	a.audit(r.Context(), actor(r).Name, "task.created", id)
	write(w, 201, map[string]string{"id": id})
}
func (a *App) updateTask(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &v) {
		return
	}
	if !validTaskState(v.Status) {
		fail(w, 400, "Ugyldig status")
		return
	}
	tag, e := a.db.Exec(r.Context(), "UPDATE tasks SET status=$1,claimed_by=NULL,lease_id=NULL,lease_until=NULL,updated_at=now() WHERE id::text=$2", v.Status, r.PathValue("id"))
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 404, "Oppgaven finnes ikke")
		return
	}
	a.audit(r.Context(), actor(r).Name, "task."+v.Status, r.PathValue("id"))
	write(w, 200, map[string]bool{"ok": true})
}
func (a *App) publications(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, `SELECT p.*,i.title AS item_title,i.status AS item_status,i.current_version_id,v.mime,v.file_name,
 (p.version_id IS NOT NULL AND p.version_id=i.current_version_id AND i.status='approved') AS content_ready
 FROM publications p LEFT JOIN items i ON i.id=p.item_id LEFT JOIN versions v ON v.id=p.version_id
 WHERE ($1='' OR p.product_id::text=$1) ORDER BY scheduled_at`, r.URL.Query().Get("product"))
}

type publicationInput struct {
	Product   string    `json:"product_id"`
	Title     string    `json:"title"`
	Channel   string    `json:"channel"`
	Scheduled time.Time `json:"scheduled_at"`
	Caption   string    `json:"caption"`
	Item      *string   `json:"item_id"`
	Task      *string   `json:"task_id"`
	Assignee  string    `json:"assignee"`
}

func (a *App) createPublication(w http.ResponseWriter, r *http.Request) {
	var v publicationInput
	if !decode(w, r, &v) {
		return
	}
	if v.Title == "" || len(v.Title) > 300 || v.Channel == "" || v.Scheduled.IsZero() || validateProduct(r.Context(), a, v.Product) != nil {
		fail(w, 400, "Oppgi tittel, produkt, kanal og tidspunkt")
		return
	}
	var version *string
	if v.Item != nil {
		var vid string
		e := a.db.QueryRow(r.Context(), "SELECT current_version_id::text FROM items WHERE id::text=$1 AND product_id::text=$2", *v.Item, v.Product).Scan(&vid)
		if e != nil {
			fail(w, 400, "Velg innhold fra samme produkt")
			return
		}
		version = &vid
	}
	if v.Task != nil {
		var exists bool
		a.db.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM tasks WHERE id::text=$1 AND product_id::text=$2)", *v.Task, v.Product).Scan(&exists)
		if !exists {
			fail(w, 400, "Velg oppgave fra samme produkt")
			return
		}
	}
	var id string
	e := a.db.QueryRow(r.Context(), "INSERT INTO publications(product_id,title,channel,scheduled_at,caption,item_id,version_id,task_id,assignee) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text", v.Product, v.Title, v.Channel, v.Scheduled, v.Caption, v.Item, version, v.Task, v.Assignee).Scan(&id)
	if e != nil {
		fail(w, 400, "Kunne ikke planlegge publiseringen")
		return
	}
	write(w, 201, map[string]string{"id": id})
}
func (a *App) updatePublication(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Status    string     `json:"status"`
		URL       string     `json:"url"`
		Scheduled *time.Time `json:"scheduled_at"`
		Item      *string    `json:"item_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	if v.Status != "" && v.Status != "planned" && v.Status != "ready" && v.Status != "published" {
		fail(w, 400, "Ugyldig status")
		return
	}
	tx, e := a.db.Begin(r.Context())
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(r.Context())
	var product string
	e = tx.QueryRow(r.Context(), "SELECT product_id::text FROM publications WHERE id::text=$1 FOR UPDATE", r.PathValue("id")).Scan(&product)
	if e != nil {
		fail(w, 404, "Publiseringen finnes ikke")
		return
	}
	if v.Item != nil {
		var vid string
		e = tx.QueryRow(r.Context(), "SELECT current_version_id::text FROM items WHERE id::text=$1 AND product_id::text=$2", *v.Item, product).Scan(&vid)
		if e != nil {
			fail(w, 400, "Innholdet finnes ikke i produktet")
			return
		}
		_, e = tx.Exec(r.Context(), "UPDATE publications SET item_id=$1,version_id=$2,status='planned' WHERE id::text=$3", *v.Item, vid, r.PathValue("id"))
		if e != nil {
			fail(w, 500, "Kunne ikke koble innhold")
			return
		}
	}
	if v.Status == "ready" || v.Status == "published" {
		var ready bool
		e = tx.QueryRow(r.Context(), "SELECT EXISTS(SELECT 1 FROM publications p JOIN items i ON i.id=p.item_id WHERE p.id::text=$1 AND i.status='approved' AND i.current_version_id=p.version_id)", r.PathValue("id")).Scan(&ready)
		if e != nil || !ready {
			fail(w, 409, "Koble til og godkjenn gjeldende innholdsversjon først")
			return
		}
	}
	if v.Status == "published" && !(strings.HasPrefix(v.URL, "https://") || strings.HasPrefix(v.URL, "http://")) {
		fail(w, 400, "Legg inn lenken til den publiserte posten")
		return
	}
	_, e = tx.Exec(r.Context(), "UPDATE publications SET status=CASE WHEN $1='' THEN status ELSE $1 END,url=CASE WHEN $2='' THEN url ELSE $2 END,scheduled_at=coalesce($3,scheduled_at),published_at=CASE WHEN $1='published' THEN now() ELSE published_at END WHERE id::text=$4", v.Status, v.URL, v.Scheduled, r.PathValue("id"))
	if e != nil || tx.Commit(r.Context()) != nil {
		fail(w, 500, "Kunne ikke oppdatere publiseringen")
		return
	}
	a.audit(r.Context(), actor(r).Name, "publication."+v.Status, r.PathValue("id"))
	write(w, 200, map[string]bool{"ok": true})
}
