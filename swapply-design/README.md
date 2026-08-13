# swapply-design

Hosts the screen mockups for **Swapply**, the bartering app where you swipe on
items you want and get a trade when the wishes close a loop. Three rounds of
drafts, each one a full pass over the flow.

- `/` — the index: one card per round, newest first, with a live scaled preview,
  the round's own change summary and its screen groups.
- `/r/<n>` — the viewer: the round in an iframe with a sidebar listing every
  screen (number + caption) that scrolls the doc, plus tabs to switch rounds.
- `/docs/round-<n>.html` — the raw export, exactly as it renders on its own.

Norwegian UI, because the mockups are Norwegian.

## Running it

```sh
npm start          # http://localhost:3000
```

No dependencies and no build step — a small node server (`server.js`) serving
`public/`. Docker: `docker build -t swapply-design . && docker run -p 3000:3000 swapply-design`.

## The docs

`public/docs/round-{1,2,3}.html` are Claude design-doc exports (originally
`Swapply Skjermer.dc.html`, `… v2.dc.html`, `… v3.dc.html`), served as-is next
to their `support.js` runtime. Two deliberate additions:

- `public/docs/vendor/` holds React 18.3.1 UMD, and `resources.js` points the
  runtime at it through `window.__resources`, its own documented override. Each
  doc gets one extra `<script>` line before `support.js`; nothing else in the
  exports was touched. Without this every page load pulls React from unpkg.
- `public/rounds.json` is the index the pages are built from — round titles,
  summaries, groups and per-screen captions, all parsed out of the docs.

To drop in a new export: put the file in `public/docs/`, add the
`resources.js` script line before `support.js`, add a row to `ROUNDS` in
`tools/index-docs.js`, then

```sh
npm run index      # rewrites public/rounds.json
```

## Exposure

Deployed through the master dashboard as `swapply-design`. Project subdomains
there are served **without authentication**, so treat anything published here as
public. `robots.txt` and a `noindex` meta keep it out of search results, which is
not the same as keeping it private.
