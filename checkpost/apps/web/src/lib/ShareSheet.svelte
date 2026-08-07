<script lang="ts">
  import { untrack } from 'svelte';
  import Qr from './Qr.svelte';
  import Sheet from './Sheet.svelte';

  let {
    url,
    title,
    onclose,
    onrotate,
  }: {
    url: string;
    title: string;
    onclose: () => void;
    onrotate: () => Promise<string>;
  } = $props();

  // The link as it was on open. Rotating replaces it from here, not from above.
  let current = $state(untrack(() => url));
  let status = $state<string | null>(null);
  let confirming = $state(false);
  let rotating = $state(false);

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  async function share() {
    try {
      await navigator.share({ title, url: current });
    } catch {
      // A cancelled share sheet is not an error, and there is nothing to say.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(current);
      status = 'Link copied.';
    } catch {
      status = 'Could not copy automatically. Select the link above.';
    }
  }

  async function rotate() {
    rotating = true;
    status = null;
    try {
      current = await onrotate();
      confirming = false;
      status = 'Link replaced. The old one no longer works.';
    } catch {
      status = 'Could not replace the link. Try again.';
    } finally {
      rotating = false;
    }
  }
</script>

<Sheet title="Share this list" {onclose}>
  <p class="lede">
    Anyone with this link can read and edit the list. There is no sign-up. The link is the key.
  </p>

  <div class="qr"><Qr value={current} /></div>

  <code>{current}</code>

  <div class="actions">
    {#if canShare}
      <button type="button" class="primary" onclick={share}>Send link</button>
    {/if}
    <button type="button" class:primary={!canShare} class:ghost={canShare} onclick={copy}>
      Copy link
    </button>
  </div>

  <p class="status" role="status">{status ?? ''}</p>

  <hr />

  <h3>If it ended up somewhere it shouldn't</h3>
  {#if confirming}
    <p class="fine">
      The current link stops working immediately. Anyone still using it, including your own
      other devices, is told the link was replaced and has to be sent the new one. There is no
      undo.
    </p>
    <button type="button" class="primary" onclick={rotate} disabled={rotating}>
      {rotating ? 'Replacing…' : 'Replace the link'}
    </button>
    <button type="button" class="quiet" onclick={() => (confirming = false)}>Keep it</button>
  {:else}
    <p class="fine">
      Replace the link and the old one stops working for everyone, at once. You then send the new
      link to the people you meant.
    </p>
    <button type="button" class="ghost" onclick={() => (confirming = true)}>Replace link</button>
  {/if}
</Sheet>

<style>
  .lede {
    color: var(--ink-muted);
    margin-bottom: 20px;
  }

  .qr {
    display: grid;
    place-items: center;
    padding: 16px;
    background: var(--primary-quiet);
    border-radius: var(--radius-lg);
  }

  code {
    display: block;
    margin-top: 20px;
    padding: 14px 16px;
    background: var(--surface);
    border-radius: var(--radius-md);
    font-family: var(--mono);
    font-size: 0.78rem;
    line-height: 1.55;
    /* The token is one long unbroken word and would otherwise overflow. */
    overflow-wrap: anywhere;
    user-select: all;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }

  .actions button {
    flex: 1;
  }

  button {
    min-height: 48px;
    padding: 0 18px;
    border-radius: var(--radius-md);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .primary {
    width: 100%;
    border: 0;
    background: var(--primary);
    color: var(--on-primary);
  }

  .primary:disabled {
    opacity: 0.6;
  }

  .ghost {
    width: 100%;
    border: 0;
    background: none;
    box-shadow: inset 0 0 0 1px var(--line-strong);
    color: var(--ink);
  }

  .quiet {
    width: 100%;
    margin-top: 8px;
    border: 0;
    background: none;
    color: var(--ink-muted);
  }

  .status {
    min-height: 1.3em;
    margin-top: 10px;
    font-size: 0.85rem;
    color: var(--ink);
  }

  hr {
    margin: 20px 0;
    border: 0;
    border-top: 1px solid var(--line);
  }

  h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .fine {
    margin-bottom: 12px;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }
</style>
