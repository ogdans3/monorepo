package app

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// Hub hands what happens to a presentation to everyone watching it: the
// display on the projector, the admin's own view, and the phones on the
// ballot. One process, so one map; a second server would need Postgres
// LISTEN/NOTIFY between them, and there is no second server.
type Hub struct {
	mu    sync.Mutex
	rooms map[string]*room
}

type room struct {
	// Every watcher, and whether it is a phone. A phone's ballot only needs
	// to know what is on screen; the votes, and how many phones there are,
	// are for the display and the admin.
	subs   map[chan []byte]bool
	phones int
	// A change in the number of phones waiting to be told, so that a room
	// scanning the code at once is one message and not a hundred.
	telling bool
}

func NewHub() *Hub {
	return &Hub{rooms: map[string]*room{}}
}

// Subscribe returns the frames for one presentation and the function that
// stops them. Frames are server-sent events, encoded once for everybody.
func (h *Hub) Subscribe(presentation string, phone bool) (<-chan []byte, func()) {
	ch := make(chan []byte, 64)
	h.mu.Lock()
	r := h.rooms[presentation]
	if r == nil {
		r = &room{subs: map[chan []byte]bool{}}
		h.rooms[presentation] = r
	}
	r.subs[ch] = phone
	if phone {
		r.phones++
		h.phonesChanged(presentation, r)
	}
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		delete(r.subs, ch)
		if phone {
			r.phones--
			h.phonesChanged(presentation, r)
		}
		if len(r.subs) == 0 && !r.telling {
			delete(h.rooms, presentation)
		}
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
		defer h.mu.Unlock()
		r.telling = false
		send(r, sseFrame("room", map[string]int{"phones": r.phones}), false)
		if len(r.subs) == 0 && h.rooms[presentation] == r {
			delete(h.rooms, presentation)
		}
	})
}

// Publish sends [event] to everyone watching [presentation], and a vote to
// the screens only. A watcher too slow to keep up misses a frame rather than
// holding up the others: every frame carries the whole count, so the next
// one puts it right.
func (h *Hub) Publish(presentation, event string, data any) {
	frame := sseFrame(event, data)
	h.mu.Lock()
	defer h.mu.Unlock()
	if r := h.rooms[presentation]; r != nil {
		send(r, frame, event == "state")
	}
}

func send(r *room, frame []byte, phones bool) {
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

// Watchers is how many are watching, phones and screens together.
func (h *Hub) Watchers(presentation string) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	if r := h.rooms[presentation]; r != nil {
		return len(r.subs)
	}
	return 0
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

func sseFrame(event string, data any) []byte {
	body, err := json.Marshal(data)
	if err != nil {
		body = []byte(`{}`)
	}
	return []byte(fmt.Sprintf("event: %s\ndata: %s\n\n", event, body))
}
