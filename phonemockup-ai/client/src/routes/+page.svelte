<script lang="ts">
  import {
    ArrowUpRight,
    ArrowDown,
    ArrowRight,
    Play,
    Pause,
    Check,
    Plus,
  } from "@lucide/svelte";
  import animationGroups from "$lib/animations/animations.svelte";
  import MotionPreview from "$lib/components/marketing/MotionPreview.svelte";

  const motions = animationGroups;
  const heroOptions = [motions[0], motions[1], motions[7]];
  let featured = $state(heroOptions[0]);
  let motionPaused = $state(false);
  let category = $state("All motions");
  const categories = ["All motions", "Cinematic", "Reveal", "Detail", "Loop"];
  const filtered = $derived(
    category === "All motions"
      ? motions
      : motions.filter((m) => m.categories?.some((c) => c === category)),
  );
  const duration = (group: (typeof motions)[number]) =>
    Math.max(...group.animations.map((a) => a.end));
  const devices = [
    {
      name: "iPhone 16 Pro",
      detail: "A frame for your next big thing.",
      preset: "soft-orbit",
      image: "soft-orbit",
    },
    {
      name: "Pixel 9 Pro",
      detail: "Clean lines. Your screen, uninterrupted.",
      preset: "detail-study",
      image: "detail-study",
    },
    {
      name: "Galaxy S24 Ultra",
      detail: "Sharp corners. All the presence.",
      preset: "slow-spin",
      image: "slow-spin",
    },
    {
      name: "MacBook Pro 14″",
      detail: "Give the bigger picture its moment.",
      preset: "top-down",
      image: "top-down",
    },
  ];
  const faqs = [
    {
      q: "Can I try it without signing up?",
      a: "Yes. Open the editor, add an image or video, and export your mockup. No account is needed to get started.",
    },
    {
      q: "Can I use my own screen recording?",
      a: "Absolutely. Drop in an image or video. It maps onto the screen while the device follows the animation you picked.",
    },
    {
      q: "Can I change the animation?",
      a: "Every motion is editable. Adjust the keyframes, timing, easing, model and background, or start from a blank canvas.",
    },
    {
      q: "What can I export?",
      a: "Export video as MP4, WebM or GIF, or download a still image. Transparent backgrounds are available in formats that support them.",
    },
    {
      q: "How much does it cost?",
      a: "PhoneMockup is free during beta, with no watermark on your exports.",
    },
  ];
</script>

<svelte:head>
  <title>PhoneMockup — Your work. In motion.</title>
  <meta
    name="description"
    content="Turn your screens into beautiful 3D mockups. Eight original animations, four detailed devices, and a studio right in your browser. Free during beta."
  />
  <meta property="og:title" content="PhoneMockup — Your work. In motion." />
  <meta
    property="og:description"
    content="Good work deserves a great entrance. Create and export animated device mockups in your browser."
  />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://phonemockup.app/og-cover.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="canonical" href="https://phonemockup.app/" />
</svelte:head>

<div class="landing">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header wrap">
    <a class="wordmark" href="/" aria-label="PhoneMockup home"
      ><span class="brand-icon" aria-hidden="true">p<span>m</span></span
      >PhoneMockup</a
    >
    <nav aria-label="Main navigation">
      <a href="#motions">The motions</a><a href="#devices">The devices</a>
    </nav>
    <a class="nav-cta" href="/platform/animation/soft-orbit"
      >Open studio <ArrowUpRight size={15} /></a
    >
  </header>

  <main id="main">
    <section class="hero wrap" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">
          <span class="live-dot"></span> A LITTLE MOTION. A BIG DIFFERENCE.
        </p>
        <h1 id="hero-title">Your work.<br /><span>In motion.</span></h1>
        <p class="hero-description">
          You made something worth showing.<br class="desktop-break" /> Give it an
          entrance to match.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="/platform/animation/soft-orbit"
            >Make your mockup <ArrowUpRight size={19} /></a
          ><a class="text-link" href="#motions"
            >Find your move <ArrowDown size={16} /></a
          >
        </div>
        <p class="micro-proof">
          <Check size={13} /> Free during beta <span>·</span> No watermark
          <span>·</span> No signup
        </p>
        <div class="hero-note">
          <span class="note-line"></span>
          <p>
            Your screens. Our studio.<br /><strong
              >A very good first impression.</strong
            >
          </p>
        </div>
      </div>
      <div
        class="hero-stage"
        style={`--stage-color:rgb(${featured.previewBackground?.slice(0, 3).join(",")})`}
      >
        <div class="stage-top">
          <span>THE MOTION STUDIO</span><span>VOL. 01 ↗</span>
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
          <div>
            <span class="small-label">NOW PLAYING</span><strong
              >{featured.name}</strong
            >
          </div>
          <a
            href={`/platform/animation/${featured.id}`}
            aria-label={`Use ${featured.name}`}><ArrowUpRight size={23} /></a
          >
        </div>
        <div class="hero-selector" aria-label="Featured animation">
          {#each heroOptions as group, i}<button
              type="button"
              aria-pressed={featured.id === group.id}
              onclick={() => {
                featured = group;
              }}><span>0{i + 1}</span>{group.name}</button
            >{/each}
        </div>
      </div>
    </section>

    <div class="benefit-strip wrap">
      <span>Made for the work you put into it.</span>
      <div>
        <span>App launches</span><span>Portfolio pieces</span><span
          >Social posts</span
        ><span>Product stories</span>
      </div>
    </div>

    <section
      class="motions-section wrap"
      id="motions"
      aria-labelledby="motions-title"
    >
      <div class="section-heading">
        <div>
          <p class="eyebrow">01 / MAKE AN ENTRANCE</p>
          <h2 id="motions-title">
            Pick a little<br /><em>main-character energy.</em>
          </h2>
        </div>
        <p>
          From a quiet orbit to a confident reveal.<br />Eight original moves.
          Every one editable.
        </p>
      </div>
      <div class="gallery-toolbar">
        <div class="filters" role="group" aria-label="Filter animations">
          {#each categories as item}<button
              type="button"
              aria-pressed={category === item}
              onclick={() => {
                category = item;
              }}>{item}</button
            >{/each}
        </div>
        <button
          class="motion-toggle"
          type="button"
          aria-pressed={motionPaused}
          onclick={() => {
            motionPaused = !motionPaused;
          }}
          >{#if motionPaused}<Play size={13} />{:else}<Pause
              size={13}
            />{/if}<span
            >{motionPaused ? "Play animations" : "Pause animations"}</span
          ></button
        >
      </div>
      <div class="motion-grid" aria-live="polite">
        {#each filtered as group (group.id)}
          <article class="motion-card">
            <div class="card-media">
              <MotionPreview
                src={`/previews/${group.preview}`}
                poster={`/previews/${group.poster}`}
                label={group.name}
                paused={motionPaused}
              /><span class="duration"
                >{duration(group).toFixed(1)} SEC / LOOP</span
              >
            </div>
            <a class="card-title" href={`/platform/animation/${group.id}`}
              ><h3>{group.name}</h3>
              <ArrowUpRight size={19} /><span class="sr-only">
                — use this animation</span
              ></a
            >
            <p>{group.description}</p>
          </article>
        {/each}
      </div>
      <div class="gallery-foot">
        <span>All the moves. None of the learning curve.</span><a
          class="text-link"
          href="/platform/animation/still"
          >Or start with a blank canvas <ArrowUpRight size={15} /></a
        >
      </div>
    </section>

    <section class="workflow-section" aria-labelledby="workflow-title">
      <div class="wrap workflow-inner">
        <div class="workflow-intro">
          <p class="eyebrow">02 / FROM SCREEN TO SCENE</p>
          <h2 id="workflow-title">
            Less setup.<br />More <em>“look at this.”</em>
          </h2>
          <p>
            No 3D experience required.<br />Just something you want to share.
          </p>
        </div>
        <ol class="steps">
          <li>
            <span class="step-number">01</span>
            <div>
              <h3>Drop in your screen.</h3>
              <p>
                An app screenshot. A screen recording.<br />Whatever you’re
                working on.
              </p>
            </div>
            <span class="step-symbol">↧</span>
          </li>
          <li>
            <span class="step-number">02</span>
            <div>
              <h3>Find its rhythm.</h3>
              <p>
                Pick a motion. Make it yours with<br />timing, colour and a
                camera angle.
              </p>
            </div>
            <span class="step-symbol">↗</span>
          </li>
          <li>
            <span class="step-number">03</span>
            <div>
              <h3>Send it out into the world.</h3>
              <p>Export a video or a still.<br />Ready for your next launch.</p>
            </div>
            <span class="step-symbol">↗</span>
          </li>
        </ol>
      </div>
    </section>

    <section
      class="devices-section wrap"
      id="devices"
      aria-labelledby="devices-title"
    >
      <div class="section-heading">
        <div>
          <p class="eyebrow">03 / GOOD COMPANY FOR YOUR DESIGN</p>
          <h2 id="devices-title">
            The right frame.<br /><em>For your big idea.</em>
          </h2>
        </div>
        <p>Four carefully built devices.<br />One very flexible studio.</p>
      </div>
      <div class="device-grid">
        {#each devices as device}<a
            href={`/platform/animation/${device.preset}`}
            class="device-card"
            ><div
              class="device-picture"
              style:background={`rgb(${motions
                .find((m) => m.id === device.preset)
                ?.previewBackground?.slice(0, 3)
                .join(",")})`}
            >
              <img
                src={`/previews/motion-2026/${device.image}.webp`}
                alt={`${device.name} 3D mockup`}
                loading="lazy"
                width="640"
                height="800"
              />
            </div>
            <div>
              <h3>{device.name}</h3>
              <ArrowUpRight size={17} />
            </div>
            <p>{device.detail}</p></a
          >{/each}
      </div>
      <div class="device-note">
        <span>YOUR SCREEN GETS THE SPOTLIGHT.</span>
        <p>
          Keep the camera cutout, or hide it on iPhone and Pixel. Open the
          MacBook lid to find your angle.
        </p>
      </div>
    </section>

    <section class="faq-section wrap" aria-labelledby="faq-title">
      <div>
        <p class="eyebrow">THE SMALL PRINT, SIMPLIFIED</p>
        <h2 id="faq-title">Good questions.</h2>
      </div>
      <div class="faq-list">
        {#each faqs as item}<details>
            <summary>{item.q}<Plus size={17} /></summary>
            <p>{item.a}</p>
          </details>{/each}
      </div>
    </section>

    <section class="final-cta wrap">
      <p class="eyebrow">YOUR NEXT BIG THING STARTS HERE.</p>
      <h2>Ready for your<br /><em>close-up?</em></h2>
      <a class="button primary" href="/platform/animation/soft-orbit"
        >Let’s make it move <ArrowUpRight size={20} /></a
      ><span>Free during beta. Made in your browser.</span>
      <div class="cta-orbit orbit-one"></div>
      <div class="cta-orbit orbit-two"></div>
    </section>
  </main>
  <footer class="site-footer wrap">
    <a class="wordmark" href="/">PhoneMockup</a>
    <p>A little motion goes a long way.</p>
    <a href="/platform/project">Your projects <ArrowUpRight size={14} /></a>
  </footer>
</div>

<style>
  .landing {
    --ink: #20281f;
    --muted: #687063;
    --paper: #f7f7f0;
    background: var(--paper);
    color: var(--ink);
    font-family: Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: clip;
  }
  .wrap {
    width: min(1280px, calc(100% - 96px));
    margin-inline: auto;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  button {
    font: inherit;
    cursor: pointer;
  }
  button:focus-visible,
  a:focus-visible,
  summary:focus-visible {
    outline: 3px solid #5c7c38;
    outline-offset: 5px;
  }
  .skip-link {
    position: fixed;
    top: -60px;
    left: 15px;
    background: var(--ink);
    color: white;
    padding: 14px;
    z-index: 100;
  }
  .skip-link:focus {
    top: 10px;
  }
  .site-header {
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    border-bottom: 1px solid #dedfd4;
  }
  .wordmark {
    display: inline-flex;
    gap: 9px;
    align-items: center;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.8px;
    white-space: nowrap;
  }
  .brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink);
    color: #e1f5bd;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    font-size: 19px;
    letter-spacing: -5px;
    padding-right: 5px;
  }
  .brand-icon span {
    font-size: 14px;
    padding-top: 7px;
  }
  nav {
    display: flex;
    gap: 32px;
    font-size: 12px;
    font-weight: 600;
  }
  nav a:hover,
  .text-link:hover {
    color: #66833f;
  }
  .nav-cta {
    display: flex;
    align-items: center;
    gap: 20px;
    border: 1px solid #c9cdc0;
    padding: 13px 19px;
    border-radius: 50px;
    font-size: 12px;
    font-weight: 600;
  }
  .hero {
    display: grid;
    grid-template-columns: 1fr 1.04fr;
    gap: 48px;
    padding-block: 54px 46px;
    align-items: center;
  }
  .eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.3px;
    line-height: 1.6;
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .live-dot {
    height: 6px;
    width: 6px;
    border-radius: 50%;
    background: #789351;
    box-shadow: 0 0 0 4px #e6ecd9;
  }
  h1 {
    font-size: clamp(70px, 7.25vw, 106px);
    line-height: 0.99;
    letter-spacing: -7px;
    font-weight: 500;
    margin: 29px 0 27px;
  }
  h1 > span {
    font-family: Georgia, "Times New Roman", serif;
    font-style: italic;
    font-weight: 400;
    letter-spacing: -6px;
  }
  .hero-description {
    font-size: 17px;
    line-height: 1.65;
    color: var(--muted);
  }
  .hero-actions {
    display: flex;
    gap: 25px;
    align-items: center;
    margin-top: 30px;
  }
  .button {
    display: inline-flex;
    gap: 25px;
    align-items: center;
    justify-content: center;
    border-radius: 50px;
    padding: 18px 25px;
    font-size: 13px;
    font-weight: 600;
    min-height: 52px;
    transition:
      background 0.2s,
      transform 0.2s;
  }
  .primary {
    background: var(--ink);
    color: #f8f9ed;
  }
  .primary:hover {
    background: #3e5232;
    transform: translateY(-2px);
  }
  .text-link {
    display: inline-flex;
    gap: 10px;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
  }
  .micro-proof {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
    color: var(--muted);
    margin-top: 17px;
  }
  .micro-proof > span {
    padding-inline: 2px;
    color: #9b9f91;
  }
  .hero-note {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 64px;
    font-size: 10px;
    color: #818678;
    line-height: 1.65;
  }
  .hero-note strong {
    color: #545e4b;
    font-weight: 400;
  }
  .note-line {
    width: 24px;
    height: 1px;
    background: #adb5a2;
  }
  .hero-stage {
    background: var(--stage-color, #dde7d5);
    border-radius: 20px;
    overflow: hidden;
    position: relative;
    min-width: 0;
  }
  .stage-top {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 1.3px;
    padding: 23px 25px 0;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2;
    pointer-events: none;
  }
  .hero-media {
    aspect-ratio: 4/4.6;
  }
  .hero-media :global(video) {
    object-fit: cover;
  }
  .stage-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 25px 23px;
  }
  .stage-bottom > div {
    display: grid;
    gap: 5px;
  }
  .small-label {
    font-size: 8px;
    letter-spacing: 1.5px;
  }
  .stage-bottom strong {
    font-size: 16px;
    font-weight: 500;
  }
  .stage-bottom > a {
    height: 40px;
    width: 40px;
    border: 1px solid #9ba88d7a;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .hero-selector {
    display: flex;
    border-top: 1px solid #93a28744;
  }
  .hero-selector button {
    flex: 1;
    padding: 15px 8px;
    border: none;
    border-right: 1px solid #93a28744;
    background: transparent;
    display: flex;
    justify-content: center;
    gap: 8px;
    align-items: center;
    font-size: 10px;
  }
  .hero-selector button:last-child {
    border-right: 0;
  }
  .hero-selector button[aria-pressed="true"] {
    background: #ffffff70;
  }
  .hero-selector button > span {
    font-size: 8px;
    color: #6d7863;
  }
  .benefit-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-block: 1px solid #dedfd4;
    padding-block: 23px;
    gap: 18px;
    font-size: 11px;
    color: #687360;
  }
  .benefit-strip > div {
    display: flex;
    gap: 31px;
    color: #3c4537;
    font-weight: 600;
  }
  .motions-section {
    padding-block: 96px 78px;
    scroll-margin-top: 25px;
  }
  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 35px;
    margin-bottom: 38px;
  }
  h2 {
    font-size: clamp(36px, 4.25vw, 56px);
    line-height: 1.1;
    font-weight: 500;
    letter-spacing: -2.4px;
    margin-top: 19px;
  }
  h2 em {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 400;
    letter-spacing: -2px;
  }
  .section-heading > p {
    font-size: 13px;
    line-height: 1.7;
    color: var(--muted);
    padding-bottom: 4px;
  }
  .gallery-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 25px;
  }
  .filters {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .filters button {
    padding: 9px 14px;
    border: 1px solid #ddded3;
    border-radius: 30px;
    background: transparent;
    font-size: 10px;
  }
  .filters button[aria-pressed="true"] {
    color: var(--paper);
    background: var(--ink);
    border-color: var(--ink);
  }
  .motion-toggle {
    background: transparent;
    border: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
    color: #69735e;
    white-space: nowrap;
    padding: 10px 0;
  }
  .motion-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 30px 19px;
  }
  .motion-card {
    min-width: 0;
  }
  .card-media {
    position: relative;
    aspect-ratio: 4/5;
    border-radius: 13px;
    overflow: hidden;
    background: #e2e7db;
  }
  .duration {
    position: absolute;
    left: 14px;
    top: 15px;
    font-size: 8px;
    letter-spacing: 1px;
    color: #53624d;
    pointer-events: none;
  }
  .card-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
  }
  .card-title:hover {
    color: #66833f;
  }
  .card-title h3 {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.4px;
  }
  .motion-card > p {
    font-size: 11px;
    line-height: 1.6;
    color: var(--muted);
    margin-top: 6px;
    max-width: 220px;
  }
  .gallery-foot {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    margin-top: 35px;
    padding-top: 22px;
    border-top: 1px solid #dedfd4;
    font-size: 11px;
    color: var(--muted);
  }
  .workflow-section {
    background: #e9eddf;
  }
  .workflow-inner {
    padding-block: 70px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 70px;
    align-items: center;
  }
  .workflow-intro > p:last-child {
    margin-top: 24px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--muted);
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .steps li {
    display: flex;
    gap: 25px;
    align-items: flex-start;
    padding: 24px 0;
    border-bottom: 1px solid #cdd4c1;
  }
  .steps li:last-child {
    border: 0;
  }
  .step-number {
    font-size: 10px;
    padding-top: 5px;
    opacity: 0.6;
  }
  .steps h3 {
    font-size: 18px;
    font-weight: 500;
    letter-spacing: -0.5px;
  }
  .steps p {
    font-size: 12px;
    line-height: 1.7;
    color: var(--muted);
    margin-top: 8px;
  }
  .step-symbol {
    margin-left: auto;
    font-size: 28px;
    line-height: 1;
  }
  .devices-section {
    padding-block: 94px 72px;
    scroll-margin-top: 25px;
  }
  .device-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
  }
  .device-picture {
    height: 230px;
    background: #eaede1;
    border-radius: 12px;
    overflow: hidden;
  }
  .device-picture img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.35s;
  }
  .device-card:hover img {
    transform: scale(1.035);
  }
  .device-card > div:nth-child(2) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    gap: 5px;
  }
  .device-card h3 {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.25px;
  }
  .device-card > p {
    font-size: 11px;
    line-height: 1.6;
    color: var(--muted);
    margin-top: 7px;
  }
  .device-note {
    margin-top: 34px;
    border-top: 1px solid #dedfd4;
    padding-top: 23px;
    display: flex;
    gap: 30px;
    justify-content: space-between;
  }
  .device-note > span {
    font-size: 9px;
    letter-spacing: 1px;
    line-height: 1.6;
  }
  .device-note > p {
    font-size: 12px;
    line-height: 1.7;
    color: var(--muted);
    max-width: 450px;
  }
  .faq-section {
    padding-block: 30px 85px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 70px;
  }
  .faq-section h2 {
    font-size: 42px;
  }
  .faq-list details {
    padding: 20px 0;
    border-bottom: 1px solid #dedfd4;
  }
  .faq-list summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    list-style: none;
  }
  .faq-list summary::-webkit-details-marker {
    display: none;
  }
  .faq-list p {
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    padding-top: 14px;
    max-width: 450px;
  }
  .faq-list details[open] summary :global(svg) {
    transform: rotate(45deg);
  }
  .final-cta {
    text-align: center;
    position: relative;
    isolation: isolate;
    background: #d5e5bc;
    border-radius: 20px;
    padding: 60px 20px;
    overflow: hidden;
  }
  .final-cta > .eyebrow {
    justify-content: center;
  }
  .final-cta h2 {
    font-size: 66px;
    margin: 20px 0 30px;
    line-height: 1.03;
  }
  .final-cta > .button {
    position: relative;
    z-index: 1;
  }
  .final-cta > span {
    display: block;
    font-size: 10px;
    color: #657353;
    margin-top: 16px;
  }
  .cta-orbit {
    position: absolute;
    border: 1px solid #8aa46c50;
    border-radius: 50%;
    width: 620px;
    height: 360px;
    top: 25px;
    z-index: -1;
  }
  .orbit-one {
    left: -330px;
    transform: rotate(-45deg);
  }
  .orbit-two {
    right: -330px;
    transform: rotate(-45deg);
  }
  .site-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 25px;
    padding-block: 36px;
  }
  .site-footer .wordmark {
    font-size: 17px;
  }
  .site-footer > p {
    font-size: 11px;
    color: var(--muted);
  }
  .site-footer > a:last-child {
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  @media (min-width: 1450px) {
    .hero-stage {
      max-height: 715px;
    }
    .hero-media {
      height: 555px;
    }
  }
  @media (max-width: 1050px) {
    .wrap {
      width: calc(100% - 56px);
    }
    .hero {
      gap: 25px;
    }
    h1 {
      font-size: 75px;
      letter-spacing: -5px;
    }
    h1 > span {
      letter-spacing: -4px;
    }
    .hero-actions {
      gap: 18px;
      flex-wrap: wrap;
    }
    .hero-note {
      margin-top: 35px;
    }
    .hero-description {
      font-size: 15px;
    }
    .benefit-strip > div {
      gap: 18px;
    }
    .motion-grid {
      gap: 26px 15px;
    }
    .workflow-inner,
    .faq-section {
      gap: 35px;
    }
    .device-picture {
      height: 200px;
    }
  }
  @media (max-width: 760px) {
    .wrap {
      width: calc(100% - 36px);
    }
    .site-header {
      height: 78px;
      gap: 12px;
    }
    .site-header nav {
      display: none;
    }
    .wordmark {
      font-size: 17px;
    }
    .brand-icon {
      width: 28px;
      height: 28px;
    }
    .nav-cta {
      font-size: 10px;
      gap: 8px;
      padding: 12px 13px;
    }
    .hero {
      grid-template-columns: 1fr;
      padding-top: 36px;
      padding-bottom: 28px;
      gap: 30px;
    }
    .hero-copy {
      text-align: center;
    }
    .hero-copy > .eyebrow {
      justify-content: center;
      font-size: 8px;
      letter-spacing: 1px;
    }
    h1 {
      font-size: clamp(61px, 15vw, 90px);
      letter-spacing: -4.5px;
      margin: 23px 0 20px;
    }
    h1 > span {
      letter-spacing: -3.5px;
    }
    .hero-description {
      font-size: 14px;
      line-height: 1.65;
    }
    .hero-actions {
      justify-content: center;
      margin-top: 23px;
      gap: 20px;
    }
    .button {
      font-size: 12px;
      padding: 15px 21px;
      min-height: 48px;
      gap: 20px;
    }
    .micro-proof {
      justify-content: center;
      font-size: 9px;
      margin-top: 15px;
    }
    .hero-note {
      display: none;
    }
    .hero-stage {
      border-radius: 16px;
      max-width: 510px;
      width: 100%;
      margin: auto;
    }
    .hero-media {
      aspect-ratio: 4/4.25;
    }
    .stage-top {
      padding: 19px 20px;
      font-size: 8px;
    }
    .stage-bottom {
      padding: 0 20px 18px;
    }
    .stage-bottom strong {
      font-size: 14px;
    }
    .hero-selector button {
      min-height: 45px;
      font-size: 9px;
      gap: 6px;
    }
    .benefit-strip {
      flex-direction: column;
      gap: 14px;
      padding-block: 21px;
      font-size: 10px;
    }
    .benefit-strip > div {
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
      font-size: 10px;
    }
    .motions-section {
      padding-block: 54px 43px;
    }
    .section-heading {
      display: block;
      margin-bottom: 25px;
    }
    h2 {
      font-size: 38px;
      letter-spacing: -1.7px;
      margin-top: 14px;
    }
    h2 em {
      letter-spacing: -1.4px;
    }
    .eyebrow {
      font-size: 8px;
      letter-spacing: 1px;
    }
    .section-heading > p {
      font-size: 12px;
      margin-top: 18px;
    }
    .gallery-toolbar {
      align-items: flex-start;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 14px;
    }
    .filters {
      gap: 5px;
    }
    .filters button {
      min-height: 44px;
      font-size: 10px;
      padding: 9px 13px;
    }
    .motion-toggle {
      align-self: flex-end;
      min-height: 44px;
      font-size: 9px;
    }
    .motion-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 26px 12px;
    }
    .card-media {
      border-radius: 10px;
    }
    .duration {
      font-size: 7px;
      left: 10px;
      top: 10px;
      letter-spacing: 0.6px;
    }
    .card-title {
      margin-top: 12px;
      gap: 5px;
      min-height: 26px;
    }
    .card-title h3 {
      font-size: 13px;
    }
    .card-title :global(svg) {
      width: 16px;
      flex-shrink: 0;
    }
    .motion-card > p {
      font-size: 10px;
      line-height: 1.55;
    }
    .gallery-foot {
      flex-direction: column;
      gap: 14px;
      margin-top: 27px;
      font-size: 10px;
    }
    .gallery-foot .text-link {
      font-size: 11px;
    }
    .workflow-inner {
      padding-block: 45px;
      grid-template-columns: 1fr;
      gap: 15px;
    }
    .workflow-intro > p:last-child {
      font-size: 12px;
      margin-top: 20px;
    }
    .steps li {
      gap: 20px;
      padding: 23px 0;
    }
    .steps h3 {
      font-size: 17px;
    }
    .steps p {
      font-size: 12px;
    }
    .devices-section {
      padding-block: 52px 42px;
    }
    .device-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 27px 12px;
    }
    .device-picture {
      height: 175px;
    }
    .device-card h3 {
      font-size: 12px;
    }
    .device-card > p {
      font-size: 10px;
    }
    .device-note {
      display: block;
      margin-top: 26px;
      padding-top: 20px;
    }
    .device-note > span {
      font-size: 8px;
    }
    .device-note > p {
      font-size: 11px;
      margin-top: 12px;
    }
    .faq-section {
      grid-template-columns: 1fr;
      gap: 15px;
      padding-bottom: 48px;
    }
    .faq-section h2 {
      font-size: 36px;
    }
    .faq-list summary {
      font-size: 12px;
    }
    .faq-list details {
      padding-block: 19px;
    }
    .final-cta {
      padding: 43px 15px;
      border-radius: 15px;
    }
    .final-cta h2 {
      font-size: 49px;
      margin-block: 18px 24px;
    }
    .final-cta > span {
      font-size: 9px;
    }
    .site-footer {
      flex-wrap: wrap;
      gap: 18px;
      padding-block: 26px;
    }
    .site-footer .wordmark {
      font-size: 15px;
    }
    .site-footer > p {
      order: 3;
      flex-basis: 100%;
      font-size: 10px;
    }
    .site-footer > a:last-child {
      font-size: 10px;
    }
  }
  @media (max-width: 350px) {
    .wrap {
      width: calc(100% - 28px);
    }
    .wordmark {
      font-size: 15px;
    }
    .brand-icon {
      display: none;
    }
    h1 {
      font-size: 57px;
    }
    .hero-actions {
      gap: 16px;
    }
    .filters button {
      padding: 8px 10px;
    }
    .motion-grid {
      grid-template-columns: 1fr;
    }
    .device-card h3 {
      font-size: 11px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      transition: none !important;
    }
    .primary:hover,
    .device-card:hover img {
      transform: none;
    }
  }
</style>
