package app

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	adminCookie = "podium_admin"
	voterCookie = "podium_voter"
	sessionLife = 30 * 24 * time.Hour
)

// The admin session is the expiry, signed with a key derived from the
// password: no table of sessions, and changing the password signs every
// session out.
func (s *Server) sessionKey() []byte {
	k := sha256.Sum256([]byte("podium session\x00" + s.cfg.AdminPassword))
	return k[:]
}

func (s *Server) sign(expiry int64) string {
	mac := hmac.New(sha256.New, s.sessionKey())
	mac.Write([]byte(strconv.FormatInt(expiry, 10)))
	return strconv.FormatInt(expiry, 10) + "." + hex.EncodeToString(mac.Sum(nil))
}

func (s *Server) isAdmin(r *http.Request) bool {
	c, err := r.Cookie(adminCookie)
	if err != nil {
		return false
	}
	at, _, ok := strings.Cut(c.Value, ".")
	if !ok {
		return false
	}
	expiry, err := strconv.ParseInt(at, 10, 64)
	if err != nil || time.Now().Unix() > expiry {
		return false
	}
	return hmac.Equal([]byte(c.Value), []byte(s.sign(expiry)))
}

// secure says whether a cookie can be marked Secure: on HTTPS, which behind a
// proxy is what the proxy says it was.
func secure(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if subtle.ConstantTimeCompare([]byte(body.Password), []byte(s.cfg.AdminPassword)) != 1 {
		// A little slower for every wrong guess, which is the whole of the
		// rate limiting a one-person admin needs.
		time.Sleep(400 * time.Millisecond)
		fail(w, http.StatusUnauthorized, "wrong_password", "Feil passord.")
		return
	}
	expiry := time.Now().Add(sessionLife).Unix()
	http.SetCookie(w, &http.Cookie{
		Name: adminCookie, Value: s.sign(expiry), Path: "/",
		Expires: time.Unix(expiry, 0), HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: secure(r),
	})
	writeJSON(w, http.StatusOK, map[string]bool{"admin": true})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name: adminCookie, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: secure(r),
	})
	w.WriteHeader(http.StatusNoContent)
}

// me says whether this browser is signed in, and to the admin how big an
// upload may be, so the editor can say so before a long upload is refused.
func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	if !s.isAdmin(r) {
		writeJSON(w, http.StatusOK, map[string]any{"admin": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"admin": true, "maxUploadBytes": s.cfg.MaxUploadBytes})
}

// admin guards a handler: the cookie, or a 401 the admin pages turn into the
// sign-in.
func (s *Server) admin(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.isAdmin(r) {
			fail(w, http.StatusUnauthorized, "not_signed_in", "Logg inn først.")
			return
		}
		h(w, r)
	}
}

// voter is the phone's own id, made the first time it asks. It is the whole
// of "one vote per phone": clearing cookies is a second phone, which for a
// show of hands in a room is fine.
func voter(w http.ResponseWriter, r *http.Request) string {
	if c, err := r.Cookie(voterCookie); err == nil && len(c.Value) >= 16 {
		return c.Value
	}
	b := make([]byte, 18)
	rand.Read(b)
	id := base64.RawURLEncoding.EncodeToString(b)
	http.SetCookie(w, &http.Cookie{
		Name: voterCookie, Value: id, Path: "/", MaxAge: 365 * 24 * 3600,
		HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: secure(r),
	})
	return id
}
