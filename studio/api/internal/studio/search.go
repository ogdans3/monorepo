package studio

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const documentSQL = `SELECT 'item:'||i.id::text AS id,i.product_id,NULL::uuid AS user_id,i.id::text AS target_id,i.current_version_id AS version_id,'item'::text AS entity,i.kind,i.title,i.body||' '||array_to_string(i.tags,' ')||' '||i.source_url AS body,NULL::double precision AS start_seconds,i.status FROM items i WHERE i.deleted_at IS NULL
 UNION ALL SELECT 'note:'||n.id::text,i.product_id,NULL::uuid,i.id::text,n.version_id,'note','note',i.title,n.body,n.at_seconds::double precision,i.status FROM notes n JOIN items i ON i.id=n.item_id WHERE i.deleted_at IS NULL
 UNION ALL SELECT 'segment:'||s.id::text,i.product_id,NULL::uuid,i.id::text,s.version_id,'segment',s.kind,i.title,s.body,s.start_seconds,i.status FROM segments s JOIN items i ON i.current_version_id=s.version_id WHERE i.deleted_at IS NULL
 UNION ALL SELECT 'task:'||id::text,product_id,NULL::uuid,id::text,NULL::uuid,'task','task',title,brief,NULL::double precision,status FROM tasks
 UNION ALL SELECT 'publication:'||id::text,product_id,NULL::uuid,id::text,version_id,'publication','publication',title,caption,NULL::double precision,status FROM publications
 UNION ALL SELECT 'message:'||m.id::text,c.product_id,c.created_by,c.id::text,NULL::uuid,'message','message',c.title,m.body,NULL::double precision,'chat' FROM messages m JOIN conversations c ON c.id=m.conversation_id
 UNION ALL SELECT 'product:'||id::text,id,NULL::uuid,id::text,NULL::uuid,'product','knowledge',name,description||' '||brand||' '||audience,NULL::double precision,'active' FROM products
 UNION ALL SELECT 'campaign:'||id::text,product_id,NULL::uuid,id::text,NULL::uuid,'campaign','campaign',name,goal,NULL::double precision,status FROM campaigns
 UNION ALL SELECT 'claim:'||id::text,product_id,NULL::uuid,id::text,NULL::uuid,'claim','knowledge',left(statement,100),statement||' '||sources::text,NULL::double precision,confidence FROM claims`

func (a *App) syncDocuments(ctx context.Context) error {
	_, e := a.db.Exec(ctx, `WITH docs AS (`+documentSQL+`) INSERT INTO search_documents(id,product_id,user_id,target_id,version_id,entity,kind,title,body,start_seconds,status,content_hash)
 SELECT id,product_id,user_id,target_id,version_id,entity,kind,title,body,start_seconds,status,md5(title||body||coalesce(version_id::text,'')) FROM docs
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,status=excluded.status,version_id=excluded.version_id,content_hash=excluded.content_hash,
 embedding=CASE WHEN search_documents.content_hash=excluded.content_hash THEN search_documents.embedding ELSE NULL END
 WHERE search_documents.content_hash<>excluded.content_hash OR search_documents.status<>excluded.status`)
	if e != nil {
		return e
	}
	_, e = a.db.Exec(ctx, `DELETE FROM search_documents WHERE (entity<>'frame' AND id NOT IN(SELECT id FROM (`+documentSQL+`) d)) OR (entity='frame' AND NOT EXISTS(SELECT 1 FROM items WHERE current_version_id=search_documents.version_id AND deleted_at IS NULL))`)
	return e
}
func (a *App) indexFrame(ctx context.Context, version string, n int, at float64, vector []float64) {
	a.db.Exec(ctx, `INSERT INTO search_documents(id,product_id,target_id,version_id,entity,kind,title,body,start_seconds,status,content_hash,visual_embedding)
 SELECT 'frame:'||$1||':'||$2::text,i.product_id,i.id::text,v.id,'frame','image',i.title,'Videoramme', $3,i.status,md5(v.id::text),$4 FROM versions v JOIN items i ON i.id=v.item_id WHERE v.id::text=$1
 ON CONFLICT(id) DO UPDATE SET visual_embedding=excluded.visual_embedding,title=excluded.title,status=excluded.status`, version, strconv.Itoa(n), at, vector)
}
func (a *App) IndexWorker(ctx context.Context) {
	ticker := time.NewTicker(8 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.syncDocuments(ctx)
			a.reminders(ctx)
			if os.Getenv("INTELLIGENCE_URL") == "" {
				continue
			}
			rows, e := a.query(ctx, "SELECT id,title,body,content_hash FROM search_documents WHERE embedding IS NULL AND entity<>'frame' ORDER BY id LIMIT 12")
			if e != nil || len(rows) == 0 {
				continue
			}
			texts := []string{}
			for _, row := range rows {
				s := fmt.Sprint(row["title"]) + " " + fmt.Sprint(row["body"])
				if len(s) > 16000 {
					s = s[:16000]
				}
				texts = append(texts, s)
			}
			var out struct {
				Model   string      `json:"model"`
				Vectors [][]float64 `json:"vectors"`
			}
			c, cancel := context.WithTimeout(ctx, 90*time.Second)
			e = a.localJSON(c, "/embed", map[string]any{"texts": texts}, &out)
			cancel()
			if e != nil || len(out.Vectors) != len(rows) {
				continue
			}
			for i, row := range rows {
				a.db.Exec(ctx, "UPDATE search_documents SET embedding=$1,embedding_model=$2 WHERE id=$3 AND content_hash=$4", out.Vectors[i], out.Model, row["id"], row["content_hash"])
			}
		}
	}
}
func (a *App) reminders(ctx context.Context) {
	rows, _ := a.query(ctx, "SELECT id,product_id,title FROM publications WHERE status<>'published' AND scheduled_at<=now()+reminder_minutes*interval '1 minute' AND scheduled_at>now()-interval '7 days'")
	for _, p := range rows {
		a.notify(ctx, fmt.Sprint(p["product_id"]), "", "publication", "På publiseringsplanen: "+fmt.Sprint(p["title"]), fmt.Sprint(p["id"]), "publication:"+fmt.Sprint(p["id"]))
	}
	// Expired unfinished uploads no longer reserve quota and their temporary files can be removed.
	rows, _ = a.query(ctx, "DELETE FROM upload_sessions WHERE expires_at<now() AND completed_at IS NULL RETURNING file_key")
	for _, row := range rows {
		os.Remove(a.storage + "/" + fmt.Sprint(row["file_key"]))
	}
}

type searchFilter struct {
	Kind, Status, Rights, Author, Campaign, Tag, Mode string
	MinViews                                          int
}

func (a *App) searchResults(ctx context.Context, q, product, user string, f searchFilter, visual []float64) ([]map[string]any, error) {
	if len(q) > 300 {
		return nil, fmt.Errorf("søket er for langt")
	}
	if strings.TrimSpace(q) == "" && len(visual) == 0 {
		return []map[string]any{}, nil
	}
	if e := a.syncDocuments(ctx); e != nil {
		return nil, e
	}
	ids := a.productIDs(ctx, product)
	vector := []float64{}
	model := ""
	explanation := "Tekstsøk"
	if (f.Mode == "semantic" || f.Mode == "all") && q != "" {
		var out struct {
			Model   string      `json:"model"`
			Vectors [][]float64 `json:"vectors"`
		}
		c, cancel := context.WithTimeout(ctx, 8*time.Second)
		e := a.localJSON(c, "/embed", map[string]any{"texts": []string{q}}, &out)
		cancel()
		if e != nil && f.Mode == "semantic" {
			return nil, e
		}
		if e == nil && len(out.Vectors) == 1 {
			vector = out.Vectors[0]
			model = out.Model
			explanation = "Tekst og semantisk likhet"
		}
	}
	if f.Mode == "visual" && len(visual) == 0 {
		var out struct {
			Vectors [][]float64 `json:"vectors"`
		}
		e := a.localJSON(ctx, "/embed", map[string]any{"texts": []string{q}, "visual": true}, &out)
		if e != nil {
			return nil, e
		}
		if len(out.Vectors) == 1 {
			visual = out.Vectors[0]
		}
	}
	if visual == nil {
		visual = []float64{}
	}
	if len(visual) > 0 {
		explanation = "Visuell likhet"
	}
	rows, e := a.query(ctx, `WITH candidates AS(
 SELECT d.*,sv.number AS version_number,ts_rank_cd(d.search_vector,websearch_to_tsquery('norwegian',$1))+similarity(d.title,$1) AS lexical,
 CASE WHEN d.embedding_model=$5 THEN studio_cosine(d.embedding,$4::float8[]) ELSE 0 END AS semantic,
 coalesce(studio_cosine(d.visual_embedding,$6::float8[]),0) AS visual
 FROM search_documents d LEFT JOIN versions sv ON sv.id=d.version_id LEFT JOIN items i ON i.id::text=d.target_id
 WHERE d.product_id::text=ANY($2) AND (d.user_id IS NULL OR d.user_id::text=$3)
 AND ($7='' OR coalesce(i.kind,d.kind)=$7) AND ($8='' OR d.status=$8) AND ($9='' OR i.rights=$9) AND ($10='' OR i.created_by ILIKE '%'||$10||'%') AND ($11='' OR $11=ANY(i.tags))
 AND ($12='' OR EXISTS(SELECT 1 FROM publications p WHERE p.item_id=i.id AND p.campaign_id::text=$12) OR EXISTS(SELECT 1 FROM tasks t WHERE t.item_id=i.id AND t.campaign_id::text=$12))
 AND ($13::int=0 OR EXISTS(SELECT 1 FROM measurements m JOIN publications p ON p.id=m.publication_id WHERE p.item_id=i.id AND m.views>=$13))
 ), ranked AS(SELECT *,CASE WHEN cardinality($6::float8[])>0 THEN visual ELSE greatest(lexical,semantic) END AS rank FROM candidates)
 SELECT id,target_id,product_id,version_id,version_number,entity,kind,title,left(body,300) AS excerpt,start_seconds,status,rank,$14::text AS explanation FROM ranked
 WHERE (cardinality($6::float8[])>0 AND visual>.16) OR (cardinality($6::float8[])=0 AND (search_vector@@websearch_to_tsquery('norwegian',$1) OR similarity(title,$1)>.18 OR semantic>.35)) ORDER BY rank DESC,title LIMIT 80`, q, ids, user, vector, model, visual, f.Kind, f.Status, f.Rights, f.Author, f.Tag, f.Campaign, f.MinViews, explanation)
	if rows == nil {
		rows = []map[string]any{}
	}
	return rows, e
}
func (a *App) searchImage(w http.ResponseWriter, r *http.Request) {
	var v struct {
		Product string `json:"product_id"`
		Base64  string `json:"base64"`
		Item    string `json:"item_id"`
	}
	if !decode(w, r, &v) {
		return
	}
	if validateProduct(r.Context(), a, v.Product) != nil {
		fail(w, 403, "Ingen produkttilgang")
		return
	}
	var vector []float64
	if v.Item != "" {
		a.db.QueryRow(r.Context(), "SELECT visual_embedding FROM search_documents WHERE target_id=$1 AND product_id::text=$2 AND entity='frame' ORDER BY start_seconds LIMIT 1", v.Item, v.Product).Scan(&vector)
	} else {
		var out struct {
			Vectors [][]float64 `json:"vectors"`
		}
		if e := a.localJSON(r.Context(), "/image", map[string]string{"base64": v.Base64}, &out); e != nil {
			fail(w, 400, e.Error())
			return
		}
		if len(out.Vectors) == 1 {
			vector = out.Vectors[0]
		}
	}
	if len(vector) == 0 {
		fail(w, 409, "Bildet er ikke indeksert ennå")
		return
	}
	rows, e := a.searchResults(r.Context(), "", v.Product, actor(r).ID, searchFilter{}, vector)
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	write(w, 200, rows)
}

// The same filters and visual-reference lookup are available in chat and MCP.
type agentSearchInput struct {
	Query     string `json:"query"`
	Mode      string `json:"mode"`
	Kind      string `json:"kind"`
	Status    string `json:"status"`
	Rights    string `json:"rights"`
	Author    string `json:"author"`
	Tag       string `json:"tag"`
	Campaign  string `json:"campaign"`
	MinViews  string `json:"min_views"`
	ImageItem string `json:"image_item"`
}

func searchProperties() map[string]any {
	p := map[string]any{}
	for _, key := range []string{"query", "mode", "kind", "status", "rights", "author", "tag", "campaign", "min_views", "image_item"} {
		p[key] = map[string]string{"type": "string"}
	}
	return p
}
func (a *App) agentSearch(ctx context.Context, p, user string, in agentSearchInput) ([]map[string]any, error) {
	f := searchFilter{Mode: in.Mode, Kind: in.Kind, Status: in.Status, Rights: in.Rights, Author: in.Author, Tag: in.Tag, Campaign: in.Campaign, MinViews: int(parseFloat(in.MinViews))}
	if f.Mode == "" {
		f.Mode = "all"
	}
	var visual []float64
	if in.ImageItem != "" {
		e := a.db.QueryRow(ctx, "SELECT visual_embedding FROM search_documents d JOIN items i ON i.id::text=d.target_id AND i.current_version_id=d.version_id WHERE i.id::text=$1 AND i.product_id::text=$2 AND i.deleted_at IS NULL AND d.visual_embedding IS NOT NULL ORDER BY start_seconds LIMIT 1", in.ImageItem, p).Scan(&visual)
		if e != nil {
			return nil, fmt.Errorf("bildet er utilgjengelig eller ikke indeksert")
		}
	}
	return a.searchResults(ctx, in.Query, p, user, f, visual)
}
