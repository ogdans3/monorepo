# docs

The written product work for **Swaply**, a bartering app: you say what you
want, and when the wishes close a loop — directly or through a chain of three
people — we connect everyone so a swap can happen.

This folder is documents, not code. There is nothing to build, run or deploy.

| File | What it is |
|---|---|
| [`DESIGN.md`](DESIGN.md) | The product as currently decided. Start here. Current as of round 5. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How it stands up: hosting, database, matching, the trade model, and data protection. |
| [`round-5-brief.md`](round-5-brief.md) | The screen-by-screen order for the latest round of mockups. |
| [`design-brief.md`](design-brief.md) | The original round 1 brief. Historical — several parts have since been cut. |
| `meeting-notes-*.md` | One per meeting, newest last. Decisions are written into the numbered points. |

**The product is spelled "Swaply", one p** (decided 06.09.2026).

The screen mockups themselves are exported separately and are not kept here.

## History

This folder was its own repository, `swappify`, until 09.09.2026. It moved into
the monorepo to get a remote, and then in here, next to the code it describes,
when the project itself was scaffolded. Commits from before the first move keep
their old root-level paths, so a path-limited `git log` on this folder starts
late; plain `git log` shows everything.
