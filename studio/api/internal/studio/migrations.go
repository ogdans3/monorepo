package studio

import (
	"context"
	"embed"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrations embed.FS

func migrate(ctx context.Context, db *pgxpool.Pool) error {
	c, e := db.Acquire(ctx)
	if e != nil {
		return e
	}
	defer c.Release()
	if _, e = c.Exec(ctx, "SELECT pg_advisory_lock(8147201)"); e != nil {
		return e
	}
	defer c.Exec(context.Background(), "SELECT pg_advisory_unlock(8147201)")
	if _, e = c.Exec(ctx, "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())"); e != nil {
		return e
	}
	files, e := migrations.ReadDir("migrations")
	if e != nil {
		return e
	}
	for _, f := range files {
		b, _ := migrations.ReadFile("migrations/" + f.Name())
		var old string
		e = c.QueryRow(ctx, "SELECT checksum FROM schema_migrations WHERE name=$1", f.Name()).Scan(&old)
		if e == nil {
			if old != hash(string(b)) {
				return fmt.Errorf("migration %s has changed", f.Name())
			}
			continue
		}
		tx, e := c.Begin(ctx)
		if e != nil {
			return e
		}
		if _, e = tx.Exec(ctx, string(b)); e == nil {
			_, e = tx.Exec(ctx, "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)", f.Name(), hash(string(b)))
		}
		if e != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("migration %s: %w", f.Name(), e)
		}
		if e = tx.Commit(ctx); e != nil {
			return e
		}
	}
	return nil
}
