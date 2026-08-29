# Working in flow-chart

Read `README.md` first. `PRODUCT.md` and `DESIGN.md` are the design contract.

## Layout

```
src/lib/flow    model, geometry, layout, mermaid, export, store — all but the
                store is pure and tested
src/lib/ui      Canvas.svelte, the one component that needs a browser
src/routes      +page.svelte, the toolbar and the sheets
```

## Rules

- **Self-contained.** This folder must build, test and deploy alone, per the
  monorepo rule at the root. Never reference anything outside `flow-chart/`.
  If another project here has something useful, copy it.
- **The pure parts stay pure.** `flow/model.ts`, `geometry.ts`, `layout.ts`,
  `mermaid.ts` and `export.ts` must not touch a DOM, because the test suite
  runs them in plain node with no Svelte plugin and no jsdom. `toPng` is the
  one exception and it is at the bottom of `export.ts` where it is obvious.
- **Operations return a new document.** Nothing edits a `FlowDoc` in place. The
  history is a list of documents and undo is an index into it, so an operation
  that mutates would corrupt every earlier step at once.
- **A drag is one step in the history.** `commit(next, true)` folds a change
  into the previous one. Without it a drag leaves a hundred entries that each
  moved a box four pixels, and undo stops meaning anything.
- **The export builds its own SVG.** It does not copy the editor's DOM, which
  is full of selection rings, the grid and the half-drawn arrow. That is also
  what keeps the PNG identical to the SVG, since the PNG is that SVG drawn onto
  a canvas.
- **Three shapes, and the retired ones still load.** `RETIRED` in `model.ts`
  maps `io` and `note` onto `process` so a file drawn before they went away
  still opens, and the Mermaid reader maps their syntax the same way. Adding a
  fourth shape is a product decision, not a tidy-up: the count is the feature.
- **A captured pointer retargets the click pair, so double click is handled on
  the canvas.** `setPointerCapture` during a drag means `click` and `dblclick`
  are dispatched to the element that captured, not to the shape under the
  cursor. An `ondblclick` on a node therefore looks right and never fires,
  which is how double clicking a box to write in it silently did nothing.
  `onDoubleClick` in `Canvas.svelte` owns every double click and works out what
  was under it. Do not move it back onto the shapes.
- **A control drawn over the paper must set `onChrome`.** Stopping the press
  is not enough: the double click still reaches the canvas, which owns every
  one of them, and reads it as a double click on empty paper. That is how
  pressing a fold button twice added a step. The canvas' own `onPointerDown`
  clears the flag, since it only runs when nothing stopped the press.
- **Nothing edits while `presenting`.** Hiding the editing chrome is not the
  same as turning editing off, and a double click on the paper is the one that
  gets left in: it adds a step to the diagram in front of an audience.
- **Text is laid out in one place.** `nodeText` in `model.ts` decides the
  lines, their sizes and where each one sits, and both the canvas and the
  export draw what it returns. Two layout rules means a label that fits on
  screen and overflows in the file.
- **Folding is a setting, and the button outlives the fold.** `foldable` is
  what puts the button on a shape; `collapsed` is only whether it is folded
  right now. The button is drawn for every foldable node regardless of the
  selection, because gating it on selection is how a branch gets hidden with no
  obvious way back. `hiddenUnder` returns 0 for a node that is not foldable.
- **A hand-sized node stays hand-sized.** `resizeNode` sets `sized`, and
  `fitSize` leaves such a node alone, so typing into it does not undo the drag.
  `sized: false` is what "Fit to the text" means.
- **The canvas draws `visibleDoc`, and edits the whole document.** Hit testing
  and routing use the visible slice so a folded branch cannot be clicked; every
  mutation is made against `full`, because ids are the same in both and an
  operation that only saw the slice would quietly drop what is folded.
- **Mermaid says what it skipped.** Anything the reader does not understand
  goes in `skipped` and the page shows it. Never guess at a line: a diagram
  that quietly loses a branch is worse than one that admits it.
- **The setup effect is untracked.** The `$effect` in `+page.svelte` that
  restores the saved diagram and fits the view reads `editor.doc`, so left
  tracked it re-runs after every change: `restore()` puts the saved copy back
  over the edit and resets the history so Undo has nothing to go back to, and
  the view refits while somebody is mid drag. Keep the body inside `untrack`.
- **The diagram is in local storage on purpose.** It is the visitor's own work
  on their own machine. Nothing is uploaded, and there is no server side beyond
  serving the page, so do not add one.

- **A new project here needs a symlink before the dashboard can see it.**
  `ln -s monorepo/flow-chart ~/git/flow-chart`, relative, made once on the
  host. Discovery reads only the top level of `~/git`. This is not in the
  monorepo's own README, which is why it gets missed.

## Testing

```sh
pnpm test && pnpm check && pnpm build
```

Verify a change to the canvas in a real browser as well. The routing, the
arrow heads and the layout are the kind of thing that passes a test and still
looks wrong, and the fastest check is to import the sample in `README.md` and
look at it.
