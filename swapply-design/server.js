'use strict';

// Static host for the Swapply screen mockups. No dependencies: the whole site
// is files under public/, plus two rewrites (/r/<n> → viewer, / → index).

const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const ROUND_RE = /^\/r\/([1-9]\d?)$/;

// The docs and their vendored React never change without a redeploy, so they
// can be cached hard. The pages themselves are revalidated every time.
function cacheFor(pathname) {
  if (pathname.startsWith('/docs/') || pathname.startsWith('/vendor/')) {
    return 'public, max-age=3600';
  }
  return 'no-cache';
}

function resolve(pathname) {
  const decoded = decodeURIComponent(pathname);
  const rel = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(ROOT, rel);
  // path.join collapses traversal, but re-check: nothing outside public/.
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain' });
  }

  let pathname;
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    return send(res, 400, 'Bad request', { 'Content-Type': 'text/plain' });
  }

  if (pathname === '/healthz') {
    return send(res, 200, JSON.stringify({ ok: true }), { 'Content-Type': TYPES['.json'] });
  }

  // /r/<n> is the viewer; the round it should open is read client-side.
  if (ROUND_RE.test(pathname)) pathname = '/viewer.html';
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';

  const file = resolve(pathname);
  if (!file) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    }
    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': cacheFor(pathname),
      'Last-Modified': stat.mtime.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.method === 'HEAD') return send(res, 200, null, headers);
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`swapply-design listening on http://0.0.0.0:${PORT}`);
});
