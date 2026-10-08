package studio

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"
)

var adChannels = []string{"tiktok", "instagram", "snapchat", "linkedin", "x", "facebook", "youtube", "pinterest", "other"}

type adOrganizationInput struct {
	Ad       string    `json:"ad_id"`
	Folder   *string   `json:"folder_id"`
	Channels *[]string `json:"channels"`
	Version  string    `json:"version_id"`
}

type adFolderInput struct {
	Product string `json:"product_id"`
	ID      string `json:"folder_id"`
	Name    string `json:"name"`
}

func (a *App) listAdFolders(ctx context.Context, product string) ([]map[string]any, error) {
	if !a.productAccess(ctx, product, false) {
		return nil, fmt.Errorf("ingen tilgang til produktet")
	}
	rows, err := a.query(ctx, `SELECT f.id,f.name,count(i.id) AS ad_count FROM ad_folders f LEFT JOIN ads a ON a.folder_id=f.id LEFT JOIN items i ON i.id=a.item_id AND i.deleted_at IS NULL WHERE f.product_id::text=$1 GROUP BY f.id ORDER BY lower(f.name),f.id`, product)
	if rows == nil {
		rows = []map[string]any{}
	}
	return rows, err
}
func (a *App) saveAdFolder(ctx context.Context, v adFolderInput) (map[string]string, error) {
	if !a.productAccess(ctx, v.Product, true) {
		return nil, fmt.Errorf("ingen tilgang til produktet")
	}
	v.Name = strings.TrimSpace(v.Name)
	if v.Name == "" || len([]rune(v.Name)) > 80 {
		return nil, fmt.Errorf("mappenavn må ha 1–80 tegn")
	}
	var id string
	var err error
	if v.ID == "" {
		err = a.db.QueryRow(ctx, `INSERT INTO ad_folders(product_id,name) VALUES($1,$2) RETURNING id::text`, v.Product, v.Name).Scan(&id)
	} else {
		err = a.db.QueryRow(ctx, `UPDATE ad_folders SET name=$1 WHERE id::text=$2 AND product_id::text=$3 RETURNING id::text`, v.Name, v.ID, v.Product).Scan(&id)
	}
	if err != nil {
		return nil, fmt.Errorf("kunne ikke lagre mappen; navnet kan være i bruk")
	}
	return map[string]string{"id": id, "name": v.Name}, nil
}
func (a *App) removeAdFolder(ctx context.Context, id string) error {
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var product string
	if tx.QueryRow(ctx, `SELECT product_id::text FROM ad_folders WHERE id::text=$1 FOR UPDATE`, id).Scan(&product) != nil || !a.productAccess(ctx, product, true) {
		return fmt.Errorf("ingen tilgang til mappen")
	}
	if _, err = tx.Exec(ctx, `UPDATE ads SET folder_id=NULL WHERE folder_id::text=$1`, id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM ad_folders WHERE id::text=$1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (a *App) organizeAd(ctx context.Context, v adOrganizationInput) error {
	if v.Folder == nil && v.Channels == nil {
		return fmt.Errorf("oppgi mappe eller kanaler")
	}
	if v.Version != "" && (v.Folder != nil || v.Channels == nil) {
		return fmt.Errorf("versjoner kan bare merkes med kanaler; mapper gjelder hele annonsen")
	}
	channels := []string{}
	if v.Channels != nil {
		for _, channel := range *v.Channels {
			if !slices.Contains(adChannels, channel) {
				return fmt.Errorf("ukjent kanal: %s", channel)
			}
			if !slices.Contains(channels, channel) {
				channels = append(channels, channel)
			}
		}
	}
	var product string
	if a.db.QueryRow(ctx, `SELECT a.product_id::text FROM ads a JOIN items i ON i.id=a.item_id WHERE a.item_id::text=$1 AND i.deleted_at IS NULL`, v.Ad).Scan(&product) != nil || !a.productAccess(ctx, product, true) {
		return fmt.Errorf("ingen tilgang til annonsen")
	}
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Lock folders before ads, matching folder deletion, to keep concurrent moves safe.
	if v.Folder != nil && *v.Folder != "" {
		var folder string
		if tx.QueryRow(ctx, `SELECT id::text FROM ad_folders WHERE id::text=$1 AND product_id::text=$2 FOR KEY SHARE`, *v.Folder, product).Scan(&folder) != nil {
			return fmt.Errorf("mappen finnes ikke i dette produktet")
		}
	}
	var id string
	if tx.QueryRow(ctx, `SELECT item_id::text FROM ads WHERE item_id::text=$1 FOR UPDATE`, v.Ad).Scan(&id) != nil {
		return fmt.Errorf("annonsen finnes ikke")
	}
	if v.Version != "" {
		if tx.QueryRow(ctx, `SELECT id::text FROM versions WHERE id::text=$1 AND item_id::text=$2`, v.Version, v.Ad).Scan(&id) != nil {
			return fmt.Errorf("versjonen tilhører ikke annonsen")
		}
		_, err = tx.Exec(ctx, `INSERT INTO ad_version_channels(version_id,channels) VALUES($1,$2) ON CONFLICT(version_id) DO UPDATE SET channels=excluded.channels`, v.Version, channels)
	} else {
		if v.Folder != nil {
			_, err = tx.Exec(ctx, `UPDATE ads SET folder_id=nullif($1,'')::uuid WHERE item_id::text=$2`, *v.Folder, v.Ad)
		}
		if err == nil && v.Channels != nil {
			_, err = tx.Exec(ctx, `UPDATE ads SET channels=$1 WHERE item_id::text=$2`, channels, v.Ad)
		}
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
func (a *App) adFolders(w http.ResponseWriter, r *http.Request) {
	rows, err := a.listAdFolders(r.Context(), r.URL.Query().Get("product"))
	if err != nil {
		fail(w, 403, err.Error())
		return
	}
	write(w, 200, rows)
}
func (a *App) upsertAdFolder(w http.ResponseWriter, r *http.Request) {
	var v adFolderInput
	if !decode(w, r, &v) {
		return
	}
	v.ID = r.PathValue("id")
	out, err := a.saveAdFolder(r.Context(), v)
	if err != nil {
		fail(w, 400, err.Error())
		return
	}
	write(w, 200, out)
}
func (a *App) deleteAdFolder(w http.ResponseWriter, r *http.Request) {
	if err := a.removeAdFolder(r.Context(), r.PathValue("id")); err != nil {
		fail(w, 400, err.Error())
		return
	}
	ok(w)
}
func (a *App) updateAdOrganization(w http.ResponseWriter, r *http.Request) {
	var v adOrganizationInput
	if !decode(w, r, &v) {
		return
	}
	v.Ad = r.PathValue("id")
	if err := a.organizeAd(r.Context(), v); err != nil {
		fail(w, 400, err.Error())
		return
	}
	ok(w)
}
