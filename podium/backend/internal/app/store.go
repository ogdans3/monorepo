package app

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Element is one thing placed on a slide: text, a picture, a video or the QR
// code that takes a phone to the ballot. Place and size are percent of the
// 16:9 stage, so a slide is the same slide on any screen.
type Element struct {
	ID   string  `json:"id"`
	Type string  `json:"type"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	W    float64 `json:"w"`
	H    float64 `json:"h"`
	// Text, and its size in percent of the stage's height.
	Text   string  `json:"text,omitempty"`
	Size   float64 `json:"size,omitempty"`
	Weight int     `json:"weight,omitempty"`
	Align  string  `json:"align,omitempty"`
	Color  string  `json:"color,omitempty"`
	// A picture's or a video's upload, and how it fills its box.
	Media    string `json:"media,omitempty"`
	Fit      string `json:"fit,omitempty"`
	Autoplay bool   `json:"autoplay,omitempty"`
	Loop     bool   `json:"loop,omitempty"`
	Muted    bool   `json:"muted,omitempty"`
}

// Option is an answer on a question slide, placed by the presenter like any
// element, and counted.
type Option struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	W     float64 `json:"w"`
	H     float64 `json:"h"`
	Count int     `json:"count"`
}

type Slide struct {
	ID         string    `json:"id"`
	Position   int       `json:"position"`
	Title      string    `json:"title"`
	Background string    `json:"background"`
	Elements   []Element `json:"elements"`
	Options    []Option  `json:"options"`
	// Total is the number of votes on the slide, every option together.
	Total int `json:"total"`
}

type Media struct {
	ID   string `json:"id"`
	Kind string `json:"kind"`
	Mime string `json:"mime"`
	Size int64  `json:"size"`
	Name string `json:"name"`
	URL  string `json:"url"`
}

type Presentation struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Code         string    `json:"code"`
	LiveSlideID  *string   `json:"liveSlideId"`
	SoundMediaID *string   `json:"soundMediaId"`
	UpdatedAt    time.Time `json:"updatedAt"`
	SlideCount   int       `json:"slideCount"`
	Slides       []Slide   `json:"slides,omitempty"`
	Media        []Media   `json:"media,omitempty"`
}

var (
	errNotFound = errors.New("not found")
	uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	hexColour   = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

// codeAlphabet leaves out what reads as two things on a projector at the
// back of a room: 0 and O, 1, I and L.
const codeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

func newCode() string {
	var b strings.Builder
	for range 5 {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(codeAlphabet))))
		b.WriteByte(codeAlphabet[n.Int64()])
	}
	return b.String()
}

func isUniqueViolation(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}

func mediaURL(id string) string { return "/media/" + id }

type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// slides loads a presentation's slides in order, with every option and its
// count, in three queries however many slides there are.
func slides(ctx context.Context, q querier, presentation string) ([]Slide, error) {
	rows, err := q.Query(ctx, `select id, position, title, background, elements
		from slides where presentation_id = $1 order by position`, presentation)
	if err != nil {
		return nil, err
	}
	out := []Slide{}
	index := map[string]int{}
	for rows.Next() {
		var s Slide
		var raw []byte
		if err := rows.Scan(&s.ID, &s.Position, &s.Title, &s.Background, &raw); err != nil {
			rows.Close()
			return nil, err
		}
		if err := json.Unmarshal(raw, &s.Elements); err != nil {
			rows.Close()
			return nil, fmt.Errorf("slide %s: %w", s.ID, err)
		}
		s.Options = []Option{}
		index[s.ID] = len(out)
		out = append(out, s)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = q.Query(ctx, `select o.slide_id, o.id, o.label, o.x, o.y, o.w, o.h,
			(select count(*) from votes v where v.option_id = o.id)
		from options o join slides s on s.id = o.slide_id
		where s.presentation_id = $1 order by o.slide_id, o.position`, presentation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var slide string
		var o Option
		if err := rows.Scan(&slide, &o.ID, &o.Label, &o.X, &o.Y, &o.W, &o.H, &o.Count); err != nil {
			return nil, err
		}
		i := index[slide]
		out[i].Options = append(out[i].Options, o)
		out[i].Total += o.Count
	}
	return out, rows.Err()
}

// slideByID loads one slide the way [slides] does, and which presentation it
// is in.
func slideByID(ctx context.Context, q querier, id string) (Slide, string, error) {
	var presentation string
	if err := q.QueryRow(ctx, `select presentation_id from slides where id = $1`, id).Scan(&presentation); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Slide{}, "", errNotFound
		}
		return Slide{}, "", err
	}
	all, err := slides(ctx, q, presentation)
	if err != nil {
		return Slide{}, "", err
	}
	for _, s := range all {
		if s.ID == id {
			return s, presentation, nil
		}
	}
	return Slide{}, "", errNotFound
}

func presentationByID(ctx context.Context, q querier, id string) (Presentation, error) {
	return scanPresentation(q.QueryRow(ctx, presentationColumns+` where p.id = $1`, id))
}

func presentationByCode(ctx context.Context, q querier, code string) (Presentation, error) {
	return scanPresentation(q.QueryRow(ctx, presentationColumns+` where p.code = $1`, strings.ToUpper(code)))
}

const presentationColumns = `select p.id, p.title, p.code, p.live_slide_id, p.sound_media_id, p.updated_at,
	(select count(*) from slides s where s.presentation_id = p.id) from presentations p`

func scanPresentation(row pgx.Row) (Presentation, error) {
	var p Presentation
	err := row.Scan(&p.ID, &p.Title, &p.Code, &p.LiveSlideID, &p.SoundMediaID, &p.UpdatedAt, &p.SlideCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, errNotFound
	}
	return p, err
}

func mediaOf(ctx context.Context, q querier, presentation string) ([]Media, error) {
	rows, err := q.Query(ctx, `select id, kind, mime, size, original_name from media
		where presentation_id = $1 order by created_at`, presentation)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Media{}
	for rows.Next() {
		var m Media
		if err := rows.Scan(&m.ID, &m.Kind, &m.Mime, &m.Size, &m.Name); err != nil {
			return nil, err
		}
		m.URL = mediaURL(m.ID)
		out = append(out, m)
	}
	return out, rows.Err()
}

func touch(ctx context.Context, q querier, presentation string) error {
	_, err := q.Exec(ctx, `update presentations set updated_at = now() where id = $1`, presentation)
	return err
}

// counts is what a vote changes: every option's count on the slide, and the
// total.
func counts(ctx context.Context, q querier, slide string) (map[string]int, int, error) {
	rows, err := q.Query(ctx, `select o.id, count(v.id) from options o
		left join votes v on v.option_id = o.id where o.slide_id = $1 group by o.id`, slide)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := map[string]int{}
	total := 0
	for rows.Next() {
		var id string
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, 0, err
		}
		out[id] = n
		total += n
	}
	return out, total, rows.Err()
}

// clampBox keeps a box on the stage and at least a sliver big, whatever the
// editor sent.
func clampBox(x, y, w, h float64) (float64, float64, float64, float64) {
	clamp := func(v, lo, hi float64) float64 { return max(lo, min(hi, v)) }
	x, y = clamp(x, 0, 99), clamp(y, 0, 99)
	w, h = clamp(w, 1, 100-x), clamp(h, 1, 100-y)
	return x, y, w, h
}

// cleanElements is the one gate between the editor and the database: known
// types only, every box on the stage, sizes and colours that render, and
// pictures and videos that are this presentation's own uploads.
func cleanElements(ctx context.Context, q querier, presentation string, in []Element) ([]Element, error) {
	if len(in) > 200 {
		return nil, errors.New("En side kan ha høyst 200 ting på seg.")
	}
	kinds := map[string]string{}
	if media, err := mediaOf(ctx, q, presentation); err == nil {
		for _, m := range media {
			kinds[m.ID] = m.Kind
		}
	} else {
		return nil, err
	}
	out := make([]Element, 0, len(in))
	for _, e := range in {
		c := Element{ID: e.ID, Type: e.Type}
		if c.ID == "" || len(c.ID) > 64 {
			return nil, errors.New("Hver ting på siden må ha en id.")
		}
		c.X, c.Y, c.W, c.H = clampBox(e.X, e.Y, e.W, e.H)
		switch e.Type {
		case "text":
			if len(e.Text) > 5000 {
				return nil, errors.New("En tekst kan være høyst 5000 tegn.")
			}
			c.Text = e.Text
			c.Size = max(1, min(40, e.Size))
			if e.Size == 0 {
				c.Size = 6
			}
			c.Weight = 400
			if e.Weight >= 600 {
				c.Weight = 700
			}
			c.Align = "left"
			if e.Align == "center" || e.Align == "right" {
				c.Align = e.Align
			}
			c.Color = ""
			if hexColour.MatchString(e.Color) {
				c.Color = strings.ToUpper(e.Color)
			}
		case "image", "video":
			if e.Media != "" && kinds[e.Media] != e.Type {
				return nil, errors.New("Bildet eller videoen finnes ikke i denne presentasjonen.")
			}
			c.Media = e.Media
			c.Fit = "contain"
			if e.Fit == "cover" {
				c.Fit = "cover"
			}
			if e.Type == "video" {
				c.Autoplay, c.Loop, c.Muted = e.Autoplay, e.Loop, e.Muted
			}
		case "qr":
			c.Color = ""
			if hexColour.MatchString(e.Color) {
				c.Color = strings.ToUpper(e.Color)
			}
		default:
			return nil, fmt.Errorf("Ukjent type på siden: %q.", e.Type)
		}
		out = append(out, c)
	}
	return out, nil
}

// newPresentation makes a presentation with one slide to start from, under a
// code nobody else has.
func newPresentation(ctx context.Context, db *pgxpool.Pool, title string) (string, error) {
	for range 8 {
		var id string
		err := pgx.BeginFunc(ctx, db, func(tx pgx.Tx) error {
			if err := tx.QueryRow(ctx, `insert into presentations (title, code) values ($1, $2) returning id`,
				title, newCode()).Scan(&id); err != nil {
				return err
			}
			_, err := insertSlide(ctx, tx, id, 0, "content")
			return err
		})
		if isUniqueViolation(err) {
			continue
		}
		return id, err
	}
	return "", errors.New("no free code after eight tries")
}

// insertSlide puts a new slide at [position], with something on it to start
// from: a heading on a content slide, and on a question slide the question,
// two answers and the QR code, already placed.
func insertSlide(ctx context.Context, q querier, presentation string, position int, kind string) (string, error) {
	if _, err := q.Exec(ctx, `update slides set position = position + 1
		where presentation_id = $1 and position >= $2`, presentation, position); err != nil {
		return "", err
	}
	var elements []Element
	title := ""
	switch kind {
	case "question":
		title = "Hva tror du?"
		elements = []Element{
			{ID: "q-title", Type: "text", X: 6, Y: 8, W: 64, H: 24, Text: title, Size: 8, Weight: 700, Align: "left"},
			{ID: "q-code", Type: "qr", X: 77, Y: 8, W: 17, H: 44},
		}
	default:
		elements = []Element{
			{ID: "heading", Type: "text", X: 8, Y: 38, W: 84, H: 24, Text: "Overskrift", Size: 10, Weight: 700, Align: "left"},
		}
	}
	raw, _ := json.Marshal(elements)
	var id string
	if err := q.QueryRow(ctx, `insert into slides (presentation_id, position, title, elements)
		values ($1, $2, $3, $4) returning id`, presentation, position, title, raw).Scan(&id); err != nil {
		return "", err
	}
	if kind == "question" {
		for i, label := range []string{"Ja", "Nei"} {
			if _, err := q.Exec(ctx, `insert into options (slide_id, position, label, x, y, w, h)
				values ($1, $2, $3, $4, 42, 32, 44)`, id, i, label, 6+float64(i)*35); err != nil {
				return "", err
			}
		}
	}
	return id, nil
}
