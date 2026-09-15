# Design

The visual system. Two files hold the palette — this one and
`app/lib/design/tokens.dart`. Change them together or they drift.

## Colour

Two colours do all the work, so they are chosen for how far apart they are
rather than for how they feel.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `good` | `oklch(0.66 0.15 158)` | `oklch(0.72 0.15 158)` | the good half, good squares |
| `bad` | `oklch(0.52 0.19 25)` | `oklch(0.58 0.19 25)` | the bad half, bad squares |
| `ink` | `oklch(0.18 0.01 260)` | `oklch(0.95 0.005 260)` | text |
| `ink-muted` | `oklch(0.48 0.015 260)` | `oklch(0.68 0.015 260)` | secondary text |
| `bg` | `oklch(0.99 0.002 260)` | `oklch(0.16 0.006 260)` | behind everything |
| `surface` | `oklch(0.96 0.004 260)` | `oklch(0.22 0.008 260)` | the corner button, sheets |
| `line` | `oklch(0.89 0.006 260)` | `oklch(0.30 0.01 260)` | hairlines |

**The green and the red differ in lightness, not only in hue.** Good sits around
L 0.66 and bad around L 0.52, a gap wide enough that the two are still different
greys in a greyscale screenshot. That is the first line of defence, because
red-green is the common colour blindness and this app is red and green.

**The second line is a toggle.** Settings offers a colour-blind pair —
`oklch(0.62 0.16 250)` blue for good and `oklch(0.70 0.17 65)` orange for bad —
which is the standard robust substitution and keeps the same lightness gap. It
changes the squares and the buttons everywhere, and nothing else in the product
depends on the hue.

**No third colour.** There is no accent, no brand colour, no highlight. A third
hue on a screen whose entire meaning is "which of these two" would be a lie
about what matters.

## Type

One family: the system UI stack. This is a product, not a poster, and the only
long string on any screen is a date range.

| Role | Size | Weight |
|---|---|---|
| Button word | 34–96, see below | 700 |
| Screen title | 24 | 700 |
| Body | 16 | 400 |
| Label / caption | 13 | 500 |

## Layout

The button word is the one thing here that scales: `0.17 ×` the short side of
the half it sits in, clamped to 34–96. That screen is closer to a poster than to
a control panel, and a fixed 34 is lost in the middle of a laptop-sized field of
colour. Everything else is a fixed scale, because everything else is UI.

The home screen is two halves and nothing else. They are stacked on a phone
(good on top) and side by side when the window is wider than it is tall, so the
same build works on a laptop without a second layout.

The corner button is 48dp, bottom left, inset 20dp, and it is the only thing
floating over the two halves. It is deliberately small: it is not part of the
job, it is the way out of it.

Nothing is a card. Nothing has a shadow except the corner button, which needs
one to survive sitting on top of a saturated colour.

## Motion

- **A tap** flashes its half and throws a small square of that colour down to
  the corner button, where the history lives. 420ms, ease-out. It is the only
  confirmation there is, so it has to be unmistakable and it has to be over
  before you could have looked away.
- **The recap** rains its squares in over roughly four seconds. Each one falls
  from above the top edge and lands in its cell, and the landings get closer
  together as it goes: the nth of N lands at `T·√(n/N)`, which is what makes it
  speed up rather than tick along. A tap skips to the end.
- **Everything else** is 160–220ms, ease-out, no bounce.
- `MediaQuery.disableAnimations` replaces the tap throw with a flash and lands
  every recap square at once. Reduced motion is a setting people choose for a
  reason, and a screen full of falling objects is exactly what they meant.

## Copy

British-flavoured plain English, lower case for labels, no exclamation marks,
no encouragement. The app never says "well done" and never says "oh dear". It
says what it recorded and what it found.
