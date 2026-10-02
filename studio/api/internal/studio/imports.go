package studio

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"
)

const maxImportBytes int64 = 512 << 20

type importInput struct {
	Product    string `json:"product_id"`
	URL        string `json:"url"`
	Title      string `json:"title"`
	Rights     string `json:"rights"`
	Collection string `json:"collection_id"`
}
type importRecord struct {
	ID, Product, URL, Platform, ActorID, ActorName, Title, Rights, Collection string
	Agent                                                                     bool
	Reserved                                                                  int64
}
type downloadedVideo struct {
	FileName    string   `json:"file_name"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Uploader    string   `json:"uploader"`
	ExternalID  string   `json:"external_id"`
	SourceURL   string   `json:"source_url"`
	Extractor   string   `json:"extractor"`
	MIME        string   `json:"mime"`
	HasAudio    *bool    `json:"has_audio"`
	Tags        []string `json:"tags"`
	Width       int      `json:"width"`
	Height      int      `json:"height"`
	Duration    float64  `json:"duration"`
}
type importDownloadFunc func(context.Context, string, string, int64, func(int64, int64)) (downloadedVideo, error)

var socialPaths = map[string]*regexp.Regexp{
	"instagram":    regexp.MustCompile(`^/(p|reel|reels|tv)/[A-Za-z0-9_-]+/?$`),
	"tiktok":       regexp.MustCompile(`^(/@[^/]+/video/[0-9]+|/t/[A-Za-z0-9]+)/?$`),
	"short_tiktok": regexp.MustCompile(`^/[A-Za-z0-9]+/?$`),
	"snapchat":     regexp.MustCompile(`^/(spotlight|t)/[A-Za-z0-9_-]+/?$`),
}

func normalizeSocialURL(raw string) (string, string, error) {
	raw = strings.TrimSpace(raw)
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, e := url.Parse(raw)
	if e != nil || len(raw) > 2048 || u.Scheme != "https" || u.User != nil || u.Opaque != "" || u.RawPath != "" || u.Hostname() == "" || (u.Port() != "" && u.Port() != "443") {
		return "", "", errors.New("Bruk en HTTPS-lenke til én video")
	}
	host := strings.ToLower(u.Hostname())
	platform, pattern := "", ""
	switch host {
	case "www.instagram.com", "instagram.com":
		platform = "instagram"
		pattern = platform
		host = "www.instagram.com"
	case "www.tiktok.com", "tiktok.com", "m.tiktok.com":
		platform = "tiktok"
		pattern = platform
		host = "www.tiktok.com"
	case "vm.tiktok.com", "vt.tiktok.com":
		platform = "tiktok"
		pattern = "short_tiktok"
	case "www.snapchat.com", "snapchat.com":
		platform = "snapchat"
		pattern = platform
		host = "www.snapchat.com"
	default:
		return "", "", errors.New("Bruk en lenke fra Instagram, TikTok eller Snapchat Spotlight")
	}
	if !socialPaths[pattern].MatchString(u.Path) {
		return "", "", errors.New("Lenken må gå til én video, ikke en profil, samling eller privat historie")
	}
	u.Host = host
	u.RawQuery = ""
	u.ForceQuery = false
	u.Fragment = ""
	u.Path = strings.TrimRight(u.Path, "/")
	if platform == "instagram" || pattern == "short_tiktok" {
		u.Path += "/"
	}
	return u.String(), platform, nil
}
func (a *App) enqueueImport(ctx context.Context, u Actor, v importInput) (map[string]any, error) {
	ctx = context.WithValue(ctx, actorKey{}, u)
	if u.Agent {
		v.Product = u.Product
	}
	if validateProduct(ctx, a, v.Product) != nil || !a.productAccess(ctx, v.Product, true) {
		return nil, errors.New("Ingen skrivetilgang til produktet")
	}
	source, platform, e := normalizeSocialURL(v.URL)
	if e != nil {
		return nil, e
	}
	if len(v.Title) > 300 {
		return nil, errors.New("Tittelen er for lang")
	}
	if v.Rights == "" {
		v.Rights = "reference_only"
	}
	if !strings.Contains("|owned|licensed|reference_only|unknown|", "|"+v.Rights+"|") {
		return nil, errors.New("Ugyldige rettigheter")
	}
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return nil, e
	}
	defer tx.Rollback(ctx)
	var capacity, used int64
	var maxActive, active int
	if e = tx.QueryRow(ctx, "SELECT storage_bytes,max_active_jobs FROM workspace_limits FOR UPDATE").Scan(&capacity, &maxActive); e != nil {
		return nil, e
	}
	var existing, status string
	if tx.QueryRow(ctx, `SELECT m.id::text,m.status FROM media_imports m LEFT JOIN items i ON i.id=m.item_id WHERE m.product_id::text=$1 AND m.source_url=$2 AND (m.status IN('queued','downloading') OR (m.status='completed' AND i.deleted_at IS NULL AND i.id IS NOT NULL)) ORDER BY m.created_at DESC LIMIT 1`, v.Product, source).Scan(&existing, &status) == nil {
		return map[string]any{"id": existing, "status": status, "duplicate": true}, nil
	}
	if v.Collection != "" {
		var p string
		if tx.QueryRow(ctx, "SELECT product_id::text FROM collections WHERE id::text=$1", v.Collection).Scan(&p) != nil || p != v.Product {
			return nil, errors.New("Velg en samling i samme produkt")
		}
	}
	if e = tx.QueryRow(ctx, "SELECT "+storageUsedSQL).Scan(&used); e != nil {
		return nil, e
	}
	reserved := min(maxImportBytes, capacity-used)
	if reserved < 1<<20 {
		return nil, errors.New("Lagringsgrensen er nådd")
	}
	if e = tx.QueryRow(ctx, "SELECT (SELECT count(*) FROM media_imports WHERE status IN('queued','downloading'))+(SELECT count(*) FROM jobs WHERE status IN('queued','running'))").Scan(&active); e != nil {
		return nil, e
	}
	if active >= maxActive {
		return nil, errors.New("Jobbkøen er full. Prøv igjen når en jobb er ferdig")
	}
	var id string
	e = tx.QueryRow(ctx, "INSERT INTO media_imports(product_id,actor_id,actor_name,actor_agent,source_url,platform,title,rights,collection_id,reserved_bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,nullif($9,'')::uuid,$10) RETURNING id::text", v.Product, u.ID, u.Name, u.Agent, source, platform, v.Title, v.Rights, v.Collection, reserved).Scan(&id)
	if e != nil {
		return nil, e
	}
	if e = tx.Commit(ctx); e != nil {
		return nil, e
	}
	a.audit(ctx, u.Name, "import.queued", id)
	return map[string]any{"id": id, "status": "queued", "duplicate": false}, nil
}
func (a *App) createImport(w http.ResponseWriter, r *http.Request) {
	var in importInput
	if !decode(w, r, &in) {
		return
	}
	out, e := a.enqueueImport(r.Context(), actor(r), in)
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	write(w, 202, out)
}

const importsSQL = `SELECT m.id,m.product_id,m.source_url,m.platform,m.status,m.stage,m.error_code,m.downloaded_bytes,m.total_bytes,m.duplicate,m.created_at,m.finished_at,
 CASE WHEN i.deleted_at IS NULL THEN m.item_id END AS item_id,coalesce(nullif(m.title,''),i.title,'') AS title,
 i.metadata->'classification' AS classification,j.status AS media_status,j.progress AS media_progress,j.result->'warnings' AS warnings
 FROM media_imports m LEFT JOIN items i ON i.id=m.item_id LEFT JOIN LATERAL(SELECT status,progress,result FROM jobs WHERE version_id=m.version_id AND kind='media' ORDER BY created_at DESC LIMIT 1) j ON true`

func (a *App) imports(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, importsSQL+" WHERE m.product_id::text=ANY($1) ORDER BY m.created_at DESC LIMIT 40", a.productIDs(r.Context(), r.URL.Query().Get("product")))
}
func (a *App) cancelImport(w http.ResponseWriter, r *http.Request) {
	// Keep an active download's reservation until its process and temporary files are gone.
	tag, e := a.db.Exec(r.Context(), "UPDATE media_imports SET status='cancelled',stage='Stoppet',reserved_bytes=CASE WHEN status='queued' THEN 0 ELSE reserved_bytes END,finished_at=now() WHERE id::text=$1 AND status IN('queued','downloading')", r.PathValue("id"))
	if e != nil || tag.RowsAffected() == 0 {
		fail(w, 409, "Importen er allerede avsluttet")
		return
	}
	ok(w)
}
func (a *App) retryImport(w http.ResponseWriter, r *http.Request) {
	var in importInput
	e := a.db.QueryRow(r.Context(), "SELECT product_id::text,source_url,title,rights,coalesce(collection_id::text,'') FROM media_imports WHERE id::text=$1 AND status IN('failed','cancelled') AND reserved_bytes=0", r.PathValue("id")).Scan(&in.Product, &in.URL, &in.Title, &in.Rights, &in.Collection)
	if e != nil {
		fail(w, 409, "Importen kan ikke prøves på nytt ennå")
		return
	}
	out, e := a.enqueueImport(r.Context(), actor(r), in)
	if e != nil {
		fail(w, 400, e.Error())
		return
	}
	write(w, 202, out)
}
func (a *App) importActor(ctx context.Context, m importRecord) (Actor, error) {
	u := Actor{ID: m.ActorID, Agent: m.Agent, Product: m.Product}
	var e error
	if u.Agent {
		e = a.db.QueryRow(ctx, "SELECT name FROM agent_tokens WHERE id::text=$1 AND product_id::text=$2 AND revoked_at IS NULL AND expires_at>now()", u.ID, m.Product).Scan(&u.Name)
		u.Role = "editor"
	} else {
		e = a.db.QueryRow(ctx, "SELECT name,role FROM users WHERE id::text=$1", u.ID).Scan(&u.Name, &u.Role)
	}
	if e != nil || !a.productAccess(context.WithValue(ctx, actorKey{}, u), m.Product, true) {
		return u, errors.New("access_revoked")
	}
	return u, nil
}
func (a *App) ImportWorker(ctx context.Context) {
	// One local API worker. Restart never silently retries a network download.
	a.db.Exec(ctx, "UPDATE media_imports SET status='failed',stage='Avbrutt ved omstart. Prøv igjen manuelt.',error_code='restart',reserved_bytes=0,finished_at=now() WHERE status='downloading'")
	a.db.Exec(ctx, "UPDATE media_imports SET reserved_bytes=0 WHERE status='cancelled'")
	os.RemoveAll(filepath.Join(a.storage, ".imports"))
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			var m importRecord
			e := a.db.QueryRow(ctx, `UPDATE media_imports SET status='downloading',stage='Henter video',started_at=now() WHERE id=(SELECT id FROM media_imports WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id::text,product_id::text,source_url,platform,actor_id,actor_name,actor_agent,title,rights,coalesce(collection_id::text,''),reserved_bytes`).Scan(&m.ID, &m.Product, &m.URL, &m.Platform, &m.ActorID, &m.ActorName, &m.Agent, &m.Title, &m.Rights, &m.Collection, &m.Reserved)
			if e == nil {
				a.executeImport(ctx, m)
			}
		}
	}
}
func (a *App) executeImport(parent context.Context, m importRecord) {
	ctx, cancel := context.WithTimeout(parent, 5*time.Minute)
	defer cancel()
	dir := filepath.Join(a.storage, ".imports", m.ID)
	defer func() {
		os.RemoveAll(dir)
		a.db.Exec(context.Background(), "UPDATE media_imports SET reserved_bytes=0 WHERE id=$1 AND status IN('cancelled','failed')", m.ID)
	}()
	go func() {
		ticker := time.NewTicker(400 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				var s string
				if a.db.QueryRow(ctx, "SELECT status FROM media_imports WHERE id=$1", m.ID).Scan(&s) != nil || s != "downloading" {
					cancel()
					return
				}
			}
		}
	}()
	u, e := a.importActor(ctx, m)
	if e == nil {
		e = os.MkdirAll(dir, 0700)
	}
	var info downloadedVideo
	if e == nil {
		downloader := a.importDownload
		if downloader == nil {
			downloader = downloadSocialVideo
		}
		info, e = downloader(ctx, m.URL, dir, m.Reserved, func(done, total int64) {
			a.db.Exec(ctx, "UPDATE media_imports SET stage='Laster ned video',downloaded_bytes=$1,total_bytes=$2 WHERE id=$3 AND status='downloading'", max(0, done), max(0, total), m.ID)
		})
	}
	if e == nil {
		u, e = a.importActor(ctx, m)
	}
	if e == nil {
		e = a.storeImportedVideo(ctx, u, m, dir, info)
	}
	if e != nil {
		code := e.Error()
		if ctx.Err() != nil {
			code = "timeout"
		}
		message := importErrorMessage(code)
		a.db.Exec(context.Background(), "UPDATE media_imports SET status='failed',stage=$1,error_code=$2,finished_at=now() WHERE id=$3 AND status='downloading'", message, knownImportError(code), m.ID)
	}
}
func knownImportError(code string) string {
	switch code {
	case "login_required", "too_large", "unavailable", "platform_blocked", "timeout", "unsupported", "access_revoked", "not_installed":
		return code
	default:
		return "download_failed"
	}
}
func importErrorMessage(code string) string {
	switch knownImportError(code) {
	case "login_required":
		return "Plattformen krever innlogging, eller videoen er privat. Last opp filen manuelt."
	case "too_large":
		return "Videoen er for stor eller lang (maks 512 MB og 30 minutter), eller det er for lite ledig lagring."
	case "unavailable":
		return "Videoen er slettet eller utilgjengelig. Kontroller lenken."
	case "platform_blocked":
		return "Plattformen blokkerte nedlastingen. Prøv senere eller last opp filen manuelt."
	case "timeout":
		return "Importen brukte for lang tid og ble stoppet."
	case "unsupported":
		return "Lenken må gi én offentlig video. Denne lenken eller videoformatet støttes ikke."
	case "access_revoked":
		return "Tilgangen til produktet er trukket tilbake."
	case "not_installed":
		return "Importverktøyet mangler. Bygg API-containeren på nytt."
	default:
		return "Kunne ikke laste ned videoen. Prøv igjen eller last opp filen manuelt."
	}
}
func downloadSocialVideo(ctx context.Context, source, dir string, maxBytes int64, progress func(int64, int64)) (downloadedVideo, error) {
	var result downloadedVideo
	cmd := exec.CommandContext(ctx, Env("SOCIAL_IMPORT_PYTHON", "/opt/importer/bin/python"), Env("SOCIAL_IMPORT_SCRIPT", "/app/importer/download.py"), source, dir, strconv.FormatInt(maxBytes, 10))
	cmd.Env = []string{"PATH=" + os.Getenv("PATH"), "LANG=C.UTF-8", "PYTHONUNBUFFERED=1", "PYTHONDONTWRITEBYTECODE=1"}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process != nil {
			return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		return nil
	}
	cmd.WaitDelay = 2 * time.Second
	pipe, e := cmd.StdoutPipe()
	if e != nil {
		return result, e
	}
	cmd.Stderr = io.Discard
	if e = cmd.Start(); e != nil {
		return result, errors.New("not_installed")
	}
	scanner := bufio.NewScanner(io.LimitReader(pipe, 2<<20))
	scanner.Buffer(make([]byte, 4096), 256<<10)
	code := ""
	gotResult := false
	for scanner.Scan() {
		var event struct {
			Type       string `json:"type"`
			Code       string `json:"code"`
			Downloaded int64  `json:"downloaded"`
			Total      int64  `json:"total"`
		}
		if json.Unmarshal(scanner.Bytes(), &event) != nil {
			code = "download_failed"
			break
		}
		switch event.Type {
		case "progress":
			progress(event.Downloaded, event.Total)
		case "result":
			if json.Unmarshal(scanner.Bytes(), &result) != nil {
				code = "download_failed"
			}
			gotResult = true
		case "error":
			code = event.Code
		}
	}
	if scanner.Err() != nil || code != "" {
		cmd.Cancel()
	}
	e = cmd.Wait()
	if code != "" {
		return result, errors.New(knownImportError(code))
	}
	if e != nil || !gotResult {
		return result, errors.New("download_failed")
	}
	return result, nil
}
func (a *App) storeImportedVideo(ctx context.Context, u Actor, m importRecord, dir string, info downloadedVideo) error {
	if info.FileName == "" || filepath.Base(info.FileName) != info.FileName {
		return errors.New("download_failed")
	}
	path := filepath.Join(dir, info.FileName)
	st, e := os.Lstat(path)
	if e != nil || !st.Mode().IsRegular() || st.Size() > m.Reserved {
		return errors.New("too_large")
	}
	checksum, mime, size, e := fileMetadata(path)
	if info.MIME == "video/mp4" || info.MIME == "video/webm" {
		mime = info.MIME // ffprobe in the trusted helper validates tracks and the container.
	}
	if e != nil || !strings.HasPrefix(mime, "video/") || size <= 0 {
		return errors.New("unsupported")
	}
	if m.Title == "" {
		m.Title = strings.TrimSpace(info.Title)
	}
	if m.Title == "" {
		m.Title = "Importert video"
	}
	m.Title = truncateText(m.Title, 300)
	tags := []string{m.Platform, "importert"}
	if info.Height > info.Width && info.Width > 0 {
		tags = append(tags, "vertikal")
	}
	if info.Duration > 0 && info.Duration <= 90 {
		tags = append(tags, "kortvideo")
	}
	for _, tag := range info.Tags {
		tag = strings.TrimSpace(strings.TrimPrefix(tag, "#"))
		if tag != "" {
			tags = append(tags, truncateText(tag, 80))
		}
		if len(tags) >= 20 {
			break
		}
	}
	tx, e := a.db.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(ctx)
	var quota, used int64
	if e = tx.QueryRow(ctx, "SELECT storage_bytes FROM workspace_limits FOR UPDATE").Scan(&quota); e != nil {
		return e
	}
	var status string
	if e = tx.QueryRow(ctx, "SELECT status FROM media_imports WHERE id=$1 FOR UPDATE", m.ID).Scan(&status); e != nil || status != "downloading" {
		return errors.New("cancelled")
	}
	if e = tx.QueryRow(ctx, "SELECT "+storageUsedSQL).Scan(&used); e != nil {
		return e
	}
	if used-m.Reserved+size > quota {
		return errors.New("too_large")
	}
	var item, version string
	duplicate := tx.QueryRow(ctx, "SELECT i.id::text,v.id::text FROM items i JOIN versions v ON v.id=i.current_version_id WHERE i.product_id=$1 AND i.deleted_at IS NULL AND v.checksum=$2 LIMIT 1", m.Product, checksum).Scan(&item, &version) == nil
	key := hash("social-import:" + m.ID)
	keep := false
	defer func() {
		if !keep {
			os.Remove(filepath.Join(a.storage, key))
		}
	}()
	if !duplicate {
		metadata := map[string]any{"import": map[string]any{"id": m.ID, "platform": m.Platform, "source_url": m.URL, "uploader": info.Uploader, "external_id": info.ExternalID, "duration": info.Duration, "width": info.Width, "height": info.Height, "has_audio": info.HasAudio, "extractor": info.Extractor}, "classification": map[string]string{"status": "pending", "category": "ukategorisert"}}
		e = tx.QueryRow(ctx, "INSERT INTO items(product_id,title,kind,body,source_url,tags,rights,metadata,created_by) VALUES($1,$2,'video',$3,$4,$5,$6,$7,$8) RETURNING id::text", m.Product, m.Title, truncateText(info.Description, 12000), m.URL, tags, m.Rights, jsonBytes(metadata), u.Name).Scan(&item)
		if e != nil {
			return e
		}
		if e = os.Rename(path, filepath.Join(a.storage, key)); e != nil {
			return e
		}
		e = tx.QueryRow(ctx, "INSERT INTO versions(item_id,number,title,body,file_key,file_name,mime,checksum,bytes,provenance,created_by) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id::text", item, m.Title, truncateText(info.Description, 12000), key, "importert"+filepath.Ext(info.FileName), mime, checksum, size, jsonBytes(metadata["import"]), u.Name).Scan(&version)
		if e != nil {
			return e
		}
		if _, e = tx.Exec(ctx, "UPDATE items SET current_version_id=$1 WHERE id=$2", version, item); e != nil {
			return e
		}
	}
	if m.Collection != "" {
		if _, e = tx.Exec(ctx, "INSERT INTO collection_items(collection_id,item_id) VALUES($1,$2) ON CONFLICT DO NOTHING", m.Collection, item); e != nil {
			return e
		}
	}
	if _, e = tx.Exec(ctx, "UPDATE media_imports SET status='completed',stage='Videoen er lagret',title=$1,item_id=$2,version_id=$3,duplicate=$4,reserved_bytes=0,downloaded_bytes=$5,finished_at=now() WHERE id=$6", m.Title, item, version, duplicate, size, m.ID); e != nil {
		return e
	}
	if !duplicate {
		var user any
		if !u.Agent {
			user = u.ID
		}
		if _, e = tx.Exec(ctx, "INSERT INTO jobs(product_id,version_id,user_id,kind) VALUES($1,$2,$3,'media') ON CONFLICT DO NOTHING", m.Product, version, user); e != nil {
			return e
		}
	}
	keep = true // On an ambiguous commit, preserve the immutable file rather than risk data loss.
	if e = tx.Commit(ctx); e != nil {
		return e
	}
	a.audit(ctx, u.Name, "import.completed", m.ID)
	return nil
}
func truncateText(s string, n int) string {
	s = strings.ToValidUTF8(s, "")
	if len(s) <= n {
		return s
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n]
}
