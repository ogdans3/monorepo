package studio

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/mail"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type App struct {
	db                         *pgxpool.Pool
	storage, origin, bootstrap string
	http                       *http.Client
	mu                         sync.Mutex
	limits                     map[string]rateWindow
}
type rateWindow struct {
	start time.Time
	count int
}
type Actor struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Role    string `json:"role"`
	Product string `json:"product_id,omitempty"`
	Agent   bool   `json:"agent"`
}
type actorKey struct{}

func Env(k, v string) string {
	if s := os.Getenv(k); s != "" {
		return s
	}
	return v
}
func token() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func hash(s string) string        { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func actor(r *http.Request) Actor { a, _ := r.Context().Value(actorKey{}).(Actor); return a }
func (a *App) Close()             { a.db.Close() }
func New(ctx context.Context) (*App, error) {
	db, e := pgxpool.New(ctx, Env("DATABASE_URL", "postgres://studio:studio-local-only@127.0.0.1:5448/studio?sslmode=disable"))
	if e != nil {
		return nil, e
	}
	if e = db.Ping(ctx); e != nil {
		db.Close()
		return nil, e
	}
	if e = migrate(ctx, db); e != nil {
		db.Close()
		return nil, e
	}
	storage := Env("STORAGE_PATH", ".data/files")
	if e = os.MkdirAll(storage, 0700); e != nil {
		db.Close()
		return nil, e
	}
	return &App{db: db, storage: storage, origin: Env("APP_ORIGIN", "http://localhost:5178"), bootstrap: os.Getenv("BOOTSTRAP_TOKEN"), http: &http.Client{Timeout: 60 * time.Second}, limits: make(map[string]rateWindow)}, nil
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, s string) {
	write(w, status, map[string]string{"error": s})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		fail(w, 400, "Ugyldig forespørsel")
		return false
	}
	return true
}
func (a *App) query(ctx context.Context, sql string, args ...any) ([]map[string]any, error) {
	rows, e := a.db.Query(ctx, sql, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	data, err := pgx.CollectRows(rows, pgx.RowToMap)
	for _, row := range data {
		for key, value := range row {
			if id, ok := value.([16]byte); ok {
				row[key] = fmt.Sprintf("%x-%x-%x-%x-%x", id[0:4], id[4:6], id[6:8], id[8:10], id[10:16])
			}
		}
	}
	return data, err
}
func (a *App) list(w http.ResponseWriter, r *http.Request, sql string, args ...any) {
	rows, e := a.query(r.Context(), sql, args...)
	if e != nil {
		log.Printf("database query: %v", e)
		fail(w, 500, "Kunne ikke hente data")
		return
	}
	if rows == nil {
		rows = []map[string]any{}
	}
	write(w, 200, rows)
}
func (a *App) audit(ctx context.Context, who, action, id string) {
	if _, e := a.db.Exec(ctx, "INSERT INTO audit(actor,action,entity_id) VALUES($1,$2,$3)", who, action, id); e != nil {
		log.Printf("audit: %v", e)
	}
}
func (a *App) allowed(key string, max int) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now()
	v := a.limits[key]
	if now.Sub(v.start) > time.Minute {
		v = rateWindow{start: now}
	}
	v.count++
	a.limits[key] = v
	if len(a.limits) > 10000 {
		for k, v := range a.limits {
			if now.Sub(v.start) > time.Minute {
				delete(a.limits, k)
			}
		}
	}
	return v.count <= max
}
func (a *App) auth(r *http.Request) (Actor, error) {
	var u Actor
	if bearer := r.Header.Get("Authorization"); strings.HasPrefix(bearer, "Bearer ") {
		e := a.db.QueryRow(r.Context(), "SELECT id::text,name,product_id::text FROM agent_tokens WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()", hash(strings.TrimPrefix(bearer, "Bearer "))).Scan(&u.ID, &u.Name, &u.Product)
		u.Agent = true
		u.Role = "editor"
		return u, e
	}
	c, e := r.Cookie("studio_session")
	if e != nil {
		return u, e
	}
	e = a.db.QueryRow(r.Context(), "SELECT u.id::text,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()", hash(c.Value)).Scan(&u.ID, &u.Name, &u.Email, &u.Role)
	return u, e
}
func (a *App) protected(h http.HandlerFunc, writeAccess, admin bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, e := a.auth(r)
		if e != nil {
			fail(w, 401, "Logg inn for å fortsette")
			return
		}
		if u.Agent && !strings.HasPrefix(r.URL.Path, "/api/agent/") {
			fail(w, 403, "Bruk agentendepunktet")
			return
		}
		if (writeAccess && u.Role == "reader") || (admin && u.Role != "admin") {
			fail(w, 403, "Du har ikke tilgang til dette")
			return
		}
		ctx := context.WithValue(r.Context(), actorKey{}, u)
		ctx = context.WithValue(ctx, writeKey{}, writeAccess)
		if !a.resourceAccess(ctx, r.URL.Path, r.PathValue("id"), writeAccess) {
			fail(w, 403, "Ingen tilgang til produktet")
			return
		}
		if p := r.URL.Query().Get("product"); p != "" && !a.productAccess(ctx, p, writeAccess) {
			fail(w, 403, "Ingen tilgang til produktet")
			return
		}
		h(w, r.WithContext(ctx))
	}
}
func (a *App) Handler() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if a.db.Ping(r.Context()) != nil {
			fail(w, 503, "Database unavailable")
			return
		}
		write(w, 200, map[string]bool{"ok": true})
	})
	m.HandleFunc("GET /api/auth/status", a.authStatus)
	m.HandleFunc("POST /api/auth/bootstrap", a.bootstrapUser)
	m.HandleFunc("POST /api/auth/login", a.login)
	m.HandleFunc("POST /api/auth/accept", a.acceptInvite)
	m.HandleFunc("POST /api/auth/logout", a.logout)
	routes := []struct {
		pattern      string
		handler      http.HandlerFunc
		write, admin bool
	}{
		{"GET /api/products", a.products, false, false}, {"PATCH /api/products/{id}", a.updateProduct, true, false},
		{"GET /api/items", a.items, false, false}, {"POST /api/items", a.createItem, true, false}, {"GET /api/items/{id}", a.item, false, false}, {"POST /api/items/{id}/versions", a.newVersion, true, false}, {"POST /api/items/{id}/approve", a.approve, true, false}, {"POST /api/items/{id}/notes", a.addNote, true, false},
		{"POST /api/uploads", a.upload, true, false}, {"GET /api/files/{id}", a.file, false, false}, {"GET /api/search", a.search, false, false},
		{"GET /api/tasks", a.tasks, false, false}, {"POST /api/tasks", a.createTask, true, false}, {"PATCH /api/tasks/{id}", a.updateTask, true, false},
		{"GET /api/publications", a.publications, false, false}, {"POST /api/publications", a.createPublication, true, false}, {"PATCH /api/publications/{id}", a.updatePublication, true, false},
		{"GET /api/conversations", a.conversations, false, false}, {"POST /api/conversations", a.createConversation, true, false}, {"GET /api/conversations/{id}", a.conversation, false, false}, {"POST /api/conversations/{id}/messages", a.sendMessage, true, false},
		{"GET /api/runs/{id}", a.getRun, false, false}, {"POST /api/runs/{id}/cancel", a.cancelRun, true, false},
		{"GET /api/settings", a.settings, false, false}, {"PUT /api/settings/{role}", a.updateSettings, true, true},
		{"GET /api/invites", a.invites, false, true}, {"POST /api/invites", a.invite, true, true},
		{"GET /api/agent-tokens", a.agentTokens, false, true}, {"POST /api/agent-tokens", a.createAgentToken, true, true}, {"DELETE /api/agent-tokens/{id}", a.revokeAgentToken, true, true},
	}
	for _, route := range routes {
		m.HandleFunc(route.pattern, a.protected(route.handler, route.write, route.admin))
	}
	a.extendedRoutes(m)
	m.HandleFunc("POST /mcp", a.mcp)
	m.HandleFunc("POST /api/agent/uploads", a.protected(a.upload, true, false))
	m.HandleFunc("GET /api/agent/files/{id}", a.protected(a.file, false, false))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if origin := r.Header.Get("Origin"); origin != "" && origin != a.origin {
			fail(w, 403, "Origin not allowed")
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" && r.Header.Get("Authorization") == "" && r.Header.Get("Origin") != a.origin {
			fail(w, 403, "Origin required")
			return
		}
		key, _, _ := net.SplitHostPort(r.RemoteAddr)
		max := 120
		if strings.HasPrefix(r.URL.Path, "/api/auth/") {
			max = 30
		}
		if !a.allowed(key+strings.Split(r.URL.Path, "?")[0], max) {
			fail(w, 429, "For mange forespørsler. Vent litt.")
			return
		}
		defer func() {
			if e := recover(); e != nil {
				log.Printf("request panic: %v", e)
				fail(w, 500, "Noe gikk galt")
			}
		}()
		m.ServeHTTP(w, r)
	})
}
func (a *App) authStatus(w http.ResponseWriter, r *http.Request) {
	var count int
	a.db.QueryRow(r.Context(), "SELECT count(*) FROM users").Scan(&count)
	u, e := a.auth(r)
	if e != nil {
		write(w, 200, map[string]any{"setup": count == 0, "user": nil})
		return
	}
	write(w, 200, map[string]any{"setup": false, "user": u})
}

type credentials struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
	Token    string `json:"token"`
}

func validCredentials(c credentials) bool {
	_, e := mail.ParseAddress(c.Email)
	return e == nil && strings.Contains(c.Email, "@") && len(c.Password) >= 12 && len(c.Password) <= 72 && len(strings.TrimSpace(c.Name)) > 0 && len(c.Name) <= 100
}
func (a *App) session(w http.ResponseWriter, r *http.Request, id string) {
	t := token()
	_, e := a.db.Exec(r.Context(), "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')", hash(t), id)
	if e != nil {
		fail(w, 500, "Kunne ikke opprette innlogging")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "studio_session", Value: t, Path: "/", HttpOnly: true, Secure: strings.HasPrefix(a.origin, "https://"), SameSite: http.SameSiteStrictMode, MaxAge: 30 * 86400})
	write(w, 200, map[string]bool{"ok": true})
}
func (a *App) bootstrapUser(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	if a.bootstrap == "" || subtle.ConstantTimeCompare([]byte(c.Token), []byte(a.bootstrap)) != 1 {
		fail(w, 403, "Ugyldig oppsettkode")
		return
	}
	if !validCredentials(c) {
		fail(w, 400, "Oppgi navn, e-post og et passord på 12–72 tegn")
		return
	}
	h, e := bcrypt.GenerateFromPassword([]byte(c.Password), 12)
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
	tx.Exec(r.Context(), "SELECT pg_advisory_xact_lock(8147202)")
	var count int
	tx.QueryRow(r.Context(), "SELECT count(*) FROM users").Scan(&count)
	if count > 0 {
		fail(w, 409, "Studio er allerede satt opp")
		return
	}
	var id string
	e = tx.QueryRow(r.Context(), "INSERT INTO users(email,name,password_hash,role) VALUES(lower($1),$2,$3,'admin') RETURNING id::text", c.Email, c.Name, string(h)).Scan(&id)
	if e != nil {
		fail(w, 500, "Kunne ikke opprette bruker")
		return
	}
	if tx.Commit(r.Context()) != nil {
		fail(w, 500, "Kunne ikke lagre bruker")
		return
	}
	a.session(w, r, id)
}
func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	var id, h string
	e := a.db.QueryRow(r.Context(), "SELECT id::text,password_hash FROM users WHERE email=lower($1)", c.Email).Scan(&id, &h)
	if e != nil || bcrypt.CompareHashAndPassword([]byte(h), []byte(c.Password)) != nil {
		fail(w, 401, "Feil e-post eller passord")
		return
	}
	a.session(w, r, id)
}
func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	if c, e := r.Cookie("studio_session"); e == nil {
		a.db.Exec(r.Context(), "DELETE FROM sessions WHERE token_hash=$1", hash(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: "studio_session", Value: "", Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, MaxAge: -1})
	write(w, 200, map[string]bool{"ok": true})
}
func (a *App) invite(w http.ResponseWriter, r *http.Request) {
	var c struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if !decode(w, r, &c) {
		return
	}
	if _, e := mail.ParseAddress(c.Email); e != nil || !(c.Role == "editor" || c.Role == "reader" || c.Role == "admin") {
		fail(w, 400, "Ugyldig e-post eller rolle")
		return
	}
	t := token()
	_, e := a.db.Exec(r.Context(), "INSERT INTO invites(token_hash,email,role,expires_at,created_by) VALUES($1,lower($2),$3,now()+interval '7 days',$4)", hash(t), c.Email, c.Role, actor(r).ID)
	if e != nil {
		fail(w, 500, "Kunne ikke opprette invitasjon")
		return
	}
	a.audit(r.Context(), actor(r).Name, "invite.created", c.Email)
	write(w, 201, map[string]string{"url": a.origin + "/#invite=" + t, "email": c.Email})
}
func (a *App) invites(w http.ResponseWriter, r *http.Request) {
	a.list(w, r, "SELECT id,email,role,expires_at,used_at,revoked_at,created_at FROM invites ORDER BY created_at DESC LIMIT 100")
}
func (a *App) acceptInvite(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	if !validCredentials(c) {
		fail(w, 400, "Oppgi navn, e-post og et passord på 12–72 tegn")
		return
	}
	h, _ := bcrypt.GenerateFromPassword([]byte(c.Password), 12)
	tx, e := a.db.Begin(r.Context())
	if e != nil {
		fail(w, 500, "Databasefeil")
		return
	}
	defer tx.Rollback(r.Context())
	var role, id string
	e = tx.QueryRow(r.Context(), "UPDATE invites SET used_at=now() WHERE token_hash=$1 AND email=lower($2) AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() RETURNING role", hash(c.Token), c.Email).Scan(&role)
	if e != nil {
		fail(w, 400, "Invitasjonen er brukt, utløpt eller tilhører en annen e-post")
		return
	}
	e = tx.QueryRow(r.Context(), "INSERT INTO users(email,name,password_hash,role) VALUES(lower($1),$2,$3,$4) RETURNING id::text", c.Email, c.Name, string(h), role).Scan(&id)
	if e != nil {
		fail(w, 409, "Brukeren finnes allerede")
		return
	}
	if tx.Commit(r.Context()) != nil {
		fail(w, 500, "Kunne ikke lagre bruker")
		return
	}
	a.session(w, r, id)
}
func badID(s string) bool {
	if len(s) != 36 {
		return true
	}
	_, e := hex.DecodeString(strings.ReplaceAll(s, "-", ""))
	return e != nil
}
func validateProduct(ctx context.Context, a *App, id string) error {
	if badID(id) {
		return errors.New("velg et produkt")
	}
	var exists bool
	e := a.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM products WHERE id=$1)", id).Scan(&exists)
	if e != nil || !exists {
		return fmt.Errorf("ukjent produkt")
	}
	write, _ := ctx.Value(writeKey{}).(bool)
	if !a.productAccess(ctx, id, write) {
		return fmt.Errorf("ingen tilgang til produktet")
	}
	return nil
}
