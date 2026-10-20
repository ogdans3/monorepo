---
name: PhoneMockup
description: Marketing world for phonemockup.app (the landing page and the guide pages). Warm paper, graphite ink, one rust accent, pastel stages where the product's own footage moves.
colors:
  rust: "#bc3d20"
  rust-deep: "#a63218"
  on-rust: "#ffffff"
  ink: "#242421"
  ink-soft: "#777770"
  muted: "#696963"
  paper: "#faf9f6"
  hairline: "#d9d8d2"
  wash: "#eeede8"
  stone-outline: "#bcbcb4"
  editor-ground: "#e5e4df"
  stage-ink: "#535a4d"
  stage-selector-ink: "#4f5747"
  stage-caption-ink: "#4a5045"
  stage-barrel-roll: "#dae4da"
  stage-detail-study: "#e9e3d9"
  stage-double-spin: "#e8dfd2"
  stage-edge-reveal: "#e2def0"
  stage-flip-cut: "#e4dcee"
  stage-lift-off: "#f1dfd1"
  stage-macro-rush: "#e6ead6"
  stage-orbit-dive: "#d8e7eb"
  stage-pull-focus: "#e3ddeb"
  stage-side-step: "#dfe7ee"
  stage-slow-spin: "#d8e5e9"
  stage-snap-in: "#e8ded9"
  stage-soft-orbit: "#dde7d5"
  stage-top-down: "#dde1f0"
  stage-tumble-cut: "#e7e3d4"
  stage-whip-switch: "#dbe5ed"
typography:
  display-landing:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(76px, 7.7vw, 112px)"
    fontWeight: 500
    lineHeight: 0.97
    letterSpacing: "-0.07em"
  display-hub:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(56px, 6vw, 92px)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.06em"
  display-guide:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(46px, 4.7vw, 76px)"
    fontWeight: 500
    lineHeight: 0.99
    letterSpacing: "-0.05em"
  close:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(54px, 5.6vw, 82px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.06em"
  headline:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(37px, 3.6vw, 50px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.055em"
  headline-compact:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "clamp(28px, 2.4vw, 34px)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.04em"
  faq-heading:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "31px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-1.3px"
  list-name:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 400
    letterSpacing: "-0.65px"
  title:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    letterSpacing: "-0.5px"
  lead:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.2px"
  body:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.72
  body-small:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  button:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  nav:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  label:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  wordmark:
    fontFamily: "Archivo, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    letterSpacing: "-1.2px"
  mono:
    fontFamily: "\"Courier New\", monospace"
    fontSize: "12px"
    fontWeight: 400
    fontFeature: "\"tnum\""
rounded:
  label: "2px"
  inset: "3px"
  media: "4px"
  md: "5px"
  pill: "50px"
spacing:
  container-max: "1320px"
  gutter-wide: "48px"
  gutter-medium: "28px"
  gutter-narrow: "20px"
  gutter-tiny: "16px"
  stage-inset: "25px"
  stage-inset-narrow: "18px"
  stage-bar: "69px"
  stage-bar-narrow: "64px"
  grid-row: "35px"
  grid-column: "24px"
  section-top: "64px"
  section-bottom: "72px"
  header: "88px"
  header-narrow: "72px"
  target: "44px"
components:
  button-primary:
    backgroundColor: "{colors.rust}"
    textColor: "{colors.on-rust}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "15px 21px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.rust-deep}"
    textColor: "{colors.on-rust}"
  button-primary-narrow:
    backgroundColor: "{colors.rust}"
    textColor: "{colors.on-rust}"
    rounded: "{rounded.md}"
    padding: "14px 18px"
    height: "50px"
  button-secondary:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "15px 21px"
    height: "52px"
  button-secondary-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
  text-link:
    textColor: "{colors.ink}"
    typography: "{typography.nav}"
    height: "{spacing.target}"
  text-link-hover:
    textColor: "{colors.rust}"
  nav-link:
    textColor: "{colors.ink}"
    typography: "{typography.nav}"
    height: "{spacing.target}"
  nav-link-hover:
    textColor: "{colors.rust}"
  stage:
    backgroundColor: "{colors.stage-soft-orbit}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "600px"
  stage-selector-item:
    textColor: "{colors.stage-selector-ink}"
    typography: "{typography.label}"
    height: "{spacing.target}"
  stage-selector-item-active:
    textColor: "{colors.ink}"
  motion-tile-media:
    rounded: "{rounded.media}"
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.list-name}"
    height: "112px"
  playback-control:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px"
    size: "44px"
---

# Design System: PhoneMockup

## Overview

**Creative North Star: "The Paper Showroom"**

A warm sheet of paper with graphite type on it, and a few pastel stages set into it where the real device turns. Everything that is not product footage holds still. The type does the structural work: large Archivo headlines at weight 500, pulled tight, with the second half of the opening line stepping back to a softer grey. Hairlines divide the page. There are no panels, no gradient fields, no icon grids.

The world was set by the October 2026 landing page (`client/src/routes/+page.svelte`, notes in `docs/landing-2026.md`) and extended unchanged to the eighteen guide pages under `/mockups`, `/use-cases` and `/alternatives` (`client/src/lib/components/guides/`). The two surfaces declare the same custom properties separately: the landing scopes them under `.landing`, the guides under `.guide` in `guides.css`. Neither stylesheet reaches the studio at `/platform`. Where the two surfaces differ, this file says so.

Density is generous at the top and tightens below. A first viewport holds one headline, one short lead, one rust button with a proof line under it, and a stage. Further down, hairline lists, a two-column FAQ and a closing "Let's see it." carry the rest.

**Key Characteristics:**
- Warm paper (`paper`) and graphite ink (`ink`), one rust accent (`rust`) for the primary action and active marks.
- Archivo only, weights 400 to 600, display tracking between -0.04em and -0.07em.
- Courier New only for measurements: loop seconds, counts, ordinals.
- Pastel stages whose ground is the preset's own `previewBackground`.
- Hairline rules instead of boxed cards. Flat surfaces.
- Only product footage moves. UI motion is 160ms state feedback.

## Colors

A near-neutral warm-grey paper palette with exactly one saturated colour, and a set of soft pastels that belong to the footage, not to the UI.

### Primary
- **Rust** (`rust`): the primary button's fill, the square in the wordmark, the `PhoneMockup` column marker in the comparison table, the focus outline, and the hover colour of every text link. On the landing it also marks the active device's ordinal in the device browser.
- **Deep Rust** (`rust-deep`): the primary button on hover, and nothing else.
- **White on rust** (`on-rust`): text and icons in the primary button (5.5:1 on rust).

### Neutral
- **Warm Paper** (`paper`): the page, the mobile navigation panel, the browser `theme-color` on the guides, and the playback control's fill (at 95% alpha).
- **Graphite Ink** (`ink`): all body and heading text, the active selector underline, the rule under the comparison table head, the skip link's ground.
- **Soft Ink** (`ink-soft`): the second half of a display headline ("Every angle." on the landing; everything after the first comma on a guide). Display sizes only, where 4.3:1 on paper is enough.
- **Muted** (`muted`): supporting copy, proof lines, FAQ answers, summaries, breadcrumbs, inactive filters.
- **Hairline** (`hairline`): every divider: header bottom, section tops, list rows, fact rows, FAQ and footer rules, the mobile navigation panel's border.
- **Wash** (`wash`): the secondary button's hover and the active device tab on the landing's narrow layout. The guides do not use it.
- **Stone Outline** (`stone-outline`): the 1px border of the landing's secondary button. Landing only.
- **Editor Ground** (`editor-ground`): the panel behind the landing's editor screenshot, and the fallback stage ground when a preset has no `previewBackground`.

### Stage pastels
- **The sixteen preset grounds** (`stage-*`): each comes from that preset's `previewBackground` in `client/src/lib/animations/presets/*.json` and is applied inline, never chosen by hand. A stage, a motion card, a hub tile and a list thumbnail all take the ground of the motion they show. The landing's fixed MacBook stage uses the Top Down ground.
- **Stage inks** (`stage-ink`, `stage-selector-ink`, `stage-caption-ink`): the greyed greens used for text set on a pastel: the stage label's measurement and device, the inactive selector items, the single-motion caption. These are the guide values (5.4:1 or better on every ground). The landing uses lighter ones (`#5e6658` for the label, `#59634f` for the selector), which still pass at about 4.5:1.
- **Stage rule**: the line above a stage's bottom bar is ink at 16% alpha (`#24242128`), on both surfaces.

### Named Rules
**The One Rust Rule.** Rust is used for the primary action and active marks only. Never for headings, body text, backgrounds or decoration. A screen carries one or two rust buttons (top and close), never a row of them.

**The Footage Owns The Colour Rule.** The pastels belong to the motion presets. A stage's ground is the preset's `previewBackground`; do not invent a new pastel for a surface, and do not use the pastels on UI chrome.

## Typography

**Display Font:** Archivo (self-hosted variable, `client/static/fonts/archivo/archivo-latin-variable.woff2`, weights 400 to 700), with Arial, sans-serif.
**Body Font:** Archivo, same file.
**Label/Mono Font:** Courier New, monospace, with tabular figures.

**Character:** One sturdy grotesque at three weights, set tight and large at the top and plain and readable below. The mono is a measuring tape, not a voice.

### Hierarchy
- **Display, landing** (`display-landing`): the landing hero only. Fixed at 86px from 1100px down, then `clamp(59px, 12vw, 86px)` at -0.065em under 760px, and 54px under 360px.
- **Display, hub** (`display-hub`): the three hub H1s, max width 11em. `clamp(46px, 12vw, 64px)` under 760px, 44px under 360px.
- **Display, guide** (`display-guide`): the fifteen guide H1s, which top out at 76px. `clamp(40px, 10.6vw, 56px)` at -0.055em under 760px, 38px under 360px.
- **Close** (`close`): "Let's see it." The landing sets it at a fixed 82px with -0.065em (64px narrow); the guides use the clamp (58px narrow).
- **Headline** (`headline`): section H2s (landing sections; the guides' "Side by side.", "More guides." and hub group headings). 37px narrow on the landing, 34px on the guides; -0.05em narrow.
- **Headline, compact** (`headline-compact`): the guide body's "The short version." and passage H2s, and the alternatives hub's verdict names. 28px narrow.
- **FAQ heading** (`faq-heading`): the FAQ block's H2 on both surfaces, 30px narrow.
- **List name** (`list-name`): a guide list row's name (17px narrow). The landing's device tabs use a near-twin (20px, -0.65px).
- **Title** (`title`): motion card and tile names (14px, -0.4px narrow). Steps use 16px at -0.3px; FAQ questions 15px at 500.
- **Lead** (`lead`): the guide lead, max 34em, 16px narrow. The landing lead is 17px at 1.6 and -0.25px, max 365px, 15px from 1100px down.
- **Body** (`body`): guide passages, max 62ch; 16px narrow and in the three-column wide layout. Hub body copy is 17px at 1.7, max 60ch.
- **Body small** (`body-small`): card and tile descriptions, list summaries, the guide's "Opens the studio with..." note. FAQ answers are 13px at 1.75 on the landing and 14px on the guides.
- **Button** (`button`): button labels, also on narrow screens.
- **Nav** (`nav`): header links and text links. 15px in the mobile panel; the "Your projects" header link is 13px.
- **Label** (`label`): proof lines, stage selector items (11px from 1100px down), footer links (12px landing, 13px guides).
- **Wordmark** (`wordmark`): "phonemockup" followed by a 7px rust square on the baseline (6px narrow). 21px in footers, 20px under 760px, 18px under 360px. The only weight-600 text.
- **Mono** (`mono`): loop length ("6s loop"), counts ("/ 16", "4 guides"), ordinals ("01", "02"). The alternatives hub also sets its "Checked" dates in mono.

### Named Rules
**The Tight Display Rule.** Headlines are Archivo 500 with negative tracking that grows with size: -0.04em around 30px, -0.055em around 50px, -0.06em to -0.07em at display sizes. Line height drops below 1 at display sizes (0.97 to 0.99). H1 and H2 use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

**The Measuring Tape Rule.** Courier New appears only for numbers that measure: seconds, pixels, counts, ordinals. Never for prose, labels or headings.

**The Step-Back Headline Rule.** On the landing the hero's second line ("Every angle.") is set in soft ink. The guide H1s apply this deliberately: everything after the first comma steps back to soft ink ("Free iPhone 16 Pro mockups, *in motion.*"). A headline without a comma stays fully ink. Display headlines only.

## Layout

**Container.** Content sits in a centred column `min(1320px, 100% - 96px)`; from 1100px down it is the viewport less 56px, under 760px less 40px, under 360px less 32px. Header, sections and footer all share it.

**Breakpoints.** `max-width: 1100px`, `max-width: 760px`, `max-width: 360px`, plus a header-only range from 761px to 1100px on the landing (the guides apply the same header change in their 1100px block). Hover styles are gated separately on `(hover: hover) and (pointer: fine)`.

**First viewport, landing.** A heading row (H1 left, lead and button right, aligned to the bottom), then a two-stage exhibit: a phone stage and a MacBook stage at 1.18fr to 1fr with a 6px gap, 500px tall (430px from 1100px down). Under 760px the MacBook stage is removed and the phone stage is 430px (385px under 360px).

**First viewport, guide.** A breadcrumb, then two columns at 0.92fr to 1.08fr with a 56px gap (36px from 1100px down): H1, lead, rust button, proof line and an "Opens the studio with..." note on the left; a stage at least 600px tall on the right (520px, then 450px stacked under 760px, 410px under 360px). Hubs put the H1 and lead in a bottom-aligned row, then optional body copy beside a compact 420px stage (380px narrow).

**Section rhythm.** Sections are separated by a hairline on top and padded 54 to 104px on top and 64 to 86px below on wide screens (64px and 72px is the most common pair), about 35 to 60px top and 42 to 52px bottom under 760px. Section heads pair the H2 on the left with a muted note of at most about 365px on the right, aligned to the bottom; under 760px they stack.

**Grids.** Motion cards and hub tiles use 35px row and 24px column gaps (28px and 18px from 1100px down on the landing), three columns on the landing and up to five on hubs, falling to three and then two (25px by 14px gaps) under 760px. The guide body is 0.82fr facts to 1.18fr passages with an 80px gap and a sticky fact list; without facts the passages run in three columns. FAQs are 1fr heading to 1.9fr list with a 90px gap and a two-column list (34px by 40px); single column under 760px.

**Inside a stage.** The label sits 23px from the top and 25px in from each side (18px under 760px). The bottom bar is 69px tall (64px narrow) with the same inset.

### Named Rules
**The Shared Column Rule.** Everything aligns to the one container and its gutters. Stages and lists run to its edges; nothing bleeds to the viewport except the paper itself.

## Elevation & Depth

Flat. Depth comes from tone: pastel stages set into paper, hairlines between sections, soft ink against ink. There are only two shadows, both faint, ink-tinted and blurred.

### Shadow Vocabulary
- **Screenshot lift** (`box-shadow: 0 6px 22px #24242112`): the landing's editor screenshot inside its editor-ground panel. Landing only.
- **Menu drop** (`box-shadow: 0 12px 20px #2424210a`): the mobile navigation panel below the header, on both surfaces.

The guide header's active hub is marked with `box-shadow: inset 0 -2px 0 ink`. This is an underline drawn with a shadow, not elevation.

### Named Rules
**The Flat Paper Rule.** Stages, cards, tiles, lists and buttons have no shadow at rest or on hover. Depth is a change of ground, not a lift.

## Shapes

Small, consistent radii and straight hairlines. Stages, buttons and the mobile navigation panel's bottom corners use 5px (`md`). Card, tile and list-thumbnail media use 4px (`media`). The editor screenshot, the narrow device tabs and the landing's round-link hover use 3px (`inset`). The landing's "Screen switch" tag on a motion card uses 2px (`label`). The wordmark's square and the comparison table's rust marker are sharp 7px squares.

The one round shape is MotionPreview's play/pause control (`pill`, 50px). It belongs to that shared component and is not a pattern for other controls.

Media is always clipped (`overflow: hidden`) to its radius. Video sits `object-fit: contain` in stages and cards so the device is never cropped. The landing's MacBook stage is the exception: it uses `cover` at a 1.25 scale.

## Components

### Buttons
Plain blocks with no ornament: the label and an up-right arrow, 40px apart.
- **Shape:** gently squared (5px).
- **Primary:** rust fill, white text and arrow, 52px tall, 15px by 21px padding (50px, 14px by 18px and a 36px gap under 760px). A primary button always names what opens: "Make a mockup", or on a guide "Make an iPhone 16 Pro mockup". A muted proof line sits 12 to 14px below it: "Free during beta. No watermark." on the landing, "Free during beta. No watermark. No account." on the guides.
- **Hover / Focus / Press:** deep rust on hover (fine pointers only); a 2px rust outline 5px out on focus; scale 0.98 on press; background, colour and transform transition over 160ms.
- **Secondary (landing only):** transparent with a 1px stone outline and ink text; wash on hover. Used for the motion gallery's expand control. The guides have no secondary button.

### Text links
- **Style:** ink, 14px, at least 44px tall, with an up-right or down arrow 22px after the label. No underline.
- **Hover:** rust (fine pointers only).
- **Prose links (guides only):** links inside a passage are underlined 1px, 4px below the text, in rust at about 53% alpha, and turn rust on hover.

### Navigation
- **Header:** 88px tall (72px under 760px) with a hairline below. Wordmark left, links centred in 14px ink with 30px between them, "Your projects" plus account controls on the right. From 1100px down the "Your projects" link is hidden and the gaps tighten.
- **Links:** the landing links to its own sections (Motions, Devices, How it works). The guides link to the three hubs and mark the current one with a 2px ink underline (`aria-current`); in the mobile panel the current hub turns rust instead.
- **Mobile disclosure (under 760px):** a "Menu" button with a down arrow that turns 180° when open; `aria-expanded` and `aria-controls`; Escape closes it and returns focus to the button. The panel drops below the header full-width in paper with a hairline border, 5px bottom corners and the menu-drop shadow. Rows are 48px with hairlines between them, then "Your projects" and the account controls. On the guides the toggle is disabled until the page hydrates.
- **Breadcrumb (guides only):** muted 13px (12px narrow), separated by "/" in a lighter grey; the current page in ink; 44px tall links.

### The Stage (signature)
A pastel field, 5px corners, in which the product's footage plays.
- **Ground:** the shown preset's `previewBackground`. On the guides the ground changes over 320ms when the selection changes; on the landing it switches without a transition.
- **Label:** a row 23px from the top: the motion name and a soft "/ device" on the left (the landing writes a short line such as "Make it move."), the loop length in mono on the right ("6s loop"). The label ignores pointer events.
- **Bottom bar:** 69px tall, an ink 16% rule above it. It holds the motion selector, or on a single-motion stage a one-line description in caption ink. The landing's phone stage adds a 44px up-right link to the studio at the right end.
- **Selector:** two or three motion names, 12px (11px from 1100px down), `aria-pressed` buttons in a labelled group, 44px tall, 21px apart. The active one is ink with a 2px underline in its own colour 8px from the bottom; inactive ones use selector ink and turn ink on hover.
- **Guide-only behaviour:** choosing a motion re-points the page's two rust buttons to `/platform/animation/<motion>`, and the "Opens the studio with..." note, an `aria-live="polite"` region, names the new motion and device. Try before you open.
- **Video:** one MotionPreview per stage, keyed by motion so a change mounts fresh footage, loaded with `priority`.

### Motion cards and hub tiles
- **Media:** the preset's pastel ground, 4px corners, ratio 1 to 1.06 (4:5 under 760px; hub groups of two or fewer use 16:10). Footage plays inside via MotionPreview without `priority`.
- **Title row:** 44px tall, 9px below the media; the 17px name and an up-right arrow. On the landing a mono loop length sits before the arrow (hidden under 360px). The title row is the link and turns rust on hover.
- **Description:** muted 13px under the title.
- **No container:** no border, no background, no shadow around the card.

### Hairline lists
- **Guide list (related guides, hub fallback):** rows at least 112px tall (92px narrow) with a hairline under each except the last: an 80px 4:5 poster thumbnail on its pastel (60px narrow), then the 21px name, a muted 13px summary and a muted 12px meta line ("Mockups · iPhone 16 Pro · Soft Orbit"), then an up-right arrow. On hover the name turns rust and the arrow moves 3px up and right over 160ms.
- **Verdict list (alternatives hub):** opens with an ink rule; four columns per row: "PhoneMockup vs X" in compact headline, the verdict, a mono "Checked" date, and the arrow; 30px padding. Same hover as the guide list. Stacks to name, text, date and arrow under 760px.
- **Fact list (guides):** "The short version." over a definition list with hairline rows: a muted 13px term, a 14px tabular value.
- **Steps (landing):** three hairline rows with a mono ordinal, a 16px title and muted copy.
- **Device browser (landing):** four 72px hairline rows in 20px muted text with a mono ordinal; the active row is ink, its ordinal rust, and an arrow appears. Under 760px they become a two-by-two grid of 3px-cornered, hairline-bordered tabs; the active one has an ink border on wash.

### Comparison table (alternatives guides)
- "Side by side." headline with a dated muted note on the right.
- A full-width table in 14px at 1.55 with hairline rows, ink under the head, and 17px vertical cell padding. The head is muted 13px; the `PhoneMockup` column head is ink 500 with a 7px rust square before it. Row labels are 500 at 19% width; the two value columns share the rest.
- Under 760px the table becomes stacked rows: label, then each value with its column name in muted 12px on the left (`data-label`).

### FAQ grid
A two-column section: the H2 on the left ("A few useful answers." on the landing, "Good to know." on the guides), a two-column grid of questions on the right, each a 15px 500 question over a muted answer. Plain text, no disclosure, no icons. Single column under 760px.

### The close
A hairline-topped row: "Let's see it." in the close size on the left, the rust primary button and its proof line on the right (right-aligned on the guides). Under 760px it stacks and aligns left. The guide close repeats the page's button, following the stage selection. The hub close opens Soft Orbit.

### Footer
- **Landing:** one row with the 21px wordmark, a muted 12px line, a row of guide hub links (44px targets), and "Your projects" with an arrow on the right; wraps under 760px.
- **Guides:** a hairline-topped grid: wordmark and "A browser. A screen. A different angle." on the left; three columns of hub (13px 500) and guide links (13px muted, rust on hover) on the right; then a bottom row with the proof line and "Your projects". Two link columns under 760px, one under 360px.

### Motion preview and playback
The `MotionPreview` component (`client/src/lib/components/marketing/MotionPreview.svelte`) is the only thing that moves on these pages, and it holds the single playback authority.
- **Plays when** it is mounted, at least 15% visible, the tab is visible, and it has not been paused by hand. Under `prefers-reduced-motion: reduce` it shows the poster and plays only after a tap.
- **Loads lazily:** the source is set once the preview first scrolls into view (`preload="auto"` only with `priority`). It is always muted, inline, without picture-in-picture, and restarts explicitly at the end instead of using native looping.
- **Recovers in the tap:** the source is assigned, reloaded if it failed, and played inside the same user gesture. If playback is blocked, the control reads "Tap to play".
- **Control:** a 44px pill in the bottom-right corner, 14px from the edges, paper at 95% with a white 44% border, ink play or pause glyph from Lucide; white on hover; scale 0.96 on press; a 2px ink focus outline 3px out. Its label is 12px Arial 500. On a stage it sits 80px from the bottom on the landing and above the bar on the guides.

### Named Rules
**The Only Footage Moves Rule.** Nothing enters, fades in, parallaxes or animates on scroll. The only motion is the product's own footage, plus 160ms state feedback: colour, background, a 0.98 press, the 180° menu arrow, the guides' 3px arrow nudge and their 320ms stage-ground change.

**The Reduced Motion Rule.** Under `prefers-reduced-motion: reduce`, every transition is removed, the press scale is removed, and previews wait for a tap.

**The 44px Rule.** Every link and button is at least 44px tall or wide: header links, selectors, filters, breadcrumbs, text links, round links, playback. Mobile menu rows are 48px. The guide footer's link columns break this rule (hub links 32px, guide links 30px tall) and are not a precedent.

**The Fine-Pointer Hover Rule.** Hover colours and backgrounds are declared only inside `(hover: hover) and (pointer: fine)`. Touch screens get press feedback, not stuck hovers.

**The Rust Focus Rule.** Keyboard focus is a 2px rust outline offset 5px on every link and button (`:focus-visible`). MotionPreview's control is the exception: an ink outline 3px out. A skip link ("Skip to content") slides in on focus.

## Do's and Don'ts

### Do:
- **Do** set every new marketing surface on `paper` with `ink` text and `hairline` dividers, scoped under its own root class like `.landing` and `.guide`.
- **Do** keep rust to the primary button, the wordmark square, active marks, link hover and focus.
- **Do** show the product's own footage first, on a stage whose ground is the preset's `previewBackground`, with its loop length in mono.
- **Do** set headlines in Archivo 500 with the tight tracking of the hierarchy above, and let only display headlines step back to `ink-soft`.
- **Do** name what the primary button opens, and point it at `/platform/animation/<motion>` for the motion on show.
- **Do** separate sections and list rows with 1px hairlines, and keep cards to media plus a title row.
- **Do** keep every target at 44px or more, gate hover on `(hover: hover) and (pointer: fine)`, press at scale 0.98 and transition over 160ms.
- **Do** honour `prefers-reduced-motion` by removing transitions and leaving previews on their poster until tapped.

### Don't:
- **Don't** use rust for headings, body text, section backgrounds or decorative fills.
- **Don't** invent pastels; a stage or tile takes its preset's ground.
- **Don't** set prose, labels or headings in Courier New; it is for measurements only.
- **Don't** add entrance, fade-in, parallax or scroll-driven animation; only product footage moves.
- **Don't** box content in bordered or shadowed cards, or lift anything with a shadow on hover.
- **Don't** add icon grids, stock heroes, testimonials, ratings, logos or counts the product does not have.
- **Don't** set a small label above a section heading. The landing's `section-index` lines ("The motion library / 16", "Got something to show?") predate this file and are not a pattern; the guides ship without them.
- **Don't** copy MotionPreview's pill shape or Arial label into other controls.
