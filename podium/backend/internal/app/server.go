package app

import (
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Server is the whole of Podium on one port: the API, the uploads, and the
// built Svelte app, so there is one thing to deploy and no CORS to get wrong.
type Server struct {
	cfg Config
	db  *pgxpool.Pool
	hub *Hub
	log *slog.Logger
	web fs.FS
	mux *http.ServeMux
}

// NewServer wires the routes. [web] is the built Svelte app, or nil when
// Vite serves it in development.
func NewServer(cfg Config, db *pgxpool.Pool, web fs.FS, log *slog.Logger) *Server {
	s := &Server{cfg: cfg, db: db, hub: NewHub(), log: log, web: web, mux: http.NewServeMux()}
	m := s.mux

	m.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := db.Ping(r.Context()); err != nil {
			fail(w, http.StatusServiceUnavailable, "no_database", "Databasen svarer ikke.")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	m.HandleFunc("POST /api/admin/login", s.login)
	m.HandleFunc("POST /api/admin/logout", s.logout)
	m.HandleFunc("GET /api/admin/me", s.me)

	m.HandleFunc("GET /api/admin/presentations", s.admin(s.listPresentations))
	m.HandleFunc("POST /api/admin/presentations", s.admin(s.createPresentation))
	m.HandleFunc("GET /api/admin/presentations/{id}", s.admin(s.getPresentation))
	m.HandleFunc("PATCH /api/admin/presentations/{id}", s.admin(s.updatePresentation))
	m.HandleFunc("DELETE /api/admin/presentations/{id}", s.admin(s.deletePresentation))
	m.HandleFunc("POST /api/admin/presentations/{id}/slides", s.admin(s.createSlide))
	m.HandleFunc("PUT /api/admin/presentations/{id}/order", s.admin(s.reorderSlides))
	m.HandleFunc("POST /api/admin/presentations/{id}/media", s.admin(s.upload))
	m.HandleFunc("DELETE /api/admin/media/{id}", s.admin(s.deleteMedia))
	m.HandleFunc("PUT /api/admin/presentations/{id}/live", s.admin(s.goLive))
	m.HandleFunc("DELETE /api/admin/presentations/{id}/live", s.admin(s.stopLive))
	m.HandleFunc("PUT /api/admin/slides/{id}", s.admin(s.saveSlide))
	m.HandleFunc("DELETE /api/admin/slides/{id}", s.admin(s.deleteSlide))
	m.HandleFunc("POST /api/admin/slides/{id}/duplicate", s.admin(s.duplicateSlide))
	m.HandleFunc("DELETE /api/admin/slides/{id}/votes", s.admin(s.resetVotes))

	m.HandleFunc("GET /api/live/{code}", s.live)
	m.HandleFunc("GET /api/live/{code}/events", s.events)
	m.HandleFunc("GET /api/stem/{code}", s.ballot)
	m.HandleFunc("POST /api/stem/{code}", s.vote)

	m.HandleFunc("GET /media/{id}", s.media)
	m.HandleFunc("GET /", s.spa)
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

// spa serves the built app: a file that exists as itself, and every other
// path as the app's shell, which routes on the client. The hashed assets are
// kept for a year; the shell never, so a deploy is seen on the next load.
func (s *Server) spa(w http.ResponseWriter, r *http.Request) {
	// An address under /api that no route took is a mistake, said in JSON, and
	// not the app's shell.
	if strings.HasPrefix(r.URL.Path, "/api/") {
		fail(w, http.StatusNotFound, "not_found", "Fant det ikke.")
		return
	}
	if s.web == nil {
		http.Error(w, "The app is served by Vite in development: cd web && pnpm dev", http.StatusNotFound)
		return
	}
	name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if name != "" && name != "index.html" {
		if st, err := fs.Stat(s.web, name); err == nil && !st.IsDir() {
			if strings.HasPrefix(name, "_app/immutable/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			http.ServeFileFS(w, r, s.web, name)
			return
		}
	}
	index, err := fs.ReadFile(s.web, "index.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write(index)
}
