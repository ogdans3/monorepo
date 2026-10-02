package app

import (
	"errors"
	"fmt"
	"os"
	"strconv"
)

// Config is everything the server reads from its environment. Nothing else
// is configured anywhere.
type Config struct {
	// Addr is where the server listens, ":8080" unless PORT says otherwise.
	Addr string
	// DatabaseURL is the Postgres connection string.
	DatabaseURL string
	// MediaDir holds the uploaded pictures, videos and sounds, one file per
	// upload, named by its id. A volume in a deployment, since a container is
	// replaced on every deploy and the files are not.
	MediaDir string
	// AdminPassword is the admin section's one password. There is one
	// presenter, and an account system for one person is a password with
	// extra steps.
	AdminPassword string
	// MaxUploadBytes caps one upload. Videos are the reason it is generous.
	MaxUploadBytes int64
}

// ConfigFromEnv reads the configuration, and refuses to start without the
// two things there is no sensible default for.
func ConfigFromEnv() (Config, error) {
	c := Config{
		Addr:           ":" + envOr("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		MediaDir:       envOr("MEDIA_DIR", "./media"),
		AdminPassword:  os.Getenv("ADMIN_PASSWORD"),
		MaxUploadBytes: 500 << 20,
	}
	if mb := os.Getenv("MAX_UPLOAD_MB"); mb != "" {
		n, err := strconv.ParseInt(mb, 10, 64)
		if err != nil || n <= 0 {
			return c, fmt.Errorf("MAX_UPLOAD_MB is %q, which is not a number of megabytes", mb)
		}
		c.MaxUploadBytes = n << 20
	}
	if c.DatabaseURL == "" {
		return c, errors.New("DATABASE_URL is not set")
	}
	if len(c.AdminPassword) < 8 {
		return c, errors.New("ADMIN_PASSWORD must be set, and at least 8 characters")
	}
	return c, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
