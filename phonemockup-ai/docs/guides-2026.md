# Guide pages — October 2026

Fifteen landing pages, each written for one search phrase, and three hub pages that list them. They follow Edward Sturm's "Compact Keywords" approach: one page per specific, ready-to-act search, with the phrase in the title, the URL, the H1 and the first sentence, about 400–500 words, and internal links instead of backlinks.

| Section | Hub | Pages |
| --- | --- | --- |
| Devices and formats | `/mockups` | `iphone-16-pro`, `pixel-9-pro`, `galaxy-s24-ultra`, `macbook-opening-animation`, `phone-mockup-video-generator`, `animated-phone-mockup`, `transparent-phone-mockup-png`, `phone-mockup-gif`, `iphone-screen-recording` |
| Use cases | `/use-cases` | `app-promo-video`, `website-mockup-video`, `instagram-story-mockup`, `product-hunt-launch-video` |
| Comparisons | `/alternatives` | `rotato`, `shots-so` |

All copy, facts, comparisons, FAQs and links live in one file, `client/src/lib/guides/guides.ts`. Every page uses the same two templates:
- `GuidePage.svelte` renders a guide, and `GuideHub.svelte` renders a hub. Both are in `client/src/lib/components/guides/`.
- The pages share the landing page's world, with the same paper, ink, hairlines, rust accent and Archivo. The styles are in `guides.css`, scoped under `.guide`.
- The direction for these pages is recorded in `.impeccable/surfaces/client-src-lib-components-guides-guidepage-svelte.md`.

## What each page does

- **The stage plays the page's own motions.** It plays the real preview footage (`static/previews/motion-2026/`) of two or three motions that suit the page. Picking another one re-points both buttons and the line «Opens the studio with … on the …». The studio opens at `/platform/animation/<motion>` with that motion's own device (`previewModelId`), so a guide's motions decide which device it opens.
- **The first motion of each guide is unique within its hub and its "More guides" list.** The hubs and lists show that motion's poster, so they would otherwise repeat the same picture. Each "More guides" row also names the section, the device and the motion.
- **Comparison pages have no spec list.** Their side-by-side table already says it, so their passages run three across. The alternatives hub lists each comparison with its verdict and the date its facts were checked (`verdict`, `comparison.checkedOn`).
- **Slugs carry the whole phrase**, apart from "free" and the brand words already in the section (for example `/mockups/transparent-phone-mockup-png`). Rename one only before it is indexed.
- **Head tags and links.** Each page sets its title, description, canonical URL (always `https://phonemockup.app/...`), Open Graph tags and a `BreadcrumbList` in JSON-LD (`GuideHead.svelte`).
  - `/sitemap.xml` lists the homepage, the hubs and every guide, and `robots.txt` points to it.
  - The homepage footer links to the three hubs.

## Adding or changing a page

1. Add the entry to `guides` in `guides.ts` and its slug to the hub's `groups`.
2. Put the keyword in the title, the H1 and the first sentence of the lead. The test checks every word.
3. Only claim what the studio does today; `PRODUCT.md` lists the capabilities. In particular:
   - The screen switch takes two images, not a video.
   - MP4 drops transparency.
   - WebM export needs Chrome or Edge.
   - GIFs are written at up to 960 px on the long side (`MAX_GIF_SIDE` in `GifEncoder.ts`).
   - Batch export is "coming soon".
   - There are no PSD or Figma files.
4. Link to the closest pages inside the copy, as `[text](/section/slug)`, and in `related`.
5. Run the checks below.

## Facts about other products

These must stay true, so they are dated. Recheck them before changing the comparison pages.

| Claim | Source | Checked |
| --- | --- | --- |
| **Rotato:** Mac app for macOS 11 or newer; web version in public beta; Windows users can sign up for news; unlimited free trial with no credit card; 30+ devices; 8K export; transparent background; Figma plugin; App Store templates | rotato.app | 20.10.2026 |
| **Rotato:** one-time plans Basic, Standard and Premium; Basic has phones only; Premium exports 8K, Standard 4K and smaller; video templates (18 on Standard, 100 on Premium) | rotato.app/pricing | 20.10.2026 |
| **Shots.so:** browser tool; "Free Mockups, Instantly"; 3D devices and flat frames for iPhones, Android phones, iPads and desktops; animation presets and video support. There is no public pricing page. | shots.so | 20.10.2026 |
| **App Store:** previews may only use video screen captures of the app itself | Apple App Review Guideline 2.3.4 | 20.10.2026 |
| **Google Play:** one preview video, as a YouTube URL; public or unlisted, ads off, embeddable, not age-restricted | Play Console Help, "Add preview assets" | 20.10.2026 |
| **Product Hunt:** gallery needs two or more images, 1270×760 recommended, each under 3 MB (GIFs too); video by YouTube link only | Product Hunt help center, "How to Post: Media" | 20.10.2026 |

Third-party reviews quote different Shots.so prices, so the pages state none.

## Checks

Run these from this project:

```sh
npm --prefix client run check
npm --prefix client run build
cd client
HOST=127.0.0.1 PORT=5231 npm start
```

In a second terminal in `client/`:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5231 npx playwright test --config=playwright.guides.config.ts --project=auth-chromium --workers=1
```

`tests/guides.spec.ts` covers:
- every page's title, H1, canonical URL and breadcrumbs;
- keyword placement;
- the motion selector re-pointing the buttons;
- every internal link resolving, and every studio link naming one of the sixteen motions;
- 404 for unknown guides;
- the sitemap and `robots.txt`;
- no sideways scrolling at 320, 390, 768 and 1440 px;
- the phone menu;
- the homepage's links to the hubs;
- comparison pages without a spec list, and the alternatives hub's dated verdicts.
