// Package webdist carries the built Svelte app inside the binary. The
// Dockerfile builds web/ into dist/ before compiling; a checkout carries only
// a placeholder, and the server then leaves the app to Vite.
package webdist

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var files embed.FS

// FS is the built app, or nil when there is none in this binary.
func FS() fs.FS {
	dist, err := fs.Sub(files, "dist")
	if err != nil {
		return nil
	}
	if _, err := fs.Stat(dist, "index.html"); err != nil {
		return nil
	}
	return dist
}
