<script lang="ts">
  import DemoList from '$lib/DemoList.svelte';
  import { appStoreUrl, playStoreUrl, storesLive } from '$lib/config';
</script>

<svelte:head>
  <title>Checkpost. A shared checklist that lives at a link</title>
  <meta
    name="description"
    content="Make a list, send the link. Everyone who has it can tick things off, at the same time. No accounts. Replace the link whenever you want."
  />
  <meta property="og:title" content="Checkpost" />
  <meta property="og:description" content="A shared checklist that lives at a link. No accounts." />
  <meta property="og:type" content="website" />
</svelte:head>

<header class="bar">
  <a class="wordmark" href="/">
    <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M9 16.6 13.8 21.4 23 12.2"
        fill="none"
        stroke="var(--bg)"
        stroke-width="3.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    Checkpost
  </a>
</header>

<main>
  <section class="hero">
    <div class="statement">
      <h1>
        <span class="line">A list</span>
        <span class="line">is a link.</span>
      </h1>
      <p class="lede">
        Write the list. Send the link. Everyone who has it sees the same list and can tick things
        off, at the same time, from anywhere. Nobody signs up for anything.
      </p>

      <div class="actions">
        {#if storesLive}
          {#if appStoreUrl}<a class="btn" href={appStoreUrl}>Get it for iPhone</a>{/if}
          {#if playStoreUrl}<a class="btn ghost" href={playStoreUrl}>Get it for Android</a>{/if}
        {:else}
          <p class="soon">
            Checkpost is in the workshop. The app lands on the App Store and Google Play shortly.
          </p>
        {/if}
      </div>
    </div>

    <div class="demo">
      <DemoList />
      <p class="hint">Go on. Tick something.</p>
    </div>
  </section>

  <section class="beats">
    <div class="beat">
      <h2>Share it however you like</h2>
      <p>
        Hold up the QR code and let someone scan it across the table, or paste the link into
        whatever thread you already have going. Both open the same list.
      </p>
    </div>
    <div class="beat">
      <h2>Everyone edits at once</h2>
      <p>
        Ticks, new items and edits land on everyone's phone as they happen. The app shows you how
        many people are on the list right now. No names, no avatars, no accounts.
      </p>
    </div>
    <div class="beat">
      <h2>Nothing to sign up for</h2>
      <p>
        No email, no password, no profile. The link is the key, which is why it's forty-three
        characters long and why we only ever store a hash of it.
      </p>
    </div>
  </section>

  <section class="rotate">
    <div class="rotate-inner">
      <h2>Sent it to the wrong group chat?</h2>
      <p>
        Replace the link. The old one stops working the instant you do. Anyone still holding it is
        told the link was replaced, and everyone you actually meant to share with gets the new one.
      </p>
      <p class="fine">
        There's no undo and no grace period. That's the point of the feature.
      </p>
    </div>
  </section>
</main>

<footer class="foot">
  <p>Checkpost</p>
  <p class="fine">
    Lists are reachable only by their link and are deleted after a year without a visit.
  </p>
</footer>

<style>
  /* A fixed brand field: it does not invert with the colour scheme, because a
     brand block that flips to pale pink in dark mode is not a brand block. */
  :global(:root) {
    --brand-field: oklch(0.555 0.193 2);
    --on-brand-field: oklch(1 0 0);
  }

  .bar {
    display: flex;
    align-items: center;
    padding: 22px clamp(20px, 5vw, 56px);
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--primary);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: -0.02em;
    text-decoration: none;
  }

  main {
    padding: 0 clamp(20px, 5vw, 56px);
  }

  .hero {
    display: grid;
    gap: clamp(40px, 6vw, 72px);
    align-items: center;
    max-width: 78rem;
    margin: clamp(24px, 6vw, 72px) auto clamp(72px, 10vw, 128px);
  }

  @media (min-width: 62rem) {
    .hero {
      grid-template-columns: 1.05fr 0.95fr;
    }
  }

  h1 {
    font-size: clamp(3.4rem, 11vw, 5.6rem);
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  .line {
    display: block;
    animation: rise 700ms var(--ease) both;
  }

  .line:nth-child(2) {
    animation-delay: 90ms;
    color: var(--primary);
  }

  .lede {
    max-width: 34ch;
    margin-top: 24px;
    font-size: clamp(1.05rem, 2.2vw, 1.25rem);
    color: var(--ink-muted);
    animation: rise 700ms var(--ease) both;
    animation-delay: 180ms;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 32px;
    animation: rise 700ms var(--ease) both;
    animation-delay: 260ms;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    min-height: 48px;
    padding: 0 22px;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: var(--on-primary);
    font-weight: 600;
    text-decoration: none;
    transition:
      background var(--fast) var(--ease),
      transform var(--fast) var(--ease);
  }

  .btn:hover {
    background: var(--primary-hover);
  }

  .btn:active {
    transform: translateY(1px);
  }

  .btn.ghost {
    background: none;
    color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }

  .btn.ghost:hover {
    background: var(--surface);
  }

  .soon {
    color: var(--ink-muted);
    max-width: 36ch;
  }

  .demo {
    display: grid;
    justify-items: center;
    gap: 14px;
    animation: rise 700ms var(--ease) both;
    animation-delay: 320ms;
  }

  .hint {
    font-size: 0.85rem;
    color: var(--ink-faint);
  }

  .beats {
    display: grid;
    gap: clamp(32px, 5vw, 56px);
    max-width: 78rem;
    margin: 0 auto clamp(80px, 11vw, 144px);
  }

  @media (min-width: 52rem) {
    .beats {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .beat h2 {
    font-size: clamp(1.35rem, 2.6vw, 1.6rem);
    letter-spacing: -0.025em;
  }

  .beat p {
    margin-top: 12px;
    max-width: 42ch;
    color: var(--ink-muted);
  }

  .rotate {
    /* The one drenched surface on the page. Rotation is the thing that makes a
       link-only product safe to use, so it gets the whole field to itself. */
    background: var(--brand-field);
    color: var(--on-brand-field);
    border-radius: clamp(20px, 3vw, 32px);
    padding: clamp(44px, 6vw, 80px) clamp(24px, 5vw, 72px);
    max-width: 78rem;
    margin: 0 auto clamp(64px, 9vw, 112px);
  }

  .rotate-inner {
    max-width: 42rem;
  }

  .rotate h2 {
    font-size: clamp(2rem, 5vw, 3.2rem);
    font-weight: 800;
    letter-spacing: -0.035em;
  }

  .rotate p {
    margin-top: 20px;
    font-size: clamp(1.05rem, 2vw, 1.2rem);
    max-width: 46ch;
  }

  .rotate .fine {
    /* A transparency of the text colour, not a grey. Grey on a saturated
       field always reads as dirty. */
    color: oklch(1 0 0 / 0.76);
    font-size: 1rem;
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    align-items: baseline;
    padding: 32px clamp(20px, 5vw, 56px) 56px;
    border-top: 1px solid var(--line);
    max-width: 78rem;
    margin: 0 auto;
  }

  .foot p:first-child {
    font-weight: 600;
  }

  .fine {
    color: var(--ink-muted);
    font-size: 0.9rem;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .line,
    .lede,
    .actions,
    .demo {
      animation: none;
    }
  }
</style>
