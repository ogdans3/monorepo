// Point the design-doc runtime at the React copies vendored under ./vendor/
// instead of unpkg. `window.__resources` is support.js's own override hook
// (see `cdnScriptFor`), so the runtime stays untouched and the docs render
// without reaching the network. Babel is deliberately left on the CDN: it is
// only fetched for `x-import` JSX, which none of these docs use, and the
// standalone build is ~3 MB.
window.__resources = Object.assign(window.__resources || {}, {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': './vendor/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': './vendor/react-dom.production.min.js',
});
