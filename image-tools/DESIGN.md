# Design

Mood: a well-machined hand tool in Scandinavian workshop light — olive steel
on a white bench, nothing you don't need. The page disappears; the color does
the work.

## Theme

Light only (v1). Pure white surface; the brand lives in an olive typographic
primary, a deep bronze accent, and monospace data. Color strategy:
**restrained** (product register) — accent ≤ 10 % of any screen.

## Color palette (OKLCH)

| Token | Value | Role |
|---|---|---|
| `--bg` | `oklch(1 0 0)` | Page background. Pure white, no hidden warmth. |
| `--surface` | `oklch(0.972 0.004 110)` | Dropzone fill, panels, thumbnails backdrop. |
| `--surface-deep` | `oklch(0.945 0.006 110)` | Pressed / drag-over surface, code chips. |
| `--line` | `oklch(0.9 0.006 110)` | Hairlines, borders. |
| `--ink` | `oklch(0.24 0.015 110)` | Body text. ~13:1 on bg. |
| `--muted` | `oklch(0.49 0.012 110)` | Secondary text. ~6:1 on bg. |
| `--primary` | `oklch(0.545 0.1 112)` | Olive. Links, primary buttons, focus rings, drag highlight. White text on fills. |
| `--primary-deep` | `oklch(0.47 0.1 112)` | Hover/active of primary. |
| `--accent` | `oklch(0.4 0.11 78)` | Bronze. Savings pills, done-state ticks. Sparingly. |
| `--danger` | `oklch(0.5 0.15 27)` | Errors. |

Transparency previews sit on an 8 px checkerboard (`--surface-deep` on white).

## Typography

- **UI**: system stack (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`).
  Quiet-tool honesty: native, instant, zero font download.
- **Data**: monospace stack (`ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace`)
  for filenames, sizes, dimensions, format names and the `→` motif.
- Fixed rem scale, ratio ≈ 1.2: 0.8125 / 0.875 / 1 / 1.25 / 1.5 / 1.875 rem.
  H1 is 1.875 rem (30 px) — a tool page, not a poster.
- The `→` arrow is the brand motif: wordmark, H1 ("HEIC → JPG"), size deltas.

## Components

- **Dropzone**: the hero. 1.5 px dashed `--line` on `--surface`, generous
  padding, mono hint line. Dragging files anywhere on the page highlights it
  (border and text go `--primary`, surface deepens). It is a `<label>` for a
  real `<input type=file>`; focus-within shows the ring. Paste (⌘V) works.
- **File rows**: thumbnail (56 px, checkerboard), mono filename, size → size
  with bronze savings pill, dimensions; right side carries the one action:
  spinner → Download (solid primary) → or error text + Retry.
- **Buttons**: solid primary (white text) for the single main action; quiet
  ghost (ink text, hairline border) for secondary; bare text links elsewhere.
- **Quality control**: one range slider + mono readout, shown only for lossy
  targets, re-converts finished files on release.
- **Target picker** (landing only): segmented row of format chips,
  `aria-pressed`, olive fill on the active chip.

## Motion

150–250 ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint feel). Motion
conveys state only: row entrance (4 px rise + fade), drag highlight, status
crossfade, spinner. No page-load choreography. `prefers-reduced-motion`:
everything becomes an instant state change.

## Layout

Single centered column, `max-width: 42rem`, for the tool and copy; the
all-conversions index runs wider (`56rem`). Header: mono wordmark left, "All
conversions" right. Footer: one privacy line, one caveat line. Spacing on an
8 px-ish rhythm with deliberate breathing room around the dropzone.
