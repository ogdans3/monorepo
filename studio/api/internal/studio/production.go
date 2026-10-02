package studio

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type templateField struct {
	Name     string `json:"name"`
	Label    string `json:"label"`
	Required bool   `json:"required"`
	Default  string `json:"default"`
}
type templateInput struct {
	Product      string            `json:"product_id"`
	Name         string            `json:"name"`
	Kind         string            `json:"kind"`
	Fields       []templateField   `json:"fields"`
	Locked       map[string]string `json:"locked"`
	Example      string            `json:"example_version_id"`
	Instructions string            `json:"instructions"`
	Revision     int               `json:"revision"`
}

func (a *App) templates(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT * FROM templates WHERE product_id::text=ANY($1) ORDER BY name", a.productIDs(r.Context(), r.URL.Query().Get("product")))
}
func (a *App) saveTemplate(w http.ResponseWriter, r *http.Request) {
	var v templateInput
	if !decode(w, r, &v) {
		return
	}
	ctx := r.Context()
	if validateProduct(ctx, a, v.Product) != nil || v.Name == "" || len(v.Name) > 200 || (v.Kind != "visual" && v.Kind != "structure" && v.Kind != "prompt") || len(v.Fields) > 30 {
		fail(w, 400, "Ugyldig mal")
		return
	}
	if v.Locked == nil {
		v.Locked = map[string]string{}
	}
	seen := map[string]bool{}
	for _, f := range v.Fields {
		if f.Name == "" || seen[f.Name] {
			fail(w, 400, "Feltnavn må være unike")
			return
		}
		seen[f.Name] = true
		if _, yes := v.Locked[f.Name]; yes {
			fail(w, 400, "Låste felter kan ikke være redigerbare")
			return
		}
	}
	if v.Example != "" {
		var p string
		if a.db.QueryRow(ctx, "SELECT i.product_id::text FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1", v.Example).Scan(&p) != nil || p != v.Product {
			fail(w, 400, "Eksempelet må være fra samme produkt")
			return
		}
	}
	tx, e := a.db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	id := r.PathValue("id")
	if id == "" {
		e = tx.QueryRow(ctx, "INSERT INTO templates(product_id,name,kind,fields,locked,example_version_id,instructions) VALUES($1,$2,$3,$4,$5,nullif($6,'')::uuid,$7) RETURNING id::text", v.Product, v.Name, v.Kind, jsonBytes(v.Fields), jsonBytes(v.Locked), v.Example, v.Instructions).Scan(&id)
	} else {
		var updated string
		e = tx.QueryRow(ctx, "UPDATE templates SET name=$1,kind=$2,fields=$3,locked=$4,example_version_id=nullif($5,'')::uuid,instructions=$6,revision=revision+1 WHERE id::text=$7 AND revision=$8 AND product_id::text=$9 RETURNING id::text", v.Name, v.Kind, jsonBytes(v.Fields), jsonBytes(v.Locked), v.Example, v.Instructions, id, v.Revision, v.Product).Scan(&updated)
	}
	if e == nil {
		_, e = tx.Exec(ctx, "INSERT INTO template_versions(template_id,revision,snapshot) SELECT id,revision,to_jsonb(t) FROM templates t WHERE id::text=$1", id)
	}
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 409, "Malen er endret. Last den inn på nytt.")
		return
	}
	write(w, 201, map[string]string{"id": id})
}

type productionInput struct {
	Product      string            `json:"product_id"`
	Title        string            `json:"title"`
	Brief        string            `json:"brief"`
	Kind         string            `json:"kind"`
	Template     string            `json:"template_id"`
	Campaign     string            `json:"campaign_id"`
	Sources      []string          `json:"source_versions"`
	Fields       map[string]string `json:"fields"`
	Formats      []string          `json:"formats"`
	Requirements []string          `json:"requirements"`
	Profile      string            `json:"profile"`
}

func (a *App) productionTask(ctx context.Context, u Actor, v productionInput) (string, error) {
	if validateProduct(ctx, a, v.Product) != nil || strings.TrimSpace(v.Title) == "" || len(v.Title) > 300 || len(v.Sources) > 30 || len(v.Brief) > 16000 {
		return "", fmt.Errorf("oppgi produkt, tittel og en avgrenset brief")
	}
	if v.Kind != "video" && v.Kind != "design" && v.Kind != "script" {
		return "", fmt.Errorf("velg video, design eller manus")
	}
	if len(v.Formats) == 0 {
		v.Formats = []string{"9:16"}
	}
	if len(v.Formats) > 4 {
		return "", fmt.Errorf("maks fire formater")
	}
	for _, f := range v.Formats {
		if f != "9:16" && f != "1:1" && f != "4:5" && f != "16:9" {
			return "", fmt.Errorf("ukjent format")
		}
	}
	if v.Campaign != "" {
		var p string
		if a.db.QueryRow(ctx, "SELECT product_id::text FROM campaigns WHERE id::text=$1", v.Campaign).Scan(&p) != nil || p != v.Product {
			return "", fmt.Errorf("kampanjen må tilhøre produktet")
		}
	}
	pack, e := a.contextPack(ctx, v.Product)
	if e != nil {
		return "", e
	}
	spec := map[string]any{"kind": v.Kind, "formats": v.Formats, "requirements": v.Requirements, "product_context": pack, "fields": v.Fields, "profile": v.Profile, "requires_review": true}
	if v.Template != "" {
		rows, e := a.query(ctx, "SELECT * FROM templates WHERE id::text=$1 AND product_id::text=$2", v.Template, v.Product)
		if e != nil || len(rows) == 0 {
			return "", fmt.Errorf("ukjent mal")
		}
		t := rows[0]
		var fields []templateField
		json.Unmarshal(jsonBytes(t["fields"]), &fields)
		var locked map[string]string
		json.Unmarshal(jsonBytes(t["locked"]), &locked)
		values := map[string]string{}
		for k, val := range locked {
			values[k] = val
		}
		for _, f := range fields {
			val := v.Fields[f.Name]
			if val == "" {
				val = f.Default
			}
			if f.Required && val == "" {
				return "", fmt.Errorf("fyll inn %s", f.Label)
			}
			values[f.Name] = val
		}
		for k := range v.Fields {
			if _, isLocked := locked[k]; isLocked {
				return "", fmt.Errorf("feltet %s er låst", k)
			}
			if _, ok := values[k]; !ok {
				return "", fmt.Errorf("ukjent malfelt %s", k)
			}
		}
		spec["template"] = t
		spec["fields"] = values
	}
	cfg, e := a.profile(ctx, v.Product, v.Profile)
	if e == nil {
		spec["model_profile"] = cfg
	}
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return "", e
	}
	defer tx.Rollback(ctx)
	for _, id := range v.Sources {
		var p string
		if tx.QueryRow(ctx, "SELECT i.product_id::text FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND i.deleted_at IS NULL", id).Scan(&p) != nil || p != v.Product {
			return "", fmt.Errorf("kildene må tilhøre samme produkt")
		}
	}
	var id string
	e = tx.QueryRow(ctx, "INSERT INTO tasks(product_id,title,brief,status,executor,specification,campaign_id) VALUES($1,$2,$3,'ready','external',$4,nullif($5,'')::uuid) RETURNING id::text", v.Product, v.Title, v.Brief, jsonBytes(spec), v.Campaign).Scan(&id)
	if e != nil {
		return "", e
	}
	for _, version := range v.Sources {
		if _, e = tx.Exec(ctx, "INSERT INTO task_sources(task_id,version_id) VALUES($1,$2) ON CONFLICT DO NOTHING", id, version); e != nil {
			return "", e
		}
	}
	if e = tx.Commit(ctx); e != nil {
		return "", e
	}
	a.audit(ctx, u.Name, "production.created", id)
	return id, nil
}
func (a *App) createProduction(w http.ResponseWriter, r *http.Request) {
	var v productionInput
	if !decode(w, r, &v) {
		return
	}
	id, e := a.productionTask(r.Context(), actor(r), v)
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	write(w, 201, map[string]string{"id": id})
}
func (a *App) variants(w http.ResponseWriter, r *http.Request) {
	var v struct {
		productionInput
		Hooks  []string `json:"hooks"`
		Bodies []string `json:"bodies"`
		CTAs   []string `json:"ctas"`
	}
	if !decode(w, r, &v) {
		return
	}
	n := len(v.Hooks) * len(v.Bodies) * len(v.CTAs)
	if n < 1 || n > 50 {
		fail(w, 400, "Velg kombinasjoner som gir 1–50 varianter")
		return
	}
	// Validate every referenced version before creating any task.
	for _, group := range [][]string{v.Hooks, v.Bodies, v.CTAs} {
		for _, id := range group {
			var p string
			if a.db.QueryRow(r.Context(), "SELECT i.product_id::text FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND i.deleted_at IS NULL", id).Scan(&p) != nil || p != v.Product {
				fail(w, 400, "Velg byggeklosser fra samme produkt")
				return
			}
		}
	}
	ids := []string{}
	for hi, h := range v.Hooks {
		for bi, b := range v.Bodies {
			for ci, c := range v.CTAs {
				in := v.productionInput
				in.Title = fmt.Sprintf("%s · H%02d-B%02d-C%02d", v.Title, hi+1, bi+1, ci+1)
				in.Sources = []string{h, b, c}
				id, e := a.productionTask(r.Context(), actor(r), in)
				if e != nil {
					write(w, 400, map[string]any{"error": e.Error(), "created_ids": ids})
					return
				}
				a.db.Exec(r.Context(), "UPDATE task_sources SET role=CASE version_id::text WHEN $2 THEN 'hook' WHEN $3 THEN 'body' ELSE 'cta' END WHERE task_id=$1", id, h, b)
				ids = append(ids, id)
			}
		}
	}
	write(w, 201, map[string]any{"ids": ids, "count": len(ids)})
}
func (a *App) taskDetail(w http.ResponseWriter, r *http.Request) {
	v, e := a.taskData(r.Context(), r.PathValue("id"), "")
	if e != nil {
		fail(w, 404, e.Error())
		return
	}
	write(w, 200, v)
}
func (a *App) taskData(ctx context.Context, id, p string) (map[string]any, error) {
	rows, e := a.query(ctx, "SELECT * FROM tasks WHERE id::text=$1 AND ($2='' OR product_id::text=$2)", id, p)
	if e != nil || len(rows) == 0 {
		return nil, fmt.Errorf("oppgaven finnes ikke")
	}
	sources, _ := a.query(ctx, "SELECT s.*,v.title,v.body,v.file_name,v.mime FROM task_sources s JOIN versions v ON v.id=s.version_id WHERE task_id::text=$1", id)
	feedback, _ := a.query(ctx, "SELECT * FROM task_feedback WHERE task_id::text=$1 ORDER BY created_at", id)
	deliveries, _ := a.query(ctx, "SELECT * FROM task_deliveries WHERE task_id::text=$1 ORDER BY created_at DESC", id)
	return map[string]any{"task": rows[0], "sources": sources, "feedback": feedback, "deliveries": deliveries}, nil
}
func (a *App) reviseTask(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Body string `json:"body"`
	}
	if !decode(w, r, &v) {
		return
	}
	if strings.TrimSpace(v.Body) == "" {
		fail(w, 400, "Beskriv endringen")
		return
	}
	ctx := r.Context()
	tx, e := a.db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	var revision int
	e = tx.QueryRow(ctx, "UPDATE tasks SET revision=revision+1,status='ready',claimed_by=NULL,lease_id=NULL,lease_until=NULL,progress='{}',updated_at=now() WHERE id::text=$1 AND status IN('review','done') RETURNING revision", r.PathValue("id")).Scan(&revision)
	if e != nil {
		fail(w, 409, "Oppgaven må være levert først")
		return
	}
	_, e = tx.Exec(ctx, "INSERT INTO task_feedback(task_id,revision,body,author) VALUES($1,$2,$3,$4)", r.PathValue("id"), revision, v.Body, actor(r).Name)
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 500, "Kunne ikke lagre revisjonen")
		return
	}
	ok(w)
}

type deliveryInput struct {
	Task        string            `json:"task_id"`
	Lease       string            `json:"lease_id"`
	Version     string            `json:"version_id"`
	Files       []string          `json:"files"`
	SourceFiles []string          `json:"source_files"`
	Formats     map[string]string `json:"formats"`
	Checklist   map[string]bool   `json:"checklist"`
	Notes       string            `json:"notes"`
}

func (a *App) deliver(ctx context.Context, u Actor, v deliveryInput) error {
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var revision int
	var spec []byte
	e = tx.QueryRow(ctx, "SELECT revision,specification FROM tasks WHERE id::text=$1 AND product_id=$2 AND claimed_by=$3 AND lease_id::text=$4 AND lease_until>now() AND status='running' FOR UPDATE", v.Task, u.Product, u.ID, v.Lease).Scan(&revision, &spec)
	if e != nil {
		return fmt.Errorf("reservasjonen er utløpt eller tilhører en annen agent")
	}
	all := append([]string{v.Version}, v.Files...)
	all = append(all, v.SourceFiles...)
	for _, id := range v.Formats {
		all = append(all, id)
	}
	if len(all) > 60 {
		return fmt.Errorf("maks 60 leveransefiler")
	}
	var item string
	for _, id := range all {
		var p, i string
		e = tx.QueryRow(ctx, "SELECT i.product_id::text,i.id::text FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1 AND i.deleted_at IS NULL", id).Scan(&p, &i)
		if e != nil || p != u.Product {
			return fmt.Errorf("alle leveranseversjoner må tilhøre produktet")
		}
		if id == v.Version {
			item = i
		}
	}
	var s struct {
		Kind         string   `json:"kind"`
		Formats      []string `json:"formats"`
		Requirements []string `json:"requirements"`
	}
	json.Unmarshal(spec, &s)
	if s.Kind != "" {
		for _, req := range s.Requirements {
			if req == "Kildefiler" && len(v.SourceFiles) == 0 {
				return fmt.Errorf("lever kildefiler i manifestet")
			}
		}
		for _, f := range s.Formats {
			if v.Formats[f] == "" {
				return fmt.Errorf("mangler format %s", f)
			}
		}
		for _, req := range s.Requirements {
			if !v.Checklist[req] {
				return fmt.Errorf("leveransekravet %s er ikke bekreftet", req)
			}
		}
	}
	_, e = tx.Exec(ctx, "INSERT INTO task_deliveries(task_id,revision,version_id,manifest,author) VALUES($1,$2,$3,$4,$5)", v.Task, revision, v.Version, jsonBytes(v), u.Name)
	if e == nil {
		_, e = tx.Exec(ctx, "UPDATE tasks SET status='review',item_id=$1,delivery_version_id=$2,lease_until=NULL,progress=jsonb_build_object('stage','Levert til gjennomgang'),updated_at=now() WHERE id=$3", item, v.Version, v.Task)
	}
	if e != nil {
		return e
	}
	if e = tx.Commit(ctx); e != nil {
		return e
	}
	a.notify(ctx, u.Product, "", "delivery", "Ny leveranse fra "+u.Name, v.Task, "")
	return nil
}

func (a *App) draftRevision(ctx context.Context, u Actor, product, id, brief string) (map[string]any, error) {
	if strings.TrimSpace(brief) == "" || len(brief) > 20000 {
		return nil, fmt.Errorf("beskriv en avgrenset revisjon")
	}
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	var revision int
	e = tx.QueryRow(ctx, "UPDATE tasks SET revision=revision+1,status='idea',brief=$1,claimed_by=NULL,lease_id=NULL,lease_until=NULL,updated_at=now() WHERE id::text=$2 AND product_id::text=$3 AND status IN('idea','review','done') RETURNING revision", brief, id, product).Scan(&revision)
	if e != nil {
		return nil, fmt.Errorf("velg en idé eller levert oppgave; aktivt arbeid kan ikke endres i chat")
	}
	_, e = tx.Exec(ctx, "INSERT INTO task_feedback(task_id,revision,body,author) VALUES($1,$2,$3,$4)", id, revision, brief, u.Name)
	if e != nil {
		return nil, e
	}
	if e = tx.Commit(ctx); e != nil {
		return nil, e
	}
	return map[string]any{"task_id": id, "revision": revision, "status": "idea", "requires_human_activation": true}, nil
}
