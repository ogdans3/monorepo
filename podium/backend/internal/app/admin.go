package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/jackc/pgx/v5"
)

// idParam reads a uuid path parameter, or answers 404 itself: anything that
// is not a uuid is not one of ours, and Postgres would only say so in a 500.
func idParam(w http.ResponseWriter, r *http.Request, name string) (string, bool) {
	id := strings.ToLower(r.PathValue(name))
	if !uuidPattern.MatchString(id) {
		fail(w, http.StatusNotFound, "not_found", "Fant det ikke.")
		return "", false
	}
	return id, true
}

func (s *Server) notFoundOr500(w http.ResponseWriter, err error, what string) {
	if errors.Is(err, errNotFound) {
		fail(w, http.StatusNotFound, "not_found", "Fant ikke "+what+".")
		return
	}
	s.oops(w, err)
}

func (s *Server) oops(w http.ResponseWriter, err error) {
	s.log.Error("request failed", "err", err)
	fail(w, http.StatusInternalServerError, "server_error", "Noe gikk galt hos oss.")
}

func (s *Server) listPresentations(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), presentationColumns+` order by p.updated_at desc`)
	if err != nil {
		s.oops(w, err)
		return
	}
	defer rows.Close()
	out := []Presentation{}
	for rows.Next() {
		p, err := scanPresentation(rows)
		if err != nil {
			s.oops(w, err)
			return
		}
		out = append(out, p)
	}
	writeJSON(w, http.StatusOK, map[string]any{"presentations": out})
}

func (s *Server) createPresentation(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title string `json:"title"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		title = "Uten tittel"
	}
	if len(title) > 200 {
		fail(w, http.StatusBadRequest, "too_long", "Tittelen kan være høyst 200 tegn.")
		return
	}
	id, err := newPresentation(r.Context(), s.db, title)
	if err != nil {
		s.oops(w, err)
		return
	}
	s.writePresentation(w, r.Context(), id, http.StatusCreated)
}

// writePresentation answers with everything the editor shows: the
// presentation, every slide with its counts, and its uploads.
func (s *Server) writePresentation(w http.ResponseWriter, ctx context.Context, id string, status int) {
	p, err := presentationByID(ctx, s.db, id)
	if err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	if p.Slides, err = slides(ctx, s.db, id); err != nil {
		s.oops(w, err)
		return
	}
	if p.Media, err = mediaOf(ctx, s.db, id); err != nil {
		s.oops(w, err)
		return
	}
	writeJSON(w, status, map[string]any{"presentation": p, "phones": s.hub.Phones(id)})
}

func (s *Server) getPresentation(w http.ResponseWriter, r *http.Request) {
	if id, ok := idParam(w, r, "id"); ok {
		s.writePresentation(w, r.Context(), id, http.StatusOK)
	}
}

func (s *Server) updatePresentation(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		Title *string `json:"title"`
		// The sound to play for each vote; an empty string goes back to the
		// built-in chime.
		SoundMediaID *string `json:"soundMediaId"`
		// What marks the answers besides their colour.
		Marks *string `json:"marks"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	ctx := r.Context()
	if body.Title != nil {
		title := strings.TrimSpace(*body.Title)
		if len(title) > 200 {
			fail(w, http.StatusBadRequest, "too_long", "Tittelen kan være høyst 200 tegn.")
			return
		}
		if _, err := s.db.Exec(ctx, `update presentations set title = $2, updated_at = now() where id = $1`, id, title); err != nil {
			s.oops(w, err)
			return
		}
	}
	if body.Marks != nil {
		if *body.Marks != "letters" && *body.Marks != "numbers" {
			fail(w, http.StatusBadRequest, "bad_marks", "Svarene merkes med bokstaver eller tall.")
			return
		}
		if _, err := s.db.Exec(ctx, `update presentations set marks = $2, updated_at = now() where id = $1`, id, *body.Marks); err != nil {
			s.oops(w, err)
			return
		}
		s.publishState(ctx, id)
	}
	if body.SoundMediaID != nil {
		var sound *string
		if *body.SoundMediaID != "" {
			var kind string
			err := s.db.QueryRow(ctx, `select kind from media where id = $1 and presentation_id = $2`,
				*body.SoundMediaID, id).Scan(&kind)
			if err != nil || kind != "audio" {
				fail(w, http.StatusBadRequest, "not_a_sound", "Det er ikke en lyd i denne presentasjonen.")
				return
			}
			sound = body.SoundMediaID
		}
		if _, err := s.db.Exec(ctx, `update presentations set sound_media_id = $2, updated_at = now() where id = $1`, id, sound); err != nil {
			s.oops(w, err)
			return
		}
		s.publishState(ctx, id)
	}
	s.writePresentation(w, ctx, id, http.StatusOK)
}

func (s *Server) deletePresentation(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	ctx := r.Context()
	media, err := mediaOf(ctx, s.db, id)
	if err != nil {
		s.oops(w, err)
		return
	}
	tag, err := s.db.Exec(ctx, `delete from presentations where id = $1`, id)
	if err != nil {
		s.oops(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "not_found", "Fant ikke presentasjonen.")
		return
	}
	// The rows went with the presentation, and the files go after them: a file
	// left behind is only space, a row left behind would be a broken picture.
	for _, m := range media {
		os.Remove(filepath.Join(s.cfg.MediaDir, m.ID))
	}
	s.hub.Publish(id, "state", liveState{ID: id, Ended: true})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) createSlide(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		// The slide to put it after; at the end when empty.
		After string `json:"after"`
		Kind  string `json:"kind"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	ctx := r.Context()
	var slide string
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if _, err := presentationByID(ctx, tx, id); err != nil {
			return err
		}
		position := 0
		if body.After != "" {
			if err := tx.QueryRow(ctx, `select position + 1 from slides where id = $1 and presentation_id = $2`,
				body.After, id).Scan(&position); err != nil {
				return errNotFound
			}
		} else if err := tx.QueryRow(ctx, `select coalesce(max(position) + 1, 0) from slides where presentation_id = $1`,
			id).Scan(&position); err != nil {
			return err
		}
		var err error
		kind := body.Kind
		if kind != "question" {
			kind = "content"
		}
		slide, err = insertSlide(ctx, tx, id, position, kind, "")
		if err != nil {
			return err
		}
		return touch(ctx, tx, id)
	})
	if err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	s.publishIfLive(ctx, id)
	writeJSON(w, http.StatusCreated, map[string]string{"id": slide})
}

// saveSlide writes a slide as the editor has it: its title and background,
// everything on it, and its answers. Answers keep their ids, and their votes,
// for as long as they stay on the slide; an answer taken off takes its votes.
func (s *Server) saveSlide(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		Title      string    `json:"title"`
		Background string    `json:"background"`
		Elements   []Element `json:"elements"`
		Options    []Option  `json:"options"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if len(body.Title) > 300 {
		fail(w, http.StatusBadRequest, "too_long", "Spørsmålet kan være høyst 300 tegn.")
		return
	}
	if !hexColour.MatchString(body.Background) {
		body.Background = "#111418"
	}
	if len(body.Options) > 40 {
		fail(w, http.StatusBadRequest, "too_many", "Et spørsmål kan ha høyst 40 svar.")
		return
	}
	ctx := r.Context()
	var presentation string
	var invalid error
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `select presentation_id from slides where id = $1 for update`, id).Scan(&presentation); err != nil {
			return errNotFound
		}
		elements, err := cleanElements(ctx, tx, presentation, body.Elements)
		if err != nil {
			invalid = err
			return err
		}
		raw, _ := json.Marshal(elements)
		if _, err := tx.Exec(ctx, `update slides set title = $2, background = $3, elements = $4 where id = $1`,
			id, strings.TrimSpace(body.Title), strings.ToUpper(body.Background), raw); err != nil {
			return err
		}
		keep := []string{}
		for _, o := range body.Options {
			if uuidPattern.MatchString(o.ID) {
				keep = append(keep, o.ID)
			}
		}
		if _, err := tx.Exec(ctx, `delete from options where slide_id = $1 and not (id = any($2::uuid[]))`, id, keep); err != nil {
			return err
		}
		for i, o := range body.Options {
			label := strings.TrimSpace(o.Label)
			if len(label) > 200 {
				invalid = errors.New("Et svar kan være høyst 200 tegn.")
				return invalid
			}
			x, y, w, h := clampBox(o.X, o.Y, o.W, o.H)
			// A colour that is not one is the next of the answers' own.
			color := strings.ToUpper(o.Color)
			if !hexColour.MatchString(color) {
				color = answerColour(i)
			}
			// An answer the editor has just made has no id of ours yet, and
			// asking Postgres about one that is not a uuid would end the
			// transaction, not answer the question.
			updated := false
			if uuidPattern.MatchString(o.ID) {
				tag, err := tx.Exec(ctx, `update options set position = $3, label = $4, color = $5, x = $6, y = $7, w = $8, h = $9
					where id = $1 and slide_id = $2`, o.ID, id, i, label, color, x, y, w, h)
				if err != nil {
					return err
				}
				updated = tag.RowsAffected() > 0
			}
			if !updated {
				if _, err := tx.Exec(ctx, `insert into options (slide_id, position, label, color, x, y, w, h)
					values ($1, $2, $3, $4, $5, $6, $7, $8)`, id, i, label, color, x, y, w, h); err != nil {
					return err
				}
			}
		}
		return touch(ctx, tx, presentation)
	})
	if invalid != nil {
		fail(w, http.StatusBadRequest, "invalid_slide", invalid.Error())
		return
	}
	if err != nil {
		s.notFoundOr500(w, err, "siden")
		return
	}
	saved, _, err := slideByID(ctx, s.db, id)
	if err != nil {
		s.oops(w, err)
		return
	}
	s.publishIfLive(ctx, presentation)
	writeJSON(w, http.StatusOK, map[string]any{"slide": saved})
}

func (s *Server) deleteSlide(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	ctx := r.Context()
	var presentation string
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var position int
		if err := tx.QueryRow(ctx, `delete from slides where id = $1 returning presentation_id, position`, id).
			Scan(&presentation, &position); err != nil {
			return errNotFound
		}
		if _, err := tx.Exec(ctx, `update slides set position = position - 1
			where presentation_id = $1 and position > $2`, presentation, position); err != nil {
			return err
		}
		return touch(ctx, tx, presentation)
	})
	if err != nil {
		s.notFoundOr500(w, err, "siden")
		return
	}
	s.publishIfLive(ctx, presentation)
	w.WriteHeader(http.StatusNoContent)
}

// duplicateSlide copies a slide and its answers, without their votes, to
// right after it.
func (s *Server) duplicateSlide(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	ctx := r.Context()
	var presentation, copy string
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var position int
		if err := tx.QueryRow(ctx, `select presentation_id, position from slides where id = $1`, id).
			Scan(&presentation, &position); err != nil {
			return errNotFound
		}
		if _, err := tx.Exec(ctx, `update slides set position = position + 1
			where presentation_id = $1 and position > $2`, presentation, position); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `insert into slides (presentation_id, position, title, background, elements)
			select presentation_id, position + 1, title, background, elements from slides where id = $1
			returning id`, id).Scan(&copy); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `insert into options (slide_id, position, label, color, x, y, w, h)
			select $2, position, label, color, x, y, w, h from options where slide_id = $1`, id, copy); err != nil {
			return err
		}
		return touch(ctx, tx, presentation)
	})
	if err != nil {
		s.notFoundOr500(w, err, "siden")
		return
	}
	s.publishIfLive(ctx, presentation)
	writeJSON(w, http.StatusCreated, map[string]string{"id": copy})
}

func (s *Server) reorderSlides(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		SlideIDs []string `json:"slideIds"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	ctx := r.Context()
	var mismatch bool
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var n int
		if err := tx.QueryRow(ctx, `select count(*) from slides where presentation_id = $1`, id).Scan(&n); err != nil {
			return err
		}
		if n != len(body.SlideIDs) {
			mismatch = true
			return errors.New("mismatch")
		}
		// Out of the way first: position is not unique, but a half-moved order
		// read by somebody else would be nonsense either way.
		for i, slide := range body.SlideIDs {
			tag, err := tx.Exec(ctx, `update slides set position = $3 where id = $1 and presentation_id = $2`, slide, id, i)
			if err != nil || tag.RowsAffected() == 0 {
				mismatch = true
				return errors.New("mismatch")
			}
		}
		return touch(ctx, tx, id)
	})
	if mismatch {
		fail(w, http.StatusBadRequest, "wrong_slides", "Rekkefølgen må ha med hver side i presentasjonen, én gang.")
		return
	}
	if err != nil {
		s.oops(w, err)
		return
	}
	s.publishIfLive(ctx, id)
	s.writePresentation(w, ctx, id, http.StatusOK)
}

// resetVotes takes every vote off a question, so it can be asked again.
func (s *Server) resetVotes(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	ctx := r.Context()
	var presentation string
	if err := s.db.QueryRow(ctx, `select presentation_id from slides where id = $1`, id).Scan(&presentation); err != nil {
		fail(w, http.StatusNotFound, "not_found", "Fant ikke siden.")
		return
	}
	if _, err := s.db.Exec(ctx, `delete from votes where slide_id = $1`, id); err != nil {
		s.oops(w, err)
		return
	}
	s.publishIfLive(ctx, presentation)
	w.WriteHeader(http.StatusNoContent)
}
