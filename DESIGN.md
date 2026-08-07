# Design

The scene this is designed for: *two people mid-Saturday — one at home with the
phone flat on a kitchen counter in daylight, one in a hardware store aisle
under fluorescent light — working the same list.* Daylight and glare force the
default: **light theme, maximum ink contrast, no low-contrast elegance.** A
full dark theme ships alongside it for evening and for OS preference, but light
is the design's home.

## Color

**Strategy: Restrained.** Tinted neutrals plus exactly one accent, used for
under 10% of any screen. There is no second accent, no status palette, no
category colours.

The accent is a **deep rose** (`#C62D6A`). It is a deliberate rejection of the
two category reflexes — the cool blue productivity accent and the green
checkmark. It carries the checked state, the primary action, focus rings, and
the presence dot. Nothing else.

Neutrals are tinted 0.006–0.016 chroma toward the accent's hue (350°), which is
enough to keep greys from reading as cold system grey and not enough to read as
"pink UI".

### Light (default)

| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `bg` | `oklch(1 0 0)` | `#FFFFFF` | Page. Pure white — the accent carries all the warmth. |
| `surface` | `oklch(0.972 0.006 350)` | `#F9F4F6` | Sheets, input wells, the checked-items shelf. |
| `surfaceHover` | `oklch(0.945 0.009 350)` | `#F2EAEE` | Pressed row, hovered control. |
| `line` | `oklch(0.898 0.011 350)` | `#E3DADE` | Hairline separators (decorative). |
| `lineStrong` | `oklch(0.83 0.014 350)` | `#CFC4C8` | Container borders. |
| `ink` | `oklch(0.20 0.010 350)` | `#1A1417` | Body and headings. 18.2:1. |
| `inkMuted` | `oklch(0.505 0.015 350)` | `#6C6166` | Secondary text, placeholders. 5.9:1. |
| `inkFaint` | `oklch(0.62 0.014 350)` | `#8D8387` | Unchecked checkbox border, icons. 3.7:1 — UI only, never text. |
| `primary` | `oklch(0.555 0.193 2)` | `#C62D6A` | Accent. 5.3:1 on white, and white on it is 5.3:1. |
| `primaryHover` | `oklch(0.50 0.19 2)` | `#B1165B` | Pressed accent. |
| `primaryQuiet` | `oklch(0.955 0.030 2)` | `#FFE8EE` | Accent wash (selected row, QR frame). Accent on it: 4.6:1. |

### Dark

| Token | OKLCH | Hex | Contrast |
|---|---|---|---|
| `bg` | `oklch(0.168 0.006 350)` | `#110E0F` | — |
| `surface` | `oklch(0.218 0.009 350)` | `#1E181B` | — |
| `surfaceHover` | `oklch(0.262 0.011 350)` | `#292225` | — |
| `line` | `oklch(0.305 0.012 350)` | `#342D30` | — |
| `lineStrong` | `oklch(0.40 0.014 350)` | `#4E4549` | — |
| `ink` | `oklch(0.955 0.004 350)` | `#F2EFF0` | 16.8:1 |
| `inkMuted` | `oklch(0.715 0.016 350)` | `#AB9FA4` | 7.5:1 |
| `inkFaint` | `oklch(0.58 0.015 350)` | `#82777B` | 4.5:1 — UI only |
| `primary` | `oklch(0.705 0.165 2)` | `#F06E98` | 6.8:1 |
| `primaryHover` | `oklch(0.755 0.155 2)` | `#FE82A8` | — |
| `primaryQuiet` | `oklch(0.285 0.055 2)` | `#401E28` | accent on it: 5.2:1 |

**Destructive actions do not get their own red.** With a rose accent, a second
red would muddy the palette and dilute the accent's meaning. Deleting a list or
replacing a link is instead gated behind an explicit confirmation sheet that
states the consequence in words; the confirm button uses `primary`. Words carry
the warning, not hue.

## Typography

**One family: Inter** (`Inter`, variable, weights 400/500/600), with the
platform sans as fallback. Product UI does not need a display/body pairing, and
a display face in a checklist row would be a costume.

Fixed scale, ratio ≈ 1.2. No fluid clamping — phones do not resize.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `title` | 28 / 34 | 600, -0.02em | List title on the list screen |
| `heading` | 20 / 26 | 600, -0.01em | Screen titles, sheet headers |
| `body` | 16 / 23 | 400 | Item text, prose |
| `bodyMedium` | 16 / 23 | 500 | Buttons, list names on home |
| `label` | 14 / 19 | 500 | Secondary rows, meta |
| `caption` | 13 / 17 | 400 | Counts, timestamps, hints |
| `mono` | 13 / 20 | 400 | The share URL only (`ui-monospace`) |

The share link is the one place monospace appears — it's a token you might read
aloud or check character by character, and that is exactly what mono is for.

## Space & Shape

8dp base, with a 4dp half-step. Scale: `2, 4, 8, 12, 16, 20, 24, 32, 40, 56`.

- Screen gutter: 20dp. Row vertical padding: 14dp (min row height 56dp).
- Radii: `sm 8` (inputs, chips) · `md 12` (buttons, wells) · `lg 20` (sheets,
  QR frame) · `full` (presence dot, FAB).
- Elevation is used twice only: the bottom composer bar (a hairline top border
  plus a 12dp soft shadow) and modal sheets. Rows are never cards.

**Rows, not cards.** Both the home list and the checklist are hairline-separated
rows on the page background. A checklist of cards is the lazy answer and it
wastes the horizontal space the item text needs.

## Components

Every interactive component ships default / pressed / focused / disabled /
loading / error states.

- **Checkbox** — 24dp square, 8dp radius, 1.5dp `inkFaint` border when
  unchecked; fills `primary` with a white mark when checked. 48dp hit target.
  The mark draws in over 180ms; it does not pop or bounce.
- **Item row** — checkbox · text · right-edge affordance (a 44dp column with a
  low-contrast chevron that is always present, never hover-revealed). Checked
  rows go `inkMuted` with a strikethrough and drift to the bottom shelf.
- **Composer** — persistent bottom field on the list screen, not a modal. Enter
  submits and keeps focus so you can type five items in a row.
- **Sheets** — the item detail and the share sheet are bottom sheets with a
  drag handle, 20dp top radii, and a scrim at 40% ink.
- **Presence** — a filled `primary` dot plus a count ("2 here"), shown only
  when someone else is connected. Never avatars, never names.
- **Empty states teach.** Home empty: "No lists yet — a list is a link you can
  send to anyone." plus the two real actions (New list / Open a link). Not
  "Nothing here."
- **Skeletons, not spinners**, for the first load of a list: three grey rows at
  the real row height.

## Motion

150–250ms, `easeOutQuart`-family curves. No bounce, no elastic, no page-load
choreography.

| Moment | Duration | What |
|---|---|---|
| Check / uncheck | 180ms | Mark draws, text crossfades to muted, strikethrough wipes L→R |
| Row settles into the checked shelf | 220ms | Position transition only, after a 400ms grace so you can undo by looking |
| Sheet in / out | 240ms / 180ms | Translate + scrim fade |
| Remote change arrives | 200ms | Crossfade in place, plus one 900ms `primaryQuiet` wash on the changed row so you can see what someone else did |
| Swipe-to-open | tracks finger | Row translates, chevron rotates; releases past 40% |

Under **Reduce Motion** every one of these becomes an instant state change or a
plain crossfade. The remote-change wash still fires — it is information, not
decoration — but as a static 900ms tint with no transition.

The one piece of motion that is allowed to be *pleasing* rather than merely
functional is the checkmark draw. It is the thing the user came for.

## Anti-patterns for this project

- Green checkmarks. Blue accents. Both are the category reflex.
- Confetti, streaks, completion percentages framed as achievement.
- Cards around list items.
- Any hover-revealed affordance — this is a touch product first.
- Modals for anything that could be inline. The composer is inline. Renaming a
  list is inline. Only destructive confirmation and item detail earn a sheet.
- Avatars or names anywhere. There are no accounts.
