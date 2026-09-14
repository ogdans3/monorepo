import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Lager } from '../src/lager.js';

function nyttLager() {
  return new Lager(mkdtempSync(join(tmpdir(), 'rundt-')));
}

test('legger til, og teller duplikater som ett', () => {
  const l = nyttLager();
  assert.equal(l.leggTil('ola@eksempel.no'), 'ny');
  assert.equal(l.leggTil('OLA@eksempel.no'), 'fantes');
  assert.equal(l.antall, 1);
});

test('overlever en omstart', () => {
  const katalog = mkdtempSync(join(tmpdir(), 'rundt-'));
  new Lager(katalog).leggTil('ola@eksempel.no', 'apning');
  const igjen = new Lager(katalog);
  assert.equal(igjen.antall, 1);
  assert.ok(igjen.har('Ola@Eksempel.no'));
});

test('sletting fjerner rada fra fila, den markeres ikke bare', () => {
  const katalog = mkdtempSync(join(tmpdir(), 'rundt-'));
  const l = new Lager(katalog);
  l.leggTil('ola@eksempel.no');
  l.leggTil('kari@eksempel.no');
  assert.equal(l.slett('OLA@EKSEMPEL.NO'), true);
  assert.equal(l.slett('ola@eksempel.no'), false);

  const paaDisk = readFileSync(join(katalog, 'liste.jsonl'), 'utf8');
  assert.ok(!paaDisk.includes('ola@'), 'adressen skal være borte fra fila');
  assert.ok(paaDisk.includes('kari@'));
  assert.equal(new Lager(katalog).antall, 1);
  assert.ok(!existsSync(join(katalog, 'liste.jsonl.ny')), 'ingen halvskrevet fil skal bli liggende');
});

test('en halvskrevet siste linje stopper ikke resten av lista', () => {
  const katalog = mkdtempSync(join(tmpdir(), 'rundt-'));
  writeFileSync(
    join(katalog, 'liste.jsonl'),
    '{"epost":"kari@eksempel.no","tidspunkt":"2026-01-01T00:00:00.000Z"}\n{"epost":"ola@eks'
  );
  assert.equal(new Lager(katalog).antall, 1);
});
