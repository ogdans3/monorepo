---
name: Podium
description: A presentation tool where the room answers back; votes land in the places the presenter put them.
colors:
  room: "oklch(0.155 0.012 250)"
  room-letterbox: "oklch(0.1 0.008 250)"
  room-raised: "oklch(0.205 0.013 250)"
  room-rule: "oklch(0.34 0.012 250)"
  room-text: "oklch(0.965 0.004 250)"
  room-quiet: "oklch(0.75 0.01 250)"
  desk: "oklch(0.972 0.004 250)"
  desk-sunk: "oklch(0.938 0.006 250)"
  desk-raised: "oklch(0.995 0.002 250)"
  desk-rule: "oklch(0.875 0.006 250)"
  desk-rule-strong: "oklch(0.76 0.009 250)"
  desk-text: "oklch(0.22 0.016 250)"
  desk-quiet: "oklch(0.47 0.014 250)"
  amber: "oklch(0.81 0.155 74)"
  amber-deep: "oklch(0.58 0.14 60)"
  amber-ink: "oklch(0.27 0.05 60)"
  alarm: "oklch(0.53 0.18 27)"
  alarm-room: "oklch(0.74 0.14 27)"
  slide-ink-light: "#F2F4F6"
  slide-ink-dark: "#111418"
  qr-paper: "#f4f5f6"
  qr-ink: "#111418"
typography:
  stage-heading:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "calc(6 * var(--u))"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  stage-text:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "calc(6 * var(--u))"
    fontWeight: 400
    lineHeight: 1.24
    letterSpacing: "-0.004em"
  option-label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "min(calc(var(--u) * 4.2), 19cqh)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 780
    lineHeight: 1
    letterSpacing: "-0.005em"
    fontFeature: "tnum"
    fontVariation: "'wdth' 72"
  ballot-question:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.018em"
  ballot-option:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.2
  desk-body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.45
  desk-control:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 520
  desk-label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.01em"
  wordmark:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 760
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 88"
rounded:
  control: "3px"
  stamp: "2px"
  swatch: "50%"
spacing:
  control: "2rem"
  control-small: "1.75rem"
  ballot-target: "4rem"
  ballot-gutter: "1.25rem"
  option-pad: "calc(var(--u) * 1.5) calc(var(--u) * 1.7)"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.desk-text}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "{spacing.control}"
    typography: "{typography.desk-control}"
  button-hover:
    backgroundColor: "{colors.desk-sunk}"
  button-primary:
    backgroundColor: "{colors.desk-text}"
    textColor: "{colors.desk}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "{spacing.control}"
  input:
    backgroundColor: "{colors.desk-raised}"
    textColor: "{colors.desk-text}"
    rounded: "{rounded.control}"
    padding: "0.3rem 0.55rem"
    height: "{spacing.control}"
  live-chip:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.control}"
    padding: "0 0.5rem"
    height: "1.5rem"
  option-box:
    backgroundColor: "transparent"
    padding: "{spacing.option-pad}"
    typography: "{typography.option-label}"
  ballot-option:
    backgroundColor: "transparent"
    textColor: "{colors.room-text}"
    padding: "0.85rem 1rem"
    height: "{spacing.ballot-target}"
    typography: "{typography.ballot-option}"
  ballot-option-chosen:
    backgroundColor: "{colors.room-text}"
    textColor: "{colors.room}"
  stamp:
    backgroundColor: "transparent"
    rounded: "{rounded.stamp}"
    padding: "0.3rem 0.55rem 0.25rem"
    typography: "{typography.figure}"
  qr-tile:
    backgroundColor: "{colors.qr-paper}"
    textColor: "{colors.qr-ink}"
  corner-caption:
    backgroundColor: "{colors.room}"
    textColor: "{colors.room-quiet}"
    padding: "0.4rem 0.8rem"
---

# Design System: Podium

## Overview

**Creative North Star: "The Counting Room"**

Podium is election night. The room, where the projector and the phones are, is dark ink; the desk, where the presenter builds, is cool paper. Counts are what the room watches, so every count is set in one counting face: condensed, heavy, tabular, lined up in columns and never shifting what is around it. A vote does not replace the slide with a chart. It ticks up a count in the place the presenter put that answer, lights amber for as long as votes keep coming, and is heard as a bell.

The system is flat and ruled. Hairlines do the work cards do elsewhere: an answer is a rule across the top, a label, a share, a large count and a measured hairline under it. The only colour that belongs to the tool is one amber, and it is kept for change and for the live state. Every other colour on a slide is the presenter's. The display carries nothing of the tool except flat captions in the corner when it has something to say.

Geometry is relative to the stage. A slide is a 16:9 plane where every position and size is a percent of the stage and every type size is a multiple of `--u`, one percent of the stage's height. The same slide is drawn by the same renderer on the projector, on the editor canvas and in the slide list, and is the same slide at every size. All interface copy is Norwegian.

**Key Characteristics:**
- Two grounds from one cool hue (250): ink room, paper desk.
- Hairline rules, not cards or panels.
- One counting face (Archivo at 72% width, weight 780, tabular) for every count, share and code.
- One amber for change and live only.
- Stage geometry in percent, stage type in `--u`.
- No chrome on the display.
- Norwegian copy throughout.

## Colors

A near-neutral cool palette at hue 250, light and dark, with one warm signal.

### Primary
- **Count Amber** (`amber`): the colour of change. A count and its share bar turn amber the moment a vote lands and stay amber until 1400 ms after that answer's last vote. The same amber marks the live state on the desk («Direkte» chips in the list, the slide list and the editor bar) and flashes once under a ballot option as it is chosen. That is all it does.
- **Deep Amber** (`amber-deep`): stands in for Count Amber on light slides, so a moving count still reads on paper.
- **Amber Ink** (`amber-ink`): text on an amber chip.

### Neutral
- **Room Ink** (`room`): ground of the display notices, the ballot, the door and the corner captions.
- **Letterbox** (`room-letterbox`): the darker ink around the letterboxed 16:9 stage on the display.
- **Room Raised** (`room-raised`): a ballot option while it is pressed or sending.
- **Room Rule** (`room-rule`): hairlines in the room: the ballot header rule, rules between ballot options, the line between stacked captions.
- **Room Text / Room Quiet** (`room-text`, `room-quiet`): text in the room, and the second voice (meta, hints, captions). Room Text is also the filled ground of a chosen ballot option.
- **Desk Paper** (`desk`), **Desk Sunk** (`desk-sunk`), **Desk Raised** (`desk-raised`): the editor's ground, the hover and well state, and input fields.
- **Desk Rule / Desk Rule Strong** (`desk-rule`, `desk-rule-strong`): table and panel hairlines; control and field borders.
- **Desk Text / Desk Quiet** (`desk-text`, `desk-quiet`): desk ink and its second voice. Desk Text is also the fill of a primary button and the focus ring.
- **Alarm / Alarm Room** (`alarm`, `alarm-room`): destructive actions on the desk and problem hints in the room. They are not used for decoration.

### Slide colours (the presenter's)
- **Slide Ink Light / Dark** (`slide-ink-light`, `slide-ink-dark`): the automatic slide text colour. Light on a dark ground, dark on a light one, flipping where both have equal contrast (relative luminance 0.179).
- The starting backgrounds are `#111418`, `#F4F5F6`, `#FFFFFF`, `#1D2B3A`, `#24352B`, `#3A1F24` and `#E9E2D3`. The starting inks are `#F2F4F6`, `#111418`, `#8FB8E8`, `#9BD3AE` and `#E88F8F`, plus any colour from the picker. These are suggestions to the presenter, not system colours.
- **QR Paper / QR Ink** (`qr-paper`, `qr-ink`): the QR tile is always paper with dark ink, whatever slide it is on, so any scanner reads it.

### Named Rules
**The One Amber Rule.** Amber means "this just changed" or "this is live", and nothing else. It is never an accent, a hover, a link, a brand colour or part of the wordmark, and it is never in the presenter's palettes. If amber appears and nothing is moving or live, that is a bug.

**The Presenter's Colour Rule.** Apart from the amber signal and the paper QR tile, every colour on a slide is the presenter's. The tool adds no tinted panels, badges or highlights to the stage.

## Typography

**Display Font:** Archivo Variable (with ui-sans-serif, system-ui), self-hosted, weights 100–900, width 62–125%
**Body Font:** Archivo Variable at normal width
**Label/Mono Font:** none; counts and codes use Archivo's condensed counting face, not a monospace font

**Character:** One family in two postures. Text runs at normal width, firm and plain. Counts, shares and codes run condensed, heavy and tabular, like figures on a results board.

### Hierarchy
- **Stage Heading** (700, `calc(n × --u)` with a default of 6, line-height 1.08, -0.02em, balanced wrapping): bold slide text. The size is always in stage units.
- **Stage Text** (400, `calc(n × --u)`, line-height 1.24, -0.004em, pretty wrapping): regular slide text.
- **Option Label** (600, 4.2u capped at 19% of the box height, line-height 1.12): the label of an answer on the stage.
- **Figure** (780, 72% width, tabular, line-height 1, -0.005em): every count (stage, inspector, list), every share (3.2u at 600 on the stage), every presentation code and the «Stemt» stamp. On the stage the count fills the box: `min(54cqh, 36cqw)`.
- **Ballot Question** (700, 1.75rem, line-height 1.12, -0.018em) and **Ballot Option** (600, 1.1875rem): the phone page, in rem so it follows the phone's text size.
- **Desk Body** (400, 0.9375rem, line-height 1.45), **Desk Control** (520, 0.875rem; small 0.8125rem) and **Desk Label** (600, 0.75rem, +0.01em, in Desk Quiet): the editor and the admin list.
- **Wordmark** (760, 1.125rem, 88% width): "Podium" beside three bars on a baseline, in the text colour.

### Named Rules
**The Counting Face Rule.** Every number the room or the presenter reads as a count, share or code is set in the figure face (72% width, weight 780, tabular). A count never shifts its neighbours as it changes.

**The Stage Unit Rule.** Type on a slide is sized only as a multiple of `--u` (1% of stage height, registered with `@property` and inherited). Never px or rem on the stage.

## Layout

**The stage.** A 16:9 plane that is its own size container. Every element is placed absolutely, with left, top, width and height in percent of the stage. The display fits the stage with `min(100vw, 100dvh × 16/9)` and centres it on the letterbox ink. The same Stage component renders the display (live video), the editor canvas and the thumbnails (stills).

**The answer box.** A three-row grid: a head row (label left, share right, aligned on the baseline), the count (bottom-aligned, filling the free space) and the share bar. Its padding is 1.5u by 1.7u.

**The editor grid.** The canvas shows a square snap grid of 32 columns by 18 rows. Lines are drawn at 9% of the slide's text colour and rise to 18% while something is being dragged. The two centre axes are a step stronger (30%, rising to 45%). Elements snap to the grid; Alt releases the snap and Shift keeps a corner's proportions. The grid can be toggled from the toolbar.

**The desk.** The editor has three columns: the slide list on the left, the canvas centred on a sunk well with a toolbar above it, and the inspector on the right. A top bar carries the title, the save state, the code, the live chip and the end control. The admin list is a centred hairline table (Tittel, Kode, Sider, Endret) with a page title and one primary action. Controls are 2rem tall, or 1.75rem for the small size.

**The ballot.** A single column honouring the safe areas, with a 1.25rem gutter. Header first (presentation title, code in the figure face, hairline below). Then the question. Then the options, stacked full width at 4rem minimum and separated by hairlines.

### Named Rules
**The Percent Plane Rule.** Stage geometry is percent of the stage and stage type is `--u`. Nothing on a slide is sized in viewport or pixel units, so the projector, the canvas and the thumbnail show the same slide.

**The No Chrome Rule.** The display shows the slide and nothing else. When the tool must speak, it does so in flat, solid captions in the bottom-right corner (0.8125rem, 520, Room ground, Quiet text, stacked with a hairline between them): the sound prompt («Trykk en tast eller klikk for lyd», «Lyden er av · M»), the lost-connection notice («Mistet forbindelsen. Kobler til igjen …») and the key hints shown for the first seconds. The cursor hides when idle.

## Elevation & Depth

Flat. Depth comes from the two grounds and from hairlines, not shadows. The room has none. The desk has exactly one ambient lift: the editor canvas sits on its well with a soft shadow, so the slide reads as an object being worked on. Selection and focus are drawn as rings, not as raised surfaces.

### Shadow Vocabulary
- **Canvas lift** (`box-shadow: 0 1px 2px oklch(0.2 0.02 250 / 0.12), 0 8px 28px -12px oklch(0.2 0.02 250 / 0.3)`): the editor canvas only.
- **Selection frame** (`box-shadow: 0 0 0 1px oklch(0.99 0 0 / 0.95), 0 0 0 2px oklch(0.16 0.012 250 / 0.92)`): a light line and a dark line together, so the selection reads on any slide. Handles are 9px white squares with a dark 1px border.
- **Current ring** (`box-shadow: 0 0 0 2px var(--desk), 0 0 0 3.5px var(--desk-text)`): the current thumbnail and the chosen swatch.

### Named Rules
**The Hairline Rule.** Group with a rule, not a box. Answers get a top rule. Ballot options, list rows and panels are divided by 1px hairlines. No cards, no tinted panels, no shadows in the room.

## Shapes

Square by default. Controls, fields and chips have a barely softened 3px corner. Thumbnails and the stamp have 2px. Swatches are the only round shapes. Stage rules scale with the stage (`max(1px, 0.16u)`), and the share bar is a slightly heavier stroke (0.36u) drawn over its own hairline: a measured rule, not a chart. Empty image and video placeholders in the editor use a dashed outline in the slide's own ink.

## Components

### Buttons
- **Shape:** 3px corners, 2rem tall, 0.75rem side padding, 1px border in Rule Strong, transparent ground.
- **Primary:** filled with the text colour, label in the ground colour («Ny presentasjon»). On hover it mixes 14% toward the ground.
- **Hover / Focus:** hover fills with Sunk. Pressing nudges it down 0.5px. Focus is a 2px outline in the text colour, offset 2px. Disabled is 45% opacity.
- **Quiet / Icon / Danger:** quiet drops the border. Icon is a 2rem square with a 1.5–1.75 stroke SVG icon. Danger uses Alarm text.

### Inputs / Fields
- **Style:** Raised ground, 1px Rule Strong border, 3px corners, 2rem minimum height, 0.875rem. The label sits above in Desk Label.
- **Focus:** the border turns to the text colour, with the outline at 0 offset. Hover mixes the border 40% toward the text colour.
- **Door code field:** in the room, 5rem tall, the code at 3rem, uppercase, +0.18em tracking, on Sunk.

### Live chip
A flat amber chip (Amber ground, Amber Ink, 700, 0.75–0.8125rem, 3px corners) reading «Direkte». It appears in the admin list, under the live slide's thumbnail, and in the editor bar with the position in tabular figures («· side 2 av 3»).

### Answer box (signature)
Everything in the answer box takes the slide's ink (currentColor), so it sits in the presenter's colours. It has a top rule at 62% ink and the label and share on one baseline (share at 72% opacity). Below them is the count as a rolling digit reel: each digit is a column of 0–9 turned to its value over 560 ms on `cubic-bezier(0.16, 1, 0.3, 1)`, with a thin gap every three digits. At the bottom is the share bar: a 32% hairline with the share drawn on it in full ink, eased over 640 ms. **Moving state:** when a vote lands, the count and the bar turn to the change colour within 90 ms (Amber, or Deep Amber on a light slide) and fade back over 700 ms once 1400 ms have passed without a vote for that answer.

### Ballot option
A full-width row at 4rem minimum, transparent, with a hairline under it. The label is 1.1875rem at 600. Pressed and sending fill with Room Raised. After a vote, the chosen option fills with Room Text in Room ink. It lands from amber over 420 ms, and the other options drop to 50%.

### «Stemt» stamp
"Stemt" in the figure face, uppercase, weight 860, 1.25rem, +0.08em tracking. It has a 2.5px border in the text colour and 2px corners, and is rotated −2.5° (left of true, the way a stamp lands). It arrives from 1.5× scale at −9° over 380 ms.

### QR tile
A paper tile (QR Paper, QR Ink) at the size and position the presenter chose. It holds the code with a one-module quiet zone, the short host, and the presentation code in the figure face at +0.05em. It switches to a side-by-side layout when it is wider than 1.3:1.

### Corner caption
See the No Chrome Rule. Flat, solid, no corners, no shadow, with an optional 16px icon.

### Sound
A synthesized bell sounds each vote. Simultaneous votes are spaced 60 ms apart and climb a major pentatonic from C6, so a room voting at once is heard as a rising arpeggio. A run that would lag more than 0.9 s drops notes, because the count is the record. A presentation may carry its own uploaded sound.

## Do's and Don'ts

### Do:
- **Do** keep amber for a count that has just moved (held 1400 ms after that answer's last vote) and for the live state («Direkte»). Use Deep Amber on light slides.
- **Do** set every count, share and code in the figure face (72% width, 780, tabular).
- **Do** place and size everything on the stage in percent of the stage and size stage type in `--u`, so the display, canvas and thumbnail stay identical.
- **Do** separate with 1px hairlines: a top rule on an answer, rules between ballot options and list rows.
- **Do** show the editor's 32×18 square snap grid with its centre axes drawn stronger, and strengthen it while dragging.
- **Do** keep the display free of chrome. The tool speaks only in flat corner captions: the sound prompt, the lost connection and the first-seconds key hints.
- **Do** stamp «Stemt» in the figure face, uppercase, rotated −2.5°.
- **Do** write all interface copy in Norwegian.
- **Do** keep ballot targets at least 4rem tall and ballot type in rem, so it follows the phone's text size.

### Don't:
- **Don't** use amber as an accent, hover, link, brand colour or wordmark colour, and don't offer it in the presenter's palettes.
- **Don't** replace the slide with a results chart. Votes land in the boxes the presenter placed.
- **Don't** put cards, tinted panels or shadows in the room. The only desk shadow is the canvas lift.
- **Don't** size slide content in px, rem or viewport units.
- **Don't** add toolbars, logos, progress bars or vote totals to the display.
- **Don't** ship Nintendo's Brain Training sound. The vote sound is the synthesized bell, or the presenter's own upload.
- **Don't** colour slide content with anything the presenter did not choose, except the amber signal and the paper QR tile.
