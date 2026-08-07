<script lang="ts">
  import { appStoreUrl, playStoreUrl, storesLive } from '$lib/config';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let copied = $state(false);
  let copyFailed = $state(false);

  async function copy() {
    copyFailed = false;
    try {
      await navigator.clipboard.writeText(data.fullLink);
      copied = true;
      setTimeout(() => (copied = false), 2400);
    } catch {
      // Clipboard access is refused often enough (insecure context, Safari
      // permissions) that "nothing happened" is not an acceptable outcome.
      copyFailed = true;
    }
  }
</script>

<svelte:head>
  <title>A list was shared with you — Checkpost</title>
  <!-- A share link in a search index is a leaked list. -->
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <meta name="referrer" content="no-referrer" />
</svelte:head>

<main>
  <div class="card">
    <svg class="mark" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
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

    <h1>Someone shared a list with you.</h1>
    <p class="lede">
      Checkpost lists live in the app. Open this link there and you'll be on the list — no account,
      nothing to fill in.
    </p>

    <a class="btn" href={data.deepLink} data-sveltekit-reload>Open in Checkpost</a>

    {#if storesLive}
      <p class="or">Don't have it yet?</p>
      <div class="stores">
        {#if appStoreUrl}<a class="btn ghost" href={appStoreUrl}>App Store</a>{/if}
        {#if playStoreUrl}<a class="btn ghost" href={playStoreUrl}>Google Play</a>{/if}
      </div>
    {:else}
      <p class="or">
        The app isn't in the stores yet. Keep this link — it will still work when it lands.
      </p>
    {/if}

    <div class="link">
      <p class="label" id="link-label">Or paste this into Checkpost yourself</p>
      <code aria-labelledby="link-label">{data.fullLink}</code>
      <button type="button" onclick={copy}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
      <p class="status" role="status">
        {#if copied}Link copied.{/if}
        {#if copyFailed}Couldn't copy automatically — select the link above.{/if}
      </p>
    </div>
  </div>

  <p class="warn">
    Anyone with this link can read and edit the list. Treat it like a key, and replace it from the
    app if it ends up somewhere it shouldn't.
  </p>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 24px;
    min-height: 100dvh;
    align-content: center;
    padding: 40px 20px 56px;
  }

  .card {
    width: min(100%, 30rem);
    text-align: left;
  }

  .mark {
    color: var(--primary);
    display: block;
    margin-bottom: 24px;
  }

  h1 {
    font-size: clamp(1.9rem, 6vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .lede {
    margin-top: 14px;
    color: var(--ink-muted);
  }

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 52px;
    margin-top: 28px;
    padding: 0 24px;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: var(--on-primary);
    font-weight: 600;
    text-decoration: none;
    transition: background var(--fast) var(--ease);
  }

  .btn:hover {
    background: var(--primary-hover);
  }

  .btn.ghost {
    flex: 1;
    margin-top: 0;
    background: none;
    color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }

  .btn.ghost:hover {
    background: var(--surface);
  }

  .or {
    margin-top: 22px;
    font-size: 0.9rem;
    color: var(--ink-muted);
  }

  .stores {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }

  .link {
    margin-top: 32px;
    padding: 16px;
    background: var(--surface);
    border-radius: var(--radius-md);
  }

  .label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--ink-muted);
  }

  code {
    display: block;
    margin-top: 8px;
    font-family: var(--mono);
    font-size: 0.78rem;
    line-height: 1.5;
    /* The token is one long unbroken word; without this it overflows the card
       on every phone there is. */
    overflow-wrap: anywhere;
    color: var(--ink);
    user-select: all;
  }

  .link button {
    margin-top: 12px;
    min-height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--radius-sm);
    background: var(--bg);
    box-shadow: inset 0 0 0 1px var(--line-strong);
    color: var(--ink);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background var(--fast) var(--ease);
  }

  .link button:hover {
    background: var(--surface-hover);
  }

  .status {
    min-height: 1.2em;
    margin-top: 8px;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  .warn {
    width: min(100%, 30rem);
    font-size: 0.85rem;
    color: var(--ink-muted);
  }
</style>
