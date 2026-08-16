# Design

## Theme

Warm ink on a pure white plate. An anatomy textbook that respects you.

The mood phrase this was composed from: *a single lamp on in a quiet room at
six in the morning, and a good anatomical plate open on the table.*

Two decisions follow from that and everything else follows from them.

**The surface is pure white**, `oklch(1 0 0)`, with no hidden warmth in it. The
warmth in this product lives in the ink, the primary and the illustration.
Putting warmth in the background as well is the tell that turns a considered
palette into a wellness app, and the whole warm-off-white band is the saturated
default of the moment. White also gives the anatomy the most legible surface
there is, and legibility of the anatomy is the product's core function.

**The ink is brown-black, not blue-black.** This is what keeps a pure white
page from reading clinical. Every line of type and every anatomical stroke sits
at hue 60, warm, so the page feels lamp-lit rather than fluorescent.

Colour strategy: **restrained**. Tinted neutrals plus one accent under ten
percent of the surface. This is not a stylistic preference here, it is a
functional requirement. Pain intensity needs its own unmistakable colour
language, and it can only read as data if the chrome around it is quiet.

## Colour

| Token | Value | Role |
|---|---|---|
| `--bg` | `oklch(1 0 0)` | Page. Pure white, no tint. |
| `--plate` | `oklch(0.985 0.004 60)` | The panel the anatomy sits on. The only tinted surface, and barely. |
| `--surface` | `oklch(0.968 0.006 60)` | Controls, pressed states, inactive chips. |
| `--line` | `oklch(0.9 0.008 60)` | Hairlines and borders. |
| `--ink` | `oklch(0.23 0.018 60)` | Body text. Warm near-black, 14:1 on bg. |
| `--muted` | `oklch(0.5 0.014 60)` | Secondary text. 5.9:1 on bg. |
| `--primary` | `oklch(0.72 0.14 78)` | Honey amber. Interactive affordances only. |
| `--primary-deep` | `oklch(0.52 0.12 66)` | Hover, and amber text where contrast demands it. |
| `--anatomy` | `oklch(0.38 0.02 60)` | Anatomical line work. Softer than ink so labels sit on top of it. |
| `--danger` | `oklch(0.48 0.19 25)` | Red flags and errors. Used almost never, which is the point. |

### The pain ramp

Separate from the palette above, and deliberately so. This is data, not chrome.

| Level | Value | |
|---|---|---|
| 1 to 2 | `oklch(0.88 0.09 85)` | Pale honey |
| 3 to 4 | `oklch(0.80 0.13 70)` | Amber |
| 5 to 6 | `oklch(0.70 0.16 47)` | Warm orange |
| 7 to 8 | `oklch(0.58 0.19 32)` | Rust |
| 9 to 10 | `oklch(0.45 0.20 22)` | Oxblood |

Monotonic in lightness from 0.88 down to 0.45, so it survives greyscale and
every form of colour blindness as a light-to-dark ramp. It shares the primary's
warm family on purpose: the brand and the pain speak the same language, and the
ramp simply runs deeper than the brand ever goes.

Never used alone. Always with the number and the position on the scale.

## Typography

- **UI and prose**: system stack. Native, instant, no font download, and it
  disappears, which is what body copy should do here.
- **Anatomical labels and data**: `ui-monospace` stack. Measurements, levels
  and muscle names in mono reads as a specimen label rather than as marketing.
- Scale, ratio 1.2: 0.8125 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.125 rem.
- H1 is 2.125 rem. Line height 1.6 on prose, 1.2 on headings.
- Body copy caps at 68ch. Never full width, because a wall of text about your
  own body is the WebMD failure mode.

## Components

- **Body map**: the hero. Anatomy in `--anatomy` line work on `--plate`.
  Regions are `<button>` elements inside the SVG, each with an accessible
  name. Unselected regions have no fill at all. Hover gives a faint amber wash,
  selected gives a solid amber at low alpha plus a stroke, so selection never
  depends on colour alone.
- **View switcher**: five segmented controls, front / back / left / right /
  soles. Text labels, not icons, because an icon for "soles of the feet" does
  not exist and inventing one helps nobody.
- **Body switcher**: two options, stated plainly and once.
- **Region detail**: the same drawing language, zoomed, with named structures.
  Labels in mono with a hairline leader line.
- **Pain scale**: eleven stops from 0 to 10, each with the number, the ramp
  colour and a short description of what that level actually means. Not a bare
  slider: a slider with no anchors produces meaningless numbers.
- **Result card**: condition name, the plain-language name beside it, the
  matched features as a list of ticks and the unmatched as a list of dashes.
  The score is written as a fraction, never a percentage.
- **Red flag**: full-width, `--danger` hairline and text, placed above
  everything else, never dismissible.
- **Buttons**: one solid primary per screen, ghost for secondary, text links
  everywhere else.

## Layout

- Single column, 44rem, centred. This is a linear interview and pretending
  otherwise with a dashboard grid would be a lie about the task.
- The body map is allowed to break out wider, to 60rem, because it is the one
  thing that benefits from size.
- Generous vertical rhythm. Sections at 3.5rem, related items at 1rem. The
  calm in this product is made of space.
- Mobile: the body map fills the width and the flow is unchanged. Regions get
  a 44px minimum touch target even where the drawn shape is smaller.

## Motion

- Zooming from the whole body into a region is the one animation that carries
  meaning: it shows where you are going. 280ms, ease-out-quart.
- Everything else is a 120ms colour or opacity change, or nothing.
- `prefers-reduced-motion`: the zoom becomes an instant change of view rather
  than being dropped, since the meaning has to survive.
- No breathing, pulsing or floating anything. This is not a meditation app.
