package app

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// upload takes one picture, video or sound for a presentation. The bytes go to
// the media folder under the row's id; what kind of file it is is read from
// the bytes, and the name it came with is only kept to be shown.
func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	ctx := r.Context()
	if _, err := presentationByID(ctx, s.db, id); err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, s.cfg.MaxUploadBytes+1<<20)
	file, header, err := r.FormFile("file")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			fail(w, http.StatusRequestEntityTooLarge, "too_large",
				"Filen er for stor. Grensen er "+formatMB(s.cfg.MaxUploadBytes)+".")
			return
		}
		fail(w, http.StatusBadRequest, "no_file", "Velg en fil å laste opp.")
		return
	}
	defer file.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	mime := http.DetectContentType(head[:n])
	// The sniffer knows pictures and the common videos and sounds, and calls a
	// QuickTime film bytes; the browser that sent it knew better.
	if mime == "application/octet-stream" {
		mime = header.Header.Get("Content-Type")
	}
	mime, _, _ = strings.Cut(mime, ";")
	var kind string
	switch {
	case strings.HasPrefix(mime, "image/"):
		kind = "image"
	case strings.HasPrefix(mime, "video/"):
		kind = "video"
	case strings.HasPrefix(mime, "audio/"):
		kind = "audio"
	default:
		fail(w, http.StatusUnsupportedMediaType, "not_media", "Bare bilder, video og lyd kan lastes opp.")
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		s.oops(w, err)
		return
	}
	if err := os.MkdirAll(s.cfg.MediaDir, 0o755); err != nil {
		s.oops(w, err)
		return
	}
	// Written beside its final name and moved there whole, so a file served is
	// never one still arriving.
	tmp, err := os.CreateTemp(s.cfg.MediaDir, ".upload-*")
	if err != nil {
		s.oops(w, err)
		return
	}
	defer os.Remove(tmp.Name())
	size, err := io.Copy(tmp, file)
	tmp.Close()
	if err != nil {
		s.oops(w, err)
		return
	}
	if size > s.cfg.MaxUploadBytes {
		fail(w, http.StatusRequestEntityTooLarge, "too_large",
			"Filen er for stor. Grensen er "+formatMB(s.cfg.MaxUploadBytes)+".")
		return
	}
	name := filepath.Base(header.Filename)
	if len(name) > 200 {
		name = name[:200]
	}
	var m Media
	if err := s.db.QueryRow(ctx, `insert into media (presentation_id, kind, mime, size, original_name)
		values ($1, $2, $3, $4, $5) returning id`, id, kind, mime, size, name).Scan(&m.ID); err != nil {
		s.oops(w, err)
		return
	}
	if err := os.Rename(tmp.Name(), filepath.Join(s.cfg.MediaDir, m.ID)); err != nil {
		s.db.Exec(ctx, `delete from media where id = $1`, m.ID)
		s.oops(w, err)
		return
	}
	m.Kind, m.Mime, m.Size, m.Name, m.URL = kind, mime, size, name, mediaURL(m.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"media": m})
}

func formatMB(n int64) string { return fmt.Sprintf("%d MB", n>>20) }

// deleteMedia takes an upload away, and with it every use of it: a picture's
// box stays on its slide, empty, for the presenter to fill or take off, and a
// vote sound goes back to the chime.
func (s *Server) deleteMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	ctx := r.Context()
	var presentation string
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `delete from media where id = $1 returning presentation_id`, id).Scan(&presentation); err != nil {
			return errNotFound
		}
		if _, err := tx.Exec(ctx, `update slides set elements = (
				select jsonb_agg(case when e->>'media' = $2 then e - 'media' else e end order by i)
				from jsonb_array_elements(elements) with ordinality as t(e, i))
			where presentation_id = $1 and elements @> jsonb_build_array(jsonb_build_object('media', $2::text))`,
			presentation, id); err != nil {
			return err
		}
		return touch(ctx, tx, presentation)
	})
	if err != nil {
		s.notFoundOr500(w, err, "filen")
		return
	}
	os.Remove(filepath.Join(s.cfg.MediaDir, id))
	s.publishIfLive(ctx, presentation)
	w.WriteHeader(http.StatusNoContent)
}

// media serves an upload. Ranges are answered, which is what lets a video
// start before it has all arrived and be jumped around in; and an id is never
// reused, so a browser may keep a file for as long as it likes.
func (s *Server) media(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	var mime string
	var created time.Time
	if err := s.db.QueryRow(r.Context(), `select mime, created_at from media where id = $1`, id).Scan(&mime, &created); err != nil {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(filepath.Join(s.cfg.MediaDir, id))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, "", created, f)
}
