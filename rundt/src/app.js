import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Lager } from './lager.js';
import { Kvote } from './kvote.js';
import { normaliser } from './epost.js';
import { lesInn, serverFil } from './statisk.js';

const HER = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HER, '..', 'public');

const MAKS_KROPP = 4 * 1024; // et skjema med ett felt trenger ikke mer

// Sida laster ingenting utenfra: skrift, bilder og skript ligger i imaget.
// Derfor kan policyen være så stram som den er, og derfor skal den forbli det
// — legger du til en ekstern ressurs, er det denne linja som sier nei først.
const CSP = [
  "default-src 'none'",
  "img-src 'self'",
  "style-src 'self'",
  "script-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ');

// Svaret til en nettleser som sendte skjemaet uten JavaScript. Den skal se en
// side, ikke en JSON-blob, og den skal se den på norsk.
const KVITTERING = readFileSync(join(HER, 'kvittering.html'), 'utf8');

const KVITTERINGER = {
  paameldt: ['Du står på lista', 'Vi sender én e-post den dagen RUNDT slippes, og ikke noe annet.'],
  slettet: ['Adressen er borte', 'Den står ikke på lista lenger. Du kan melde deg på igjen når som helst.'],
  ugyldig_epost: ['Den adressen gikk ikke', 'Den ser ikke helt riktig ut. Gå tilbake og sjekk den en gang til.'],
  for_mange: ['Det holder for nå', 'Det har kommet nok forsøk fra deg den siste timen. Prøv igjen senere.'],
  ugyldig_kropp: ['Noe gikk galt', 'Skjemaet kom ikke fram slik det skulle. Prøv en gang til.']
};

function htmlRomming(tekst) {
  return tekst.replace(/[&<>"]/g, (t) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[t]);
}

function svarSide(res, kode, slag) {
  const [tittel, tekst] = KVITTERINGER[slag] ?? KVITTERINGER.ugyldig_kropp;
  const kropp = Buffer.from(
    KVITTERING.split('{{TITTEL}}').join(htmlRomming(tittel)).split('{{TEKST}}').join(htmlRomming(tekst)),
    'utf8'
  );
  res.writeHead(kode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': kropp.length,
    'Cache-Control': 'no-store'
  });
  res.end(kropp);
}

function svar(res, kode, data) {
  const kropp = Buffer.from(JSON.stringify(data), 'utf8');
  res.writeHead(kode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': kropp.length,
    'Cache-Control': 'no-store'
  });
  res.end(kropp);
}

/**
 * Les kroppen, eller gi opp om den er for stor.
 *
 * Merk at forbindelsen ikke rives når grensa sprekker. Første versjon gjorde
 * det, og da fikk avsenderen en nullstilt forbindelse i stedet for et svar —
 * altså «fetch failed» og ingen anelse om hvorfor. Nå skrives 413-svaret
 * først, og strømmen kastes når svaret er ute.
 */
function lesKropp(req, res) {
  return new Promise((resolve, reject) => {
    let lengde = 0;
    const biter = [];
    let sprakk = false;

    req.on('data', (bit) => {
      if (sprakk) return;
      lengde += bit.length;
      if (lengde > MAKS_KROPP) {
        sprakk = true;
        biter.length = 0;
        res.once('finish', () => req.destroy());
        reject(new Error('for stor'));
        return;
      }
      biter.push(bit);
    });
    req.on('end', () => {
      if (!sprakk) resolve(Buffer.concat(biter).toString('utf8'));
    });
    req.on('error', (e) => {
      if (!sprakk) reject(e);
    });
  });
}

/**
 * Avsenderen, slik vi klarer å se den.
 *
 * Containeren står bak dashboardets proxy, så socket-adressen er alltid
 * proxyen. X-Forwarded-For kan forfalskes av hvem som helst, men den brukes
 * bare til kvoten, og kvoten er uansett en bremse og ikke en sperre.
 */
function avsender(req) {
  const videresendt = req.headers['x-forwarded-for'];
  if (typeof videresendt === 'string' && videresendt.length > 0) {
    return videresendt.split(',')[0].trim().slice(0, 64);
  }
  return req.socket.remoteAddress ?? 'ukjent';
}

export function lagBehandler({
  dataKatalog = process.env.DATA_DIR ?? join(HER, '..', 'data'),
  kontaktEpost = process.env.KONTAKT_EPOST ?? '',
  lager = null,
  kvote = new Kvote()
} = {}) {
  const liste = lager ?? new Lager(dataKatalog);
  const filer = lesInn(PUBLIC, { KONTAKT: kontaktEpost });

  return async function behandle(req, res) {
    const url = new URL(req.url, 'http://rundt.invalid');
    const sti = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/';

    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (sti === '/api/helse') {
      return svar(res, 200, { ok: true });
    }

    if (sti === '/api/varsling' || sti === '/api/varsling/slett') {
      const sletting = sti.endsWith('/slett');
      // Uten JavaScript sender nettleseren et vanlig skjema og forventer en
      // side tilbake. Med JavaScript sender side.js JSON. Begge veier ender i
      // den samme koden, og det er `ut` som avgjør hvordan svaret ser ut.
      const somSkjema = String(req.headers['content-type'] ?? '')
        .startsWith('application/x-www-form-urlencoded');
      const ut = somSkjema
        ? (kode, data) => svarSide(res, kode, data.feil ?? (sletting ? 'slettet' : 'paameldt'))
        : (kode, data) => svar(res, kode, data);

      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return svar(res, 405, { feil: 'metode' });
      }
      if (!kvote.slippGjennom(avsender(req))) {
        return ut(429, { feil: 'for_mange' });
      }

      let rå;
      try {
        rå = await lesKropp(req, res);
      } catch {
        return ut(413, { feil: 'ugyldig_kropp' });
      }

      let data;
      if (somSkjema) {
        const felter = new URLSearchParams(rå);
        data = { epost: felter.get('epost'), gate: felter.get('gate'), kilde: felter.get('kilde') };
      } else {
        try {
          data = JSON.parse(rå);
        } catch {
          return ut(400, { feil: 'ugyldig_kropp' });
        }
      }

      // Honeypot: et felt som er skjult for folk og fristende for skript.
      // Fylt ut betyr bot, og boten får et vellykket svar slik at den ikke
      // lærer noe av å prøve igjen.
      if (typeof data?.gate === 'string' && data.gate.trim() !== '') {
        return ut(sletting ? 200 : 201, { ok: true });
      }

      const adresse = normaliser(data?.epost);
      if (!adresse) return ut(400, { feil: 'ugyldig_epost' });

      if (sletting) {
        liste.slett(adresse);
        // Samme svar enten adressen sto der eller ikke. Ellers blir
        // sletteskjemaet en måte å sjekke om noen står på lista.
        return ut(200, { ok: true });
      }

      liste.leggTil(adresse, typeof data?.kilde === 'string' ? data.kilde.slice(0, 32) : null);
      return ut(201, { ok: true });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return svar(res, 405, { feil: 'metode' });
    }

    const fil = filer.get(sti);
    if (fil) return serverFil(fil, req, res);

    const fireNullFire = filer.get('/404.html');
    if (fireNullFire) {
      res.writeHead(404, { 'Content-Type': fireNullFire.type, 'Cache-Control': 'no-cache' });
      return res.end(req.method === 'HEAD' ? undefined : fireNullFire.innhold);
    }
    return svar(res, 404, { feil: 'finnes_ikke' });
  };
}
