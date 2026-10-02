package app

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
)

// liveState is what the display shows and the ballot reads: the slide on
// screen, with its counts, or none.
type liveState struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Code  string `json:"code"`
	// The uploaded vote sound, or empty for the built-in chime.
	Sound string `json:"sound"`
	Slide *Slide `json:"slide"`
	// Where the slide is in the presentation, from 1, and how many there are.
	Index int `json:"index"`
	Count int `json:"count"`
	// The presentation is gone: whoever is watching it can stop.
	Ended bool `json:"ended,omitempty"`
}

// voteEvent is what a vote changes, for the display to count and sound.
type voteEvent struct {
	SlideID  string         `json:"slideId"`
	OptionID string         `json:"optionId"`
	Counts   map[string]int `json:"counts"`
	Total    int            `json:"total"`
}

func (s *Server) stateOf(ctx context.Context, p Presentation) (liveState, error) {
	st := liveState{ID: p.ID, Title: p.Title, Code: p.Code, Count: p.SlideCount}
	if p.SoundMediaID != nil {
		st.Sound = mediaURL(*p.SoundMediaID)
	}
	if p.LiveSlideID == nil {
		return st, nil
	}
	slide, _, err := slideByID(ctx, s.db, *p.LiveSlideID)
	if errors.Is(err, errNotFound) {
		return st, nil
	}
	if err != nil {
		return st, err
	}
	st.Slide = &slide
	st.Index = slide.Position + 1
	return st, nil
}

// publishState tells everyone watching what is on screen now.
func (s *Server) publishState(ctx context.Context, presentation string) {
	p, err := presentationByID(ctx, s.db, presentation)
	if err != nil {
		return
	}
	st, err := s.stateOf(ctx, p)
	if err != nil {
		s.log.Error("live state", "err", err)
		return
	}
	s.hub.Publish(presentation, "state", st)
}

// publishIfLive is for an edit: only a presentation somebody is watching, or
// was a moment ago, has anyone to tell, and an edit to its live slide shows on
// the projector as it is made.
func (s *Server) publishIfLive(ctx context.Context, presentation string) {
	if s.hub.Active(presentation) {
		s.publishState(ctx, presentation)
	}
}

// goLive puts a slide on screen: a given one, or the next or the one before
// the slide that is on screen now. Starting is putting the first one up.
func (s *Server) goLive(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		SlideID string `json:"slideId"`
		Step    int    `json:"step"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	ctx := r.Context()
	p, err := presentationByID(ctx, s.db, id)
	if err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	target := body.SlideID
	if target == "" {
		position := 0
		if p.LiveSlideID != nil && body.Step != 0 {
			var current int
			if err := s.db.QueryRow(ctx, `select position from slides where id = $1`, *p.LiveSlideID).Scan(&current); err == nil {
				position = max(0, min(p.SlideCount-1, current+body.Step))
			}
		}
		if err := s.db.QueryRow(ctx, `select id from slides where presentation_id = $1 and position = $2`,
			id, position).Scan(&target); err != nil {
			fail(w, http.StatusConflict, "no_slides", "Presentasjonen har ingen sider.")
			return
		}
	} else if !uuidPattern.MatchString(target) {
		fail(w, http.StatusNotFound, "not_found", "Fant ikke siden.")
		return
	}
	tag, err := s.db.Exec(ctx, `update presentations set live_slide_id = $2 where id = $1
		and exists (select 1 from slides where id = $2 and presentation_id = $1)`, id, target)
	if err != nil {
		s.oops(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "not_found", "Fant ikke siden.")
		return
	}
	s.publishState(ctx, id)
	s.writeLive(w, ctx, id)
}

func (s *Server) stopLive(w http.ResponseWriter, r *http.Request) {
	id, ok := idParam(w, r, "id")
	if !ok {
		return
	}
	ctx := r.Context()
	if _, err := s.db.Exec(ctx, `update presentations set live_slide_id = null where id = $1`, id); err != nil {
		s.oops(w, err)
		return
	}
	s.publishState(ctx, id)
	s.writeLive(w, ctx, id)
}

func (s *Server) writeLive(w http.ResponseWriter, ctx context.Context, id string) {
	p, err := presentationByID(ctx, s.db, id)
	if err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	st, err := s.stateOf(ctx, p)
	if err != nil {
		s.oops(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

// live is the display's first look; the stream keeps it current after.
func (s *Server) live(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := presentationByCode(ctx, s.db, r.PathValue("code"))
	if err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	s.writeLive(w, ctx, p.ID)
}

// events streams a presentation as it happens: the slide on screen whenever
// it changes, every vote, and how many phones are on the ballot. Server-sent
// events, so a dropped connection comes back by itself. A screen coming back
// in time is sent what it missed (see [Hub]); anyone else starts from where
// things stand. A phone's ballot asks with ?ballot, and is sent the slide
// changes only.
func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p, err := presentationByCode(ctx, s.db, r.PathValue("code"))
	if err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		fail(w, http.StatusInternalServerError, "no_stream", "Kan ikke strømme herfra.")
		return
	}
	_, phone := r.URL.Query()["ballot"]
	joined := s.hub.Subscribe(p.ID, phone, r.Header.Get("Last-Event-ID"))
	defer joined.Stop()

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-store")
	// Nginx and its kind hold a response back to buffer it; a vote cannot wait.
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	// Back quickly: the proxy in front of a deployment ends any response
	// after two minutes, so a stream ends often, and on purpose.
	w.Write([]byte("retry: 500\n\n"))
	if joined.Resumed {
		for _, frame := range joined.Missed {
			w.Write(frame)
		}
	} else {
		st, err := s.stateOf(ctx, p)
		if err != nil {
			return
		}
		w.Write(sseFrame(joined.LastID, "state", st))
		if !phone {
			w.Write(sseFrame("", "room", map[string]int{"phones": s.hub.Phones(p.ID)}))
		}
	}
	flusher.Flush()

	// A proxy that hears nothing for a while closes the connection, and a
	// connection that has died does not always say so; so the stream says
	// something every 20 seconds, as an event the page can see, and a page
	// that hears nothing for much longer than that starts again.
	ping := time.NewTicker(20 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case frame := <-joined.Frames:
			if _, err := w.Write(frame); err != nil {
				return
			}
			flusher.Flush()
		case <-ping.C:
			if _, err := w.Write([]byte("event: ping\ndata: {}\n\n")); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

// ballotQuestion is what a phone sees: the question on screen and its
// answers, and nothing of the slide's own design.
type ballotQuestion struct {
	SlideID string         `json:"slideId"`
	Title   string         `json:"title"`
	Options []ballotOption `json:"options"`
}

type ballotOption struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// ballot is the phone page's state: the question on screen, if there is one,
// and the answer this phone gave it, if it has.
func (s *Server) ballot(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	me := voter(w, r)
	p, err := presentationByCode(ctx, s.db, r.PathValue("code"))
	if err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	out := map[string]any{"title": p.Title, "code": p.Code, "live": p.LiveSlideID != nil, "question": nil, "voted": nil}
	if p.LiveSlideID != nil {
		slide, _, err := slideByID(ctx, s.db, *p.LiveSlideID)
		if err == nil && len(slide.Options) > 0 {
			q := ballotQuestion{SlideID: slide.ID, Title: slide.Title, Options: []ballotOption{}}
			for _, o := range slide.Options {
				q.Options = append(q.Options, ballotOption{ID: o.ID, Label: o.Label})
			}
			out["question"] = q
			var voted string
			if err := s.db.QueryRow(ctx, `select option_id from votes where slide_id = $1 and voter = $2`,
				slide.ID, me).Scan(&voted); err == nil {
				out["voted"] = voted
			}
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// vote counts a phone's answer to the question on screen. Only that
// question: an answer to one that has gone is refused, and a second answer
// from the same phone too.
func (s *Server) vote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	me := voter(w, r)
	var body struct {
		OptionID string `json:"optionId"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	p, err := presentationByCode(ctx, s.db, r.PathValue("code"))
	if err != nil {
		s.notFoundOr500(w, err, "presentasjonen")
		return
	}
	if p.LiveSlideID == nil || !uuidPattern.MatchString(body.OptionID) {
		fail(w, http.StatusConflict, "not_open", "Det spørsmålet er ikke oppe lenger.")
		return
	}
	slide := *p.LiveSlideID
	var inserted bool
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var ok bool
		if err := tx.QueryRow(ctx, `select exists (select 1 from options where id = $1 and slide_id = $2)`,
			body.OptionID, slide).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return errNotFound
		}
		tag, err := tx.Exec(ctx, `insert into votes (slide_id, option_id, voter) values ($1, $2, $3)
			on conflict (slide_id, voter) do nothing`, slide, body.OptionID, me)
		inserted = tag.RowsAffected() == 1
		return err
	})
	if errors.Is(err, errNotFound) {
		fail(w, http.StatusConflict, "not_open", "Det spørsmålet er ikke oppe lenger.")
		return
	}
	if err != nil {
		s.oops(w, err)
		return
	}
	if !inserted {
		fail(w, http.StatusConflict, "already_voted", "Du har allerede stemt på dette spørsmålet.")
		return
	}
	all, total, err := counts(ctx, s.db, slide)
	if err != nil {
		s.oops(w, err)
		return
	}
	s.hub.Publish(p.ID, "vote", voteEvent{SlideID: slide, OptionID: body.OptionID, Counts: all, Total: total})
	writeJSON(w, http.StatusOK, map[string]string{"voted": body.OptionID})
}
