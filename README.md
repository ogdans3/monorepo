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
