// Testpublikum is a room full of phones for Podium, for trying a presentation
// out before the room is there. It joins a presentation the way a phone does,
// by its code, and answers every question that comes up on the screen: a
// little at random, a few seconds apart, and not every phone, the way a room
// does.
//
// Signing in is Podium's. The password is checked by Podium, and the session
// is Podium's own admin session, so Testpublikum keeps no password of its own,
// and a changed Podium password signs it out too.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	base := strings.TrimRight(getenv("PODIUM_URL", "https://podium.freelunch.no"), "/")
	s := newServer(newPodium(base), log)

	srv := &http.Server{
		Addr:              ":" + getenv("PORT", "8080"),
		Handler:           s.routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		// The phones go with the process; the page says why.
		s.stopAll("Stoppet fordi Testpublikum ble startet på nytt.")
		shut, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(shut)
	}()

	log.Info("listening", "addr", srv.Addr, "podium", base)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("server", "err", err)
		os.Exit(1)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
