package app

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Hub hands what happens to a presentation to everyone watching it: the
// display on the projector, the admin's own view, and the phones on the
// ballot. One process, so one map; a second server would need Postgres
// LISTEN/NOTIFY between them, and there is no second server.
//
// Every frame is numbered, and a room keeps its last frames for a while. A
// stream is not forever: a proxy in front may end any response after a few
// minutes, a projector's Wi-Fi drops. A screen that comes back says the
// number it heard last and is sent what it missed, so a vote that landed in
// the gap is still counted out loud, instead of the count jumping in silence.
type Hub struct {
	mu    sync.Mutex
	rooms map[string]*room
	// Numbers from an earlier process mean nothing to this one.
	epoch string
}

const (
	// How many frames a room remembers for a screen that reconnects.
	keepFrames = 256
	// How long a room nobody is watching is kept, for whoever was watching
	// a moment ago to come back to.
	roomLinger = 45 * time.Second
)

type room struct {
	// Every watcher, and whether it is a phone. A phone's ballot only needs
	// to know what is on screen; the votes, and how many phones there are,
	// are for the display and the admin.
	subs   map[chan []byte]bool
	phones int
	// A change in the number of phones waiting to be told, so that a room
	// scanning the code at once is one message and not a hundred.
	telling bool
	seq     uint64
	recent  []numbered
	// When the last watcher left, or zero while there is one.
	emptySince time.Time
}

type numbered struct {
	seq   uint64
	frame []byte
}

func NewHub() *Hub {
	return &Hub{rooms: map[string]*room{}, epoch: strconv.FormatInt(time.Now().UnixNano(), 36)}
}

// Joined is a new watcher: its frames, what it missed if it came back in
// time to be told, and the function that stops it.
type Joined struct {
	Frames <-chan []byte
	// The frames since the one the watcher heard last; empty when [Resumed]
	// is false, or when it missed nothing.
	Missed [][]byte
	// The watcher's place in the stream was found, so it needs no fresh start.
	Resumed bool
	// The number of the last frame before this watcher joined, for a fresh
	// start to carry, so that its next return can resume from there.
	LastID string
	Stop   func()
}

// Subscribe joins a presentation's stream. [lastID] is the Last-Event-ID a
// returning screen sends; phones always start fresh, since a phone asks for
// the ballot again whatever it is told.
func (h *Hub) Subscribe(presentation string, phone bool, lastID string) Joined {
	ch := make(chan []byte, 64)
	h.mu.Lock()
	defer h.mu.Unlock()
	r := h.rooms[presentation]
	if r == nil {
		r = &room{subs: map[chan []byte]bool{}}
		h.rooms[presentation] = r
	}
	r.subs[ch] = phone
	r.emptySince = time.Time{}
	if phone {
		r.phones++
		h.phonesChanged(presentation, r)
	}
	j := Joined{Frames: ch, LastID: h.id(r.seq)}
	if seq, ok := h.parseID(lastID); ok && !phone && seq <= r.seq {
		// Resumable if nothing between that frame and now has been forgotten.
		if seq == r.seq || (len(r.recent) > 0 && r.recent[0].seq <= seq+1) {
			j.Resumed = true
			for _, n := range r.recent {
				if n.seq > seq {
					j.Missed = append(j.Missed, n.frame)
				}
			}
		}
	}
	j.Stop = func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		delete(r.subs, ch)
		if phone {
			r.phones--
			h.phonesChanged(presentation, r)
		}
		if len(r.subs) == 0 {
			r.emptySince = time.Now()
			time.AfterFunc(roomLinger, func() { h.forget(presentation, r) })
		}
	}
	return j
}

// forget drops a room that has been empty for [roomLinger].
func (h *Hub) forget(presentation string, r *room) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[presentation] == r && len(r.subs) == 0 && !r.telling &&
		!r.emptySince.IsZero() && time.Since(r.emptySince) >= roomLinger {
		delete(h.rooms, presentation)
	}
}

// phonesChanged tells the room's screens how many phones are on the ballot,
// a second after the first change. Called with the lock held.
func (h *Hub) phonesChanged(presentation string, r *room) {
	if r.telling {
		return
	}
	r.telling = true
	time.AfterFunc(time.Second, func() {
		h.mu.Lock()
		r.telling = false
		h.publishLocked(r, "room", map[string]int{"phones": r.phones}, false)
		h.mu.Unlock()
		h.forget(presentation, r)
	})
}

// Publish sends [event] to everyone watching [presentation]: a slide change
// to everyone, a vote and the phone count to the screens only. A watcher too
// slow to keep up misses a frame rather than holding up the others; every
// frame carries the whole count, so the next one puts it right.
func (h *Hub) Publish(presentation, event string, data any) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r := h.rooms[presentation]; r != nil {
		h.publishLocked(r, event, data, event == "state")
	}
}

func (h *Hub) publishLocked(r *room, event string, data any, phones bool) {
	r.seq++
	frame := sseFrame(h.id(r.seq), event, data)
	r.recent = append(r.recent, numbered{seq: r.seq, frame: frame})
	if len(r.recent) > keepFrames {
		r.recent = r.recent[len(r.recent)-keepFrames:]
	}
	for ch, phone := range r.subs {
		if phone && !phones {
			continue
		}
		select {
		case ch <- frame:
		default:
		}
	}
}

func (h *Hub) id(seq uint64) string { return h.epoch + "." + strconv.FormatUint(seq, 10) }

func (h *Hub) parseID(id string) (uint64, bool) {
	epoch, n, ok := strings.Cut(id, ".")
	if !ok || epoch != h.epoch {
		return 0, false
	}
	seq, err := strconv.ParseUint(n, 10, 64)
	return seq, err == nil
}

// Active says whether anyone is watching, or was a moment ago and may be
// back: whether a change is worth telling.
func (h *Hub) Active(presentation string) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.rooms[presentation] != nil
}

// Phones is how many phones have the ballot open.
func (h *Hub) Phones(presentation string) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r := h.rooms[presentation]; r != nil {
		return r.phones
	}
	return 0
}

// sseFrame is one server-sent event, with the number a returning watcher
// sends back, if it has one.
func sseFrame(id, event string, data any) []byte {
	body, err := json.Marshal(data)
	if err != nil {
		body = []byte(`{}`)
	}
	if id == "" {
		return []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event, body))
	}
	return []byte(fmt.Sprintf("id: %s\nevent: %s\ndata: %s\n\n", id, event, body))
}
