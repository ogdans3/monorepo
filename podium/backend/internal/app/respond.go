package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

// writeJSON answers with [body] as JSON.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

// fail answers with a code a client can switch on and a message a person
// can read, in Norwegian, since it is shown as it is.
func fail(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}

// readJSON reads a request body of at most a megabyte into [into], or answers
// 400 itself and says so. Only a body that says it is JSON: a form on another
// site can send text that parses as JSON, but not that content type without
// asking first, and this server does not answer that question.
func readJSON(w http.ResponseWriter, r *http.Request, into any) bool {
	if ct := r.Header.Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		fail(w, http.StatusUnsupportedMediaType, "not_json", "Forespørselen må være JSON.")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(into); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			fail(w, http.StatusRequestEntityTooLarge, "too_large", "Det er for mye på én gang.")
			return false
		}
		fail(w, http.StatusBadRequest, "bad_request", "Forespørselen kunne ikke leses.")
		return false
	}
	return true
}
