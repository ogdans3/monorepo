# Product

## Register

product

## Users

Anyone who lands from a search like "heic to jpg" with a file in hand and a
task half-done: a parent with iPhone photos the school website rejects, a
developer needing a favicon, a designer handed a TIFF. They arrive mid-task,
often once, from any device. Zero patience for accounts, ads or upsells; they
want the file converted and to leave.

## Product Purpose

Free, client-side image conversion (and later editing) in the browser. Every
format pair gets its own fast page; the conversion itself never leaves the
user's device — decode to raw RGBA, encode to the target, download with the
same base filename. Success: the visitor converts within seconds of landing,
without scrolling, without reading instructions, and comes back unprompted.

## Brand Personality

Quiet, precise, trustworthy. A well-machined hand tool on a clean bench: you
pick it up, it works, you put it down. Dry copy with no exclamation marks, no
marketing adjectives, no "blazingly fast". Technical details (bytes, pixels,
extensions) are shown plainly in monospace — competence is the charm.

## Anti-references

- **Lunapic's GUI**: the direct impetus for this product. Great function
  buried under 2005-era chrome, menu sprawl and ads. We keep the utility,
  discard everything around it.
- **Convertio / CloudConvert / freeconvert.com**: upsell walls, fake-progress
  uploads, premium nags, cookie-consent labyrinths, "your file is ready"
  interstitials.
- **Fake-download-button aesthetics**: multiple competing green buttons is
  the signature of scam converter sites. There is exactly one obvious action
  per state, ever.
- **SaaS landing slop**: gradient heroes, badge walls, testimonial carousels.
  This is a tool, not a pitch.

## Design Principles

1. **The tool is the page.** The dropzone is above the fold on every page;
   converting requires zero scrolling and zero reading.
2. **Private by architecture.** Files never leave the device — so no upload
   patterns, no server progress bars, no "processing on our servers" language.
   The privacy line is stated once, plainly, and proven by the network tab.
3. **Quiet competence.** Monospace for data (names, sizes, dimensions,
   formats), dry copy, one accent used sparingly. No decoration that doesn't
   inform.
4. **Every state crafted.** Idle, drag-over, converting, done, error, retry —
   each designed, none an afterthought.
5. **Familiar affordances, machined finish.** Standard patterns (dashed
   dropzone, plain buttons, range slider) executed precisely, not reinvented
   for flavor.

## Accessibility & Inclusion

WCAG 2.1 AA. Full keyboard operation (dropzone is a real file input, all
actions reachable by Tab). Visible focus rings. Body text ≥ 4.5:1, UI
elements ≥ 3:1. Status changes announced via live regions. Reduced motion
honored: transitions collapse to instant state changes.
