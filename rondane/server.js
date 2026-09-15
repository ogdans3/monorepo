// Serverer det ferdigbygde nettstedet fra dist/, med ekte 301-er for de
// gamle adressene. Astro kan lage omdirigeringer selv, men bare som
// HTML-sider med meta-refresh — søkemotorene vil ha en ekte 301, og det er
// hele poenget med å ta vare på adressene fra gamle rondane.no.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 3000);
const DIST = new URL('./dist/', import.meta.url).pathname;
const omdir = JSON.parse(readFileSync(new URL('./omdirigeringer.json', import.meta.url), 'utf8'));

const TYPER = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

function send(res, kode, sti, ekstraHoder = {}) {
  const st = statSync(sti);
  const ext = extname(sti).toLowerCase();
  const evig = sti.includes('/_astro/') || ext === '.woff2';
  res.writeHead(kode, {
    'Content-Type': TYPER[ext] ?? 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': evig ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'public, max-age=0, must-revalidate' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...ekstraHoder,
  });
  createReadStream(sti).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://rondane.invalid');
  let sti = decodeURIComponent(url.pathname);

  // Gamle adresser: med og uten skråstrek på slutten, og med domenet foran.
  const noekkel = sti.replace(/\/+$/, '') || '/';
  if (omdir[noekkel] && omdir[noekkel] !== sti) {
    res.writeHead(301, { Location: omdir[noekkel] + url.search });
    return res.end();
  }
  // Nye adresser skal alltid ha skråstrek på slutten (Astro: trailingSlash always).
  if (!sti.endsWith('/') && !extname(sti) && existsSync(join(DIST, sti, 'index.html'))) {
    res.writeHead(301, { Location: sti + '/' + url.search });
    return res.end();
  }

  let fil = normalize(join(DIST, sti));
  if (!fil.startsWith(DIST)) { res.writeHead(400); return res.end(); }
  if (sti.endsWith('/')) fil = join(fil, 'index.html');
  if (existsSync(fil) && statSync(fil).isFile()) return send(res, 200, fil);

  const feil = join(DIST, '404.html');
  if (existsSync(feil)) return send(res, 404, feil);
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Ikke funnet');
}).listen(PORT, '0.0.0.0', () => console.log(`rondane.no lytter på :${PORT}`));
