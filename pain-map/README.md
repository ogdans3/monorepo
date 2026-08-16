# pain-map

A pain mapping tool. Five views of the body, front, back, both sides and the
soles of the feet, to say roughly where it hurts. Then one region at a time,
zoomed into a detailed diagram, to say exactly where. Then intensity on an
explained 0 to 10 scale. The result is a pain profile and an interpretation.

`PRODUCT.md` and `DESIGN.md` are the authority for what this is and how it
looks. Read them first.

## Status

Early. The scaffold, the design tokens and the parametric body system exist.
The anatomy is the open question: see the note at the bottom.

## How the anatomy works

Nothing here is a hand-drawn asset. `src/lib/anatomy/proportions.ts` holds the
body as numbers, named landmarks on a 200 by 520 grid, and
`silhouette.ts` generates the outlines from them. Two consequences:

- Male and female are the same code with different measurements, so the two
  bodies cannot drift into different drawing styles.
- The clickable regions will be built from the same landmarks as the drawing,
  so an overlay cannot end up misaligned with the body underneath it.

`path.ts` is a small path model with mirror and reverse, which exists because
the body has to be walked as one continuous outline. Drawing each half as its
own closed shape leaves a stroked seam down the middle of every torso.

Vertical landmarks follow the 7.5-head anatomical canon, checked as fractions
of total height. The crotch sits at exactly half the total height. An earlier
draft put it at 61% by eye and gave the body a long torso on short legs.

Shapes are filled with the plate colour and stacked, so each one hides the
lines behind it. That is how layered line art works, and it is what makes the
arms read as being in front of the ribs.

## Commands

```sh
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm build
```
