# Design

Mood: a sheet of squared paper and a fine black pen. The diagram is the only
thing with weight on the screen; everything else is a hairline, a label, or
nothing at all.

## Theme

Light only. A warm off-white page, a white sheet of paper, brown-black ink, and
one blue that means "this is selected" and nothing else. Colour strategy:
**restrained**, and stricter than usual because the diagram is monochrome by
design. A flow chart printed in black on white is the reference; the accent
exists for the editor, not for the drawing.

## Colour (OKLCH)

| Token | Value | Role |
|---|---|---|
| `--bg` | `oklch(0.985 0.004 85)` | Around the paper: the app's own background. |
| `--paper` | `oklch(1 0 0)` | The sheet being drawn on. |
| `--grid` | `oklch(0.93 0.006 85)` | Dots on the paper, 24px apart. |
| `--surface` | `oklch(1 0 0)` | Shape fill, sheets, buttons. |
| `--surface-deep` | `oklch(0.965 0.006 85)` | The toolbar strip. |
| `--line` | `oklch(0.9 0.007 85)` | Hairlines and borders. |
| `--ink` | `oklch(0.24 0.014 70)` | Text and shape outlines. ~13:1 on paper. |
| `--muted` | `oklch(0.52 0.012 70)` | Arrows, edge labels, help text. ~6:1. |
| `--accent` | `oklch(0.55 0.13 250)` | Selection, the primary button. Nothing else. |
| `--danger` | `oklch(0.5 0.17 25)` | The delete chip, as text only. |

Arrows are `--muted` rather than `--ink` on purpose: the boxes carry the
content, the lines carry the order, and lines as black as the text turn a
diagram into a mesh.

## Type

System stack throughout, 15px on the canvas and 13px on labels and chrome.
Monospace only in the text view, where Mermaid is code. No display face: a flow
chart is read at a glance and a distinctive font is a distraction inside a box.

## Shapes

Three, and no more: a rectangle for a step, a diamond for a decision, a stadium
for a start or an end. Outlines are 2px so they hold up when the PNG lands in a
slide. A box grows downwards as text is added and stops widening at what the
wrap allows, so a paragraph makes a tall box rather than a box the width of the
page.

The **+** buds on a selected shape are the accent's other job. They are drawn
last so a neighbouring box can never bury one, and they are the only round
things on the canvas, which is what tells them apart from the diagram.

## Motion

Almost none. Selection and hover are instant state changes at 150ms, and the
canvas itself does not animate: a box that eases into place while you are still
dragging it feels like lag. `prefers-reduced-motion` collapses what is left.

## Layout

Full-height flex column: a wrapping toolbar strip, then the canvas taking the
rest. Floating pieces sit over the canvas rather than taking space from it,
each pinned to a side it belongs to: the shape row at the top when something is
selected, the help line at the bottom, sheets above that. The canvas never
resizes when a panel appears, because the diagram moving under the pointer is
worse than a panel overlapping it.
