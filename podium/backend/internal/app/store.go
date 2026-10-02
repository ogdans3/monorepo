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
// element, and counted. Its colour is its tile's on the phones and its
// mark's on the slide.
type Option struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Color string  `json:"color"`
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
	ID    string `json:"id"`
	Title string `json:"title"`
	Code  string `json:"code"`
	// What marks the answers besides their colour: «letters» or «numbers».
	Marks        string    `json:"marks"`
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

// answerColours are the answers' colours, in order: white reads on each of
// them (4.5:1 or more), each reads on the ink and on the paper slide (3:1),
// they are far enough apart to tell, and none of them is the amber, which on
// the display means a count that has just moved.
var answerColours = []string{"#D0273A", "#2A68CF", "#1D8452", "#7448C8", "#0C7F8E", "#BB2F82", "#8E5A35", "#56677D"}

func answerColour(i int) string { return answerColours[i%len(answerColours)] }

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

	rows, err = q.Query(ctx, `select o.slide_id, o.id, o.label, o.color, o.x, o.y, o.w, o.h,
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
		if err := rows.Scan(&slide, &o.ID, &o.Label, &o.Color, &o.X, &o.Y, &o.W, &o.H, &o.Count); err != nil {
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

const presentationColumns = `select p.id, p.title, p.code, p.marks, p.live_slide_id, p.sound_media_id, p.updated_at,
	(select count(*) from slides s where s.presentation_id = p.id) from presentations p`

func scanPresentation(row pgx.Row) (Presentation, error) {
	var p Presentation
	err := row.Scan(&p.ID, &p.Title, &p.Code, &p.Marks, &p.LiveSlideID, &p.SoundMediaID, &p.UpdatedAt, &p.SlideCount)
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

// newPresentation makes a presentation under a code nobody else has, opening
// with the way in: a slide with its title and the code to scan, big.
func newPresentation(ctx context.Context, db *pgxpool.Pool, title string) (string, error) {
	for range 8 {
		var id string
		err := pgx.BeginFunc(ctx, db, func(tx pgx.Tx) error {
			if err := tx.QueryRow(ctx, `insert into presentations (title, code) values ($1, $2) returning id`,
				title, newCode()).Scan(&id); err != nil {
				return err
			}
			_, err := insertSlide(ctx, tx, id, 0, "join", title)
			return err
		})
		if isUniqueViolation(err) {
			continue
		}
		return id, err
	}
	return "", errors.New("no free code after eight tries")
}

// cornerCode is the small QR code every new slide carries in its top right
// corner, the same code on all of them, for whoever came in late. The
// presenter can take it off a slide like anything else.
var cornerCode = Element{ID: "corner-code", Type: "qr", X: 87.5, Y: 5.556, W: 9.375, H: 22.222}

// insertSlide puts a new slide at [position], with something on it to start
// from: the way in (the title, and the code big), a heading, or a question
// with two answers; and on the last two, the code small in the corner.
func insertSlide(ctx context.Context, q querier, presentation string, position int, kind, name string) (string, error) {
	if _, err := q.Exec(ctx, `update slides set position = position + 1
		where presentation_id = $1 and position >= $2`, presentation, position); err != nil {
		return "", err
	}
	var elements []Element
	title := ""
	switch kind {
	case "join":
		elements = []Element{
			{ID: "join-title", Type: "text", X: 6.25, Y: 27.778, W: 56.25, H: 33.333, Text: name, Size: 11, Weight: 700, Align: "left"},
			{ID: "join-text", Type: "text", X: 6.25, Y: 66.667, W: 50, H: 11.111, Text: "Skann koden og stem underveis.", Size: 4, Weight: 400, Align: "left"},
			{ID: "join-code", Type: "qr", X: 68.75, Y: 16.667, W: 25, H: 66.667},
		}
	case "question":
		title = "Hva tror du?"
		elements = []Element{
			{ID: "q-title", Type: "text", X: 6.25, Y: 8.333, W: 75, H: 22.222, Text: title, Size: 8, Weight: 700, Align: "left"},
			cornerCode,
		}
	default:
		elements = []Element{
			{ID: "heading", Type: "text", X: 6.25, Y: 38.889, W: 75, H: 22.222, Text: "Overskrift", Size: 10, Weight: 700, Align: "left"},
			cornerCode,
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
			if _, err := q.Exec(ctx, `insert into options (slide_id, position, label, color, x, y, w, h)
				values ($1, $2, $3, $4, $5, 38.889, 42.188, 50)`, id, i, label, answerColour(i), 6.25+float64(i)*45.313); err != nil {
				return "", err
			}
		}
	}
	return id, nil
}
