# Design

The scene this is designed for: *two people mid-Saturday, one at home with the
phone flat on a kitchen counter in daylight, one in a hardware store aisle
under fluorescent light, working the same list.* Daylight and glare force the
default: **light theme, maximum ink contrast, no low-contrast elegance.** A
full dark theme ships alongside it for evening and for OS preference, but light
is the design's home.

## Color

**Strategy: Restrained.** Tinted neutrals plus exactly one accent, used for
under 10% of any screen. There is no second accent and no status palette. The
one place colour sorts things is tags, and they are tints rather than accents:
see *Tag tints* below.

The accent is a **deep rose** (`#C62D6A`). It is a deliberate rejection of the
two category reflexes: the cool blue productivity accent and the green
checkmark. It carries the checked state, the primary action, focus rings, and
the presence dot. Nothing else.

Neutrals are tinted 0.006 to 0.016 chroma toward the accent's hue (350°), which is
enough to keep greys from reading as cold system grey and not enough to read as
"pink UI".

### Light (default)

| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `bg` | `oklch(1 0 0)` | `#FFFFFF` | Page. Pure white, so the accent carries all the warmth. |
| `surface` | `oklch(0.972 0.006 350)` | `#F9F4F6` | Sheets, input wells, the checked-items shelf. |
| `surfaceHover` | `oklch(0.945 0.009 350)` | `#F2EAEE` | Pressed row, hovered control. |
| `line` | `oklch(0.898 0.011 350)` | `#E3DADE` | Hairline separators (decorative). |
| `lineStrong` | `oklch(0.83 0.014 350)` | `#CFC4C8` | Container borders. |
| `ink` | `oklch(0.20 0.010 350)` | `#1A1417` | Body and headings. 18.2:1. |
| `inkMuted` | `oklch(0.505 0.015 350)` | `#6C6166` | Secondary text, placeholders. 5.9:1. |
| `inkFaint` | `oklch(0.62 0.014 350)` | `#8D8387` | Unchecked checkbox border, icons. 3.7:1, UI only, never text. |
| `primary` | `oklch(0.555 0.193 2)` | `#C62D6A` | Accent. 5.3:1 on white, and white on it is 5.3:1. |
| `primaryHover` | `oklch(0.50 0.19 2)` | `#B1165B` | Pressed accent. |
| `primaryQuiet` | `oklch(0.955 0.030 2)` | `#FFE8EE` | Accent wash (selected row, QR frame). Accent on it: 4.6:1. |

### Dark

| Token | OKLCH | Hex | Contrast |
|---|---|---|---|
| `bg` | `oklch(0.168 0.006 350)` | `#110E0F` | |
| `surface` | `oklch(0.218 0.009 350)` | `#1E181B` | |
| `surfaceHover` | `oklch(0.262 0.011 350)` | `#292225` | |
| `line` | `oklch(0.305 0.012 350)` | `#342D30` | |
| `lineStrong` | `oklch(0.40 0.014 350)` | `#4E4549` | |
| `ink` | `oklch(0.955 0.004 350)` | `#F2EFF0` | 16.8:1 |
| `inkMuted` | `oklch(0.715 0.016 350)` | `#AB9FA4` | 7.5:1 |
| `inkFaint` | `oklch(0.58 0.015 350)` | `#82777B` | 4.5:1, UI only |
| `primary` | `oklch(0.705 0.165 2)` | `#F06E98` | 6.8:1 |
| `primaryHover` | `oklch(0.755 0.155 2)` | `#FE82A8` | |
| `primaryQuiet` | `oklch(0.285 0.055 2)` | `#401E28` | accent on it: 5.2:1 |

### Tag tints

Tags are the one place a colour stands for a category, and they were added
knowing that (see PRODUCT.md). They are held to it three ways. **Eight quiet
tints at one lightness**, so no tag is louder than another and none is as
loud as the accent. **Kept clear of the rose**, on hues 45 to 320, so a tagged
list still has exactly one accent on it. And **a tag always shows its name**:
the colour is how you find the Kitchen rows at a glance, never the only way
to know which tag it is.

Each tag colour has three roles. **Tint** is the chip's fill, **ink** is its
text, **dot** is the 8dp mark that stands for the tag where there is no chip
(a group heading, a filter that is off, a done row, the colour picker). The
lightness is the same across all eight in every role; only the hue and, where
the gamut runs out, the chroma move.

| Tag | Light tint | Light ink | Light dot | Dark tint | Dark ink | Dark dot |
|---|---|---|---|---|---|---|
| `clay` | `oklch(0.95 0.026 45)` `#FEEAE0` | `oklch(0.43 0.085 45)` `#763F25` | `oklch(0.62 0.12 45)` `#C16D45` | `oklch(0.3 0.045 45)` `#41261A` | `oklch(0.87 0.065 45)` `#FAC8B1` | `oklch(0.72 0.115 45)` `#E08C66` |
| `ochre` | `oklch(0.95 0.032 85)` `#F8EDD7` | `oklch(0.43 0.085 85)` `#654B07` | `oklch(0.62 0.12 85)` `#A77F19` | `oklch(0.3 0.045 85)` `#382C11` | `oklch(0.87 0.065 85)` `#E8D2A4` | `oklch(0.72 0.115 85)` `#C69F47` |
| `olive` | `oklch(0.95 0.032 120)` `#EBF2DA` | `oklch(0.43 0.085 120)` `#4A561A` | `oklch(0.62 0.12 120)` `#7D9034` | `oklch(0.3 0.045 120)` `#2B3116` | `oklch(0.87 0.065 120)` `#CEDBAB` | `oklch(0.72 0.115 120)` `#9BAF58` |
| `sage` | `oklch(0.95 0.032 160)` `#DDF6E7` | `oklch(0.43 0.085 160)` `#195E3F` | `oklch(0.62 0.12 160)` `#339C6D` | `oklch(0.3 0.045 160)` `#173526` | `oklch(0.87 0.065 160)` `#B0E2C6` | `oklch(0.72 0.115 160)` `#5BBB8C` |
| `teal` | `oklch(0.95 0.032 200)` `#D7F6F7` | `oklch(0.43 0.073 200)` `#005C60` | `oklch(0.62 0.105 200)` `#03999F` | `oklch(0.3 0.045 200)` `#0A3537` | `oklch(0.87 0.065 200)` `#A1E2E5` | `oklch(0.72 0.115 200)` `#28BAC1` |
| `steel` | `oklch(0.95 0.025 245)` `#E1F1FF` | `oklch(0.43 0.085 245)` `#21547B` | `oklch(0.62 0.12 245)` `#3E8CC9` | `oklch(0.3 0.045 245)` `#193043` | `oklch(0.87 0.065 245)` `#B1DAFD` | `oklch(0.72 0.115 245)` `#62ACE8` |
| `iris` | `oklch(0.95 0.024 285)` `#ECEDFF` | `oklch(0.43 0.085 285)` `#4B487C` | `oklch(0.62 0.12 285)` `#7F7BCB` | `oklch(0.3 0.045 285)` `#2B2A44` | `oklch(0.87 0.065 285)` `#CFCFFE` | `oklch(0.72 0.115 285)` `#9D9AEA` |
| `plum` | `oklch(0.95 0.032 320)` `#F8E8FC` | `oklch(0.43 0.085 320)` `#643F6D` | `oklch(0.62 0.12 320)` `#A66DB3` | `oklch(0.3 0.045 320)` `#38263C` | `oklch(0.87 0.065 320)` `#E8C7EF` | `oklch(0.72 0.115 320)` `#C58CD1` |

Measured, not eyeballed. Ink on its tint is 6.78:1 at worst in light (sage)
and 9.17:1 in dark. A dot is at least 3.38:1 on the page and 3.15:1 on
`surface` in light, 6.7:1 in dark, so it clears the 3:1 a UI mark needs. The
closest two dots, iris and plum, are 0.07 apart in OKLab, several times what
anyone can tell apart. The light tints of clay, teal, steel and iris run out
of sRGB at 0.032 chroma and are pulled in just far enough to fit.

The order a picker shows them in is the wheel order above. New tags are handed
the least used colour, in the order `clay, teal, ochre, steel, olive, iris,
sage, plum`, which alternates across the wheel so neighbouring tags differ.

**Destructive actions do not get their own red.** With a rose accent, a second
red would muddy the palette and dilute the accent's meaning. Deleting a list or
replacing a link is instead gated behind an explicit confirmation sheet that
states the consequence in words. The confirm button uses `primary`. Words carry
the warning, not hue.

## Typography

**One family: Schibsted Grotesk** (variable, weights 400 to 800), self-hosted, with the
platform sans as fallback. Product UI does not need a display/body pairing, and
a display face in a checklist row would be a costume. But the reflex pick
(Inter) would make the app look like every other one, so the family is a
grotesque with actual character: slightly narrow, high x-height, a hard-edged
`t` and `a` that stay legible at 13px and turn sharp at display sizes. One
family carries the landing page's 5rem statement and the app's 13px counts.

Fallback stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui,
sans-serif`. The web build self-hosts two subset woff2 files (latin,
latin-ext). The app bundles the variable TTF. Neither ever calls out to
fonts.googleapis.com, because a checklist app should not tell Google which
lists you open. Licence: SIL OFL 1.1, shipped alongside the files.

Fixed scale, ratio ≈ 1.2. No fluid clamping, because phones do not resize.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `title` | 28 / 34 | 600, -0.02em | List title on the list screen |
| `heading` | 20 / 26 | 600, -0.01em | Screen titles, sheet headers |
| `body` | 16 / 23 | 400 | Item text, prose |
| `bodyMedium` | 16 / 23 | 500 | Buttons, list names on home |
| `label` | 14 / 19 | 500 | Secondary rows, meta |
| `caption` | 13 / 17 | 400 | Counts, timestamps, hints |
| `mono` | 13 / 20 | 400 | The share URL only (`ui-monospace`) |

The share link is the one place monospace appears. It's a token you might read
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

- **Checkbox.** 24dp square, 8dp radius, 1.5dp `inkFaint` border when
  unchecked. Fills `primary` with a white mark when checked. 48dp hit target.
  The mark draws in over 180ms. It does not pop or bounce.
- **Item row.** Grip · checkbox · text · right-edge affordance (a 44dp column
  with a low-contrast chevron that is always present, never hover-revealed).
  A tagged row shows its tags under the text (and under the note), in
  `compareTags` order, wrapping onto more lines rather than truncating.
  Checked rows go `inkMuted` with a strikethrough and drift to the bottom shelf.
  **The box ticks the item and nothing else does. Tapping the row opens it.**
  That split is the way round it is because the two acts are not equally cheap
  to get wrong: a stray tick is a change everyone on the list sees, and a stray
  open costs a tap to close. It used to be the other way, with the whole row
  toggling and only the 44dp chevron opening.
- **Grip.** A 40dp column of `inkFaint` dots at the head of every unchecked
  row, held and dragged to move the row. The done shelf never reorders, but its
  rows **reserve the same 40dp** so the two lists' checkbox columns line up: a
  screen where they do not reads as broken rather than as a distinction. On a
  read link, and on a list of one, neither the grip nor its space is drawn.
  Dragging is a shortcut, never the only way: the item sheet carries Move up
  and Move down, which is also the only way to move something a long way in a
  list that does not fit on one screen.
- **Composer.** A persistent bottom field on the list screen, not a modal. Enter
  submits and keeps focus so you can type five items in a row. While a tag
  filter is on, new rows are made with the filter's tags, so they stay in view,
  and the placeholder says so: "Add to Kitchen", "Add to Kitchen and Bath",
  "Add with 3 tags".
- **Tag.** A chip of 24dp: an 8dp dot and the name, `label` size at 500, on
  the tag's tint in the tag's ink, `sm` radius. On a done row the tint goes and
  the name turns `inkMuted` with the rest of the row, and the dot stays, so the
  row still says which tag it is while it reads as finished.
- **Tag bar.** One horizontally scrolling row between the header and the
  list, shown only when the list has at least one tag: a two-option segmented
  control, **Your order** or **By tag** (the same control as the order on
  Your lists), then **Clear** while a filter is on, then one filter chip per
  tag, then **Edit tags** on a link that can write. A filter chip that is off
  is the dot and the name on a `lineStrong` hairline. On, it takes the tag's
  tint and ink and its dot becomes a tick, so on and off differ in shape and
  not only in colour. Several on means rows with **any** of them. The done shelf
  is filtered too, and its count follows.
- **Grouped by tag.** The open rows, under one heading per tag in
  `compareTags` order: the dot, the name at `label` 600, and a muted count. A
  row with several tags sits under the first of them, and rows with none sit
  under **No tag**, last. There is nothing to drag in this view, so no grip and
  no reserved grip column, in the open rows or the done shelf, and the item
  sheet's Move up and Move down are not offered: they move rows in your order,
  which this view is not showing.
- **Tags on a row, in the item sheet.** Every tag on the list as a filter-style
  chip that toggles at a tap (a tap lands at once, like a tick, not on Save),
  then an **Add a tag** field: Enter makes the tag and puts it on the row, or
  puts on the one the list already has by that name. At ten tags the chips that
  are off and the field stop taking more and say why.
- **Tags sheet.** Every tag with its dot, name and how many rows wear it. Tap
  one to rename it, recolour it from the eight swatches (on at a tap, marked
  with a tick and a ring, not colour alone), or delete it, which is confirmed in
  words: "Takes Kitchen off 4 rows, for everyone. There is no undo." A field at
  the foot makes a new one.
- **Done shelf.** The heading is a button: a chevron and "Done · 12". Tapping
  it folds the shelf to that one line and back, and **Clear** stays beside it.
  Whether it is folded, and whether the list is grouped by tag, are this
  device's view of the list and are remembered per list. The filter is not: a
  filter left on and forgotten hides rows, which is the one thing a shared list
  must not do quietly.
- **Sheets.** The item detail and the share sheet are bottom sheets with a
  drag handle, 20dp top radii, and a scrim at 40% ink.
- **Presence.** A filled `primary` dot plus a count ("2 here"), shown only
  when someone else is connected. Never avatars, never names.
- **Empty states teach.** Home empty: "No lists yet. A list is a link you can
  send to anyone." plus the two real actions (New list / Open a link). Not
  "Nothing here."
- **Skeletons, not spinners**, for the first load of a list: three grey rows at
  the real row height.
- **Your lists**, on the web at `/lists`, is the browser's own index and the
  same anatomy as the app's home: hairline rows on the page background, title
  over one muted line of `3 of 7 done · opened 2 hours ago`. No progress meter
  here, unlike the app's home row — on a phone it pushed the timestamp into an
  ellipsis to say what the words beside it already said. Favourites are a
  filled star against an outline one, never colour alone, and they lift into
  their own group above the rest rather than mixing in. The order is a
  two-option segmented control, Last opened or Added, and the rows name the
  stamp they are sorted by so the order is legible in them. A link that has
  stopped working keeps its row, struck through and saying which way it went:
  no dead ends, including here.

## Motion

150 to 250ms, `easeOutQuart`-family curves. No bounce, no elastic, no page-load
choreography.

| Moment | Duration | What |
|---|---|---|
| Check / uncheck | 180ms | Mark draws, text crossfades to muted, strikethrough wipes L→R |
| Row settles into the checked shelf | 220ms | Position transition only, after a 400ms grace so you can undo by looking |
| Sheet in / out | 240ms / 180ms | Translate + scrim fade |
| Remote change arrives | 200ms | Crossfade in place, plus one 900ms `primaryQuiet` wash on the changed row so you can see what someone else did |
| Done shelf folds | 180ms | The chevron turns a quarter. The rows go at once rather than sliding, because animating a list's height is layout work for no information |
| Swipe-to-open | tracks finger | Row translates, chevron rotates, releases past 40% |
| Carrying a row | tracks finger | The row lifts on a `surfaceHover` fill and a soft shadow, and the rows under it part as it passes their midpoints |

Under **Reduce Motion** every one of these becomes an instant state change or a
plain crossfade. The remote-change wash still fires, because it is information
rather than decoration, but as a static 900ms tint with no transition.

The one piece of motion that is allowed to be *pleasing* rather than merely
functional is the checkmark draw. It is the thing the user came for.

## Anti-patterns for this project

- Green checkmarks. Blue accents. Both are the category reflex.
- Confetti, streaks, completion percentages framed as achievement.
- Cards around list items.
- Any hover-revealed affordance. This is a touch product first.
- Modals for anything that could be inline. The composer is inline. Renaming a
  list is inline. Only destructive confirmation and item detail earn a sheet.
- Avatars or names anywhere. There are no accounts.
