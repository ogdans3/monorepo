# monorepo

Several unrelated projects, kept in one repository so there is one thing to
clone, one deploy key and one backup. That is the only thing they have in
common.

## The rule

**Every top-level folder is a separate project, and no two projects are linked
in any way.**

Concretely, nothing may cross a top-level folder boundary:

- no imports, no shared packages, no path aliases, no workspace that spans two
  projects
- no shared lockfile, no shared `node_modules`, no shared virtualenv
- no shared config, tooling, linter rules, formatter settings or CI pipeline
- no relative path that walks up out of a project and back down into another
- no shared database, no shared environment file, no shared secrets
- no shared documentation beyond this page

The test to apply: **could you drag this folder out of here, drop it in an
empty repository, and have it still build, test and deploy without changing a
line?** If not, something has leaked across the boundary and needs undoing.

## What lives at the root

This README and `CLAUDE.md`, which restates the rule for agents. That is all.
The root is not a place to put anything "shared", because there is no such
thing here. If a project needs a `.gitignore`, a CI config or a Makefile, it
gets its own, inside its own folder.

## Adding a project

Make a folder, put the project in it, and give it everything it needs to stand
on its own. Do not reach for something another project already has. Copying is
correct here, and duplication between two projects is a feature rather than
debt, because it is what keeps them separable.

## Projects

| Folder | What it is |
|---|---|
| [`checkpost/`](checkpost/) | A shared checklist that lives at a link. Node API, Flutter app, SvelteKit landing page. |
| [`flow-chart/`](flow-chart/) | Draw a flow chart in the browser. Boxes, decisions and arrows, in and out as Mermaid, SVG or PNG. SvelteKit, no server side. |
| [`image-tools/`](image-tools/) | Client-side image converter — every format pair gets its own page, files never leave the browser. SvelteKit + WASM codecs. |
| [`hva-koster-norge/`](hva-koster-norge/) | The Norwegian state budget priced in ordinary annual salaries, one drawing per line item. |
| [`pain-map/`](pain-map/) | Mark where it hurts on a body and get matching conditions, with a features fraction rather than a made-up probability. |
| [`swaply/`](swaply/) | The Swaply bartering app — say what you want, and when the wishes close a loop everyone swaps. Fastify API, SvelteKit web, Flutter app, and the design docs that drive them. |
| [`swapply-design/`](swapply-design/) | Screen mockups for the Swaply bartering app — five rounds of drafts with a per-screen index, the newest not yet indexed. Static, dependency-free node server. |
