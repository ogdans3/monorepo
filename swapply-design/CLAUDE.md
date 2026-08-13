# Working in swapply-design

Read `README.md` first. This project only hosts design-doc exports; it has no
build step, no dependencies and no state.

- **The docs are artefacts, not source.** Do not restyle, refactor or "fix"
  anything inside `public/docs/*.html` or `support.js`. The one sanctioned edit
  is the `resources.js` script line that points the runtime at vendored React.
  If a doc looks wrong, the fix belongs in the next export, not here.
- **`public/rounds.json` is generated.** Change `tools/index-docs.js` and re-run
  `npm run index` rather than hand-editing the JSON.
- **Keep it dependency-free.** `server.js` is plain node, the pages are plain
  HTML/CSS/JS. A framework here would be more machinery than the job needs.
- **The UI is Norwegian**, matching the mockups. Keep new copy Norwegian.
