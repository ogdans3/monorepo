// The guide pages under /mockups, /use-cases and /alternatives. Each one is
// written for one search phrase (its `keyword`), which goes in the title, the
// URL, the H1 and the first sentence of the lead. Every claim has to match what
// the studio does today; see PRODUCT.md and docs/guides-2026.md. Links inside
// paragraphs are written [like this](/mockups/phone-mockup-video-generator).

export const SITE = "https://phonemockup.app";

export type GuideSection = "mockups" | "use-cases" | "alternatives";

export interface Fact {
  label: string;
  value: string;
}

export interface Passage {
  heading: string;
  body: string[];
}

export interface Comparison {
  /** The other tool, as the column heading. */
  them: string;
  rows: { label: string; us: string; them: string }[];
  /** Where and when the other tool's facts were checked. */
  checked: string;
  /** The date alone, for lists. */
  checkedOn: string;
}

export interface Guide {
  section: GuideSection;
  slug: string;
  keyword: string;
  /** Short name for breadcrumbs and lists. */
  name: string;
  /** One line for the hub and related lists. */
  summary: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  cta: string;
  /** Motion preset ids. The first is shown and opened by default. */
  motions: string[];
  /** The spec list. Comparison pages leave it out: their table says it. */
  facts?: Fact[];
  passages: Passage[];
  comparison?: Comparison;
  /** The one-line verdict the alternatives hub shows. */
  verdict?: string;
  faqs: { q: string; a: string }[];
  /** `section/slug` of the pages to link to at the end. */
  related: string[];
}

export interface GuideHub {
  section: GuideSection;
  name: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  /** Paragraphs under the heading, for a hub that needs more than a lead. */
  body?: string[];
  /** A motion to play beside the body, for a hub whose list has no footage. */
  motion?: string;
  /** Groups of slugs, in the order the hub lists them. A list shows verdicts. */
  groups: { heading: string; slugs: string[]; layout?: "tiles" | "list" }[];
}

const FREE = "Free during beta. No watermark.";

export const hubs: GuideHub[] = [
  {
    section: "mockups",
    name: "Mockups",
    title: "Free 3D Phone and Laptop Mockups | PhoneMockup",
    description:
      "Free 3D mockups of the iPhone 16 Pro, Pixel 9 Pro, Galaxy S24 Ultra and MacBook Pro 14″, made from your screenshots and screen recordings. Video, GIF or PNG.",
    h1: "Free 3D phone and laptop mockups.",
    lead: "Free 3D mockups of four detailed devices, made from your own screenshots and screen recordings. Start from the device you’re showing, or from the file you need at the end.",
    groups: [
      {
        heading: "By device",
        slugs: [
          "iphone-16-pro",
          "pixel-9-pro",
          "galaxy-s24-ultra",
          "macbook-opening-animation",
        ],
      },
      {
        heading: "By format",
        slugs: [
          "phone-mockup-video-generator",
          "animated-phone-mockup",
          "transparent-phone-mockup-png",
          "phone-mockup-gif",
          "iphone-screen-recording",
        ],
      },
    ],
  },
  {
    section: "use-cases",
    name: "Use cases",
    title: "Mockup Videos for App Launches, Sites and Feeds | PhoneMockup",
    description:
      "How app makers and designers use PhoneMockup: app promo videos, website mockup videos, Instagram story mockups and Product Hunt launch videos.",
    h1: "Mockup videos for launches, sites and feeds.",
    lead: "Where a moving device earns its place: in an app promo, at the top of a website, in a story, on launch day. Each guide pairs the job with the device, motion and export that fit it.",
    groups: [
      {
        heading: "Use cases",
        slugs: [
          "app-promo-video",
          "website-mockup-video",
          "instagram-story-mockup",
          "product-hunt-launch-video",
        ],
      },
    ],
  },
  {
    section: "alternatives",
    name: "Alternatives",
    title: "PhoneMockup Compared with Rotato and Shots.so | PhoneMockup",
    description:
      "How PhoneMockup compares with Rotato and Shots.so, with their facts checked on their own sites and dated. Including when the other tool is the better pick.",
    h1: "PhoneMockup, compared.",
    lead: "Side-by-side notes on other mockup tools. Their facts are checked on their own sites and dated, and where another tool is the better pick, the page says so.",
    body: [
      "Every comparison follows the same order: the two tools side by side, where PhoneMockup fits, where the other tool is the better pick, and how to try both with your own screen before you decide.",
      "PhoneMockup is the one to pick when the device itself should move: four detailed 3D devices, sixteen editable camera motions and video export, free during beta and without a watermark.",
    ],
    motion: "orbit-dive",
    groups: [{ heading: "Comparisons", slugs: ["rotato", "shots-so"], layout: "list" }],
  },
];

export const guides: Guide[] = [
  // ─── Mockups: devices ───────────────────────────────────────────────────
  {
    section: "mockups",
    slug: "iphone-16-pro",
    keyword: "iphone 16 pro mockup free",
    name: "iPhone 16 Pro",
    summary: "Dynamic Island on or off, your screen in motion.",
    title: "Free iPhone 16 Pro Mockup, Animated in 3D | PhoneMockup",
    description:
      "Make a free iPhone 16 Pro mockup from a screenshot or screen recording. Turn it in 3D, hide the Dynamic Island, export video or a transparent PNG. No watermark.",
    h1: "Free iPhone 16 Pro mockups, in motion.",
    lead: "Make a free iPhone 16 Pro mockup from your own screenshot or screen recording. Turn it in 3D, keep or hide the Dynamic Island, and export a video, a GIF or a transparent PNG.",
    cta: "Make an iPhone 16 Pro mockup",
    motions: ["soft-orbit", "edge-reveal", "macro-rush"],
    facts: [
      { label: "Device", value: "iPhone 16 Pro. Titanium frame, three cameras." },
      { label: "Dynamic Island", value: "On, or off for an edge-to-edge screen" },
      { label: "Screen", value: "Any image or video. It moves with the phone." },
      { label: "Motions", value: "16 presets, every keyframe editable" },
      { label: "Export", value: "MP4, WebM, GIF or PNG" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Keep the Dynamic Island, or lose it.",
        body: [
          "The mockup starts with the Dynamic Island in place, the way the phone looks in your hand. Switch it off and your screen runs edge to edge, which suits full-bleed artwork, games and video. The Apple logo on the back can be hidden too, for the motions that turn the phone around.",
        ],
      },
      {
        heading: "Your screen, playing on the phone.",
        body: [
          "Drop in a PNG from Figma or a recording from your phone. A video plays on the display while the phone moves, so a scroll or a tap reads as real use rather than a still on a turntable. Soft Orbit floats slowly around the phone, Edge Reveal goes from a sliver of light to the whole story, and Macro Rush pushes right into the screen, then breathes out. All three stay editable down to the keyframe.",
        ],
      },
      {
        heading: "Export it for where it’s going.",
        body: [
          "MP4 for a landing page or a post, a GIF for a changelog, or a PNG with a [transparent background](/mockups/transparent-phone-mockup-png) to place over your own design. The vertical canvas renders at 2160×3840 and the square one at 2160×2160.",
        ],
      },
      {
        heading: "Made for the close-up.",
        body: [
          "The iPhone 16 Pro is modelled for the close-up, from the titanium frame to the three cameras, so it holds up when Macro Rush pushes right in. Keep the phone’s own finish, or set a case color to match your brand: the color covers the body and leaves the screen and glass alone. Any of the sixteen motions works on it, not only the three shown here.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the iPhone 16 Pro mockup free?",
        a: "Yes. PhoneMockup is free during beta. Exports carry no watermark, and you can start without an account.",
      },
      {
        q: "Can I hide the Dynamic Island?",
        a: "Yes. Turn it off in the model settings and the screen fills the whole display.",
      },
      {
        q: "Can I download it as a PSD or Figma file?",
        a: "No. PhoneMockup renders the finished mockup as a video, a GIF or a PNG. There is no layered file.",
      },
    ],
    related: [
      "mockups/iphone-screen-recording",
      "mockups/transparent-phone-mockup-png",
      "mockups/pixel-9-pro",
      "use-cases/app-promo-video",
    ],
  },
  {
    section: "mockups",
    slug: "pixel-9-pro",
    keyword: "google pixel 9 pro mockup free",
    name: "Pixel 9 Pro",
    summary: "The camera bar in detail, the cutout on or off.",
    title: "Free Google Pixel 9 Pro Mockup, Animated in 3D | PhoneMockup",
    description:
      "Make a free Google Pixel 9 Pro mockup from your Android screenshots and recordings. Show the camera bar in 3D, hide the cutout, export video or PNG. No watermark.",
    h1: "Free Google Pixel 9 Pro mockups, in 3D.",
    lead: "Make a free Google Pixel 9 Pro mockup from your Android screenshots and screen recordings. Show off the camera bar, hide the front camera cutout if you like, and export a video or a still.",
    cta: "Make a Pixel 9 Pro mockup",
    motions: ["detail-study", "lift-off", "pull-focus"],
    facts: [
      { label: "Device", value: "Google Pixel 9 Pro, camera bar and all" },
      { label: "Camera cutout", value: "Shown, or hidden" },
      { label: "Screen", value: "Any image or video. It moves with the phone." },
      { label: "Motions", value: "16 presets, every keyframe editable" },
      { label: "Export", value: "MP4, WebM, GIF or PNG" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Your Android app, on an Android phone.",
        body: [
          "The Pixel 9 Pro is modelled down to its camera bar, and the motions are made to show it. Detail Study moves in close, glides across and pulls back, so the hardware gets its moment before your screen takes over. Pull Focus works the other way round: it starts on the details and reveals the whole picture.",
        ],
      },
      {
        heading: "Hide the cutout, or keep it.",
        body: [
          "The front camera cutout shows by default, as it does on the phone. Hide it when your screenshot already carries its own status bar and you want a clean display. The Google logo can be hidden too, for a neutral device in client work.",
        ],
      },
      {
        heading: "From recording to a looping clip.",
        body: [
          "Record your app on the phone, drop the file onto the screen and pick a motion. Lift Off rises into the frame and lands softly, in five seconds that loop. Export MP4 or WebM for video, a GIF for a quick loop, or a PNG still at 2160×3840. For another Android shape, there’s the [Galaxy S24 Ultra](/mockups/galaxy-s24-ultra).",
        ],
      },
      {
        heading: "Turn it over.",
        body: [
          "Barrel Roll and Tumble Cut turn the phone right over, so the camera bar gets its moment on the way round. Tumble Cut goes further: give it two screenshots and the second takes over the screen while the phone faces away, so one clip can show two screens of your app. Keep the phone’s own finish or set a case color.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the Pixel 9 Pro mockup free?",
        a: "Yes, free during beta. Exports have no watermark, and you can start without an account.",
      },
      {
        q: "Can I use a screen recording from my phone?",
        a: "Yes. Drop in a video file and it plays on the screen while the phone moves.",
      },
      {
        q: "Which other devices are there?",
        a: "The iPhone 16 Pro, the Samsung Galaxy S24 Ultra and a MacBook Pro 14″ for desktop work.",
      },
    ],
    related: [
      "mockups/galaxy-s24-ultra",
      "mockups/animated-phone-mockup",
      "mockups/phone-mockup-video-generator",
      "use-cases/instagram-story-mockup",
    ],
  },
  {
    section: "mockups",
    slug: "galaxy-s24-ultra",
    keyword: "samsung galaxy s24 ultra mockup free",
    name: "Galaxy S24 Ultra",
    summary: "A flat display and a squared silhouette, built for spins.",
    title: "Free Samsung Galaxy S24 Ultra Mockup in 3D | PhoneMockup",
    description:
      "Make a free Samsung Galaxy S24 Ultra mockup from your screenshot or screen recording. Spin it in 3D, then export MP4, GIF or a transparent PNG. No watermark.",
    h1: "Free Samsung Galaxy S24 Ultra mockups.",
    lead: "Make a free Samsung Galaxy S24 Ultra mockup from your screenshot or screen recording. Its flat display and squared silhouette hold up in close-ups and full spins alike.",
    cta: "Make a Galaxy S24 Ultra mockup",
    motions: ["slow-spin", "side-step", "double-spin"],
    facts: [
      { label: "Device", value: "Samsung Galaxy S24 Ultra" },
      { label: "Shape", value: "Flat display, squared silhouette" },
      { label: "Case", value: "Its own finish, or any color" },
      { label: "Screen", value: "Any image or video. It moves with the phone." },
      { label: "Export", value: "MP4, WebM, GIF or PNG" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Built for the spin.",
        body: [
          "Slow Spin takes one measured turn, so every detail gets its moment. Double Spin makes two full turns and finishes facing front. Side Step glides sideways with a little attitude. The display is flat, so your screen meets the frame without a curved edge on the way round.",
        ],
      },
      {
        heading: "Paint it, or keep it.",
        body: [
          "Keep the phone’s own finish, or set a case color to match your brand. The color covers the body and leaves the screen and the glass alone. The Samsung logo can be hidden for a neutral device.",
        ],
      },
      {
        heading: "Two screens in one turn.",
        body: [
          "Whip Switch flips the phone sideways and cuts to a second screen while it faces away, so one four-second clip can show two screenshots of your app. Export MP4 for social posts, WebM or PNG with a transparent background for layering, or a 16:9 frame at 3840×2160 for a slide.",
        ],
      },
      {
        heading: "Close-ups that hold.",
        body: [
          "The Galaxy S24 Ultra is detailed enough for the motions that move in close. Macro Rush pushes right into the screen, then breathes out, and Pull Focus starts on the details before it reveals the whole phone. Every device works with every motion, so pick the move first and the phone second if you like, then edit any keyframe that isn’t quite right.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the Galaxy S24 Ultra mockup free?",
        a: "Yes. It’s free during beta, without a watermark, and you don’t need an account to start.",
      },
      {
        q: "Can I change the phone’s color?",
        a: "Yes. Pick a case color, or keep the model’s own finish.",
      },
      {
        q: "Can I put a video on the screen?",
        a: "Yes. Drop in a video file and it plays on the screen while the phone moves.",
      },
      {
        q: "Can I hide the Samsung logo?",
        a: "Yes. Untick Show logo in the model settings and the back of the phone is plain, which suits client work that shouldn’t carry a brand.",
      },
    ],
    related: [
      "mockups/pixel-9-pro",
      "mockups/phone-mockup-gif",
      "mockups/transparent-phone-mockup-png",
      "alternatives/rotato",
    ],
  },
  {
    section: "mockups",
    slug: "macbook-opening-animation",
    keyword: "macbook opening animation mockup",
    name: "MacBook opening animation",
    summary: "A MacBook Pro 14″ whose lid opens as the film plays.",
    title: "MacBook Opening Animation Mockup, Free | PhoneMockup",
    description:
      "Make a MacBook opening animation mockup with your website or app on screen. Set the lid angle or animate it opening, then export MP4, GIF or PNG. Free during beta.",
    h1: "Free MacBook opening animation mockups.",
    lead: "Make a MacBook opening animation mockup with your website or desktop app on screen. The lid of a detailed MacBook Pro 14″ opens as the motion plays, or stays at the angle you set.",
    cta: "Make a MacBook mockup",
    motions: ["top-down"],
    facts: [
      { label: "Device", value: "MacBook Pro 14″ (M4)" },
      { label: "Lid angle", value: "0° to 130°, starting at 105°" },
      { label: "Opening", value: "During the animation, 2.5 s unless you change it" },
      { label: "Screen", value: "Any image or video, such as a site recording" },
      { label: "Export", value: "MP4, WebM, GIF or PNG" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Open the lid as the film starts.",
        body: [
          "Tick “Open lid during animation” and the MacBook opens while the motion plays, over 2.5 seconds unless you set another opening duration. Leave it off and the lid holds still at any angle from closed to 130°, so a half-open laptop and a wide-open hero shot are one slider apart.",
        ],
      },
      {
        heading: "Top Down, then the hero angle.",
        body: [
          "Top Down is the motion made for the laptop: an overhead study that opens into a hero angle. Your screen sits on the display throughout, whether it’s a still of a landing page or a recording of someone scrolling through it.",
        ],
      },
      {
        heading: "For sites, apps and decks.",
        body: [
          "Use the clip at the top of a launch page, in a portfolio or on a slide. The 16:9 canvas renders at 3840×2160 and the 21:9 one at 7680×3292, and PNG, WebM and GIF can keep the background transparent. There’s a guide to [website mockup videos](/use-cases/website-mockup-video) too.",
        ],
      },
      {
        heading: "A recording that scrolls.",
        body: [
          "Record your site or desktop app in a window, scroll at the pace you want people to read, and drop the file onto the display. The recording plays while the lid opens and the camera moves, so the first thing people see is your product coming into view. For the phone version of the same page, use the [iPhone 16 Pro](/mockups/iphone-16-pro).",
        ],
      },
    ],
    faqs: [
      {
        q: "Can the MacBook open during the animation?",
        a: "Yes. Turn on “Open lid during animation” and set how many seconds the opening takes.",
      },
      {
        q: "Is the MacBook mockup free?",
        a: "Yes, free during beta, with no watermark on exports.",
      },
      {
        q: "Can I show a website recording on the screen?",
        a: "Yes. Drop in a video of your site and it plays on the display while the camera moves.",
      },
    ],
    related: [
      "use-cases/website-mockup-video",
      "mockups/phone-mockup-video-generator",
      "use-cases/product-hunt-launch-video",
      "mockups/iphone-16-pro",
    ],
  },

  // ─── Mockups: formats ───────────────────────────────────────────────────
  {
    section: "mockups",
    slug: "phone-mockup-video-generator",
    keyword: "phone mockup video generator free",
    name: "Phone mockup video",
    summary: "Your screen on a 3D phone, rendered as a video.",
    title: "Free Phone Mockup Video Generator | PhoneMockup",
    description:
      "A free phone mockup video generator in your browser. Put your screen recording on a 3D phone, pick one of 16 motions and export MP4, WebM or GIF. No watermark.",
    h1: "A free phone mockup video generator.",
    lead: "PhoneMockup is a free phone mockup video generator: drop a screenshot or screen recording onto a 3D phone, pick one of sixteen motions, and render the video in your browser.",
    cta: "Make a mockup video",
    motions: ["double-spin", "soft-orbit", "lift-off"],
    facts: [
      { label: "Phones", value: "iPhone 16 Pro, Pixel 9 Pro, Galaxy S24 Ultra" },
      { label: "Laptop", value: "MacBook Pro 14″" },
      { label: "Screen", value: "Screenshot, design export or screen recording" },
      { label: "Motions", value: "16 presets, 4–6 second loops" },
      { label: "Video", value: "MP4, WebM, GIF or a PNG sequence" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "A product film, without the 3D software.",
        body: [
          "No After Effects template and no Blender scene. The phone, the lighting and the camera move are already built; you bring the screen. Choose a device and a motion, adjust whatever you like, and render it in the browser, on your own computer.",
        ],
      },
      {
        heading: "Sixteen motions, all editable.",
        body: [
          "Orbits, zooms, spins, flips and reveals, each a loop of four to six seconds. Every keyframe can be moved, and the timing and curves changed, so a preset is a starting point rather than a template you’re stuck with. Three of the flips can cut to a second screenshot while the phone faces away. See them all on the [animated phone mockups](/mockups/animated-phone-mockup) page.",
        ],
      },
      {
        heading: "Export at the size you post.",
        body: [
          "Render vertical 9:16 at 2160×3840 for stories and reels, 4:5 or square for feeds, and 16:9 at 3840×2160 for sites and decks. MP4 plays almost anywhere; WebM and GIF can keep a transparent background. WebM export needs Chrome or Edge.",
        ],
      },
      {
        heading: "Free, and yours to come back to.",
        body: [
          "PhoneMockup is free during beta, with no watermark on what you export and no account to make first. Projects are saved in the browser you made them in, so you can come back later, swap the recording for a newer build and export again without starting over. For a single still instead of a video, see the [transparent PNG](/mockups/transparent-phone-mockup-png) guide.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the video generator really free?",
        a: "Yes. PhoneMockup is free during beta. Exports carry no watermark, and you can start without an account.",
      },
      {
        q: "Do I need to install anything?",
        a: "No. It runs in your browser, and the video is rendered on your own computer.",
      },
      {
        q: "Can I use my screen recording?",
        a: "Yes. Drop in a video file and it plays on the phone’s screen while the phone moves.",
      },
    ],
    related: [
      "mockups/animated-phone-mockup",
      "mockups/iphone-screen-recording",
      "use-cases/app-promo-video",
      "mockups/phone-mockup-gif",
    ],
  },
  {
    section: "mockups",
    slug: "animated-phone-mockup",
    keyword: "animated phone mockup free",
    name: "Animated phone mockups",
    summary: "Sixteen motions, from slow orbits to full flips.",
    title: "Free Animated Phone Mockups, 16 Motions | PhoneMockup",
    description:
      "Free animated phone mockups made from your own screen. Pick one of 16 motions, from slow orbits to flips, edit every keyframe and export video or GIF. No watermark.",
    h1: "Free animated phone mockups, sixteen ways.",
    lead: "Make a free animated phone mockup from your own screen with one of sixteen motions, from a slow orbit to a full flip. Every one of them can be edited down to the keyframe.",
    cta: "Animate your screen",
    motions: ["barrel-roll", "macro-rush", "whip-switch"],
    facts: [
      { label: "Motions", value: "16, in seven groups" },
      { label: "Loop length", value: "4 to 6 seconds" },
      { label: "Editing", value: "Keyframes, timing and curves" },
      { label: "Screen switch", value: "Flip Cut, Tumble Cut, Whip Switch" },
      { label: "Export", value: "MP4, WebM, GIF or a PNG sequence" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Pick a move.",
        body: [
          "Zooms like Macro Rush push right into the screen, then breathe out. Spins like Barrel Roll and Double Spin turn the whole phone. Reveals like Snap In and Edge Reveal bring it into the frame, and Orbit Dive sweeps wide, makes a close pass and flies back. Every preview on this site is the actual motion, not a sketch of it.",
        ],
      },
      {
        heading: "Change the screen mid-flip.",
        body: [
          "Flip Cut, Tumble Cut and Whip Switch turn the phone far enough to hide its screen. Give them two screenshots and the second takes over while the phone faces away, so one short clip shows two screens of your app.",
        ],
      },
      {
        heading: "Then make it yours.",
        body: [
          "Move a keyframe, change the timing, choose another animation curve, or start from an empty timeline. Pick a background color or keep it transparent, then export MP4, WebM, GIF or a PNG sequence. For a phone mockup GIF, [start here](/mockups/phone-mockup-gif).",
        ],
      },
      {
        heading: "Seven kinds of move.",
        body: [
          "The motions come in seven groups. Zoom pushes in close, Spin turns the whole device, and Flip goes end over end or sideways. Cinematic sweeps the camera around, Reveal brings the device into the frame, Detail studies the hardware, and Loop glides sideways and back, made to repeat. Every motion works with every device, from the iPhone 16 Pro to the MacBook Pro 14″.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are the animations free?",
        a: "Yes. All sixteen motions are free during beta, and exports have no watermark.",
      },
      {
        q: "Can I edit a preset?",
        a: "Yes. Every keyframe, its timing and its curve can be changed, or you can start from scratch.",
      },
      {
        q: "Can I export a GIF?",
        a: "Yes. GIF is one of the export formats, and it can keep a transparent background.",
      },
      {
        q: "How long is each animation?",
        a: "Four to six seconds, built to loop. Move any keyframe on the timeline to make a motion shorter or longer.",
      },
    ],
    related: [
      "mockups/phone-mockup-video-generator",
      "mockups/phone-mockup-gif",
      "mockups/galaxy-s24-ultra",
      "alternatives/rotato",
    ],
  },
  {
    section: "mockups",
    slug: "transparent-phone-mockup-png",
    keyword: "transparent phone mockup png free",
    name: "Transparent phone mockup",
    summary: "A PNG with nothing behind the phone, at any angle.",
    title: "Free Transparent Phone Mockup PNG, in 3D | PhoneMockup",
    description:
      "Make a free transparent phone mockup PNG from your screenshot, at any 3D angle. Export PNG, WebM or GIF with a transparent background. No watermark.",
    h1: "Transparent phone mockup PNGs, free.",
    lead: "Make a free transparent phone mockup PNG at any angle: put your screenshot on a 3D phone, turn on the transparent background and export. Video and GIF can keep the transparency too.",
    cta: "Make a transparent mockup",
    motions: ["edge-reveal", "double-spin", "side-step"],
    facts: [
      { label: "Transparent", value: "PNG, PNG sequence, WebM and GIF" },
      { label: "Not transparent", value: "MP4, which renders the background black" },
      { label: "Angle", value: "Any frame of a motion, or a pose you set" },
      { label: "Largest canvas", value: "7680×3292 (21:9)" },
      { label: "Devices", value: "Three phones and a MacBook Pro 14″" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Nothing to cut out.",
        body: [
          "The phone comes out on its own, with nothing behind it, ready to drop onto a landing page, a slide or a design in Figma. There’s no masking to do, because there was never a background to remove.",
        ],
      },
      {
        heading: "Any angle, not only the front.",
        body: [
          "Stop on any frame of a motion, or set the angle yourself, and export that pose as a still. The vertical canvas renders at 2160×3840 and the square one at 2160×2160, so there’s room to scale down. All four devices work this way, from the [iPhone 16 Pro](/mockups/iphone-16-pro) to the MacBook Pro 14″.",
        ],
      },
      {
        heading: "Transparent video, too.",
        body: [
          "WebM, GIF and the PNG sequence keep the transparent background in motion. MP4 can’t store transparency, so with the background turned off it comes out black; choose MP4 together with a background color instead. WebM export needs Chrome or Edge.",
        ],
      },
      {
        heading: "Place it anywhere.",
        body: [
          "Drop the PNG into Figma, Keynote, a slide deck or the hero of your site, and the phone keeps its own edges on whatever color sits behind it. Export a few angles from the same motion to build a set, such as the front, a three-quarter turn and the back, all with the same lighting. Each export is free during beta and carries no watermark.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the transparent PNG free?",
        a: "Yes. It’s free during beta and has no watermark.",
      },
      {
        q: "Which formats keep the transparent background?",
        a: "PNG, the PNG sequence, WebM and GIF. MP4 doesn’t support transparency.",
      },
      {
        q: "Can I use it in Figma or Keynote?",
        a: "Yes. A transparent PNG places like any other image.",
      },
      {
        q: "Does the PNG include the background color?",
        a: "No. With the transparent background on, the PNG holds only the device. Turn it off to export the phone on the background color you picked instead.",
      },
    ],
    related: [
      "mockups/phone-mockup-gif",
      "mockups/iphone-16-pro",
      "use-cases/website-mockup-video",
      "alternatives/shots-so",
    ],
  },
  {
    section: "mockups",
    slug: "phone-mockup-gif",
    keyword: "phone mockup gif",
    name: "Phone mockup GIF",
    summary: "A 3D phone and your screen, as a looping GIF.",
    title: "Phone Mockup GIF Maker, Free and in 3D | PhoneMockup",
    description:
      "Turn your screen into a phone mockup GIF: a 3D phone, a looping motion and your screenshot or recording. Free during beta, no watermark, transparent if you like.",
    h1: "Phone mockup GIFs that loop.",
    lead: "Turn a screenshot or screen recording into a phone mockup GIF: pick a 3D phone and a motion, and export a loop of four to six seconds. A transparent background works in GIF too.",
    cta: "Make a mockup GIF",
    motions: ["whip-switch", "snap-in", "side-step"],
    facts: [
      { label: "Format", value: "GIF, up to 25 frames a second" },
      { label: "Loop", value: "4 to 6 seconds" },
      { label: "Shortest", value: "Whip Switch, 4 s. Snap In, 4.4 s." },
      { label: "Size", value: "The full canvas, 2160 px wide and up" },
      { label: "Transparent", value: "Yes" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Made to loop.",
        body: [
          "Every motion is built as a loop, so the GIF can repeat for as long as it’s on screen. Whip Switch runs four seconds and Snap In just over four, short enough for a README, a changelog or a chat thread.",
        ],
      },
      {
        heading: "Mind the file size.",
        body: [
          "GIFs render at the full canvas size, 2160 pixels wide or more, and GIF is an old format that grows quickly with length and size. Where a site sets a limit, shrink the file afterwards in a GIF tool, or use MP4 or WebM wherever video can play. They look better at a fraction of the size.",
        ],
      },
      {
        heading: "Transparent, if you want it.",
        body: [
          "Turn on the transparent background and the GIF keeps it, so the phone sits on whatever page it’s placed on. GIF transparency has no soft edges, so try the result on the page it’s going to before you publish. For soft edges, use a [transparent PNG or WebM](/mockups/transparent-phone-mockup-png).",
        ],
      },
      {
        heading: "Where a GIF still makes sense.",
        body: [
          "Some places can’t play video: a README on GitHub, many email newsletters, older chat tools and docs pages. A short GIF of your app on a moving phone works in all of them. Wherever video does play, an MP4 of the same scene looks better and loads faster, so export both from the same timeline and use each where it fits.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the GIF maker free?",
        a: "Yes. It’s free during beta, with no watermark.",
      },
      {
        q: "Can the GIF have a transparent background?",
        a: "Yes. Turn on the transparent background before you export.",
      },
      {
        q: "Can I make a GIF from a screen recording?",
        a: "Yes. The recording plays on the phone’s screen, and the whole scene is exported as a GIF.",
      },
      {
        q: "What frame rate do the GIFs have?",
        a: "Up to 25 frames a second, which keeps the file smaller. Use MP4 or WebM wherever video can play.",
      },
    ],
    related: [
      "mockups/animated-phone-mockup",
      "mockups/transparent-phone-mockup-png",
      "use-cases/product-hunt-launch-video",
      "mockups/phone-mockup-video-generator",
    ],
  },
  {
    section: "mockups",
    slug: "iphone-screen-recording",
    keyword: "iphone screen recording mockup",
    name: "iPhone screen recording",
    summary: "A recording from your phone, playing on a 3D iPhone.",
    title: "iPhone Screen Recording Mockup, Free | PhoneMockup",
    description:
      "Put your iPhone screen recording into a 3D iPhone 16 Pro mockup. The recording plays on the screen while the phone moves. Export MP4, WebM or GIF. Free during beta.",
    h1: "iPhone screen recording mockups that move.",
    lead: "Make an iPhone screen recording mockup in three steps: record your app on the phone, drop the video onto a 3D iPhone 16 Pro, and pick how the phone moves while it plays.",
    cta: "Use my screen recording",
    motions: ["orbit-dive", "soft-orbit", "flip-cut"],
    facts: [
      { label: "Phone", value: "iPhone 16 Pro" },
      { label: "Recording", value: "Plays on the screen as the phone moves" },
      { label: "Dynamic Island", value: "Keep it, or switch it off" },
      { label: "Canvas", value: "9:16 at 2160×3840, and four more" },
      { label: "Export", value: "MP4, WebM, GIF or a PNG sequence" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Recorded on the phone, shown on a phone.",
        body: [
          "Drop in the recording and it fills the iPhone 16 Pro’s display while the phone moves, so the clip shows the app being used with the hardware around it. Keep the Dynamic Island for the look of the real device, or switch it off to show every pixel of the recording.",
        ],
      },
      {
        heading: "Motions that let it play.",
        body: [
          "Soft Orbit floats slowly, so the screen stays readable from start to finish. Orbit Dive sweeps wide, makes a close pass and flies back, which suits a quick feature reveal. Flip Cut turns the phone all the way round for a confident finish. Every motion can be slowed down, sped up or edited key by key.",
        ],
      },
      {
        heading: "Export the clip.",
        body: [
          "MP4 is the safe choice for social posts and sites, WebM keeps a transparent background, and a GIF works where video can’t play. To use the clip as a promo, read the [app promo video](/use-cases/app-promo-video) guide first: App Store previews have rules of their own.",
        ],
      },
      {
        heading: "Before you record.",
        body: [
          "Turn on Do Not Disturb so no notification lands mid-take, clear the status bar of anything personal, and run through the flow once before you press record. Move a little slower than feels natural: the phone will be turning while the recording plays, and calm taps read better than quick ones. Then trim the file to the moment you want to show.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the screen recording mockup free?",
        a: "Yes, free during beta, with no watermark.",
      },
      {
        q: "Does the recording play while the phone moves?",
        a: "Yes. The video plays on the screen while the phone turns, zooms or flips.",
      },
      {
        q: "Can I use it as an App Store preview?",
        a: "No. Apple only allows screen captures of the app itself in App Store previews. Use the mockup on your site, in social posts or as your Google Play preview video.",
      },
    ],
    related: [
      "mockups/iphone-16-pro",
      "use-cases/app-promo-video",
      "mockups/phone-mockup-video-generator",
      "use-cases/instagram-story-mockup",
    ],
  },

  // ─── Use cases ──────────────────────────────────────────────────────────
  {
    section: "use-cases",
    slug: "app-promo-video",
    keyword: "app promo video maker free",
    name: "App promo video",
    summary: "Your recording on a 3D phone, ready for your site and Google Play.",
    title: "Free App Promo Video Maker with 3D Phones | PhoneMockup",
    description:
      "A free app promo video maker: put your screen recording on a 3D iPhone or Android phone, pick a motion and export MP4 for your site, socials or Google Play.",
    h1: "A free app promo video maker.",
    lead: "PhoneMockup is a free app promo video maker for app developers: your screen recording plays on a 3D iPhone, Pixel or Galaxy while the camera moves, and the result exports as MP4.",
    cta: "Make an app promo video",
    motions: ["flip-cut", "soft-orbit", "macro-rush"],
    facts: [
      { label: "Phones", value: "iPhone 16 Pro, Pixel 9 Pro, Galaxy S24 Ultra" },
      { label: "Input", value: "Your screen recording or screenshots" },
      { label: "Motion", value: "4–6 second loops, every keyframe editable" },
      { label: "Export", value: "MP4, WebM, GIF or PNG" },
      { label: "Canvas", value: "9:16, 4:5, 1:1, 16:9 or 21:9" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "From recording to promo.",
        body: [
          "Record a feature on your phone, drop the video onto the device and choose a motion. A slow orbit keeps the screen readable; a flip can cut between two screenshots in a single turn. Make one clip per feature and put them back to back in your video editor for a longer promo.",
        ],
      },
      {
        heading: "Where it can go.",
        body: [
          "On your website and landing pages. In posts on X, LinkedIn or Instagram, in 9:16, 4:5 or square. And as your Google Play preview video: upload the MP4 to YouTube and add the link in Play Console. Google asks for a public or unlisted video with ads turned off.",
        ],
      },
      {
        heading: "Where it can’t.",
        body: [
          "App Store app previews may only use screen captures of the app itself, under Apple’s App Review Guideline 2.3.4, so a 3D mockup can’t be one. Use your raw recording as the App Store preview, and the mockup everywhere else. For a launch day, see the [Product Hunt launch video](/use-cases/product-hunt-launch-video) guide.",
        ],
      },
      {
        heading: "Keep each clip short.",
        body: [
          "One feature per clip, four to six seconds long, with the screen readable from the first frame. That matches the length of the motions, so each clip loops on its own in a post and cuts together cleanly in an editor. Start with the screen your users open most, and end on the one that shows the result.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the app promo video maker free?",
        a: "Yes. It’s free during beta, with no watermark and no account needed to start.",
      },
      {
        q: "Can I use it as my Google Play preview video?",
        a: "Yes. Google Play takes a YouTube link, so upload the MP4 to YouTube first.",
      },
      {
        q: "Can I use it as an App Store preview?",
        a: "No. Apple only accepts screen captures of the app itself as App Store previews.",
      },
    ],
    related: [
      "mockups/phone-mockup-video-generator",
      "mockups/iphone-screen-recording",
      "use-cases/product-hunt-launch-video",
      "use-cases/instagram-story-mockup",
    ],
  },
  {
    section: "use-cases",
    slug: "website-mockup-video",
    keyword: "website mockup video generator free",
    name: "Website mockup video",
    summary: "Your site scrolling on a MacBook or a phone, as a short film.",
    title: "Free Website Mockup Video Generator | PhoneMockup",
    description:
      "A free website mockup video generator: your site on a 3D MacBook Pro or phone while the camera moves. Export MP4 or WebM for a launch, case study or deck.",
    h1: "A free website mockup video generator.",
    lead: "Use PhoneMockup as a free website mockup video generator: record your site scrolling, drop the recording onto a 3D MacBook Pro 14″, and export a short film of it for a case study or a launch.",
    cta: "Make a website mockup video",
    motions: ["top-down", "soft-orbit", "pull-focus"],
    facts: [
      { label: "Desktop", value: "MacBook Pro 14″, lid open or opening" },
      { label: "Mobile", value: "iPhone 16 Pro, Pixel 9 Pro, Galaxy S24 Ultra" },
      { label: "Input", value: "A screen recording or a screenshot" },
      { label: "Canvas", value: "16:9 at 3840×2160, 21:9 at 7680×3292" },
      { label: "Export", value: "MP4, WebM, GIF or PNG" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "Record the scroll, not a template.",
        body: [
          "No After Effects template needed. Record your site in the browser, scrolling the way you want it seen, and drop that video onto the MacBook’s display. The camera move does the rest, and every keyframe stays editable if it doesn’t.",
        ],
      },
      {
        heading: "Desktop and mobile.",
        body: [
          "Top Down studies the laptop from above, then opens into a hero angle, and the [lid can open as it plays](/mockups/macbook-opening-animation). For the mobile version of the site, switch to the iPhone 16 Pro or the Pixel 9 Pro and drop in a recording of the mobile layout.",
        ],
      },
      {
        heading: "Sized for the page.",
        body: [
          "Export 16:9 at 3840×2160 for a hero video or a case study, or 21:9 for a wide banner. WebM keeps a transparent background, so the laptop can sit directly on your page’s own color. WebM export needs Chrome or Edge; MP4 works there and in Safari.",
        ],
      },
      {
        heading: "Make the scroll readable.",
        body: [
          "Scroll slowly and pause on the sections that matter. The camera is already moving, so the page doesn’t need to rush as well. Hide anything personal before you record, such as bookmarks, other tabs and notifications, and record in a clean browser window so the display shows your site rather than your desktop.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the website mockup video generator free?",
        a: "Yes. It’s free during beta, without a watermark.",
      },
      {
        q: "Can the MacBook lid open in the video?",
        a: "Yes. Turn on “Open lid during animation” in the model settings.",
      },
      {
        q: "Can I show the mobile site?",
        a: "Yes. Use one of the phones with a recording of your mobile layout.",
      },
      {
        q: "Can I use the video as a website hero?",
        a: "Yes. Export MP4 for the widest playback, or WebM to keep a transparent background so the laptop sits on your page’s own color.",
      },
    ],
    related: [
      "mockups/macbook-opening-animation",
      "mockups/transparent-phone-mockup-png",
      "use-cases/product-hunt-launch-video",
      "alternatives/rotato",
    ],
  },
  {
    section: "use-cases",
    slug: "instagram-story-mockup",
    keyword: "phone mockup instagram story",
    name: "Instagram story mockup",
    summary: "A 3D phone in 9:16 for stories and reels, 4:5 for posts.",
    title: "Instagram Story Phone Mockup, Free in 3D | PhoneMockup",
    description:
      "Make a phone mockup for an Instagram story or reel: a 3D phone with your screen on it, in 9:16 at 2160×3840. Also 4:5 and square for posts. Free during beta.",
    h1: "A phone mockup for your Instagram story.",
    lead: "Make a phone mockup for an Instagram story in the shape stories use: vertical 9:16, exported at 2160×3840, with your screenshot or recording playing on a 3D phone.",
    cta: "Make a story mockup",
    motions: ["lift-off", "snap-in", "slow-spin"],
    facts: [
      { label: "Stories and reels", value: "9:16, 2160×3840" },
      { label: "Feed posts", value: "4:5 at 2160×2700, or 1:1 at 2160×2160" },
      { label: "Export", value: "MP4 for video, PNG for stills" },
      { label: "Loop", value: "4 to 6 seconds" },
      { label: "Phones", value: "iPhone 16 Pro, Pixel 9 Pro, Galaxy S24 Ultra" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "The right shape from the start.",
        body: [
          "Choose the vertical 9:16 canvas, the one the studio calls TikTok (9:16), and the phone is framed for stories, reels, TikTok and Shorts. It renders at 2160×3840, exactly twice the 1080×1920 that stories are usually made at, so there’s detail to spare when the app compresses it.",
        ],
      },
      {
        heading: "Posts, too.",
        body: [
          "For the feed, switch the canvas to Portrait (4:5) at 2160×2700 or Square (1:1) at 2160×2160. The scene is framed again for the new shape, so one mockup can serve the story and the post.",
        ],
      },
      {
        heading: "Video or still.",
        body: [
          "Export MP4 for a moving story, or a PNG still if you want to add text in Instagram itself. Lift Off rises into the frame and lands softly, Slow Spin takes one measured turn, and Snap In makes a quick entrance with a confident finish. For a moving post on another network, see the [phone mockup video](/mockups/phone-mockup-video-generator) guide.",
        ],
      },
      {
        heading: "Keep the edges clear.",
        body: [
          "Instagram puts its profile row at the top of a story and the reply bar at the bottom. Keep the text you add in Instagram away from both, and let the phone carry the middle of the frame. If you’re posting the same mockup as a reel, keep the screen content in the centre too, where the app’s own buttons don’t cover it.",
        ],
      },
    ],
    faqs: [
      {
        q: "What size is an Instagram story mockup?",
        a: "Stories use 9:16. PhoneMockup exports that at 2160×3840, which scales down evenly to 1080×1920.",
      },
      {
        q: "Is it free?",
        a: "Yes. It’s free during beta, with no watermark.",
      },
      {
        q: "Is this a template of the Instagram interface?",
        a: "No. It puts your own screen on a 3D phone. There is no Instagram interface template.",
      },
      {
        q: "Can I post the same video as a reel?",
        a: "Yes. Reels use the same vertical 9:16 shape as stories, so one MP4 export works for both. Keep the screen in the middle of the frame, where the app’s buttons don’t cover it.",
      },
    ],
    related: [
      "mockups/phone-mockup-video-generator",
      "mockups/pixel-9-pro",
      "use-cases/app-promo-video",
      "mockups/phone-mockup-gif",
    ],
  },
  {
    section: "use-cases",
    slug: "product-hunt-launch-video",
    keyword: "product hunt launch video",
    name: "Product Hunt launch video",
    summary: "The launch video and gallery stills from one scene.",
    title: "Make a Product Hunt Launch Video, Free | PhoneMockup",
    description:
      "Make a Product Hunt launch video and gallery images from your screenshots: a 3D phone or MacBook, a motion, an MP4 for YouTube and PNG stills for the gallery.",
    h1: "A Product Hunt launch video, from your screenshots.",
    lead: "Make a Product Hunt launch video from the screenshots and recordings you already have: put them on a 3D phone or MacBook, pick a motion, and export the clip and the gallery stills from the same scene.",
    cta: "Start my launch video",
    motions: ["pull-focus", "top-down", "whip-switch"],
    facts: [
      { label: "Launch video", value: "Product Hunt takes a YouTube link" },
      { label: "Gallery", value: "Two images or more, 1270×760 recommended" },
      { label: "Image limit", value: "3 MB each, GIFs included" },
      { label: "From PhoneMockup", value: "MP4 for YouTube, PNG for the gallery" },
      { label: "Devices", value: "Three phones and a MacBook Pro 14″" },
      { label: "Price", value: FREE },
    ],
    passages: [
      {
        heading: "One scene, every asset.",
        body: [
          "Build the scene once: your screen, a device and a motion. Export an MP4 for the launch video and a few PNG stills for the gallery, all from the same timeline. Upload the MP4 to YouTube, because a YouTube link is the only video Product Hunt accepts.",
        ],
      },
      {
        heading: "Fit the gallery.",
        body: [
          "Product Hunt recommends 1270×760 for gallery images and limits each one to 3 MB, GIFs included. Export a 16:9 still and crop it to size. PhoneMockup’s GIFs render at the full canvas size, so a [mockup GIF](/mockups/phone-mockup-gif) needs shrinking before it fits under 3 MB.",
        ],
      },
      {
        heading: "Show the product itself.",
        body: [
          "A phone that turns to show your real screen tells people what they’re upvoting. For a web product, a [MacBook that opens](/mockups/macbook-opening-animation) onto your dashboard does the same. Pull Focus and Whip Switch work for phones; Top Down is made for the laptop.",
        ],
      },
      {
        heading: "Before launch day.",
        body: [
          "Export everything a day early. YouTube needs time to process an upload before the link plays well, and you’ll want to see the gallery and the video together before anyone else does. Keep the project in the browser you made it in, so a last-minute change to a screen is a new export rather than a new scene.",
        ],
      },
    ],
    faqs: [
      {
        q: "What video does Product Hunt accept?",
        a: "A YouTube link. Upload your MP4 to YouTube and paste the URL into the launch form.",
      },
      {
        q: "What size should gallery images be?",
        a: "Product Hunt recommends 1270×760, at most 3 MB per image.",
      },
      {
        q: "Is PhoneMockup free for my launch?",
        a: "Yes. It’s free during beta, with no watermark on anything you export.",
      },
      {
        q: "Can the gallery include a GIF?",
        a: "Yes. Product Hunt accepts GIFs in the gallery as long as each file is under 3 MB. PhoneMockup’s GIFs render at the full canvas size, so shrink one before you upload it.",
      },
    ],
    related: [
      "use-cases/app-promo-video",
      "mockups/phone-mockup-gif",
      "mockups/macbook-opening-animation",
      "use-cases/instagram-story-mockup",
    ],
  },

  // ─── Alternatives ───────────────────────────────────────────────────────
  {
    section: "alternatives",
    slug: "rotato",
    keyword: "rotato alternative free",
    name: "Rotato",
    summary: "A browser-based option to the Mac app, and when Rotato wins.",
    verdict:
      "Rotato for 30+ devices, 8K at 16:9 and a Figma plugin. PhoneMockup for a free tool in the browser, on any system.",
    title: "Free Rotato Alternative in Your Browser | PhoneMockup",
    description:
      "Looking for a free Rotato alternative? PhoneMockup makes animated 3D device mockups in your browser, on Windows or Mac. Free during beta, no watermark, no account.",
    h1: "A free Rotato alternative, in your browser.",
    lead: "If you need a free Rotato alternative that runs on Windows as well as a Mac, PhoneMockup makes animated 3D device mockups in the browser. Here is how the two compare, and when Rotato is the better pick.",
    cta: "Try PhoneMockup",
    motions: ["soft-orbit", "top-down", "double-spin"],
    comparison: {
      them: "Rotato",
      rows: [
        {
          label: "Runs on",
          us: "Chrome or Edge, on Windows, Mac or Linux",
          them: "A Mac app for macOS 11 or newer. A web version is in public beta.",
        },
        {
          label: "Price",
          us: "Free during beta",
          them: "One-time plans: Basic, Standard and Premium. Unlimited free trial.",
        },
        {
          label: "Devices",
          us: "Four: iPhone 16 Pro, Pixel 9 Pro, Galaxy S24 Ultra, MacBook Pro 14″",
          them: "30+, or all phones on Basic",
        },
        {
          label: "Largest export",
          us: "3840×2160 at 16:9, 7680×3292 at 21:9",
          them: "8K on Premium, 4K and smaller on Standard",
        },
        {
          label: "Transparent background",
          us: "PNG, WebM and GIF",
          them: "Yes",
        },
        {
          label: "Extras",
          us: "Screen switch on three flip motions",
          them: "Video templates, a Figma plugin, App Store templates",
        },
      ],
      checkedOn: "20 October 2026",
      checked:
        "Rotato’s facts were checked on rotato.app and rotato.app/pricing on 20 October 2026. Plans change, so check their site for the latest.",
    },
    passages: [
      {
        heading: "Where PhoneMockup fits.",
        body: [
          "PhoneMockup runs in the browser, so Windows and Linux work as well as a Mac, with nothing to install and no account to make first. It’s free during beta and adds no watermark. Sixteen motions are ready for your screen, each editable down to the keyframe, and the MacBook’s [lid can open on cue](/mockups/macbook-opening-animation).",
        ],
      },
      {
        heading: "Where Rotato is the better pick.",
        body: [
          "Rotato has far more devices, over thirty against PhoneMockup’s four, plus video templates, a Figma plugin and 8K export on its Premium plan, where PhoneMockup’s 16:9 canvas stops at 3840×2160. If you design on a Mac and need a device beyond PhoneMockup’s four, or 8K at 16:9, Rotato is the stronger tool.",
        ],
      },
      {
        heading: "Try both with your own screen.",
        body: [
          "Rotato offers an unlimited free trial, and PhoneMockup needs no account at all. Make the same mockup in each from one screenshot and keep the one that fits your work. If a browser tool for still mockups is what you want, see how PhoneMockup compares with [Shots.so](/alternatives/shots-so).",
        ],
      },
    ],
    faqs: [
      {
        q: "Is PhoneMockup really free?",
        a: "Yes. It’s free during beta, with no watermark and no account needed to start.",
      },
      {
        q: "Does Rotato work on Windows?",
        a: "Rotato is a Mac app. In October 2026 its web version was in public beta, and its site invites Windows users to sign up for news. PhoneMockup runs in Chrome or Edge on any system.",
      },
      {
        q: "Can I import a Rotato project?",
        a: "No. Projects don’t move between the two tools. Start from your screenshot or recording.",
      },
    ],
    related: [
      "alternatives/shots-so",
      "mockups/animated-phone-mockup",
      "mockups/macbook-opening-animation",
      "mockups/phone-mockup-video-generator",
    ],
  },
  {
    section: "alternatives",
    slug: "shots-so",
    keyword: "shots so alternative free",
    name: "Shots.so",
    summary: "When the phone itself should move, and when Shots.so wins.",
    verdict:
      "Shots.so for quick stills across many devices. PhoneMockup when the phone itself should move.",
    title: "Free Shots.so Alternative for 3D Motion | PhoneMockup",
    description:
      "A free Shots.so alternative for when the phone itself should move: detailed 3D devices, 16 camera motions and video export, in your browser. Free during beta.",
    h1: "A free Shots.so alternative, for motion.",
    lead: "If you want a free Shots.so alternative where the phone itself moves in 3D, PhoneMockup is built for that: your screen on a detailed 3D device, sixteen camera motions, and video export in the browser.",
    cta: "Try PhoneMockup",
    motions: ["macro-rush", "flip-cut", "detail-study"],
    comparison: {
      them: "Shots.so",
      rows: [
        {
          label: "Runs on",
          us: "A desktop browser",
          them: "A browser",
        },
        {
          label: "Made for",
          us: "Animated 3D devices and camera motion",
          them: "Screenshot mockups with frames and backgrounds, plus animation presets",
        },
        {
          label: "Devices",
          us: "Four detailed 3D models",
          them: "iPhones, Android phones, iPads, desktops and more, in 3D and flat",
        },
        {
          label: "Motion",
          us: "16 camera motions with editable keyframes",
          them: "Animation presets and video support",
        },
        {
          label: "Price",
          us: "Free during beta",
          them: "Free mockups. No public pricing page.",
        },
      ],
      checkedOn: "20 October 2026",
      checked:
        "Shots.so’s facts were checked on shots.so on 20 October 2026. It has no public pricing page, so check shots.so for its current plans.",
    },
    passages: [
      {
        heading: "Different strengths.",
        body: [
          "Shots.so makes quick, polished mockups: a screenshot in a frame on a good-looking background, in seconds, across a wide range of devices. PhoneMockup does one thing differently. It treats the device as a 3D object and moves a camera around it, with your screen on the display.",
        ],
      },
      {
        heading: "When the phone should move.",
        body: [
          "If the clip is the point, such as a launch video, a hero loop or a feature reveal, PhoneMockup’s sixteen motions turn, zoom and flip the device, and every keyframe is editable. Flip Cut, Tumble Cut and Whip Switch can cut to a second screenshot while the phone faces away. Stills work too: stop on any frame and export a [transparent PNG](/mockups/transparent-phone-mockup-png).",
        ],
      },
      {
        heading: "When Shots.so is the better pick.",
        body: [
          "For a single still in a tidy layout, with iPads, desktops and many phones to choose from, Shots.so is quicker and covers more devices. PhoneMockup has four. Many launches need both a still and a clip, so use whichever tool makes each one best.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is PhoneMockup free?",
        a: "Yes. It’s free during beta, with no watermark and no account needed to start.",
      },
      {
        q: "Does PhoneMockup make still mockups too?",
        a: "Yes. Stop on any angle and export a PNG, with or without a transparent background.",
      },
      {
        q: "Which devices does PhoneMockup have?",
        a: "The iPhone 16 Pro, Google Pixel 9 Pro, Samsung Galaxy S24 Ultra and MacBook Pro 14″.",
      },
      {
        q: "Can I export a still for a post or a Dribbble shot?",
        a: "Yes. Stop on any frame, pick a background color or keep it transparent, and export a PNG.",
      },
    ],
    related: [
      "alternatives/rotato",
      "mockups/transparent-phone-mockup-png",
      "mockups/animated-phone-mockup",
      "use-cases/product-hunt-launch-video",
    ],
  },
];

export function guidePath(guide: Pick<Guide, "section" | "slug">): string {
  return `/${guide.section}/${guide.slug}`;
}

export function hubFor(section: GuideSection): GuideHub {
  return hubs.find((h) => h.section === section)!;
}

export function findGuide(section: GuideSection, slug: string): Guide | undefined {
  return guides.find((g) => g.section === section && g.slug === slug);
}

/** Resolves `section/slug` ids; unknown ids are dropped. */
export function relatedGuides(guide: Guide): Guide[] {
  return guide.related
    .map((id) => {
      const [section, slug] = id.split("/") as [GuideSection, string];
      return findGuide(section, slug);
    })
    .filter((g): g is Guide => !!g);
}

export function hubGuides(
  hub: GuideHub,
): { heading: string; layout: "tiles" | "list"; guides: Guide[] }[] {
  return hub.groups.map((group) => ({
    heading: group.heading,
    layout: group.layout ?? "tiles",
    guides: group.slugs
      .map((slug) => findGuide(hub.section, slug))
      .filter((g): g is Guide => !!g),
  }));
}

/** Splits `[text](/href)` links out of a paragraph. */
export function segments(text: string): ({ text: string } | { text: string; href: string })[] {
  const out: ({ text: string } | { text: string; href: string })[] = [];
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], href: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
