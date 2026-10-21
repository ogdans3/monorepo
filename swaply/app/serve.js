// Serves the built web app. Plain node, no dependencies, same as every other
// static thing in this repository.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

// Flutter names three things without a content hash: index.html points at
// flutter_bootstrap.js, which points at main.dart.js, and all three keep their
// names across builds. Behind a CDN that was told to cache them for a year, a
// deploy is then invisible — which is exactly what happened the first time this
// was deployed behind Cloudflare: the origin had the new app and the edge kept
// serving the old one.
//
// So the build's own id rides along as a query string, and every deploy asks
// for URLs no cache has seen. The id is the entrypoint's modification time,
// which COPY preserves, so it is the same for every container from an image and
// different for every build.
const UNHASHED = new Set([
  '/flutter_bootstrap.js',
  '/main.dart.js',
  '/flutter_service_worker.js',
  '/version.json',
  '/manifest.json',
]);

let buildId;
try {
  buildId = Math.round(fs.statSync(path.join(root, 'main.dart.js')).mtimeMs).toString(36);
} catch {
  buildId = Date.now().toString(36);
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
};

// The fonts the engine asks for: Roboto, and the Noto fonts it falls back on
// for a glyph Roboto lacks (an arrow, an emoji, another script). The app is
// told `fontFallbackBaseUrl: 'fonts/'` (web/flutter_bootstrap.js), so it asks
// us, and this fetches each file once from Google's font server and keeps it.
// The visitor's browser never talks to Google, which is the point: their IP
// address is personal data, and Google would be a second processor in the
// transfer chapter of docs/ARCHITECTURE.md. Only the shape Flutter asks for is
// relayed — family, version, file — so this is not an open proxy. The file
// name may carry a dot: the CJK fonts come in slices named `….90.woff2`, and
// they are where an arrow like ⇄ is found.
const FONT = /^\/fonts\/([a-z0-9]+\/v\d+\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:woff2|ttf|otf))$/;
const FONT_UPSTREAM = 'https://fonts.gstatic.com/s/';
const FONT_CACHE_BYTES = 64 * 1024 * 1024;
const fonts = new Map(); // relative path -> Promise<Buffer | null>
let fontBytes = 0;

function font(rel) {
  let pending = fonts.get(rel);
  if (!pending) {
    pending = fetch(FONT_UPSTREAM + rel)
      .then(async (upstream) => {
        if (!upstream.ok) return null;
        const body = Buffer.from(await upstream.arrayBuffer());
        fontBytes += body.length;
        // Kept while there is room. The fallback fonts for a whole script can
        // run to megabytes each, and a few dozen of them is plenty to hold.
        if (fontBytes > FONT_CACHE_BYTES) {
          fonts.delete(rel);
          fontBytes -= body.length;
        }
        return body;
      })
      .catch(() => null);
    fonts.set(rel, pending);
    // A failure is not kept: the next request tries again.
    pending.then((body) => body || fonts.delete(rel));
  }
  return pending;
}

// CanvasKit is asked for under the engine revision (canvaskit/<revision>/…, see
// web/flutter_bootstrap.js) and lives in the build without it. With the
// revision in the URL a cache may keep it for a year and a Flutter upgrade still
// reaches people, which is what the gstatic URL used to give us.
const CANVASKIT = /^\/canvaskit\/[0-9a-f]{40}\//;

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    const wanted = FONT.exec(url.pathname);
    if (wanted) {
      font(wanted[1]).then((body) => {
        if (!body) {
          res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
          res.end('Fikk ikke tak i skriften.');
          return;
        }
        res.writeHead(200, {
          'content-type': types[path.extname(wanted[1])],
          // The version is in the path, so the bytes behind it never change.
          'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
        });
        res.end(body);
      });
      return;
    }

    // Anything else under fonts/ is nothing we have, and the shell in its
    // place would be read by the engine as a broken font.
    if (url.pathname.startsWith('/fonts/')) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Fant ikke skriften.');
      return;
    }

    const pathname = url.pathname.replace(CANVASKIT, '/canvaskit/');
    // Resolve inside root and check afterwards: `..` in a path is how a static
    // server hands out /etc/passwd.
    const target = path.join(root, decodeURIComponent(pathname));
    const safe = target.startsWith(root) ? target : root;

    fs.stat(safe, (err, stat) => {
      const file =
        !err && stat.isFile()
          ? safe
          : // Everything else is the app: it routes in the browser, and a deep
            // link has to load the shell rather than a 404.
            path.join(root, 'index.html');

      fs.readFile(file, (readErr, body) => {
        if (readErr) {
          res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Noe gikk galt hos oss.');
          return;
        }
        const ext = path.extname(file);
        const name = '/' + path.relative(root, file);
        let out = body;

        // Stamp the build id onto the two references that would otherwise point
        // at a name a cache already holds. The shell itself is never cached, so
        // this is what makes a deploy visible.
        if (ext === '.html') {
          out = Buffer.from(
            body.toString('utf8').replaceAll('flutter_bootstrap.js', `flutter_bootstrap.js?v=${buildId}`),
          );
        } else if (name === '/flutter_bootstrap.js') {
          out = Buffer.from(
            body.toString('utf8').replaceAll('"main.dart.js"', `"main.dart.js?v=${buildId}"`),
          );
        }

        res.writeHead(200, {
          'content-type': types[ext] || 'application/octet-stream',
          // The shell must never be cached or a deploy takes hours to reach
          // people. Anything the build gives a content hash may be kept for
          // ever; the handful of files Flutter names without one must be
          // revalidated, whatever query they were asked for.
          'cache-control':
            ext === '.html'
              ? 'no-store'
              : UNHASHED.has(name)
                ? 'no-cache'
                : 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'strict-origin-when-cross-origin',
        });
        res.end(out);
      });
    });
  })
  .listen(port, '0.0.0.0', () => console.log(`swaply app on ${port}`));
