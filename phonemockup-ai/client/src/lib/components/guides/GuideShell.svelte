<script lang="ts">
  import "./guides.css";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { ArrowUpRight, ArrowDown } from "@lucide/svelte";
  import AuthControls from "$lib/components/auth/AuthControls.svelte";
  import {
    hubs,
    hubGuides,
    guidePath,
    type GuideSection,
  } from "$lib/guides/guides";

  let {
    section,
    isHub = false,
    children,
  }: { section: GuideSection; isHub?: boolean; children: Snippet } = $props();

  let menuOpen = $state(false);
  let interactive = $state(false);
  let menuButton: HTMLButtonElement;
  onMount(() => {
    interactive = true;
  });
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
  <meta name="theme-color" content="#faf9f6" />
  <link
    rel="preload"
    href="/fonts/archivo/archivo-latin-variable.woff2"
    as="font"
    type="font/woff2"
    crossorigin="anonymous"
  />
</svelte:head>

<div class="guide">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header wrap">
    <a class="wordmark" href="/" aria-label="PhoneMockup home"
      >phonemockup<span class="brand-mark" aria-hidden="true"></span></a
    >
    <nav
      id="guide-navigation"
      class="site-nav"
      class:open={menuOpen}
      aria-label="Main navigation"
    >
      {#each hubs as hub}<a
          href={`/${hub.section}`}
          aria-current={hub.section === section
            ? isHub
              ? "page"
              : "true"
            : undefined}
          onclick={() => (menuOpen = false)}>{hub.name}</a
        >{/each}
      <a class="mobile-projects" href="/platform/project"
        >Your projects <ArrowUpRight size={16} /></a
      >
      <div class="mobile-account"><AuthControls /></div>
    </nav>
    <div class="header-actions">
      <a class="nav-cta" href="/platform/project"
        >Your projects <ArrowUpRight size={16} /></a
      ><AuthControls />
    </div>
    <button
      class="menu-toggle"
      type="button"
      disabled={!interactive}
      aria-expanded={menuOpen}
      aria-controls="guide-navigation"
      bind:this={menuButton}
      onclick={() => (menuOpen = !menuOpen)}
      >Menu <ArrowDown size={16} /></button
    >
  </header>

  <main id="main">
    {@render children()}
  </main>

  <footer class="site-footer wrap">
    <div class="footer-brand">
      <a class="wordmark" href="/"
        >phonemockup<span class="brand-mark" aria-hidden="true"></span></a
      >
      <p>A browser. A screen. A different angle.</p>
    </div>
    <nav class="footer-links" aria-label="Guides">
      {#each hubs as hub}
        <div>
          <a class="footer-hub" href={`/${hub.section}`}>{hub.name}</a>
          <ul>
            {#each hubGuides(hub).flatMap((group) => group.guides) as guide}
              <li><a href={guidePath(guide)}>{guide.name}</a></li>
            {/each}
          </ul>
        </div>
      {/each}
    </nav>
    <div class="footer-bottom">
      <span>Free during beta. No watermark.</span>
      <a href="/platform/project">Your projects <ArrowUpRight size={16} /></a>
    </div>
  </footer>
</div>
