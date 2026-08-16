# Product

## Register

product

## Users

People with a pain they have been putting off dealing with. Not athletes with
an acute injury and not patients mid-treatment: the much larger group who have
had a sore hip or a bad shoulder for weeks, have not seen anyone about it, and
want to understand it well enough to decide what to do.

The scene this is designed for: someone sits on the edge of the bed early in
the morning, presses a thumb into their own hip, and tries to work out whether
this is the thing they should finally do something about. They are alone with
it, slightly worried, not panicking, and they have been here before.

They arrive knowing roughly where it hurts and almost nothing about what is
under the skin there. They leave with a name for it, a sense of how confident
that name is, and something to do next.

## Product Purpose

Turn "my hip hurts" into a specific, structured picture of the pain, and then
into named conditions that commonly present that way.

The flow is deliberately narrowing. Five views of the body, front, back, both
sides and the soles of the feet, for a rough answer. Then one region at a time,
zoomed into a real muscle diagram, for a precise one. Then intensity on an
explained 0 to 10 scale. Repeat per region, assemble into a pain profile,
interpret.

Success is someone saying "that is exactly where it hurts" while pointing at
the screen, and then acting on what it told them.

## The interpretation, and its honest limits

The product names conditions and ranks them. It does not invent a probability
for them, because there is no honest way to compute one from a pain map: that
would need validated likelihood ratios this product does not have, and a
fabricated percentage is a fabricated number no matter how confident it looks.

Instead the score is one that can be shown: a condition matches on a stated
number of features out of the features it is defined by, and the matched and
unmatched ones are both listed. Equally specific to read, and it survives being
asked where it came from.

Red flags are separate from the ranking and override it. Saddle numbness,
bladder changes, unexplained weight loss, night pain that wakes you, fever with
back pain, and chest or jaw pain do not compete with the other results for
position on the page. They interrupt.

This is not medical advice and says so, but not by burying a disclaimer that
nobody reads. The limits are stated where they matter, in the words around each
result.

## Brand Personality

Warm, precise, unhurried.

It speaks the way a good physiotherapist does on a first visit: direct, using
the real anatomical names but always with the plain word beside them, and never
talking down. It does not reassure reflexively, and it does not alarm. When
something is uncertain it says so in the same tone it uses for everything else.

No exclamation marks, no encouragement, no "great job". Someone in pain is not
looking for a cheerleader.

## Anti-references

- **Clinical blue and white.** The default look of every symptom checker and
  patient portal. Cold, institutional, and the reason people feel like a case
  number.
- **Wellness pastel.** Calm, Headspace and every meditation app: rounded
  gradients, breathing animations, soft-focus language. Warm was chosen over
  clinical, and this is the trap on the other side. Warmth here comes from the
  ink and the illustration, not from a peach gradient.
- **WebMD and symptom-checker SEO farms.** Wall of text, dense ads, and a list
  of terrifying possibilities ranked by how alarming they are.
- **The medical stock photograph.** Smiling person in scrubs, folded arms,
  stethoscope. There are no photographs of people in this product at all.
- **Fake precision.** "73% match" with nothing behind it, confidence meters,
  anything that dresses a guess as a measurement.

## Design Principles

1. **The body is the only rich thing on screen.** The anatomy carries all the
   visual weight. Everything else, chrome, controls and type, gets out of its
   way. If a screen competes with the diagram, the screen is wrong.
2. **Show the working.** Every conclusion names the features it matched and the
   ones it did not. A number that cannot be explained does not ship.
3. **Interrupt for the things that matter.** Red flags are not a card further
   down the results. They break the flow, because someone using this instead of
   seeing a clinician is exactly who needs to be stopped.
4. **Their body, their words.** Anatomical precision and plain language
   together, never one without the other. "Gluteus medius, the muscle on the
   side of your hip."
5. **Calm comes from rhythm, not from colour.** Space, type and pacing do the
   soothing. Colour is reserved almost entirely for the pain data itself, so
   that when something is red it means something.

## Accessibility & Inclusion

WCAG 2.2 AA throughout.

- **Pain intensity is never colour alone.** Always the number, the colour and
  the position on the scale together. The ramp is also monotonic in lightness,
  so it survives greyscale and every form of colour blindness.
- **The body map is fully keyboard operable.** An SVG region picker is the
  easiest thing in this product to build mouse-only. Every region is a real
  focusable control with a visible focus ring and an accessible name, and the
  whole flow can be completed without a pointer.
- **Reduced motion respected.** Zooming into a region is the one place motion
  carries meaning, so it becomes an instant change rather than being removed.
- **Both male and female bodies**, chosen by the user, with neutral wording
  around the choice. It is about anatomy, not identity, and the copy says so
  without making a performance of it.
- Target sizes at least 24 by 24 CSS pixels, which matters more here than
  usual: some of these people have hand, wrist or shoulder pain.
