# Flow chart

Draw a flow chart in the browser. Boxes, decisions and arrows, tidied up on
demand, out as SVG, PNG or Mermaid. Nothing is uploaded and nothing is stored
anywhere but the tab you drew it in.

```
src/lib/flow    the document, the geometry, the layout, Mermaid, the exports
src/lib/ui      the canvas
src/routes      one page
```

## Get it running

```sh
pnpm install
pnpm dev        # http://localhost:5173

pnpm test       # the pure parts, in plain node
pnpm check      # svelte-check
pnpm build      # adapter-node output in build/
pnpm start      # serve that build
```

Docker, which is how it deploys:

```sh
docker build -t flow-chart .
docker run --rm -p 3000:3000 flow-chart
```

The dashboard picks the project up from `Dockerfile` and `.dashboard.yaml`, and
reaches the container over the `aicentral` network, which is why `HOST` is
`0.0.0.0` in the image.

## Running it on the AI Central dashboard

The dashboard scans the top level of `~/git` and does not look inside
directories, so a project that lives in this monorepo is reached through a
symlink made once on the host:

```bash
ln -s monorepo/flow-chart ~/git/flow-chart
```

**Relative on purpose.** The dashboard container mounts the git directory, and
an absolute symlink would point outside that mount and break inside the
container. Every other project in this repository is set up the same way. It is
also the step that is easy to forget: without it the folder is complete, builds
and runs perfectly by hand, and simply never appears in the dashboard.

## Drawing

| | |
|---|---|
| Add the first shape | Double click the paper |
| Add the next one | Select a shape and press one of its **+** buttons. It arrives joined on |
| Add one somewhere else | Drag a **+** onto empty paper |
| Connect two | Drag a **+** onto another shape |
| Write in it | Double click it, or select it and press Enter. It is a box, not a line: paragraphs are fine, and Enter makes a new line |
| Change what it is | Select it and pick Step, Decision or Start/end |
| Move | Drag it. Positions land on an 8px grid |
| Delete | Select and press Delete |
| Move around | Drag the paper, scroll to zoom, **Fit** to see everything |
| Undo | Ctrl or Cmd + Z, shift to redo |

Almost every shape in a flow chart follows another one, so that is the one
action with a button on it. The **+** buds appear on whatever is selected, and
a press puts the next step in that direction and joins it up.

**Tidy up** arranges the shapes in rows by following the arrows, which is also
what makes an imported diagram usable, since Mermaid carries no positions.

## Three shapes

Something happens, something is decided, and the thing starts or stops. Every
other shape in the old stencils is a distinction the reader has to be taught and
a menu the writer has to think about, in exchange for nothing the words in the
box do not already say. A file drawn when there were five still opens: the two
that went away become the nearest thing that stayed.

## The four ideas it hangs on

**1. The document is a list of nodes and a list of edges.** Both serialisable as
they stand, which is what makes save, load, undo and export one problem rather
than four. Every operation in `flow/model.ts` returns a new document instead of
editing one, so the history is a list of documents and undo is an index into it.
No journal of inverse operations to get wrong.

**2. An arrow is trimmed to the outline it meets.** A rectangle, a diamond and a
stadium all cut the same line at different points, so `flow/geometry.ts` knows
each shape rather than treating them all as their bounding box. A diamond
trimmed as a box leaves a visible gap at the tip.

**3. An arrow that skips ahead goes round the outside.** If the direct line
would pass through another shape, it leaves sideways, runs down a clear lane and
comes back in. Drawn straight it reads as an arrow into every box it crosses,
which is the wrong diagram.

**4. It goes out as text as well as pictures.** A flow chart is usually on its
way somewhere else: a README, a wiki, a chat with a model. Mermaid out for that,
and Mermaid in because that is where a diagram often already exists, and
retyping one is why people give up on drawing them.

## Mermaid

A deliberate subset: `flowchart TD`, the three shapes this editor draws, and
arrows labelled either way round (`A -- yes --> B` and `A -->|yes| B`). Both
spellings get written by hand, so both are read. Mermaid's other shapes still
open, as steps, because a shape this editor cannot draw is no reason to refuse
somebody's diagram.

`subgraph`, `classDef`, `style` and the rest are **listed as skipped** rather
than guessed at. A diagram that silently loses a branch is worse than one that
says what it could not take.

## Where the drawing lives

In the tab, and in this browser's local storage so a stray reload does not cost
you the diagram. It is the visitor's own work on their own machine, which is
what device storage is for. **Save** writes a JSON file, **Open** reads one back,
and **Clear the canvas** forgets it. Nothing is sent anywhere: there is no
server side to this beyond the one that hands you the page.

## Testing

```sh
pnpm test
```

Everything worth testing is pure and runs in plain node with no DOM: the
document and its operations, the geometry that decides where an arrow meets a
shape and how it gets round an obstacle, the layout, the Mermaid reader and
writer, and the SVG the exports are built from. The canvas is the only part
that needs a browser, and it is deliberately thin: it turns pointers into calls
on the modules above.

## Later

- Straight-through routing for long edges could use proper dummy nodes, so two
  arrows down the same lane do not overlap. One lane is enough for now.
- Multi-select, and dragging a group.
- Swimlanes. They would need a second kind of thing in the document, so not
  until the first kind is finished.
