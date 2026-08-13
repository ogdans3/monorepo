#!/usr/bin/env node
// Reads the exported design docs in public/docs/ and writes public/rounds.json,
// which is what the index page and the viewer's sidebar are built from.
//
// The docs are Claude design-doc exports: one <section id="gN"> per group, a
// small uppercase kicker naming the group, and one <div id="sNN"> per screen
// carrying a number badge and a caption. Nothing here rewrites the docs — run
// this again after dropping in a new export.

'use strict';

const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'public', 'docs');
const OUT = path.join(__dirname, '..', 'public', 'rounds.json');

// Round order is newest first; `file` is the export as it landed in public/docs.
const ROUNDS = [
  { n: 3, file: 'round-3.html', label: 'Runde 3', latest: true },
  { n: 2, file: 'round-2.html', label: 'Runde 2' },
  { n: 1, file: 'round-1.html', label: 'Runde 1' },
];

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

function parse(html) {
  const parts = html.split(/<section id="(g\d+)"/).slice(1);
  const sections = [];
  let title = '';
  let subtitle = '';

  for (let i = 0; i < parts.length; i += 2) {
    const id = parts[i];
    const body = parts[i + 1];

    if (id === 'g0') {
      const t = body.match(/font-size:2[0-9](?:\.\d)?px[^>]*>([^<]{3,120})</);
      const s = body.match(/font-size:13px;color:#6E7B73">([\s\S]*?)<\/div>/);
      title = t ? strip(t[1]) : '';
      subtitle = s ? strip(s[1]) : '';
      continue;
    }

    const kicker = body.match(/letter-spacing:\.14em[^>]*>([^<]+)</);
    const note = body.match(/color:#98A29B[^>]*>([^<]+)</);
    const screens = [...body.matchAll(
      /<div id="(s[a-z0-9]+)"[\s\S]{0,400}?<a href="#\1"[^>]*>([^<]+)<\/a><span[^>]*>([^<]+)<\/span>/gi
    )].map((m) => ({ id: m[1], num: strip(m[2]), name: strip(m[3]) }));

    sections.push({
      id,
      kicker: kicker ? strip(kicker[1]) : '',
      note: note ? strip(note[1]) : '',
      screens,
    });
  }

  // Every screen still is one 390×844 frame wrapper plus its inner phone body,
  // so the raw count is exactly twice the number of states on the canvas.
  const states = (html.match(/width:390px/g) || []).length / 2;

  return { title, subtitle, sections, states };
}

const rounds = ROUNDS.map((r) => {
  const html = fs.readFileSync(path.join(DOCS, r.file), 'utf8');
  const parsed = parse(html);
  return {
    n: r.n,
    label: r.label,
    latest: Boolean(r.latest),
    file: r.file,
    bytes: Buffer.byteLength(html),
    title: parsed.title,
    subtitle: parsed.subtitle,
    states: parsed.states,
    sections: parsed.sections,
  };
});

fs.writeFileSync(OUT, JSON.stringify({ rounds }, null, 2) + '\n');

for (const r of rounds) {
  const screens = r.sections.reduce((n, s) => n + s.screens.length, 0);
  console.log(`${r.file}: ${r.sections.length} grupper, ${screens} skjermer, ${r.states} tilstander`);
}
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
