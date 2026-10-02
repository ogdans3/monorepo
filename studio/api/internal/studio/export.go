package studio

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

func publicIP(ip net.IP) bool {
	return !ip.IsLoopback() && !ip.IsPrivate() && !ip.IsLinkLocalUnicast() && !ip.IsLinkLocalMulticast() && !ip.IsUnspecified() && !ip.IsMulticast()
}
func metadataClient() *http.Client {
	return &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(r *http.Request, via []*http.Request) error {
		if len(via) >= 3 {
			return fmt.Errorf("for mange videresendinger")
		}
		if r.URL.Scheme != "https" && r.URL.Scheme != "http" {
			return fmt.Errorf("ugyldig protokoll")
		}
		return nil
	}, Transport: &http.Transport{Proxy: nil, DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, e := net.SplitHostPort(address)
		if e != nil {
			return nil, e
		}
		if port != "443" && port != "80" {
			return nil, fmt.Errorf("kun offentlige HTTP-lenker")
		}
		ips, e := net.DefaultResolver.LookupIPAddr(ctx, host)
		if e != nil || len(ips) == 0 {
			return nil, fmt.Errorf("ukjent vert")
		}
		for _, ip := range ips {
			if !publicIP(ip.IP) {
				return nil, fmt.Errorf("private adresser er ikke tillatt")
			}
		}
		return (&net.Dialer{Timeout: 5 * time.Second}).DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
	}}}
}

var titleRE = regexp.MustCompile(`(?is)<title[^>]*>(.*?)</title>`)
var descriptionRE = regexp.MustCompile(`(?is)<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']*)["']`)

func (a *App) linkMetadata(w http.ResponseWriter, r *http.Request) {
	var v struct {
		URL string `json:"url"`
	}
	if !decode(w, r, &v) {
		return
	}
	u, e := url.Parse(v.URL)
	if e != nil || u.User != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		fail(w, 400, "Oppgi en offentlig lenke")
		return
	}
	req, _ := http.NewRequestWithContext(r.Context(), "GET", v.URL, nil)
	req.Header.Set("User-Agent", "Studio/1.0 reference metadata")
	resp, e := metadataClient().Do(req)
	if e != nil {
		fail(w, 400, "Kunne ikke hente lenken. Du kan fortsatt lagre den manuelt.")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 || !strings.Contains(resp.Header.Get("Content-Type"), "text/html") {
		fail(w, 400, "Siden tilbyr ikke lesbare metadata")
		return
	}
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	title, description := "", ""
	if m := titleRE.FindSubmatch(b); len(m) > 1 {
		title = html.UnescapeString(string(m[1]))
	}
	if m := descriptionRE.FindSubmatch(b); len(m) > 1 {
		description = html.UnescapeString(string(m[1]))
	}
	write(w, 200, map[string]string{"title": title, "description": description, "source_url": resp.Request.URL.String()})
}
func (a *App) exportWorkspace(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="studio-arbeidsrom.zip"`)
	z := zip.NewWriter(w)
	defer z.Close()
	// Content export excludes credentials, private conversations and token tables.
	for _, table := range []string{"products", "product_history", "items", "versions", "notes", "collections", "collection_items", "relations", "ratings", "tasks", "task_sources", "task_deliveries", "task_feedback", "templates", "template_versions", "media_imports", "publications", "campaigns", "measurements", "conversions", "experiments", "claims", "segments", "evaluations"} {
		rows, e := a.query(ctx, "SELECT * FROM "+table)
		if e != nil {
			return
		}
		for _, row := range rows {
			delete(row, "file_key")
		}
		out, e := z.Create(table + ".json")
		if e != nil {
			return
		}
		if json.NewEncoder(out).Encode(rows) != nil {
			return
		}
	}
	rows, e := a.query(ctx, "SELECT DISTINCT file_key,file_name FROM versions WHERE file_key<>''")
	if e != nil {
		return
	}
	seen := map[string]bool{}
	for _, row := range rows {
		key := fmt.Sprint(row["file_key"])
		if seen[key] {
			continue
		}
		seen[key] = true
		f, e := os.Open(filepath.Join(a.storage, key))
		if e != nil {
			continue
		}
		out, e := z.Create("files/" + key + "/" + filepath.Base(fmt.Sprint(row["file_name"])))
		if e == nil {
			io.Copy(out, f)
		}
		f.Close()
	}
}
