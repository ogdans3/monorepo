import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const KOMPRIMERES = new Set(['.html', '.css', '.js', '.svg', '.txt', '.webmanifest']);

/**
 * Hele public/ leses inn i minnet ved oppstart.
 *
 * Sida er noen hundre kilobyte og endrer seg bare når containeren bygges på
 * nytt, så en fil-lesing per forespørsel ville bare vært en måte å gjøre den
 * treg og samtidig åpne for stier som peker ut av katalogen. Med et kart bygget
 * på forhånd finnes de stiene ikke: en URL som ikke er en nøkkel er 404.
 */
export function lesInn(rot, erstatninger = {}) {
  const filer = new Map();

  const gaaGjennom = (katalog) => {
    for (const navn of readdirSync(katalog)) {
      const full = join(katalog, navn);
      if (statSync(full).isDirectory()) {
        gaaGjennom(full);
        continue;
      }
      const ext = extname(navn).toLowerCase();
      const type = TYPER[ext];
      if (!type) continue; // ukjent filtype serveres ikke i det hele tatt

      let innhold = readFileSync(full);
      if (ext === '.html') {
        let tekst = innhold.toString('utf8');
        for (const [nokkel, verdi] of Object.entries(erstatninger)) {
          tekst = tekst.split(`{{${nokkel}}}`).join(verdi);
        }
        // Blokker som er merket med en nøkkel forsvinner når nøkkelen er tom.
        tekst = tekst.replace(
          /<!--\s*hvis:(\w+)\s*-->([\s\S]*?)<!--\s*\/hvis:\1\s*-->/g,
          (_, nokkel, kropp) => (erstatninger[nokkel] ? kropp : '')
        );
        innhold = Buffer.from(tekst, 'utf8');
      }

      const sti = '/' + relative(rot, full).split('\\').join('/');
      const etag = '"' + createHash('sha1').update(innhold).digest('base64url').slice(0, 20) + '"';
      const oppf = {
        innhold,
        type,
        etag,
        gzip: KOMPRIMERES.has(ext) ? gzipSync(innhold, { level: 9 }) : null,
        // Bilder og skrift er uforanderlige i praksis: de byttes ved å bygge
        // et nytt image. HTML, CSS og JS får ETag i stedet, så en endring
        // treffer med en gang.
        cache: sti.startsWith('/bilder/') || sti.startsWith('/skrift/')
          ? 'public, max-age=2592000'
          : 'no-cache'
      };
      filer.set(sti, oppf);
      if (navn === 'index.html') {
        const mappe = sti.slice(0, -'index.html'.length);
        filer.set(mappe === '/' ? '/' : mappe.replace(/\/$/, ''), oppf);
      }
      // /personvern like gjerne som /personvern.html
      if (ext === '.html' && navn !== 'index.html') {
        filer.set(sti.slice(0, -'.html'.length), oppf);
      }
    }
  };

  gaaGjennom(rot);
  return filer;
}

export function serverFil(oppf, req, res) {
  if (req.headers['if-none-match'] === oppf.etag) {
    res.writeHead(304, { ETag: oppf.etag, 'Cache-Control': oppf.cache });
    res.end();
    return;
  }
  const godtar = String(req.headers['accept-encoding'] ?? '');
  const brukGzip = oppf.gzip && /\bgzip\b/.test(godtar);
  const kropp = brukGzip ? oppf.gzip : oppf.innhold;
  const hoder = {
    'Content-Type': oppf.type,
    'Content-Length': kropp.length,
    'Cache-Control': oppf.cache,
    ETag: oppf.etag,
    Vary: 'Accept-Encoding'
  };
  if (brukGzip) hoder['Content-Encoding'] = 'gzip';
  res.writeHead(200, hoder);
  res.end(req.method === 'HEAD' ? undefined : kropp);
}
