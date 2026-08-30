# Working in swapply-design

Read `README.md` first. This project only hosts design-doc exports; it has no
build step, no dependencies and no state.

- **The product is spelled "Swaply"**, one p, as the exports have always had it.
  A previous pass rewrote rounds 1-3 to "Swapply"; that was wrong and has been
  reverted. Do not "correct" it back. The directory, npm name, dashboard slug
  and subdomain are still `swapply-design` — those are deployment identifiers,
  not the product name, and renaming them would move the site.
- **The docs are artefacts, not source.** Do not restyle, refactor or "fix"
  anything inside `public/docs/*.html` or `support.js`. The one sanctioned edit
  is the `resources.js` script line that points the runtime at vendored React.
  If a doc looks wrong, the fix belongs in the next export, not here.
- **`public/rounds.json` is generated.** Change `tools/index-docs.js` and re-run
  `npm run index` rather than hand-editing the JSON. Exports do not all use the
  same group markup: round 4 introduced non-numeric section ids (`gS`, `g7alt`,
  `g8t`) and stacked two kickers inside one `<section>`, so the parser splits on
  kickers as well as sections. Check the group list after adding an export.
- **Keep it dependency-free.** `server.js` is plain node, the pages are plain
  HTML/CSS/JS. A framework here would be more machinery than the job needs.
- **The UI is Norwegian**, matching the mockups. Keep new copy Norwegian.
