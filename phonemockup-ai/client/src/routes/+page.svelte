<script lang="ts">
  import {
    ArrowUpRight,
    ArrowRight,
    ArrowDown,
    Play,
    Pause,
  } from "@lucide/svelte";
  import animationGroups from "$lib/animations/animations.svelte";
  import MotionPreview from "$lib/components/marketing/MotionPreview.svelte";

  const motions = animationGroups;
  const heroOptions = ["soft-orbit", "edge-reveal", "top-down"].map((id) =>
    motions.find((m) => m.id === id)!,
  );
  const desktopMotion = motions.find((m) => m.id === "top-down")!;
  let featured = $state(heroOptions[0]);
  let motionPaused = $state(false);
  let category = $state("All motions");
  let showAll = $state(false);
  let menuOpen = $state(false);
  let menuButton: HTMLButtonElement;
  const categories = [
    "All motions",
    "Zoom",
    "Spin",
    "Flip",
    "Cinematic",
    "Reveal",
    "Detail",
    "Loop",
  ];
  const firstMotions = [
    "soft-orbit",
    "macro-rush",
    "double-spin",
    "flip-cut",
    "top-down",
    "detail-study",
  ].map((id) => motions.find((m) => m.id === id)!);
  const allMotions = [
    ...firstMotions,
    ...motions.filter((m) => !firstMotions.some((first) => first.id === m.id)),
  ];
  const filtered = $derived(
    category === "All motions"
      ? allMotions
      : motions.filter((m) => m.categories?.some((c) => c === category)),
  );
  const visibleMotions = $derived(
    category === "All motions" && !showAll ? firstMotions : filtered,
  );
  const duration = (group: (typeof motions)[number]) =>
    Math.max(...group.animations.map((a) => a.end));
  const devices = [
    {
      name: "iPhone 16 Pro",
      short: "iPhone",
      preset: "soft-orbit",
      detail:
        "Titanium frame. Three cameras. Keep the Dynamic Island, or give your screen the whole stage.",
    },
    {
      name: "Pixel 9 Pro",
      short: "Pixel",
      preset: "detail-study",
      detail:
        "The distinctive camera bar, down to the details. Show or hide the front camera cutout.",
    },
    {
      name: "Galaxy S24 Ultra",
      short: "Galaxy",
      preset: "slow-spin",
      detail:
        "A flat display and a crisp, squared silhouette. Built for close-ups as well as full spins.",
    },
    {
      name: "MacBook Pro 14″",
      short: "MacBook",
      preset: "top-down",
      detail:
        "A bigger canvas for websites and desktop apps. Set the lid angle, or animate it opening.",
    },
  ];
  let selectedDevice = $state(devices[0]);
  const deviceMotion = $derived(
    motions.find((m) => m.id === selectedDevice.preset)!,
  );
  const faqs = [
    {
      q: "Is it really free?",
      a: "Yes. PhoneMockup is free during beta. Export without a watermark, and start without an account.",
    },
    {
      q: "What can I put on the screen?",
      a: "A screenshot, a design export, or a screen recording. Drop in an image or video and it follows the device’s movement.",
    },
    {
      q: "Can I change the motion?",
      a: "Every preset is editable. Adjust keyframes, timing and easing, or build an animation from a blank canvas.",
    },
    {
      q: "Which formats can I export?",
      a: "MP4, WebM and GIF for motion. PNG for stills. Choose a transparent background when the format supports it.",
    },
  ];
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape" && menuOpen) {
      menuOpen = false;
      menuButton?.focus();
    }
  }}
/>

<svelte:head>
  <title>PhoneMockup — Your work. Every angle.</title>
  <meta
    name="description"
    content="Make animated 3D device mockups from your screenshots and screen recordings. Four detailed devices, 16 editable motions. Free during beta. No watermark."
  />
  <meta property="og:title" content="PhoneMockup — Your work. Every angle." />
  <meta
    property="og:description"
    content="Your screenshots and screen recordings, in a whole new dimension. Create animated device mockups in your browser."
  />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://phonemockup.app/og-cover.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#faf9f6" />
  <link rel="canonical" href="https://phonemockup.app/" />
  <link
    rel="preload"
    href="/fonts/archivo/archivo-latin-variable.woff2"
    as="font"
    type="font/woff2"
    crossorigin="anonymous"
  />
</svelte:head>

<div class="landing">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header wrap">
    <a class="wordmark" href="/" aria-label="PhoneMockup home"
      >phonemockup<span class="brand-mark" aria-hidden="true"></span></a
    >
    <nav
      id="site-navigation"
      class:open={menuOpen}
      aria-label="Main navigation"
    >
      <a href="#motions" onclick={() => (menuOpen = false)}>Motions</a><a
        href="#devices"
        onclick={() => (menuOpen = false)}>Devices</a
      ><a href="#workflow" onclick={() => (menuOpen = false)}>How it works</a>
      <a class="mobile-projects" href="/platform/project"
        >Your projects <ArrowUpRight size={16} /></a
      >
    </nav>
    <a class="nav-cta" href="/platform/project"
      >Your projects <ArrowUpRight size={16} /></a
    >
    <button
      class="menu-toggle"
      type="button"
      aria-expanded={menuOpen}
      aria-controls="site-navigation"
      bind:this={menuButton}
      onclick={() => (menuOpen = !menuOpen)}
      >Menu <ArrowDown size={16} /></button
    >
  </header>

  <main id="main">
    <section class="hero wrap" aria-labelledby="hero-title">
      <div class="hero-heading">
        <h1 id="hero-title">Your work.<br /><span>Every angle.</span></h1>
        <div class="hero-copy">
          <p>
            Your screenshots and screen recordings,<br class="desktop-break" /> in
            a whole new dimension.
          </p>
          <div class="hero-actions">
            <a class="button primary" href="/platform/animation/soft-orbit"
              >Make a mockup <ArrowUpRight size={20} /></a
            >
            <span class="hero-proof">Free during beta. No watermark.</span>
          </div>
        </div>
      </div>
      <div class="hero-exhibit">
        <div
          class="hero-stage"
          style:background={`rgb(${featured.previewBackground?.slice(0, 3).join(",")})`}
        >
          <div class="stage-label">
            <span>Make it move.</span><span class="mono"
              >{duration(featured).toFixed(0)}s loop</span
            >
          </div>
          <div class="hero-media">
            {#key featured.id}<MotionPreview
                src={`/previews/${featured.preview}`}
                poster={`/previews/${featured.poster}`}
                label={featured.name}
                priority
                paused={motionPaused}
              />{/key}
          </div>
          <div class="stage-bottom">
            <div class="hero-selector" aria-label="Featured animation">
              {#each heroOptions as group, i}<button
                  type="button"
                  aria-label={`0${i + 1} ${group.name}`}
                  aria-pressed={featured.id === group.id}
                  onclick={() => (featured = group)}>{group.name}</button
                >{/each}
            </div>
            <a
              class="round-link"
              href={`/platform/animation/${featured.id}`}
              aria-label={`Use ${featured.name}`}><ArrowUpRight size={21} /></a
            >
          </div>
        </div>
        <div class="desktop-stage">
          <div class="stage-label">
            <span>Desktop, too.</span><span class="mono">6s loop</span>
          </div>
          <div class="desktop-media">
            <MotionPreview
              src={`/previews/${desktopMotion.preview}`}
              poster={`/previews/${desktopMotion.poster}`}
              label="MacBook Top Down"
              paused={motionPaused}
            />
          </div>
          <a class="desktop-caption" href="/platform/animation/top-down"
            ><span>MacBook Pro <span class="muted">/ Top Down</span></span
            ><ArrowUpRight size={21} /></a
          >
        </div>
      </div>
      <div class="hero-foot">
        <p>Made in your browser. Ready for wherever you share.</p>
        <a href="#motions">Explore the motions <ArrowDown size={16} /></a>
      </div>
    </section>

    <section
      class="motions-section wrap"
      id="motions"
      aria-labelledby="motions-title"
    >
      <div class="section-heading">
        <div>
          <p class="section-index">
            The motion library <span class="mono">/ {motions.length}</span>
          </p>
          <h2 id="motions-title">Find your first move.</h2>
        </div>
        <p>
          Orbits, close-ups and full turns.<br />Pick a motion, then make it
          your own.
        </p>
      </div>
      <div class="gallery-toolbar">
        <div class="filters" role="group" aria-label="Filter animations">
          {#each categories as item}<button
              type="button"
              aria-pressed={category === item}
              onclick={() => (category = item)}>{item}</button
            >{/each}
        </div>
        <button
          class="motion-toggle"
          type="button"
          aria-pressed={motionPaused}
          onclick={() => (motionPaused = !motionPaused)}
        >
          {#if motionPaused}<Play size={15} />{:else}<Pause
              size={15}
            />{/if}<span
            >{motionPaused ? "Play animations" : "Pause animations"}</span
          >
        </button>
      </div>
      <p class="sr-only" aria-live="polite">
        Showing {visibleMotions.length} of {filtered.length}
        {category === "All motions"
          ? "motions"
          : category.toLowerCase() + " motions"}.
      </p>
      <div class="motion-grid" id="motion-library">
        {#each visibleMotions as group (group.id)}
          <article class="motion-card">
            <div
              class="card-media"
              style:background={`rgb(${group.previewBackground?.slice(0, 3).join(",")})`}
            >
              <MotionPreview
                src={`/previews/${group.preview}`}
                poster={`/previews/${group.poster}`}
                label={group.name}
                paused={motionPaused}
              />
              {#if group.screenCut}<span class="cut-label">Screen switch</span
                >{/if}
            </div>
            <a class="card-title" href={`/platform/animation/${group.id}`}
              ><h3>{group.name}</h3>
              <span class="card-duration mono"
                >{duration(group).toFixed(0)}s</span
              ><ArrowUpRight size={19} /><span class="sr-only">
                — use this animation</span
              ></a
            >
            <p>{group.description}</p>
          </article>
        {/each}
      </div>
      <div class="gallery-foot">
        {#if category === "All motions"}<button
            class="button secondary"
            type="button"
            aria-expanded={showAll}
            aria-controls="motion-library"
            onclick={() => (showAll = !showAll)}
            >{showAll
              ? "Show fewer motions"
              : `View all ${motions.length} motions`}<ArrowDown
              size={17}
            /></button
          >{:else}<span
            >{filtered.length} motions. Every keyframe is yours to edit.</span
          >{/if}
        <a class="text-link" href="/platform/animation/still"
          >Start from scratch <ArrowUpRight size={17} /></a
        >
      </div>
    </section>

    <section
      class="workflow-section wrap"
      id="workflow"
      aria-labelledby="workflow-title"
    >
      <div class="workflow-heading">
        <p class="section-index">From screenshot to final cut</p>
        <h2 id="workflow-title">The studio, without the setup.</h2>
      </div>
      <div class="workflow-body">
        <div class="editor-preview">
          <img
            src="/media/landing/editor.webp"
            alt="PhoneMockup editor with an iPhone scene, editable motion timeline and model controls"
            width="1440"
            height="1000"
            loading="lazy"
          /><a href="/platform/animation/soft-orbit"
            >Take a look inside <ArrowUpRight size={17} /></a
          >
        </div>
        <div class="workflow-copy">
          <p class="workflow-lead">
            The good part of making a product film. Without learning 3D
            software.
          </p>
          <ol class="steps">
            <li>
              <span class="mono">01</span>
              <div>
                <h3>Bring your screen.</h3>
                <p>
                  Drop in a screenshot or screen recording. Your work fits
                  straight onto the display.
                </p>
              </div>
            </li>
            <li>
              <span class="mono">02</span>
              <div>
                <h3>Find your angle.</h3>
                <p>
                  Choose a device and a motion. Adjust the timing, background
                  and details.
                </p>
              </div>
            </li>
            <li>
              <span class="mono">03</span>
              <div>
                <h3>Get it out there.</h3>
                <p>
                  Export a video, GIF or still. No watermark. Ready for your
                  launch, portfolio or feed.
                </p>
              </div>
            </li>
          </ol>
          <a class="text-link" href="/platform/animation/soft-orbit"
            >Open the studio <ArrowRight size={18} /></a
          >
        </div>
      </div>
    </section>

    <section
      class="devices-section wrap"
      id="devices"
      aria-labelledby="devices-title"
    >
      <div class="section-heading">
        <div>
          <p class="section-index">
            The devices <span class="mono">/ 04</span>
          </p>
          <h2 id="devices-title">Choose your device.</h2>
        </div>
        <p>
          Detailed 3D models, made for the close-up.<br />Use any device with
          any motion.
        </p>
      </div>
      <div class="device-browser">
        <div class="device-controls">
          <div class="device-tabs" role="group" aria-label="Preview a device">
            {#each devices as device, i}<button
                type="button"
                aria-pressed={selectedDevice.name === device.name}
                onclick={() => (selectedDevice = device)}
                ><span class="mono">0{i + 1}</span><span>{device.name}</span
                ><ArrowUpRight size={20} /></button
              >{/each}
          </div>
          <div class="device-detail" aria-live="polite">
            <p>{selectedDevice.detail}</p>
            <p class="device-options">Show or hide the logo on every model.</p>
            <a
              class="text-link"
              href={`/platform/animation/${selectedDevice.preset}`}
              >Use this {selectedDevice.short} <ArrowRight size={18} /></a
            >
          </div>
        </div>
        <div
          class="device-picture"
          style:background={`rgb(${deviceMotion.previewBackground?.slice(0, 3).join(",")})`}
        >
          {#key selectedDevice.name}<MotionPreview
              src={`/previews/${deviceMotion.preview}`}
              poster={`/previews/${deviceMotion.poster}`}
              label={selectedDevice.name}
              paused={motionPaused}
            />{/key}
        </div>
      </div>
    </section>

    <section class="faq-section wrap" aria-labelledby="faq-title">
      <div class="faq-heading">
        <h2 id="faq-title">A few useful answers.</h2>
        <p>Less guesswork. More making.</p>
      </div>
      <div class="faq-list">
        {#each faqs as item}<article>
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </article>{/each}
      </div>
    </section>

    <section class="final-cta wrap" aria-labelledby="final-title">
      <div>
        <p class="section-index">Got something to show?</p>
        <h2 id="final-title">Let’s see it.</h2>
      </div>
      <a class="button primary" href="/platform/animation/soft-orbit"
        >Make a mockup <ArrowUpRight size={21} /></a
      >
    </section>
  </main>
  <footer class="site-footer wrap">
    <a class="wordmark" href="/"
      >phonemockup<span class="brand-mark" aria-hidden="true"></span></a
    >
    <p>A browser. A screen. A different angle.</p>
    <a href="/platform/project">Your projects <ArrowUpRight size={16} /></a>
  </footer>
</div>

<style>
  @font-face {
    font-family: Archivo;
    src: url("/fonts/archivo/archivo-latin-variable.woff2") format("woff2");
    font-style: normal;
    font-weight: 400 700;
    font-display: swap;
  }
  .landing {
    --ink: #242421;
    --muted: #696963;
    --paper: #faf9f6;
    --line: #d9d8d2;
    --accent: #bc3d20;
    --ease: cubic-bezier(0.23, 1, 0.32, 1);
    background: var(--paper);
    color: var(--ink);
    font-family: Archivo, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
  }
  .wrap {
    width: min(1320px, calc(100% - 96px));
    margin-inline: auto;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
  }
  a {
    touch-action: manipulation;
  }
  a,
  button {
    transition:
      color 160ms ease,
      background 160ms ease,
      transform 160ms var(--ease);
  }
  :is(a, button):focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 5px;
  }
  :is(button, .button):active {
    transform: scale(0.98);
  }
  h1,
  h2,
  h3,
  p {
    margin: 0;
  }
  h1,
  h2 {
    text-wrap: balance;
  }
  p {
    text-wrap: pretty;
  }
  .mono {
    font-family: "Courier New", monospace;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 400;
  }
  .muted {
    color: var(--muted);
  }
  .skip-link {
    position: fixed;
    top: 12px;
    left: 12px;
    transform: translateY(-160%);
    z-index: 10;
    background: var(--ink);
    color: white;
    padding: 15px;
  }
  .skip-link:focus {
    transform: none;
  }
  .site-header {
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
    gap: 24px;
    position: relative;
    z-index: 3;
  }
  .wordmark {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    font-size: 23px;
    font-weight: 600;
    letter-spacing: -1.2px;
    white-space: nowrap;
  }
  .brand-mark {
    width: 7px;
    height: 7px;
    background: var(--accent);
    display: inline-block;
  }
  nav {
    display: flex;
    gap: 30px;
    font-size: 14px;
  }
  nav a,
  .nav-cta {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .nav-cta {
    gap: 22px;
    font-size: 13px;
  }
  .menu-toggle,
  nav .mobile-projects {
    display: none;
  }
  .hero {
    padding-top: 54px;
  }
  .hero-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 50px;
    margin-bottom: 48px;
  }
  h1 {
    font-size: clamp(76px, 7.7vw, 112px);
    font-weight: 500;
    line-height: 0.97;
    letter-spacing: -0.07em;
  }
  h1 span {
    color: #777770;
  }
  .hero-copy {
    padding-bottom: 5px;
    max-width: 365px;
  }
  .hero-copy > p {
    font-size: 17px;
    line-height: 1.6;
    letter-spacing: -0.25px;
  }
  .hero-actions {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
    margin-top: 24px;
  }
  .button {
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
    padding: 15px 21px;
    border: 0;
    border-radius: 5px;
    font-size: 14px;
    font-weight: 500;
  }
  .primary {
    background: var(--accent);
    color: white;
  }
  .hero-proof {
    font-size: 12px;
    color: var(--muted);
  }
  .hero-exhibit {
    display: grid;
    grid-template-columns: 1.18fr 1fr;
    gap: 6px;
  }
  .hero-stage,
  .desktop-stage {
    position: relative;
    min-width: 0;
    overflow: hidden;
    border-radius: 5px;
  }
  .desktop-stage {
    background: #dde1f0;
  }
  .stage-label {
    position: absolute;
    left: 25px;
    right: 25px;
    top: 23px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    z-index: 2;
    font-size: 13px;
    pointer-events: none;
  }
  .stage-label .mono {
    color: #5e6658;
  }
  .hero-media,
  .desktop-media {
    height: 500px;
  }
  .hero-media :global(video) {
    object-fit: contain;
  }
  .desktop-media :global(video) {
    object-fit: cover;
    transform: scale(1.25);
  }
  .hero-media :global(.playback),
  .desktop-media :global(.playback) {
    bottom: 80px;
  }
  .stage-bottom,
  .desktop-caption {
    position: absolute;
    bottom: 0;
    left: 25px;
    right: 25px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    height: 69px;
    border-top: 1px solid #24242128;
    font-size: 13px;
  }
  .hero-selector {
    display: flex;
    gap: 21px;
    align-items: center;
  }
  .hero-selector button {
    border: 0;
    background: none;
    padding: 12px 0;
    min-height: 44px;
    font-size: 12px;
    color: #59634f;
    position: relative;
  }
  .hero-selector button[aria-pressed="true"] {
    color: var(--ink);
  }
  .hero-selector button[aria-pressed="true"]::after {
    content: "";
    position: absolute;
    height: 2px;
    bottom: 8px;
    left: 0;
    right: 0;
    background: currentColor;
  }
  .round-link {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .hero-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding-block: 22px;
    border-bottom: 1px solid var(--line);
    font-size: 12px;
    color: var(--muted);
  }
  .hero-foot a {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 44px;
    color: var(--ink);
  }
  .motions-section {
    padding-top: 104px;
    padding-bottom: 86px;
    scroll-margin-top: 30px;
  }
  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 40px;
    margin-bottom: 38px;
  }
  .section-index {
    font-size: 13px;
    line-height: 1.5;
    color: var(--muted);
    display: flex;
    gap: 18px;
    align-items: center;
    margin-bottom: 20px;
  }
  h2 {
    font-size: clamp(37px, 3.6vw, 50px);
    font-weight: 500;
    line-height: 1.08;
    letter-spacing: -0.055em;
  }
  .section-heading > p {
    max-width: 365px;
    font-size: 15px;
    line-height: 1.7;
    color: var(--muted);
    padding-bottom: 3px;
  }
  .gallery-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 22px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 25px;
  }
  .filters {
    display: flex;
    gap: 23px;
    overflow: auto;
    scrollbar-width: thin;
    padding: 5px;
    margin: -5px;
  }
  .filters button {
    flex-shrink: 0;
    border: 0;
    border-bottom: 2px solid transparent;
    min-height: 49px;
    min-width: 44px;
    padding: 12px 0;
    background: none;
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
  }
  .filters button[aria-pressed="true"] {
    color: var(--ink);
    border-color: var(--ink);
  }
  .motion-toggle {
    border: 0;
    background: none;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    white-space: nowrap;
    min-height: 44px;
  }
  .motion-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 35px 24px;
  }
  .motion-card {
    min-width: 0;
  }
  .card-media {
    position: relative;
    aspect-ratio: 1/1.06;
    overflow: hidden;
    border-radius: 4px;
  }
  .card-media :global(video) {
    object-fit: contain;
  }
  .card-title {
    display: flex;
    align-items: center;
    gap: 13px;
    min-height: 44px;
    padding-top: 9px;
  }
  .card-title h3 {
    font-size: 17px;
    font-weight: 500;
    letter-spacing: -0.5px;
  }
  .card-duration {
    margin-left: auto;
    color: var(--muted);
  }
  .motion-card > p {
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted);
  }
  .cut-label {
    position: absolute;
    left: 16px;
    top: 16px;
    background: #faf9f6e8;
    padding: 7px 10px;
    font-size: 11px;
    border-radius: 2px;
    pointer-events: none;
  }
  .gallery-foot {
    margin-top: 38px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    font-size: 13px;
    color: var(--muted);
  }
  .secondary {
    border: 1px solid #bcbcb4;
    background: transparent;
    color: var(--ink);
  }
  .text-link {
    display: inline-flex;
    align-items: center;
    gap: 22px;
    font-size: 14px;
    min-height: 44px;
    color: var(--ink);
  }
  .workflow-section {
    border-block: 1px solid var(--line);
    padding-block: 64px 72px;
    scroll-margin-top: 25px;
  }
  .workflow-heading {
    margin-bottom: 40px;
  }
  .workflow-body {
    display: grid;
    grid-template-columns: 1.55fr 1fr;
    gap: 64px;
    align-items: center;
  }
  .editor-preview {
    background: #e5e4df;
    border-radius: 5px;
    padding: 22px;
    min-width: 0;
  }
  .editor-preview img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 3px;
    box-shadow: 0 6px 22px #24242112;
  }
  .editor-preview a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 44px;
    padding-top: 18px;
    font-size: 12px;
  }
  .workflow-lead {
    font-size: 21px;
    line-height: 1.5;
    letter-spacing: -0.6px;
    max-width: 380px;
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 23px 0 17px;
  }
  .steps li {
    display: flex;
    gap: 22px;
    padding-block: 21px;
    border-bottom: 1px solid var(--line);
  }
  .steps .mono {
    padding-top: 3px;
    color: var(--muted);
  }
  .steps h3 {
    font-size: 16px;
    font-weight: 500;
    letter-spacing: -0.3px;
  }
  .steps p {
    font-size: 13px;
    line-height: 1.65;
    color: var(--muted);
    margin-top: 8px;
    max-width: 300px;
  }
  .devices-section {
    padding-block: 90px 82px;
    scroll-margin-top: 25px;
  }
  .device-browser {
    display: grid;
    grid-template-columns: 0.8fr 1.2fr;
    gap: 80px;
    align-items: center;
  }
  .device-tabs {
    display: flex;
    flex-direction: column;
  }
  .device-tabs button {
    display: flex;
    align-items: center;
    gap: 19px;
    text-align: left;
    border: 0;
    border-bottom: 1px solid var(--line);
    padding: 23px 0;
    min-height: 72px;
    background: transparent;
    font-size: 20px;
    letter-spacing: -0.65px;
    color: var(--muted);
  }
  .device-tabs button .mono {
    color: var(--muted);
  }
  .device-tabs button :global(svg) {
    margin-left: auto;
    opacity: 0;
  }
  .device-tabs button[aria-pressed="true"] {
    color: var(--ink);
  }
  .device-tabs button[aria-pressed="true"] .mono {
    color: var(--accent);
  }
  .device-tabs button[aria-pressed="true"] :global(svg) {
    opacity: 1;
  }
  .device-detail {
    margin-top: 28px;
    max-width: 360px;
    min-height: 190px;
  }
  .device-detail p {
    font-size: 14px;
    line-height: 1.7;
    color: var(--muted);
  }
  .device-detail .device-options {
    font-size: 12px;
    margin-block: 12px 18px;
  }
  .device-picture {
    height: 560px;
    min-width: 0;
    border-radius: 5px;
    overflow: hidden;
  }
  .device-picture :global(video) {
    object-fit: contain;
  }
  .faq-section {
    border-top: 1px solid var(--line);
    padding-block: 54px 72px;
    display: grid;
    grid-template-columns: 1fr 1.9fr;
    gap: 90px;
  }
  .faq-heading h2 {
    font-size: 31px;
    letter-spacing: -1.3px;
  }
  .faq-heading p {
    font-size: 13px;
    color: var(--muted);
    margin-top: 15px;
  }
  .faq-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 34px 40px;
  }
  .faq-list h3 {
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 12px;
  }
  .faq-list p {
    font-size: 13px;
    line-height: 1.75;
    color: var(--muted);
  }
  .final-cta {
    border-block: 1px solid var(--line);
    padding-block: 58px 65px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 30px;
  }
  .final-cta .section-index {
    margin-bottom: 14px;
  }
  .final-cta h2 {
    font-size: 82px;
    letter-spacing: -0.065em;
  }
  .site-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 25px;
    padding-block: 33px 40px;
  }
  .site-footer .wordmark {
    font-size: 21px;
  }
  .site-footer p {
    font-size: 12px;
    color: var(--muted);
  }
  .site-footer > a:last-child {
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 15px;
    min-height: 44px;
  }
  @media (hover: hover) and (pointer: fine) {
    nav a:hover,
    .nav-cta:hover,
    .text-link:hover,
    .card-title:hover,
    .hero-foot a:hover {
      color: var(--accent);
    }
    .primary:hover {
      background: #a63218;
    }
    .secondary:hover {
      background: #eeede8;
    }
    .hero-selector button:hover,
    .filters button:hover,
    .device-tabs button:hover {
      color: var(--ink);
    }
    .round-link:hover {
      background: #ffffff50;
      border-radius: 3px;
    }
  }
  @media (max-width: 1100px) {
    .wrap {
      width: calc(100% - 56px);
    }
    .hero-heading {
      gap: 35px;
    }
    h1 {
      font-size: 86px;
    }
    .hero-copy {
      max-width: 315px;
    }
    .hero-copy > p {
      font-size: 15px;
    }
    .hero-media,
    .desktop-media {
      height: 430px;
    }
    .hero-selector {
      gap: 13px;
    }
    .hero-selector button {
      font-size: 11px;
    }
    .filters {
      gap: 18px;
    }
    .motion-grid {
      gap: 28px 18px;
    }
    .workflow-body {
      gap: 35px;
    }
    .device-browser {
      gap: 45px;
    }
    .device-picture {
      height: 485px;
    }
    .faq-section {
      gap: 45px;
    }
  }
  @media (max-width: 760px) {
    .wrap {
      width: calc(100% - 40px);
    }
    .site-header {
      height: 72px;
      gap: 15px;
    }
    .wordmark {
      font-size: 20px;
    }
    .brand-mark {
      width: 6px;
      height: 6px;
    }
    nav {
      display: none;
      position: absolute;
      top: 71px;
      left: 0;
      right: 0;
      padding: 12px 20px 18px;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 0 0 5px 5px;
      box-shadow: 0 12px 20px #2424210a;
      gap: 0;
    }
    nav.open {
      display: flex;
      flex-direction: column;
    }
    nav a {
      min-height: 48px;
      border-bottom: 1px solid var(--line);
      font-size: 15px;
    }
    nav .mobile-projects {
      display: flex;
      justify-content: space-between;
      border: 0;
    }
    .menu-toggle {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 44px;
      padding: 10px 0 10px 15px;
      background: none;
      border: 0;
      font-size: 13px;
    }
    .menu-toggle[aria-expanded="true"] :global(svg) {
      transform: rotate(180deg);
    }
    .nav-cta {
      display: none;
    }
    .hero {
      padding-top: 35px;
    }
    .hero-heading {
      display: block;
      margin-bottom: 30px;
    }
    h1 {
      font-size: clamp(59px, 12vw, 86px);
      letter-spacing: -0.065em;
      line-height: 0.99;
    }
    .hero-copy {
      max-width: none;
      padding: 0;
      margin-top: 23px;
    }
    .hero-copy > p {
      font-size: 15px;
      line-height: 1.6;
      max-width: 340px;
    }
    .hero-actions {
      margin-top: 20px;
      gap: 12px;
    }
    .button {
      min-height: 50px;
      font-size: 14px;
      padding: 14px 18px;
      gap: 36px;
    }
    .hero-proof {
      font-size: 12px;
    }
    .hero-exhibit {
      grid-template-columns: 1fr;
    }
    .hero-media {
      height: 430px;
    }
    .stage-label {
      top: 18px;
      left: 18px;
      right: 18px;
      font-size: 12px;
    }
    .stage-bottom {
      left: 18px;
      right: 18px;
      height: 64px;
    }
    .hero-selector {
      gap: 20px;
    }
    .hero-selector button {
      font-size: 12px;
    }
    .desktop-stage {
      display: none;
    }
    .hero-foot {
      padding-block: 15px;
      gap: 14px;
      font-size: 11px;
      align-items: flex-start;
    }
    .hero-foot p {
      max-width: 170px;
      line-height: 1.6;
      padding-top: 9px;
    }
    .hero-foot a {
      gap: 8px;
      white-space: nowrap;
    }
    .motions-section {
      padding-block: 60px 50px;
    }
    .section-heading {
      display: block;
      margin-bottom: 24px;
    }
    .section-index {
      font-size: 12px;
      margin-bottom: 16px;
    }
    h2 {
      font-size: 37px;
      letter-spacing: -0.05em;
    }
    .section-heading > p {
      font-size: 14px;
      margin-top: 20px;
    }
    .gallery-toolbar {
      display: block;
      position: relative;
      margin-bottom: 20px;
    }
    .filters {
      gap: 23px;
      padding-inline: 3px;
      margin-inline: -3px;
    }
    .filters button {
      font-size: 13px;
      min-height: 48px;
    }
    .motion-toggle {
      margin-left: auto;
      margin-top: 3px;
      font-size: 12px;
      min-height: 44px;
    }
    .motion-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 25px 14px;
    }
    .card-media {
      aspect-ratio: 4/5;
    }
    .card-title {
      gap: 7px;
      padding-top: 6px;
    }
    .card-title h3 {
      font-size: 14px;
      letter-spacing: -0.4px;
    }
    .card-title :global(svg) {
      width: 15px;
      flex-shrink: 0;
    }
    .card-duration {
      font-size: 12px;
    }
    .motion-card > p {
      font-size: 12px;
      line-height: 1.55;
    }
    .cut-label {
      font-size: 10px;
      top: 10px;
      left: 10px;
      padding: 5px 7px;
    }
    .gallery-foot {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
      margin-top: 30px;
    }
    .gallery-foot .text-link {
      justify-content: center;
      font-size: 13px;
    }
    .workflow-section {
      padding-block: 42px 45px;
    }
    .workflow-heading {
      margin-bottom: 26px;
    }
    .workflow-body {
      grid-template-columns: 1fr;
      gap: 29px;
    }
    .editor-preview {
      padding: 12px;
    }
    .editor-preview a {
      font-size: 12px;
      padding: 10px 3px 0;
    }
    .workflow-lead {
      font-size: 20px;
      max-width: 340px;
    }
    .steps {
      margin-block: 15px;
    }
    .steps li {
      gap: 20px;
      padding-block: 18px;
    }
    .steps h3 {
      font-size: 16px;
    }
    .steps p {
      font-size: 14px;
      max-width: none;
    }
    .devices-section {
      padding-block: 56px 45px;
    }
    .device-browser {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .device-controls {
      display: contents;
    }
    .device-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .device-tabs button {
      font-size: 14px;
      letter-spacing: -0.3px;
      padding: 13px;
      min-height: 56px;
      border: 1px solid var(--line);
      border-radius: 3px;
      line-height: 1.35;
    }
    .device-tabs button[aria-pressed="true"] {
      border-color: var(--ink);
      background: #eeede8;
    }
    .device-tabs .mono,
    .device-tabs button :global(svg) {
      display: none;
    }
    .device-detail {
      order: 2;
      min-height: 0;
      margin-top: 0;
      max-width: none;
    }
    .device-detail .device-options {
      font-size: 12px;
      margin-block: 10px;
    }
    .device-picture {
      order: 1;
      height: 380px;
      width: 100%;
    }
    .faq-section {
      padding-block: 35px 45px;
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .faq-heading h2 {
      font-size: 30px;
    }
    .faq-list {
      grid-template-columns: 1fr;
      gap: 25px;
    }
    .faq-list h3 {
      font-size: 15px;
      margin-bottom: 8px;
    }
    .faq-list p {
      font-size: 14px;
    }
    .final-cta {
      align-items: flex-start;
      flex-direction: column;
      padding-block: 37px 42px;
      gap: 25px;
    }
    .final-cta h2 {
      font-size: 64px;
    }
    .site-footer {
      flex-wrap: wrap;
      padding-block: 24px 30px;
      gap: 15px;
    }
    .site-footer p {
      order: 3;
      flex-basis: 100%;
      font-size: 11px;
    }
    .site-footer > a:last-child {
      font-size: 11px;
      gap: 8px;
    }
  }
  @media (max-width: 360px) {
    .wrap {
      width: calc(100% - 32px);
    }
    .wordmark {
      font-size: 18px;
    }
    h1 {
      font-size: 54px;
    }
    .hero-media {
      height: 385px;
    }
    .hero-selector {
      gap: 13px;
    }
    .hero-selector button {
      font-size: 11px;
    }
    .hero-foot {
      display: block;
    }
    .hero-foot p {
      max-width: none;
    }
    .motion-grid {
      gap: 22px 12px;
    }
    .card-duration {
      display: none;
    }
    .card-title :global(svg) {
      margin-left: auto;
    }
    h2 {
      font-size: 34px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    a,
    button {
      transition: none;
    }
    :is(button, .button):active {
      transform: none;
    }
  }
</style>
