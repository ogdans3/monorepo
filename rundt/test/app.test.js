import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lagBehandler } from '../src/app.js';
import { Kvote } from '../src/kvote.js';

let server;
let base;
let dataKatalog;

before(async () => {
  dataKatalog = mkdtempSync(join(tmpdir(), 'rundt-app-'));
  server = createServer(
    lagBehandler({ dataKatalog, kontaktEpost: '', kvote: new Kvote({ maks: 100, vinduMs: 1000 }) })
  );
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const somJson = (kropp) =>
  fetch(base + '/api/varsling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(kropp)
  });

const somSkjema = (sti, felter) =>
  fetch(base + sti, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(felter).toString(),
    redirect: 'manual'
  });

const liste = () => {
  try {
    return readFileSync(join(dataKatalog, 'liste.jsonl'), 'utf8');
  } catch {
    return '';
  }
};

test('forsiden serveres, og den er komprimert', async () => {
  const r = await fetch(base + '/', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.equal(r.headers.get('content-encoding'), 'gzip');
  const html = await r.text();
  assert.match(html, /Tegn streken/);
});

test('en uendret side svarer 304', async () => {
  const første = await fetch(base + '/stil.css');
  const etag = første.headers.get('etag');
  assert.ok(etag);
  const andre = await fetch(base + '/stil.css', { headers: { 'If-None-Match': etag } });
  assert.equal(andre.status, 304);
});

test('stier som peker ut av public finnes ikke', async () => {
  for (const sti of ['/../package.json', '/%2e%2e/package.json', '/../src/app.js']) {
    const r = await fetch(base + sti);
    assert.equal(r.status, 404, sti);
  }
});

test('ukjente stier får 404-siden, ikke JSON', async () => {
  const r = await fetch(base + '/finnes-ikke');
  assert.equal(r.status, 404);
  assert.match(await r.text(), /Feil utgang/);
});

test('personvern nås både med og uten .html', async () => {
  for (const sti of ['/personvern', '/personvern.html']) {
    assert.equal((await fetch(base + sti)).status, 200, sti);
  }
});

test('kontaktavsnittet forsvinner når det ikke er satt noen adresse', async () => {
  const html = await (await fetch(base + '/personvern')).text();
  assert.ok(!html.includes('{{KONTAKT}}'), 'plassholderen skal aldri vises');
  assert.ok(!html.includes('mailto:'), 'ingen tom mailto-lenke');
});

test('en gyldig adresse havner på lista', async () => {
  const r = await somJson({ epost: ' Ola@Eksempel.NO ' });
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { ok: true });
  assert.match(liste(), /"epost":"Ola@eksempel\.no"/);
});

test('samme adresse to ganger gir samme svar og én rad', async () => {
  await somJson({ epost: 'kari@eksempel.no' });
  const r = await somJson({ epost: 'KARI@eksempel.no' });
  assert.equal(r.status, 201);
  assert.equal(liste().split('\n').filter((l) => l.includes('kari@')).length, 1);
});

test('en ugyldig adresse avvises og lagres ikke', async () => {
  const r = await somJson({ epost: 'ikke-en-adresse' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).feil, 'ugyldig_epost');
  assert.ok(!liste().includes('ikke-en-adresse'));
});

test('honeypot-feltet gir et vellykket svar, men lagrer ingenting', async () => {
  const r = await somJson({ epost: 'bot@eksempel.no', gate: 'Storgata 1' });
  assert.equal(r.status, 201);
  assert.ok(!liste().includes('bot@eksempel.no'));
});

test('sletting fjerner adressen, og svarer likt for en som ikke sto der', async () => {
  await somJson({ epost: 'slettmeg@eksempel.no' });
  const a = await fetch(base + '/api/varsling/slett', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epost: 'SlettMeg@eksempel.no' })
  });
  assert.equal(a.status, 200);
  assert.ok(!liste().includes('slettmeg@'));

  const b = await fetch(base + '/api/varsling/slett', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epost: 'harikkevaerther@eksempel.no' })
  });
  assert.equal(b.status, 200);
  assert.deepEqual(await b.json(), { ok: true });
});

test('skjemaet virker uten JavaScript og svarer med en side', async () => {
  const r = await somSkjema('/api/varsling', { epost: 'utenjs@eksempel.no', gate: '', kilde: 'apning' });
  assert.equal(r.status, 201);
  assert.match(r.headers.get('content-type'), /text\/html/);
  const html = await r.text();
  assert.match(html, /Du står på lista/);
  assert.ok(!html.includes('{{'), 'ingen plassholdere igjen i kvitteringen');
  assert.match(liste(), /utenjs@eksempel\.no/);
});

test('en feil uten JavaScript svarer også med en side', async () => {
  const r = await somSkjema('/api/varsling', { epost: 'tull' });
  assert.equal(r.status, 400);
  assert.match(await r.text(), /Den adressen gikk ikke/);
});

test('kvoten stenger etter nok forsøk', async () => {
  const enServer = createServer(
    lagBehandler({ dataKatalog: mkdtempSync(join(tmpdir(), 'rundt-kvote-')), kvote: new Kvote({ maks: 2, vinduMs: 60_000 }) })
  );
  await new Promise((r) => enServer.listen(0, '127.0.0.1', r));
  const adr = `http://127.0.0.1:${enServer.address().port}/api/varsling`;
  const send = () =>
    fetch(adr, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"epost":"a@b.no"}' });
  assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 429);
  enServer.close();
});

test('en kropp som er altfor stor avvises', async () => {
  const r = await fetch(base + '/api/varsling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ epost: 'a@b.no', fyll: 'x'.repeat(10_000) })
  });
  assert.equal(r.status, 413);
});

test('GET på skjema-endepunktet er ikke lov', async () => {
  const r = await fetch(base + '/api/varsling');
  assert.equal(r.status, 405);
  assert.equal(r.headers.get('allow'), 'POST');
});

test('svarene bærer en stram innholdspolicy', async () => {
  const r = await fetch(base + '/');
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('helsesjekken svarer', async () => {
  const r = await fetch(base + '/api/helse');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
});
