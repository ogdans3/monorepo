# pain-map

A pain mapping tool. Five views of the body, front, back, both sides and the
soles of the feet, to say roughly where it hurts. Then one region at a time,
zoomed into a detailed diagram, to say exactly where. Then intensity on an
explained 0 to 10 scale. The result is a pain profile and an interpretation.

`PRODUCT.md` and `DESIGN.md` are the authority for what this is and how it
looks. Read them first.

## Status

The whole flow works end to end: pick areas on any of the five views, narrow
each one down on a muscle diagram, rate it on an explained scale, answer the
safety questions, read the profile. Covered by `/tmp/e2e/flow.mjs`, which walks
it with two areas and checks the result.

What is unfinished, plainly: six regions have their own detailed diagram (hip
and groin, lower back, shoulder, knee, neck, sole of the foot) and seven more
borrow a neighbour's where that is anatomically right. Ten regions have no
close-up yet, and the flow says so rather than pretending. The diagrams read as
schematic anatomy rather than as medical illustration, and the silhouettes are
consistent but not polished.

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

## How the interpretation works

`src/lib/pain/conditions.ts` defines each condition as a list of features. The
score is how many matched out of how many there are, shown as a fraction, and
both the matched and the unmatched features are listed on screen.

It is deliberately not a probability. Getting one from a pain map needs
validated likelihood ratios this project does not have, so a percentage would be
a number invented to look confident. A fraction with its working shown is just
as specific to read and it survives being asked where it came from.

Two rules keep the list from becoming noise. A condition only appears if one of
its key features matched, and only if the person named a location: without the
second rule "worse with activity", which is true of nearly all musculoskeletal
pain, surfaced three conditions from an answer that named nowhere at all.

Red flags live in `redflags.ts` and never enter the ranking. A raised flag is a
different kind of statement from a match, and it renders above everything else
and cannot be dismissed. That matters more here than in a tool people take to a
clinician, because this product's audience is specifically people who are not
going to see anyone.

## Deploy

Single container, per the conventions in `/home/ai_user/git/README.md`. The
dashboard discovers it through the `pain-map` symlink in the git root, since
discovery only reads top-level folders and this lives in the monorepo.

```sh
docker build -t pain-map . && docker run -p 3000:3000 pain-map
```

## Commands

```sh
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm build
```
