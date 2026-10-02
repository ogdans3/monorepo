package studio

import (
	"context"
	"encoding/csv"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func (a *App) campaigns(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT * FROM campaigns WHERE product_id::text=ANY($1) ORDER BY created_at DESC", a.productIDs(r.Context(), r.URL.Query().Get("product")))
}
func (a *App) saveCampaign(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Product  string   `json:"product_id"`
		Name     string   `json:"name"`
		Goal     string   `json:"goal"`
		Starts   *string  `json:"starts_at"`
		Ends     *string  `json:"ends_at"`
		Budget   float64  `json:"budget"`
		Channels []string `json:"channels"`
		Status   string   `json:"status"`
	}
	if !decode(w, r, &v) {
		return
	}
	if validateProduct(r.Context(), a, v.Product) != nil || v.Name == "" || v.Budget < 0 {
		fail(w, 400, "Oppgi navn, produkt og et gyldig budsjett")
		return
	}
	if v.Status == "" {
		v.Status = "planned"
	}
	if v.Channels == nil {
		v.Channels = []string{}
	}
	id := r.PathValue("id")
	var e error
	if id == "" {
		e = a.db.QueryRow(r.Context(), "INSERT INTO campaigns(product_id,name,goal,starts_at,ends_at,budget,channels,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text", v.Product, v.Name, v.Goal, v.Starts, v.Ends, v.Budget, v.Channels, v.Status).Scan(&id)
	} else {
		_, e = a.db.Exec(r.Context(), "UPDATE campaigns SET name=$1,goal=$2,starts_at=$3,ends_at=$4,budget=$5,channels=$6,status=$7 WHERE id::text=$8 AND product_id::text=$9", v.Name, v.Goal, v.Starts, v.Ends, v.Budget, v.Channels, v.Status, id, v.Product)
	}
	if e != nil {
		fail(w, 400, "Kunne ikke lagre kampanjen")
		return
	}
	write(w, 201, map[string]string{"id": id})
}
func (a *App) experiments(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT * FROM experiments WHERE product_id::text=ANY($1) ORDER BY created_at DESC", a.productIDs(r.Context(), r.URL.Query().Get("product")))
}
func (a *App) saveExperiment(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Product    string   `json:"product_id"`
		Campaign   string   `json:"campaign_id"`
		Name       string   `json:"name"`
		Hypothesis string   `json:"hypothesis"`
		Metric     string   `json:"metric"`
		Variants   []string `json:"variants"`
		Conclusion string   `json:"conclusion"`
	}
	if !decode(w, r, &v) {
		return
	}
	ctx := r.Context()
	if validateProduct(ctx, a, v.Product) != nil || v.Name == "" || v.Hypothesis == "" || len(v.Variants) > 30 {
		fail(w, 400, "Oppgi navn, produkt og hypotese")
		return
	}
	if v.Variants == nil {
		v.Variants = []string{}
	}
	for _, id := range v.Variants {
		var p string
		if a.db.QueryRow(ctx, "SELECT product_id::text FROM items WHERE id::text=$1", id).Scan(&p) != nil || p != v.Product {
			fail(w, 400, "Variantene må være fra samme produkt")
			return
		}
	}
	if v.Campaign != "" {
		var p string
		if a.db.QueryRow(ctx, "SELECT product_id::text FROM campaigns WHERE id::text=$1", v.Campaign).Scan(&p) != nil || p != v.Product {
			fail(w, 400, "Ukjent kampanje")
			return
		}
	}
	id := r.PathValue("id")
	var e error
	if id == "" {
		e = a.db.QueryRow(ctx, "INSERT INTO experiments(product_id,campaign_id,name,hypothesis,metric,variants,conclusion) VALUES($1,nullif($2,'')::uuid,$3,$4,$5,$6::text[]::uuid[],$7) RETURNING id::text", v.Product, v.Campaign, v.Name, v.Hypothesis, v.Metric, v.Variants, v.Conclusion).Scan(&id)
	} else {
		_, e = a.db.Exec(ctx, "UPDATE experiments SET name=$1,hypothesis=$2,metric=$3,variants=$4::text[]::uuid[],conclusion=$5 WHERE id::text=$6 AND product_id::text=$7", v.Name, v.Hypothesis, v.Metric, v.Variants, v.Conclusion, id, v.Product)
	}
	if e != nil {
		fail(w, 400, "Kunne ikke lagre eksperimentet")
		return
	}
	if v.Conclusion != "" {
		var existing *string
		a.db.QueryRow(ctx, "SELECT knowledge_id::text FROM experiments WHERE id=$1", id).Scan(&existing)
		if existing == nil {
			out, err := a.insertItem(ctx, actor(r), itemInput{Product: v.Product, Title: "Læring: " + v.Name, Kind: "knowledge", Body: "Hypotese: " + v.Hypothesis + "\n\nKonklusjon: " + v.Conclusion, Rights: "owned"}, "", "", "")
			if err != nil {
				fail(w, 500, "Eksperiment lagret, men kunne ikke lagre læring")
				return
			}
			a.db.Exec(ctx, "UPDATE experiments SET knowledge_id=$1 WHERE id=$2", out["id"], id)
		}
	}
	write(w, 201, map[string]string{"id": id})
}

type measurementInput struct {
	Publication string    `json:"publication_id"`
	At          time.Time `json:"measured_at"`
	Mode        string    `json:"mode"`
	Views       int64     `json:"views"`
	Clicks      int64     `json:"clicks"`
	Likes       int64     `json:"likes"`
	Spend       float64   `json:"spend"`
	Currency    string    `json:"currency"`
	Source      string    `json:"source"`
}

func (a *App) storeMeasurement(ctx context.Context, v measurementInput) error {
	var p string
	if a.db.QueryRow(ctx, "SELECT product_id::text FROM publications WHERE id::text=$1", v.Publication).Scan(&p) != nil || !a.productAccess(ctx, p, true) {
		return fmt.Errorf("ingen tilgang til publiseringen")
	}
	if v.At.IsZero() || v.Views < 0 || v.Clicks < 0 || v.Likes < 0 || v.Spend < 0 || (v.Mode != "paid" && v.Mode != "organic") {
		return fmt.Errorf("ugyldige måletall")
	}
	if v.Currency == "" {
		v.Currency = "NOK"
	}
	if len(v.Currency) != 3 {
		return fmt.Errorf("bruk en valuta med tre bokstaver")
	}
	if v.Source == "" {
		v.Source = "manual"
	}
	_, e := a.db.Exec(ctx, "INSERT INTO measurements(publication_id,measured_at,mode,views,clicks,likes,spend,currency,source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(publication_id,measured_at,mode) DO UPDATE SET views=excluded.views,clicks=excluded.clicks,likes=excluded.likes,spend=excluded.spend,currency=excluded.currency,source=excluded.source", v.Publication, v.At, v.Mode, v.Views, v.Clicks, v.Likes, v.Spend, v.Currency, v.Source)
	return e
}
func (a *App) measurement(w http.ResponseWriter, r *http.Request) {
	var v measurementInput
	if !decode(w, r, &v) {
		return
	}
	if e := a.storeMeasurement(r.Context(), v); e != nil {
		fail(w, 400, e.Error())
		return
	}
	ok(w)
}
func (a *App) importMeasurements(w http.ResponseWriter, r *http.Request) {
	var v struct {
		CSV string `json:"csv"`
	}
	if !decode(w, r, &v) {
		return
	}
	rows, e := csv.NewReader(strings.NewReader(v.CSV)).ReadAll()
	if e != nil || len(rows) < 2 || len(rows) > 501 {
		fail(w, 400, "CSV må inneholde 1–500 rader")
		return
	}
	headers := map[string]int{}
	for i, h := range rows[0] {
		headers[h] = i
	}
	get := func(row []string, k string) string {
		if i, ok := headers[k]; ok && i < len(row) {
			return row[i]
		}
		return ""
	}
	count := 0
	for _, row := range rows[1:] {
		at, e := time.Parse(time.RFC3339, get(row, "measured_at"))
		if e != nil {
			fail(w, 400, fmt.Sprintf("Ugyldig tidspunkt i rad %d; %d rader importert", count+2, count))
			return
		}
		views, e1 := strconv.ParseInt(get(row, "views"), 10, 64)
		clicks, e2 := strconv.ParseInt(get(row, "clicks"), 10, 64)
		likes, e3 := strconv.ParseInt(get(row, "likes"), 10, 64)
		spend, e4 := strconv.ParseFloat(get(row, "spend"), 64)
		if e1 != nil || e2 != nil || e3 != nil || e4 != nil {
			fail(w, 400, fmt.Sprintf("Ugyldig tall i rad %d; %d rader importert", count+2, count))
			return
		}
		in := measurementInput{Publication: get(row, "publication_id"), At: at, Mode: get(row, "mode"), Views: views, Clicks: clicks, Likes: likes, Spend: spend, Currency: get(row, "currency"), Source: "csv"}
		if e = a.storeMeasurement(r.Context(), in); e != nil {
			fail(w, 400, e.Error())
			return
		}
		count++
	}
	write(w, 201, map[string]int{"count": count})
}
func (a *App) insights(w http.ResponseWriter, r *http.Request) {
	v, e := a.insightsData(r.Context(), a.productIDs(r.Context(), r.URL.Query().Get("product")), r.URL.Query().Get("currency"))
	if e != nil {
		fail(w, 500, "Kunne ikke hente tall")
		return
	}
	write(w, 200, v)
}
func (a *App) insightsData(ctx context.Context, ids []string, currency string) (map[string]any, error) {
	if currency == "" {
		currency = "NOK"
	}
	rows, e := a.query(ctx, `WITH latest AS(SELECT DISTINCT ON(m.publication_id,m.mode) m.*,greatest(0,extract(epoch FROM m.measured_at-coalesce(p.published_at,p.scheduled_at))/3600)::int AS age_hours FROM measurements m JOIN publications p ON p.id=m.publication_id WHERE p.product_id::text=ANY($1) AND m.currency=$2 ORDER BY m.publication_id,m.mode,m.measured_at DESC), cohort AS(SELECT p.channel,m.mode,m.age_hours/24 AS age_days,percentile_cont(.5) WITHIN GROUP(ORDER BY m.views) AS baseline FROM latest m JOIN publications p ON p.id=m.publication_id GROUP BY p.channel,m.mode,m.age_hours/24)
 SELECT p.id,p.title,p.channel,p.item_id,p.campaign_id,m.measured_at,m.mode,m.views,m.clicks,m.likes,m.spend::float8,m.age_hours,c.baseline,CASE WHEN c.baseline>0 THEN m.views/c.baseline ELSE NULL END AS relative_views,CASE WHEN m.views>0 THEN 100.0*m.clicks/m.views ELSE NULL END AS ctr
 FROM latest m JOIN publications p ON p.id=m.publication_id JOIN cohort c ON c.channel=p.channel AND c.mode=m.mode AND c.age_days=m.age_hours/24 ORDER BY m.measured_at DESC`, ids, currency)
	if e != nil {
		return nil, e
	}
	conv, e := a.query(ctx, `SELECT c.publication_id,c.campaign_id,count(*) FILTER(WHERE kind='signup') AS signups,count(*) FILTER(WHERE kind='purchase') AS purchases,count(*) FILTER(WHERE kind='refund') AS refunds,sum(CASE WHEN kind='refund' THEN -amount WHEN kind='purchase' THEN amount ELSE 0 END)::float8 AS revenue FROM conversions c WHERE c.product_id::text=ANY($1) AND currency=$2 GROUP BY c.publication_id,c.campaign_id`, ids, currency)
	history, _ := a.query(ctx, "SELECT m.*,p.title FROM measurements m JOIN publications p ON p.id=m.publication_id WHERE p.product_id::text=ANY($1) AND m.currency=$2 ORDER BY measured_at DESC LIMIT 300", ids, currency)
	return map[string]any{"results": rows, "conversions": conv, "history": history, "currency": currency, "comparison": "Samme kanal, organisk/betalt og alder i hele døgn. Visninger er kumulative øyeblikksbilder."}, e
}
func (a *App) createConversionKey(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Product string `json:"product_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	if validateProduct(r.Context(), a, v.Product) != nil {
		fail(w, 400, "Velg produkt")
		return
	}
	t := token()
	var id string
	e := a.db.QueryRow(r.Context(), "INSERT INTO conversion_keys(product_id,token_hash) VALUES($1,$2) RETURNING id::text", v.Product, hash(t)).Scan(&id)
	if e != nil {
		fail(w, 500, "Kunne ikke lage nøkkel")
		return
	}
	write(w, 201, map[string]string{"id": id, "token": t})
}
func (a *App) revokeConversionKey(w http.ResponseWriter, r *http.Request) {
	a.db.Exec(r.Context(), "UPDATE conversion_keys SET revoked_at=now() WHERE id::text=$1", r.PathValue("id"))
	ok(w)
}
func (a *App) conversion(w http.ResponseWriter, r *http.Request) {
	var product string
	key := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if a.db.QueryRow(r.Context(), "SELECT product_id::text FROM conversion_keys WHERE token_hash=$1 AND revoked_at IS NULL", hash(key)).Scan(&product) != nil {
		fail(w, 401, "Ugyldig konverteringsnøkkel")
		return
	}
	var v struct {
		Event       string    `json:"event_id"`
		Order       string    `json:"order_id"`
		Publication string    `json:"publication_id"`
		Campaign    string    `json:"campaign_id"`
		Kind        string    `json:"kind"`
		Amount      float64   `json:"amount"`
		Currency    string    `json:"currency"`
		At          time.Time `json:"occurred_at"`
	}
	if !decode(w, r, &v) {
		return
	}
	if v.Event == "" || len(v.Event) > 150 || v.At.IsZero() || v.Amount < 0 || (v.Kind != "signup" && v.Kind != "purchase" && v.Kind != "refund") || (v.Kind != "signup" && v.Order == "") || len(v.Currency) != 3 {
		fail(w, 400, "Ugyldig hendelse")
		return
	}
	ctx := r.Context()
	tx, e := a.db.Begin(ctx)
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(ctx)
	tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", product)
	digest := hash(string(jsonBytes(v)))
	var prior string
	e = tx.QueryRow(ctx, "SELECT payload_hash FROM conversions WHERE product_id=$1 AND event_id=$2", product, v.Event).Scan(&prior)
	if e == nil {
		if prior != digest {
			fail(w, 409, "Hendelses-ID er brukt med annet innhold")
			return
		}
		write(w, 200, map[string]bool{"duplicate": true})
		return
	}
	for table, id := range map[string]string{"publications": v.Publication, "campaigns": v.Campaign} {
		if id != "" {
			var p string
			if tx.QueryRow(ctx, "SELECT product_id::text FROM "+table+" WHERE id::text=$1", id).Scan(&p) != nil || p != product {
				fail(w, 400, "Hendelsen peker utenfor produktet")
				return
			}
		}
	}
	if v.Kind == "refund" {
		var balance float64
		tx.QueryRow(ctx, "SELECT coalesce(sum(CASE WHEN kind='purchase' THEN amount WHEN kind='refund' THEN -amount ELSE 0 END),0)::float8 FROM conversions WHERE product_id=$1 AND order_id=$2 AND currency=$3", product, v.Order, v.Currency).Scan(&balance)
		if v.Amount > balance {
			fail(w, 409, "Refusjonen overstiger registrert kjøp")
			return
		}
	}
	_, e = tx.Exec(ctx, "INSERT INTO conversions(product_id,event_id,order_id,publication_id,campaign_id,kind,amount,currency,occurred_at,payload_hash) VALUES($1,$2,$3,nullif($4,'')::uuid,nullif($5,'')::uuid,$6,$7,$8,$9,$10)", product, v.Event, v.Order, v.Publication, v.Campaign, v.Kind, v.Amount, v.Currency, v.At, digest)
	if e != nil || tx.Commit(ctx) != nil {
		fail(w, 409, "Kunne ikke lagre hendelsen")
		return
	}
	write(w, 201, map[string]bool{"ok": true})
}
func trackingURL(base, channel, campaign, content string) (string, error) {
	u, e := url.Parse(base)
	if e != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") {
		return "", fmt.Errorf("oppgi en gyldig landingsside")
	}
	q := u.Query()
	q.Set("utm_source", strings.ToLower(channel))
	q.Set("utm_medium", "social")
	q.Set("utm_campaign", campaign)
	q.Set("utm_content", content)
	u.RawQuery = q.Encode()
	return u.String(), nil
}
func (a *App) claims(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT * FROM claims WHERE product_id::text=ANY($1) ORDER BY created_at DESC", a.productIDs(r.Context(), r.URL.Query().Get("product")))
}
func (a *App) saveClaim(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Product     string   `json:"product_id"`
		Scope       string   `json:"scope"`
		Statement   string   `json:"statement"`
		Sources     []string `json:"sources"`
		Confidence  string   `json:"confidence"`
		Kind        string   `json:"kind"`
		Contradicts string   `json:"contradicts"`
		Resolved    bool     `json:"resolved"`
	}
	if !decode(w, r, &v) {
		return
	}
	ctx := r.Context()
	if validateProduct(ctx, a, v.Product) != nil || strings.TrimSpace(v.Statement) == "" || len(v.Statement) > 8000 {
		fail(w, 400, "Oppgi produkt og påstand")
		return
	}
	if v.Scope == "" {
		v.Scope = "product"
	}
	if v.Kind == "" {
		v.Kind = "claim"
	}
	if v.Confidence == "" {
		v.Confidence = "low"
	}
	if v.Sources == nil {
		v.Sources = []string{}
	}
	if v.Contradicts != "" {
		var p string
		if a.db.QueryRow(ctx, "SELECT product_id::text FROM claims WHERE id::text=$1", v.Contradicts).Scan(&p) != nil || p != v.Product {
			fail(w, 400, "Ugyldig motstridende påstand")
			return
		}
	}
	var id string
	var e error
	if r.PathValue("id") == "" {
		e = a.db.QueryRow(ctx, "INSERT INTO claims(product_id,scope,statement,sources,confidence,kind,contradicts,created_by) VALUES($1,$2,$3,$4,$5,$6,nullif($7,'')::uuid,$8) RETURNING id::text", v.Product, v.Scope, v.Statement, jsonBytes(v.Sources), v.Confidence, v.Kind, v.Contradicts, actor(r).Name).Scan(&id)
	} else {
		id = r.PathValue("id")
		_, e = a.db.Exec(ctx, "UPDATE claims SET resolved_at=CASE WHEN $1 THEN now() ELSE NULL END WHERE id::text=$2", v.Resolved, id)
	}
	if e != nil {
		fail(w, 400, "Kunne ikke lagre påstanden")
		return
	}
	if v.Contradicts != "" {
		a.notify(ctx, v.Product, "", "contradiction", "To påstander trenger gjennomgang", id, "")
	}
	write(w, 201, map[string]string{"id": id})
}
