package studio

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Media can be reused by the browser, but every reuse revalidates authorization.
// Never use a public cache or a long freshness period for private customer media.
func mediaCache(w http.ResponseWriter, r *http.Request, key string) {
	w.Header().Set("Cache-Control", "private, no-cache")
	w.Header().Set("Vary", "Cookie, Authorization")
	w.Header().Set("ETag", `"`+hash(key)+`"`)
}

func (a *App) queuePreviews(ctx context.Context, product, version, user string) {
	a.db.Exec(ctx, `INSERT INTO jobs(product_id,version_id,user_id,kind)
 SELECT $1,v.id,nullif($3,'')::uuid,k.kind FROM versions v CROSS JOIN (VALUES('thumbnail'),('proxy')) k(kind)
 WHERE v.id::text=$2 AND v.file_key<>'' AND (v.mime LIKE 'video/%' OR (v.mime LIKE 'image/%' AND k.kind='thumbnail'))
 AND NOT EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind=k.kind)
 AND NOT EXISTS(SELECT 1 FROM jobs WHERE version_id=v.id AND kind=k.kind)
 ON CONFLICT DO NOTHING`, product, version, user)
}
func (a *App) backfillPreviews(ctx context.Context) {
	// Small batches repair old uploads after deploy, once per artifact, without retry loops.
	rows, err := a.query(ctx, `SELECT v.id::text AS id,i.product_id::text AS product FROM versions v JOIN items i ON i.id=v.item_id
 WHERE i.deleted_at IS NULL AND v.file_key<>'' AND (v.mime LIKE 'image/%' OR v.mime LIKE 'video/%')
 AND ((NOT EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind='thumbnail') AND NOT EXISTS(SELECT 1 FROM jobs WHERE version_id=v.id AND kind='thumbnail'))
 OR (v.mime LIKE 'video/%' AND NOT EXISTS(SELECT 1 FROM media_artifacts WHERE version_id=v.id AND kind='proxy') AND NOT EXISTS(SELECT 1 FROM jobs WHERE version_id=v.id AND kind='proxy')))
 ORDER BY v.created_at DESC LIMIT 20`)
	if err != nil {
		return
	}
	for _, row := range rows {
		a.queuePreviews(ctx, row["product"].(string), row["id"].(string), "")
	}
}
func (a *App) artifactWorker(ctx context.Context, kind string) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	lastBackfill := time.Time{}
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if kind == "thumbnail" && time.Since(lastBackfill) > 30*time.Second {
				a.backfillPreviews(ctx)
				lastBackfill = time.Now()
			}
			var j jobRecord
			err := a.db.QueryRow(ctx, `UPDATE jobs SET status='running',started_at=now() WHERE id=(SELECT id FROM jobs WHERE status='queued' AND kind=$1 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id::text,product_id::text,coalesce(version_id::text,''),coalesce(user_id::text,''),kind`, kind).Scan(&j.ID, &j.Product, &j.Version, &j.User, &j.Kind)
			if err == nil {
				a.executeJob(ctx, j)
			}
		}
	}
}
func (a *App) buildArtifact(ctx context.Context, j jobRecord) (any, error) {
	var key, mt, existing string
	if err := a.db.QueryRow(ctx, "SELECT file_key,mime FROM versions WHERE id=$1", j.Version).Scan(&key, &mt); err != nil || key == "" {
		return nil, fmt.Errorf("versjonen mangler mediefil")
	}
	if a.db.QueryRow(ctx, "SELECT file_key FROM media_artifacts WHERE version_id=$1 AND kind=$2", j.Version, j.Kind).Scan(&existing) == nil {
		if info, err := os.Stat(filepath.Join(a.storage, existing)); err == nil && info.Size() > 0 {
			return map[string]any{"kind": j.Kind, "ready": true}, nil
		}
	}
	if j.Kind == "proxy" && !strings.HasPrefix(mt, "video/") {
		return nil, fmt.Errorf("mobilvideo krever en videofil")
	}
	if j.Kind == "thumbnail" && !strings.HasPrefix(mt, "video/") && !strings.HasPrefix(mt, "image/") {
		return nil, fmt.Errorf("miniatyr krever bilde eller video")
	}
	source := filepath.Join(a.storage, key)
	result := token() + ".jpg"
	outMime := "image/jpeg"
	args := []string{"-v", "error", "-nostdin", "-threads", "1", "-filter_threads", "1", "-protocol_whitelist", "file,pipe", "-i", source}
	if j.Kind == "thumbnail" {
		// The first decodable frame also works for clips shorter than a second.
		args = append(args, "-frames:v", "1", "-vf", "scale=640:640:force_original_aspect_ratio=decrease", "-q:v", "4")
	} else {
		result = token() + ".mp4"
		outMime = "video/mp4"
		args = append(args, "-t", "600", "-vf", "scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2", "-c:v", "libx264", "-threads", "1", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-fs", "268435456", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart")
	}
	output := filepath.Join(a.storage, result)
	args = append(args, "-y", output)
	a.jobProgress(ctx, j.ID, map[string]string{"thumbnail": "Lager miniatyr", "proxy": "Lager lett videoforhåndsvisning"}[j.Kind])
	if _, err := runProgram(ctx, "ffmpeg", args...); err != nil {
		os.Remove(output)
		return nil, fmt.Errorf("kunne ikke lage forhåndsvisning; kontroller formatet og prøv igjen")
	}
	if err := a.saveArtifact(ctx, j.Version, j.Kind, result, outMime); err != nil {
		os.Remove(output)
		return nil, err
	}
	return map[string]any{"kind": j.Kind, "ready": true}, nil
}

// Browser MIME sniffing does not recognize every valid MP4/QuickTime brand.
func probeContainer(path string, head []byte, original string) string {
	if len(head) < 12 || string(head[4:8]) != "ftyp" {
		return original
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	data, err := runProgram(ctx, "ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-show_entries", "stream=codec_type", "-of", "json", path)
	if err != nil {
		return original
	}
	var result struct {
		Streams []struct {
			Kind string `json:"codec_type"`
		} `json:"streams"`
	}
	if json.Unmarshal(data, &result) != nil {
		return original
	}
	for _, stream := range result.Streams {
		if stream.Kind == "video" {
			return "video/mp4"
		}
	}
	for _, stream := range result.Streams {
		if stream.Kind == "audio" {
			return "audio/mp4"
		}
	}
	return original
}
