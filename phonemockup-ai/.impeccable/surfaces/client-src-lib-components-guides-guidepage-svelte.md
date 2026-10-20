---
version: 1
slug: "client-src-lib-components-guides-guidepage-svelte"
primary_target: "client/src/lib/components/guides/GuidePage.svelte"
related_targets: ["client/src/lib/components/guides/GuideHub.svelte","client/src/routes/mockups","client/src/routes/use-cases","client/src/routes/alternatives"]
---

# Guide pages: /mockups, /use-cases, /alternatives

Scope: three hub pages and fifteen compact-keyword landing pages under them. Visitor mode: Persuade.

- **Audience:** app developers and founders; designers and agencies (PRODUCT.md).
- **Job:** they searched a specific phrase ("iphone 16 pro mockup free", "rotato alternative free"). They want to know within seconds that this page gives exactly that, free, and how to start.
- **Action:** open the studio at `/platform/animation/<motion>`, with the device and motion the page is about.
- **Proof:** the product's own preview footage of each motion, the real studio capabilities, and dated facts about competitors. There are no testimonials or numbers, and none may be invented.
- **Constraints:**
  - Each page has its keyword in the title, URL, H1 and first sentence, and runs 400–500 words of unique copy.
  - Canonical URLs point to https://phonemockup.app.
  - Every claim must match PRODUCT.md's capabilities.
  - App Store previews are not offered.
  - "Free during beta" is the price wording.

## Direction contract

THESIS: Each page proves its search phrase in the first viewport. The searcher sees the named device or use moving, and the matching studio setup is one click away. The page refuses the category's SEO default: a stock hero, a grid of icon cards and a wall of text.

OWN-WORLD: The landing's world, unchanged:
- Warm paper `#faf9f6`, graphite ink `#242421`, muted `#696963` and hairlines `#d9d8d2`. One rust accent, `#bc3d20`, is used only for the primary action and active marks.
- Archivo 400–600 with tight display tracking. Courier New appears only for measurements: seconds, pixels and counts.
- 5px radii, and pastel motion stages taken from each preset's `previewBackground`.
- Hairline lists instead of cards.

STORY: The visitor sees their device or use moving and reads that it is free during beta with no watermark. A spec list answers the exact query. A few short passages show what they can change. They open the studio with the right device and motion, or follow a hairline list to the next closest page.

FIRST VIEWPORT:
- Breadcrumb across the top.
- Left column: the H1 with the keyword (≤88px), a lead with the keyword in its first sentence, a rust primary button that names the device or use, and the proof line «Free during beta. No watermark. No account.».
- Right column: a tall pastel stage playing the page's motion, with a selector of two or three matching motions and the loop length in mono.

The button follows the selected motion. That is the signature interaction: try before you open. Only the product's footage moves. There are no entrance animations.

FORM: Extension of the established landing world (`client/src/routes/+page.svelte`, `docs/landing-2026.md`). There was no concept roll, because the world and the page format (compact-keyword landing pages) are already settled. Seed key: none.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Production deploys of phonemockup.app are the user's. The dashboard preview at phonemockup-ai.freelunch.no is where this is checked.
