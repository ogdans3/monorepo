{{flutter_js}}
{{flutter_build_config}}

// Nothing the app needs comes from Google's servers. By default Flutter loads
// CanvasKit from www.gstatic.com and Roboto, with the Noto fonts it falls back
// on, from fonts.gstatic.com, so every visitor's IP address went to Google
// before the first screen was drawn (docs/ARCHITECTURE.md, the transfer
// chapter). CanvasKit is in the build, under a path with the engine revision in
// it so it can be cached for good and still change with Flutter, and the fonts
// are fetched through our own server by serve.js.
_flutter.loader.load({
  serviceWorkerSettings: {
    serviceWorkerVersion: {{flutter_service_worker_version}},
  },
  config: {
    canvasKitBaseUrl: 'canvaskit/' + _flutter.buildConfig.engineRevision + '/',
    fontFallbackBaseUrl: 'fonts/',
  },
});
