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
  answer-red: "#D0273A"
  answer-blue: "#2A68CF"
  answer-green: "#1D8452"
  answer-violet: "#7448C8"
  answer-teal: "#0C7F8E"
  answer-magenta: "#BB2F82"
  answer-brown: "#8E5A35"
  answer-slate: "#56677D"
  answer-ink: "#FFFFFF"
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
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.018em"
  ballot-mark:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 13vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 0.9
    fontFeature: "tnum"
    fontVariation: "'wdth' 72"
  ballot-label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
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
  ballot-tile: "5.5rem"
  ballot-tile-gap: "0.6rem"
  ballot-gutter: "1rem"
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
  segment-on:
    backgroundColor: "{colors.desk-text}"
    textColor: "{colors.desk}"
    padding: "0 0.6rem"
    height: "1.875rem"
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
  answer-mark:
    backgroundColor: "{colors.answer-red}"
    textColor: "{colors.answer-ink}"
    rounded: "{rounded.stamp}"
    padding: "0 0.22em"
    height: "1.3em"
  ballot-tile:
    backgroundColor: "{colors.answer-red}"
    textColor: "{colors.answer-ink}"
    rounded: "{rounded.control}"
    padding: "0.8rem 0.95rem 0.9rem"
    height: "{spacing.ballot-tile}"
    typography: "{typography.ballot-label}"
  stamp:
    backgroundColor: "transparent"
    rounded: "{rounded.stamp}"
    padding: "0.3rem 0.5rem 0.25rem"
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

The system is flat and ruled. Hairlines do the work cards do elsewhere: an answer is a rule across the top, a marked label, a share, a large count and a measured hairline under it. The only colour that belongs to the tool is one amber, and it is kept for change and for the live state. Every answer has a colour and a mark (a letter or a number), and the phone shows the same colour and mark as the slide, so voting is matching a colour to a colour. Every other colour on a slide is the presenter's. The display carries nothing of the tool except flat captions in the corner when it has something to say.

Geometry is relative to the stage. A slide is a 16:9 plane where every position and size is a percent of the stage and every type size is a multiple of `--u`, one percent of the stage's height. The same slide is drawn by the same renderer on the projector, on the editor canvas and in the slide list, and is the same slide at every size. Every presentation opens with the way in, a join slide with the QR code large, and every new slide after it carries the code small in its corner. All interface copy is Norwegian.

**Key Characteristics:**
- Two grounds from one cool hue (250): ink room, paper desk.
- Hairline rules, not cards or panels, on the stage and the desk.
- One counting face (Archivo at 72% width, weight 780, tabular) for every count, share, code and mark.
- One amber for change and live only.
- Eight answer colours, each always paired with its mark.
- Stage geometry in percent, stage type in `--u`.
- No chrome on the display.
- Norwegian copy throughout.

## Colors

A near-neutral cool palette at hue 250, light and dark, with one warm signal and eight mid-tone answer colours.

### Primary
- **Count Amber** (`amber`): the colour of change. A count turns amber the moment a vote lands and stays amber until 1400 ms after that answer's last vote. The same amber marks the live state on the desk («Direkte» chips in the list, the slide list and the editor bar). That is all it does.
- **Deep Amber** (`amber-deep`): stands in for Count Amber on light slides, so a moving count still reads on paper.
- **Amber Ink** (`amber-ink`): text on an amber chip.

### Secondary (the answers')
- **Answer colours** (`answer-red`, `answer-blue`, `answer-green`, `answer-violet`, `answer-teal`, `answer-magenta`, `answer-brown`, `answer-slate`, in that order): one per answer. On the stage an answer's colour fills its mark square and its share bar; on the phone it fills the whole tile. A new answer takes the first colour not yet used on its slide (the next round once all eight are used). The presenter can change it in the inspector, from these eight or any colour from the picker. The list is one list kept in two places (`ANSWER_COLOURS` in `web/src/lib/answers.ts`, `answerColours` in `backend/internal/app/store.go`) and they must match.
- **Answer Ink** (`answer-ink`): the mark and label on an answer colour. White reads on each of the eight at 4.5:1 or better (4.69–5.99:1). On a light colour the presenter picks, the mark switches to Slide Ink Dark.
- Every answer colour reads at 3:1 or better on the ink slide (`#111418`, 3.08–3.94:1) and on the paper slide (`#F4F5F6`, 4.30–5.49:1).

### Neutral
- **Room Ink** (`room`): ground of the display notices, the ballot, the door and the corner captions.
- **Letterbox** (`room-letterbox`): the darker ink around the letterboxed 16:9 stage on the display.
- **Room Raised** (`room-raised`): input fields in the room.
- **Room Rule** (`room-rule`): hairlines in the room: the ballot header rule, the line between stacked captions.
- **Room Text / Room Quiet** (`room-text`, `room-quiet`): text in the room, and the second voice (meta, hints, captions, the waiting line's follow-up). Room Text is also the focus ring on a ballot tile.
- **Desk Paper** (`desk`), **Desk Sunk** (`desk-sunk`), **Desk Raised** (`desk-raised`): the editor's ground, the hover and well state, and input fields.
- **Desk Rule / Desk Rule Strong** (`desk-rule`, `desk-rule-strong`): table and panel hairlines; control and field borders.
- **Desk Text / Desk Quiet** (`desk-text`, `desk-quiet`): desk ink and its second voice. Desk Text is also the fill of a primary button, a chosen segment and the focus ring.
- **Alarm / Alarm Room** (`alarm`, `alarm-room`): destructive actions on the desk and problem hints in the room. They are not used for decoration.

### Slide colours (the presenter's)
- **Slide Ink Light / Dark** (`slide-ink-light`, `slide-ink-dark`): the automatic slide text colour. Light on a dark ground, dark on a light one, flipping where both have equal contrast (relative luminance 0.179).
- The starting backgrounds are `#111418`, `#F4F5F6`, `#FFFFFF`, `#1D2B3A`, `#24352B`, `#3A1F24` and `#E9E2D3`. The starting inks are `#F2F4F6`, `#111418`, `#8FB8E8`, `#9BD3AE` and `#E88F8F`, plus any colour from the picker. These are suggestions to the presenter, not system colours.
- **QR Paper / QR Ink** (`qr-paper`, `qr-ink`): the QR tile is always paper with dark ink, whatever slide it is on, so any scanner reads it.

### Named Rules
**The One Amber Rule.** Amber means "this just changed" or "this is live", and nothing else. On the stage only a moving count turns amber; the share bar keeps the answer's colour. Amber is never an accent, a hover, a link, a brand colour or part of the wordmark, it is never in the presenter's palettes, and it is never one of the answer colours. If amber appears and nothing is moving or live, that is a bug.

**The Presenter's Colour Rule.** Every colour on a slide is the presenter's, with three exceptions: the amber signal, the paper QR tile, and the answer colours. The answer colours are the one sanctioned way the tool colours slide content, and they belong to the answers: the tool assigns one to each new answer and the presenter may change it. The tool adds no other tinted panels, badges or highlights to the stage.

**The Mark And Colour Rule.** A colour never stands alone. Every answer carries its mark, a letter (A, B … Z, AA) or a number (1, 2, 3), chosen per presentation («Svarene merkes med: A B C | 1 2 3»), and the mark appears wherever the colour does: in the square before the label on the stage, large on the phone tile, in the inspector's heading («Svar B»). Someone who cannot tell two colours apart votes by the mark.

## Typography

**Display Font:** Archivo Variable (with ui-sans-serif, system-ui), self-hosted, weights 100–900, width 62–125%
**Body Font:** Archivo Variable at normal width
**Label/Mono Font:** none; counts, codes and marks use Archivo's condensed counting face, not a monospace font

**Character:** One family in two postures. Text runs at normal width, firm and plain. Counts, shares, codes and marks run condensed, heavy and tabular, like figures on a results board.

### Hierarchy
- **Stage Heading** (700, `calc(n × --u)` with a default of 6, line-height 1.08, -0.02em, balanced wrapping): bold slide text. The size is always in stage units. The starting slides use 11 (join title), 10 (heading slide) and 8 (question).
- **Stage Text** (400, `calc(n × --u)`, line-height 1.24, -0.004em, pretty wrapping): regular slide text.
- **Option Label** (600, 4.2u capped at 19% of the box height, line-height 1.12): the label of an answer on the stage. Its mark sits before it at 0.92em, weight 800, in the figure face.
- **Figure** (780, 72% width, tabular, line-height 1, -0.005em): every count (stage, inspector, list), every share (3.2u at 600 on the stage), every presentation code, every answer mark and the «Stemt» stamp. On the stage the count fills the box: `min(54cqh, 36cqw)`.
- **Ballot Question** (700, 1.5rem, line-height 1.15, -0.018em), **Ballot Mark** (figure face at 800, `clamp(2.5rem, 13vw, 3.75rem)`, line-height 0.9) and **Ballot Label** (600, 1rem, line-height 1.2, three lines at most): the phone page, in rem so it follows the phone's text size.
- **Desk Body** (400, 0.9375rem, line-height 1.45), **Desk Control** (520, 0.875rem; small 0.8125rem) and **Desk Label** (600, 0.75rem, +0.01em, in Desk Quiet): the editor and the admin list.
- **Wordmark** (760, 1.125rem, 88% width): "Podium" beside three bars on a baseline, in the text colour.

### Named Rules
**The Counting Face Rule.** Every number or code the room or the presenter reads as a count, share, code or answer mark is set in the figure face (72% width, tabular). A count never shifts its neighbours as it changes.

**The Stage Unit Rule.** Type on a slide is sized only as a multiple of `--u` (1% of stage height, registered with `@property` and inherited). Never px or rem on the stage.

## Layout

**The stage.** A 16:9 plane that is its own size container. Every element is placed absolutely, with left, top, width and height in percent of the stage. The display fits the stage with `min(100vw, 100dvh × 16/9)` and centres it on the letterbox ink. The same Stage component renders the display (live video), the editor canvas and the thumbnails (stills).

**The starting slides** (all x/y/w/h in percent of the stage):
- **Join slide** (every presentation opens with it): the presentation's title at size 11, weight 700 (6.25/27.778/56.25/33.333), «Skann koden og stem underveis.» at size 4 (6.25/66.667/50/11.111), and the QR tile big on the right (68.75/16.667/25/66.667).
- **Question slide:** the title «Hva tror du?» at size 8 (6.25/8.333/75/22.222), and two answers side by side, «Ja» and «Nei», each 42.188 wide and 50 tall at y 38.889, with a 2.5 gap.
- **Heading slide:** «Overskrift» at size 10 (6.25/38.889/75/22.222).
- **Corner code:** every slide after the join slide starts with a small QR tile top right (87.5/5.556/9.375/22.222). The presenter may delete it, or the join slide, so nothing may assume a slide has a QR code.

**The answer area.** Answers placed by the tool go in 6.25/38.889/87.5/50: below the question, the width of the slide, clear of the corner code. They are laid out in one row up to four, then in rows of as many as make the cells nearest square, with a 2.5 column gap and a 4 row gap. A new answer goes beside the last if it fits, else under the first on a new row.

**The answer box.** A three-row grid: a head row (mark and label left, share right, aligned on the baseline), the count (bottom-aligned, filling the free space) and the share bar. Its padding is 1.5u by 1.7u.

**The editor grid.** The canvas shows a square snap grid of 32 columns by 18 rows. Lines are drawn at 9% of the slide's text colour and rise to 18% while something is being dragged. The two centre axes are a step stronger (30%, rising to 45%). Elements snap to the grid; Alt releases the snap and Shift keeps a corner's proportions. The grid can be toggled from the toolbar.

**The desk.** The editor has three columns: the slide list on the left, the canvas centred on a sunk well with a toolbar above it, and the inspector on the right. A top bar carries the title, the save state, the code, the live chip and the end control. The inspector's Presentasjonen section holds the per-presentation settings, among them the marks. The admin list is a centred hairline table (Tittel, Kode, Sider, Endret) with a page title and one primary action. Controls are 2rem tall, or 1.75rem for the small size.

**The ballot.** A single column honouring the safe areas (at least 1rem at the sides and top, 1.25rem at the bottom). Header first (presentation title in Room Quiet, code in the figure face, hairline below). Then the question. Then the tiles, filling the rest of the screen: one column up to three answers, two columns from four, each row at least 5.5rem tall, 0.6rem apart. A line of help sits under them («Trykk på fargen du vil stemme på. Én stemme per telefon.», then «Stemmen din er telt. Se skjermen.»). Between questions the page is empty and says only «Venter på neste spørsmål», centred. A new question is drawn straight from the pushed state.

### Named Rules
**The Percent Plane Rule.** Stage geometry is percent of the stage and stage type is `--u`. Nothing on a slide is sized in viewport or pixel units, so the projector, the canvas and the thumbnail show the same slide.

**The No Chrome Rule.** The display shows the slide and nothing else. When the tool must speak, it does so in flat, solid captions in the bottom-right corner (0.8125rem, 520, Room ground, Quiet text, stacked with a hairline between them): the sound prompt («Trykk en tast eller klikk for lyd», «Lyden er av · M»), the lost-connection notice («Mistet forbindelsen. Kobler til igjen …») and the key hints shown for the first seconds. The cursor hides when idle. The QR tiles are slide elements the presenter owns, not chrome.

**The Way In Rule.** The room can always find the ballot: the join slide opens every presentation with the QR code big, and every new slide carries it small in the corner. Both are ordinary elements the presenter may move, resize or delete.

## Elevation & Depth

Flat. Depth comes from the two grounds and from hairlines, not shadows. The room has none. The desk has exactly one ambient lift: the editor canvas sits on its well with a soft shadow, so the slide reads as an object being worked on. Selection and focus are drawn as rings, not as raised surfaces.

### Shadow Vocabulary
- **Canvas lift** (`box-shadow: 0 1px 2px oklch(0.2 0.02 250 / 0.12), 0 8px 28px -12px oklch(0.2 0.02 250 / 0.3)`): the editor canvas only.
- **Selection frame** (`box-shadow: 0 0 0 1px oklch(0.99 0 0 / 0.95), 0 0 0 2px oklch(0.16 0.012 250 / 0.92)`): a light line and a dark line together, so the selection reads on any slide. Handles are 9px white squares with a dark 1px border.
- **Current ring** (`box-shadow: 0 0 0 2px var(--desk), 0 0 0 3.5px var(--desk-text)`): the current thumbnail and the chosen swatch.

### Named Rules
**The Hairline Rule.** Group with a rule, not a box. Answers on the stage get a top rule, and the share is drawn on a hairline. List rows, panels and the ballot header are divided by 1px hairlines. The phone's answer tiles are flat fills of the answer's colour, targets rather than containers. No cards, no tinted panels, no shadows in the room.

## Shapes

Square by default. Controls, fields, chips and ballot tiles have a barely softened 3px corner. Thumbnails, the stamp and the answer mark square have 2px. Swatches are the only round shapes. Stage rules scale with the stage (`max(1px, 0.16u)`), and the share bar is a slightly heavier stroke (0.36u) in the answer's colour drawn over its own hairline: a measured rule, not a chart. Empty image and video placeholders in the editor use a dashed outline in the slide's own ink.

## Components

### Buttons
- **Shape:** 3px corners, 2rem tall, 0.75rem side padding, 1px border in Rule Strong, transparent ground.
- **Primary:** filled with the text colour, label in the ground colour («Ny presentasjon»). On hover it mixes 14% toward the ground.
- **Hover / Focus:** hover fills with Sunk. Pressing nudges it down 0.5px. Focus is a 2px outline in the text colour, offset 2px. Disabled is 45% opacity.
- **Quiet / Icon / Danger:** quiet drops the border. Icon is a 2rem square with a 1.5–1.75 stroke SVG icon. Danger uses Alarm text.
- **Segments:** a row of 1.875rem buttons in one Rule Strong border with 3px corners, divided by hairlines, 0.8125rem at 520. Hover fills with Sunk; the chosen one is filled with Desk Text in Desk Paper («A B C | 1 2 3»).

### Inputs / Fields
- **Style:** Raised ground, 1px Rule Strong border, 3px corners, 2rem minimum height, 0.875rem. The label sits above in Desk Label.
- **Focus:** the border turns to the text colour, with the outline at 0 offset. Hover mixes the border 40% toward the text colour.
- **Swatches:** round swatches with the current ring on the chosen one, and a last «Annen farge» swatch that opens the colour picker and shows a custom colour once picked. The answer's swatches («Svarets farge») offer the eight answer colours.
- **Door code field:** in the room, 5rem tall, the code at 3rem, uppercase, +0.18em tracking, on Sunk.

### Live chip
A flat amber chip (Amber ground, Amber Ink, 700, 0.75–0.8125rem, 3px corners) reading «Direkte». It appears in the admin list, under the live slide's thumbnail, and in the editor bar with the position in tabular figures («· side 2 av 3»).

### Answer box (signature)
The rule, label, share and count take the slide's ink (currentColor), so the box sits in the presenter's colours; the answer's colour appears in two places only. It has a top rule at 62% ink. In the head row, the mark comes first: a 1.3em square (2px corners, at least 1.3em wide) filled with the answer's colour, the mark in the figure face at 0.92em and 800, in Answer Ink, set 0.45em before the label. The share sits right on the same baseline at 72% opacity. Below them is the count as a rolling digit reel: each digit is a column of 0–9 turned to its value over 560 ms on `cubic-bezier(0.16, 1, 0.3, 1)`, with a thin gap every three digits. At the bottom is the share bar: a 32% ink hairline with the share drawn on it in the answer's colour, eased over 640 ms. **Moving state:** when a vote lands, only the count turns to the change colour, within 90 ms (Amber, or Deep Amber on a light slide), and fades back over 700 ms once 1400 ms have passed without a vote for that answer. The bar keeps its colour.

### Ballot tile
One tile per answer, filled with the answer's colour, 3px corners, padding 0.8rem 0.95rem 0.9rem. The mark is large in the figure face at the top left; the label (Ballot Label, three lines at most) sits at the bottom; both in Answer Ink. Pressing or sending scales the tile to 97.5% over 120 ms. Focus is a 3px Room Text outline, offset 2px. After a vote, the chosen tile carries the «Stemt» stamp at its top right (0.75rem in), and the others fade to 36% opacity and 40% saturation over 240 ms.

### «Stemt» stamp
"Stemt" in the figure face, uppercase, weight 860, 1.125rem, +0.08em tracking. It has a 2.5px border in the tile's ink and 2px corners, and is rotated −2.5° (left of true, the way a stamp lands). It arrives from 1.5× scale at −9° over 380 ms.

### QR tile
A paper tile (QR Paper, QR Ink) at the size and position the presenter chose. It holds the code with a one-module quiet zone, the short host, and the presentation code in the figure face at +0.05em. It switches to a side-by-side layout when it is wider than 1.3:1. A tile narrower than 15% of the stage renders compact: the QR and the presentation code, no host. The corner code is compact; the join slide's is full.

### Corner caption
See the No Chrome Rule. Flat, solid, no corners, no shadow, with an optional 16px icon.

### Start dialog
The one modal in the desk, and it exists because the owner asked for it. «Start» on a presentation that already has votes asks first: «Nullstille stemmene før du starter?», with the count, and three choices: «Nullstill og start» (primary), «Start med stemmene», «Avbryt» (quiet). With no votes it does not appear. It is a native `<dialog>` on Desk Paper: 1px Desk Rule border, 4px corners, a soft drop shadow, and a 42% ink backdrop. No button has the focus when it opens; the heading does. Enter alone must never take away the votes of a talk that is being started again halfway through.

### Presentation votes
Under «Presentasjonen» in the inspector, the total for every question together in the figure face, beside «Nullstill alle stemmer» (small button, disabled at zero, confirms first). It sits above the marks and the sound, because it is what a presenter needs between a rehearsal and the talk.

### Sound
A synthesized bell sounds each vote. Simultaneous votes are spaced 60 ms apart and climb a major pentatonic from C6, so a room voting at once is heard as a rising arpeggio. A run that would lag more than 0.9 s drops notes, because the count is the record. A presentation may carry its own uploaded sound.

## Do's and Don'ts

### Do:
- **Do** keep amber for a count that has just moved (held 1400 ms after that answer's last vote) and for the live state («Direkte»). Use Deep Amber on light slides.
- **Do** give every answer a colour from the eight answer colours (the first one not yet used on the slide) and let the presenter change it.
- **Do** show an answer's mark wherever its colour appears: the square before the label on the stage, large on the phone tile.
- **Do** keep the answer colours one list in `answers.ts` and `store.go`, and check any new one against the three tests: white on it at 4.5:1, it on the ink and paper slides at 3:1, and not the amber.
- **Do** set every count, share, code and mark in the figure face (72% width, tabular).
- **Do** place and size everything on the stage in percent of the stage and size stage type in `--u`, so the display, canvas and thumbnail stay identical.
- **Do** separate with 1px hairlines: a top rule on an answer, rules under the ballot header and between list rows.
- **Do** open every presentation with the join slide and start every new slide with the corner code, and draw a QR tile under 15% wide compact.
- **Do** show the editor's 32×18 square snap grid with its centre axes drawn stronger, and strengthen it while dragging.
- **Do** keep the display free of chrome. The tool speaks only in flat corner captions: the sound prompt, the lost connection and the first-seconds key hints.
- **Do** stamp «Stemt» in the figure face, uppercase, rotated −2.5°.
- **Do** write all interface copy in Norwegian.
- **Do** keep ballot tiles at least 5.5rem tall and ballot type in rem, so it follows the phone's text size.

### Don't:
- **Don't** use amber as an accent, hover, link, brand colour or wordmark colour, don't offer it in the presenter's palettes, and don't make it an answer colour.
- **Don't** turn the share bar amber; on the stage only the moving count changes colour.
- **Don't** let a colour stand alone: no answer without its mark.
- **Don't** replace the slide with a results chart. Votes land in the boxes the presenter placed.
- **Don't** put cards, tinted panels or shadows in the room. The only desk shadow is the canvas lift.
- **Don't** size slide content in px, rem or viewport units.
- **Don't** add toolbars, logos, progress bars or vote totals to the display.
- **Don't** assume a slide has a QR code; the presenter may delete the join slide and the corner code.
- **Don't** ship Nintendo's Brain Training sound. The vote sound is the synthesized bell, or the presenter's own upload.
- **Don't** colour slide content with anything the presenter did not choose, except the amber signal, the paper QR tile and the answer colours.
