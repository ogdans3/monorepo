package studio

import "net/http"

func (a *App) extendedRoutes(m *http.ServeMux) {
	routes := []struct {
		pattern      string
		h            http.HandlerFunc
		write, admin bool
	}{
		{"GET /api/ad-folders", a.adFolders, false, false}, {"POST /api/ad-folders", a.upsertAdFolder, true, false}, {"PATCH /api/ad-folders/{id}", a.upsertAdFolder, true, false}, {"DELETE /api/ad-folders/{id}", a.deleteAdFolder, true, false},
		{"PATCH /api/ads/{id}/organization", a.updateAdOrganization, true, false},
		{"GET /api/ads", a.ads, false, false}, {"POST /api/ads", a.addAd, true, false}, {"GET /api/ads/{id}", a.ad, false, false}, {"PATCH /api/ads/{id}", a.editAd, true, false}, {"POST /api/ads/{id}/versions/from-item", a.attachAdVersion, true, false}, {"POST /api/ads/{id}/review", a.reviewAd, true, false},
		{"PATCH /api/items/{id}/category", a.setCategory, true, false},
		{"POST /api/imports", a.createImport, true, false}, {"GET /api/imports", a.imports, false, false}, {"POST /api/imports/{id}/cancel", a.cancelImport, true, false}, {"POST /api/imports/{id}/retry", a.retryImport, true, false},
		{"POST /api/products", a.createProduct, true, true}, {"GET /api/products/{id}/people", a.people, false, false}, {"GET /api/products/{id}/history", a.productHistory, false, false}, {"GET /api/products/{id}/members", a.members, false, true}, {"PUT /api/products/{id}/members", a.updateMember, true, true}, {"GET /api/products/{id}/context", a.getContext, false, false},
		{"DELETE /api/invites/{id}", a.revokeInvite, true, true}, {"POST /api/password-resets", a.resetLink, true, true},
		{"GET /api/library", a.libraryExtras, false, false}, {"POST /api/collections", a.saveCollection, true, false}, {"POST /api/items/{id}/favorite", a.favorite, false, false}, {"DELETE /api/items/{id}/favorite", a.favorite, false, false}, {"POST /api/saved-searches", a.savedSearch, false, false}, {"DELETE /api/saved-searches/{id}", a.savedSearch, false, false},
		{"POST /api/items/bulk", a.bulkItems, true, false}, {"PATCH /api/items/{id}/metadata", a.itemMetadata, true, false}, {"POST /api/items/{id}/relations", a.relation, true, false}, {"POST /api/items/{id}/ratings", a.rateItem, true, false}, {"PATCH /api/items/{id}/notes/{note}", a.resolveNote, true, false},
		{"POST /api/items/{id}/shares", a.shareItem, true, false}, {"DELETE /api/items/{id}/shares/{share}", a.revokeShare, true, false}, {"GET /api/export/csv", a.exportCSV, false, false}, {"POST /api/import/csv", a.importCSV, true, false}, {"GET /api/export/package", a.exportPackage, false, false},
		{"GET /api/versions/{id}/segments", a.listSegments, false, false}, {"PUT /api/versions/{id}/segments", a.saveSegments, true, false}, {"GET /api/previews/{id}", a.preview, false, false},
		{"POST /api/upload-sessions", a.startUpload, true, false}, {"GET /api/upload-sessions/{id}", a.uploadStatus, false, false}, {"PATCH /api/upload-sessions/{id}", a.uploadChunk, true, false}, {"POST /api/upload-sessions/{id}/complete", a.completeUpload, true, false},
		{"GET /api/templates", a.templates, false, false}, {"POST /api/templates", a.saveTemplate, true, false}, {"PUT /api/templates/{id}", a.saveTemplate, true, false}, {"POST /api/production", a.createProduction, true, false}, {"POST /api/production/variants", a.variants, true, false}, {"GET /api/tasks/{id}", a.taskDetail, false, false}, {"POST /api/tasks/{id}/revise", a.reviseTask, true, false},
		{"GET /api/campaigns", a.campaigns, false, false}, {"POST /api/campaigns", a.saveCampaign, true, false}, {"PUT /api/campaigns/{id}", a.saveCampaign, true, false}, {"GET /api/experiments", a.experiments, false, false}, {"POST /api/experiments", a.saveExperiment, true, false}, {"PUT /api/experiments/{id}", a.saveExperiment, true, false},
		{"GET /api/insights", a.insights, false, false}, {"POST /api/measurements", a.measurement, true, false}, {"POST /api/measurements/import", a.importMeasurements, true, false}, {"POST /api/conversion-keys", a.createConversionKey, true, true}, {"DELETE /api/conversion-keys/{id}", a.revokeConversionKey, true, true},
		{"GET /api/claims", a.claims, false, false}, {"POST /api/claims", a.saveClaim, true, false}, {"PATCH /api/claims/{id}", a.saveClaim, true, false},
		{"GET /api/notifications", a.notifications, false, false}, {"POST /api/notifications/{id}/read", a.readNotification, false, false},
		{"GET /api/operations", a.limitsStatus, false, true}, {"PUT /api/operations/limits", a.updateLimits, true, true},
		{"GET /api/profiles", a.profiles, false, false}, {"PUT /api/profiles", a.saveProfile, true, true}, {"GET /api/runs/{id}/stream", a.runStream, false, false},
		{"GET /api/jobs", a.jobs, false, false}, {"POST /api/jobs", a.startJob, true, false}, {"POST /api/jobs/{id}/cancel", a.cancelJob, true, false}, {"POST /api/search/image", a.searchImage, false, false},
		{"POST /api/references/metadata", a.linkMetadata, true, false}, {"GET /api/export/workspace", a.exportWorkspace, false, true},
	}
	for _, route := range routes {
		m.HandleFunc(route.pattern, a.protected(route.h, route.write, route.admin))
	}
	m.HandleFunc("POST /api/auth/reset", a.resetPassword)
	m.HandleFunc("GET /api/shared/{token}", a.shared)
	m.HandleFunc("POST /api/conversions", a.conversion)
	for _, route := range []struct {
		pattern string
		h       http.HandlerFunc
	}{{"POST /api/agent/upload-sessions", a.startUpload}, {"GET /api/agent/upload-sessions/{id}", a.uploadStatus}, {"PATCH /api/agent/upload-sessions/{id}", a.uploadChunk}, {"POST /api/agent/upload-sessions/{id}/complete", a.completeUpload}} {
		m.HandleFunc(route.pattern, a.protected(route.h, true, false))
	}
}
