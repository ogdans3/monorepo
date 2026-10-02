# Working in Podium

A presentation tool where the room votes from their phones. Read `README.md`
first. `PRODUCT.md` and `DESIGN.md` are the design contract, and
`.impeccable/surfaces/` holds the direction for the screens. The interface is
Norwegian: every string a person reads is in Norwegian, including the API's
error messages, which the app shows as they are.

## Layout

```
backend/   Go: cmd/podium (main), internal/app (everything), webdist (the built app, embedded)
web/       SvelteKit, adapter-static, SPA fallback. Svelte 5 runes.
```

`web/src/lib/stage/Stage.svelte` draws a slide everywhere: on the display, on
the editor's canvas and in the slide list. `web/src/lib/admin/editor.svelte.ts`
is the editor's state and its saving.

## Invariants

**One server process.** The hub that streams votes and slide changes is a map in
memory (`hub.go`). Two instances would split the room between them. Scaling out
needs Postgres `LISTEN/NOTIFY` between processes, which does not exist yet.

**A slide is percent, so it is the same slide at any size.** Every box is
`x/y/w/h` in percent of the 16:9 stage. Every type size is percent of the
stage's height, through `--u`, a registered custom property that is `1cqh` of
the stage. Never add a pixel size to anything drawn on a stage. Never fork
`Stage.svelte` into a display copy and an editor copy: what the presenter
builds must be what the room sees.

**The editor sends a slide whole, and the server is the only gate.** `PUT
/api/admin/slides/{id}` replaces the slide's elements and answers.
`cleanElements` clamps boxes, sizes and colours, and refuses media that is not
this presentation's own. An answer keeps its id, and with it its votes, for as
long as it is on the slide. An answer the editor has just made has an id that
is not a uuid (`new-…`). The server inserts it, and the editor swaps in the real
id from the response by position (`reconcile`). Removing an answer deletes its
votes. That is why the editor asks first when an answer has any.

**One vote per phone per question** is the unique `(slide_id, voter)` with the
`podium_voter` cookie. A vote is only taken for the slide on screen.

**Phones are told what is on screen and nothing else.** The ballot subscribes
with `?ballot` and gets `state` frames only. Votes and the phone count (`vote`,
`room`) go to the display and the editor. A hundred phones each hearing every
vote is a hundred squared frames, for nothing.

**A silent stream is a dead stream.** The server sends `event: ping` every
20 s, as an event and not a comment, because EventSource hides comments from
the page. `follow()` in `live.ts` restarts a stream that has heard nothing for
`SILENT_MS`, and checks again when a sleeping phone wakes.

**Uploads are what their bytes say.** The kind is sniffed from the first
512 bytes: only image, video or audio is taken. SVG and HTML sniff as text and
are refused, which keeps scripts out of `/media`. Files are served with
`nosniff` and an immutable cache. An id is never reused.

**JSON endpoints take only `Content-Type: application/json`** (`readJSON`). With
the `SameSite=Lax` cookie, that is the CSRF defence. Do not relax it for
convenience.

**The admin session is the expiry, signed with a key derived from the
password.** There is no session table, and changing `ADMIN_PASSWORD` signs
everyone out.

**Migrations are embedded and numbered**, and run at start-up under an
advisory lock. After a migration has run anywhere real, never edit it; add the
next number.

## Design rules that are easy to break

- The amber is for change and for the live state only: a count that has just
  moved, the «Direkte» marks. It is not an accent. It is also not offered as a
  text colour on slides.
- Hairlines, not cards. Counts are tabular figures (`.figure` for the counting
  face).
- The display has no chrome. The only things the tool adds there are the
  sound prompt, a lost-connection note and the first-seconds key hints, all
  in the bottom corner.
- Nintendo's Brain Training sound is never shipped, whatever the brief says.
  The chime in `chime.ts` is Podium's own.

## Checks

```sh
cd backend && go vet ./... && go test ./...          # needs `docker compose up -d db`
cd web && pnpm check && pnpm test
cd web && PODIUM_URL=… PODIUM_PASSWORD=… pnpm e2e     # the whole loop, against a running Podium
```

`go test -race` needs cgo. Without a C compiler, run it in
`golang:1.27.1-bookworm` with `--network host`.
