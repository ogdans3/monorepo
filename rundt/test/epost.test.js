import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliser, nokkel } from '../src/epost.js';

test('godtar vanlige adresser', () => {
  for (const a of ['ola@eksempel.no', 'o.nordmann+spill@ein-adresse.co.uk', 'a@b.io']) {
    assert.equal(normaliser(a), a);
  }
});

test('trimmer og senker domenet, men ikke lokaldelen', () => {
  assert.equal(normaliser('  Ola.Nordmann@Eksempel.NO '), 'Ola.Nordmann@eksempel.no');
});

test('avviser det som ikke kan sendes til', () => {
  for (const a of ['', '   ', 'ola', 'ola@', '@eksempel.no', 'ola@eksempel', 'ola nordmann@eksempel.no',
                   'ola@eksempel..no', 'ola@.no', 'ola@eksempel.no.', 'a@b.no\nbcc: c@d.no', null, 42, {}]) {
    assert.equal(normaliser(a), null, `skulle avvist ${JSON.stringify(a)}`);
  }
});

test('avviser adresser over RFC-grensa', () => {
  assert.equal(normaliser('a'.repeat(250) + '@eksempel.no'), null);
});

test('nøkkelen er versalufølsom, så samme innboks bare telles én gang', () => {
  assert.equal(nokkel('Ola@eksempel.no'), nokkel('ola@EKSEMPEL.no'));
});
