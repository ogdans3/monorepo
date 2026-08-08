<script lang="ts">
  import { untrack } from 'svelte';
  import type { Access, DirectAccess, ShareLink } from '@checkpost/contract';
  import { ACCESS_BLURBS, ACCESS_LABELS } from '@checkpost/contract';
  import Qr from './Qr.svelte';
  import Sheet from './Sheet.svelte';

  let {
    url,
    title,
    canAdmin,
    onclose,
    onrotate,
    onlinks,
    oncreate,
    onrevoke,
  }: {
    url: string;
    title: string;
    canAdmin: boolean;
    onclose: () => void;
    onrotate: () => Promise<string>;
    onlinks: () => Promise<ShareLink[]>;
    oncreate: (access: Access, label: string) => Promise<{ url: string; access: Access }>;
    onrevoke: (linkId: string) => Promise<void>;
  } = $props();

  /** The link that opened this list. Rotating replaces it from here. */
  let mine = $state(untrack(() => url));
  let status = $state<string | null>(null);

  /** A token is visible once, right after it is made, and never again. */
  let fresh = $state<{ url: string; access: Access } | null>(null);
  let links = $state<ShareLink[]>([]);
  let busy = $state(false);
  let confirming = $state<'rotate' | null>(null);
  let choosing = $state(false);
  let chosen = $state<Access>('read');
  let label = $state('');

  const shown = $derived(fresh?.url ?? mine);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const OFFER: Access[] = ['read', 'write', 'admin', 'copy'];

  $effect(() => {
    if (canAdmin) void refresh();
  });

  async function refresh() {
    try {
      links = await onlinks();
    } catch {
      // Not being able to list links is not worth breaking the sheet over.
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url: shown });
    } catch {
      // A cancelled share sheet is not an error, and there is nothing to say.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
      status = 'Link copied.';
    } catch {
      status = 'Could not copy automatically. Select the link above.';
    }
  }

  async function make() {
    busy = true;
    status = null;
    try {
      fresh = await oncreate(chosen, label.trim());
      label = '';
      choosing = false;
      status = 'New link made. It is shown once, so copy it now.';
      await refresh();
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not make the link.';
    } finally {
      busy = false;
    }
  }

  async function rotate() {
    busy = true;
    status = null;
    try {
      mine = await onrotate();
      fresh = null;
      confirming = null;
      status = 'Link replaced. The old one no longer works.';
      await refresh();
    } catch {
      status = 'Could not replace the link. Try again.';
    } finally {
      busy = false;
    }
  }

  async function revoke(link: ShareLink) {
    busy = true;
    try {
      await onrevoke(link.id);
      status = 'Link revoked. Whoever had it is out.';
      await refresh();
    } catch (error) {
      status = error instanceof Error ? error.message : 'Could not revoke that link.';
    } finally {
      busy = false;
    }
  }
</script>

<Sheet title="Share this list" {onclose}>
  {#if fresh}
    <p class="lede">
      A <strong>{ACCESS_LABELS[fresh.access].toLowerCase()}</strong> link. This is the only time it
      is shown, because only a hash of it is ever stored.
    </p>
  {:else}
    <p class="lede">
      Anyone with this link can {canAdmin ? 'do anything to' : 'use'} the list. There is no sign-up.
      The link is the key.
    </p>
  {/if}

  <div class="qr"><Qr value={shown} /></div>

  <code>{shown}</code>

  <div class="actions">
    {#if canShare}
      <button type="button" class="primary" onclick={share}>Send link</button>
    {/if}
    <button type="button" class:primary={!canShare} class:ghost={canShare} onclick={copy}>
      Copy link
    </button>
  </div>

  {#if fresh}
    <button type="button" class="quiet" onclick={() => (fresh = null)}>
      Back to my own link
    </button>
  {/if}

  <p class="status" role="status">{status ?? ''}</p>

  {#if canAdmin}
    <hr />

    <h3>Make a link for someone</h3>
    {#if choosing}
      <div class="choices" role="radiogroup" aria-label="What the link can do">
        {#each OFFER as level (level)}
          <label class="choice" class:picked={chosen === level}>
            <input type="radio" name="access" value={level} bind:group={chosen} />
            <span>
              <strong>{ACCESS_LABELS[level]}</strong>
              <em>{ACCESS_BLURBS[level]}</em>
            </span>
          </label>
        {/each}
      </div>
      <input
        class="label"
        bind:value={label}
        maxlength="60"
        placeholder="Who is it for? (optional)"
      />
      <button type="button" class="primary" onclick={make} disabled={busy}>
        {busy ? 'Making…' : 'Make the link'}
      </button>
      <button type="button" class="quiet" onclick={() => (choosing = false)}>Cancel</button>
    {:else}
      <p class="fine">
        Send people only what they need. A read link cannot change anything, and a copy link hands
        each person their own list without ever showing them yours.
      </p>
      <button type="button" class="ghost" onclick={() => (choosing = true)}>Make a link</button>
    {/if}

    {#if links.length}
      <h3 class="spaced">Live links <span class="count">{links.length}</span></h3>
      <ul class="links">
        {#each links as link (link.id)}
          <li>
            <span class="what">
              <strong>{ACCESS_LABELS[link.access]}</strong>
              {#if link.label}<em>{link.label}</em>{/if}
              {#if link.isCurrent}<em>the one you are using</em>{/if}
            </span>
            {#if link.isCurrent}
              <button type="button" class="tiny" onclick={() => (confirming = 'rotate')}>
                Replace
              </button>
            {:else}
              <button type="button" class="tiny" onclick={() => revoke(link)} disabled={busy}>
                Revoke
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <hr />

    <h3>If your own link ended up somewhere it shouldn't</h3>
    {#if confirming === 'rotate'}
      <p class="fine">
        Your link stops working immediately and you get a new one at the same level. Every other
        link on this list carries on, so replacing yours does not lock anyone else out.
      </p>
      <button type="button" class="primary" onclick={rotate} disabled={busy}>
        {busy ? 'Replacing…' : 'Replace my link'}
      </button>
      <button type="button" class="quiet" onclick={() => (confirming = null)}>Keep it</button>
    {:else}
      <p class="fine">
        Replace it and the old one stops working. Other people's links are untouched, and you revoke
        those one at a time above.
      </p>
      <button type="button" class="ghost" onclick={() => (confirming = 'rotate')}>
        Replace my link
      </button>
    {/if}
  {:else}
    <hr />
    <p class="fine">
      Only a link that can do everything may make or revoke links. Ask whoever set this list up.
    </p>
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

  h3.spaced {
    margin-top: 24px;
  }

  .count {
    font-weight: 400;
    color: var(--ink-muted);
  }

  .fine {
    margin-bottom: 12px;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }

  /* Full-width rows with the explanation attached, not a dropdown of one-word
     labels. Choosing what a link may do is the moment to say what that means. */
  .choices {
    display: grid;
    gap: 8px;
    margin-bottom: 14px;
  }

  .choice {
    display: block;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    box-shadow: inset 0 0 0 1px var(--line-strong);
    cursor: pointer;
  }

  .choice.picked {
    box-shadow: inset 0 0 0 2px var(--primary);
    background: var(--primary-quiet);
  }

  .choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .choice strong {
    display: block;
    font-weight: 600;
  }

  .choice em {
    display: block;
    margin-top: 2px;
    font-style: normal;
    font-size: 0.85rem;
    color: var(--ink-muted);
  }

  .choice:focus-within {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .label {
    width: 100%;
    margin-bottom: 12px;
    padding: 12px 16px;
    /* 16px minimum, or iOS zooms the page when this takes focus. */
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
  }

  .links {
    list-style: none;
    margin-bottom: 8px;
  }

  .links li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
  }

  .links li + li {
    border-top: 1px solid var(--line);
  }

  .what {
    flex: 1;
    min-width: 0;
  }

  .what strong {
    display: block;
    font-size: 0.92rem;
    font-weight: 500;
  }

  .what em {
    font-style: normal;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  .tiny {
    min-height: 40px;
    padding: 0 14px;
    flex: none;
    border: 0;
    background: none;
    box-shadow: inset 0 0 0 1px var(--line-strong);
    color: var(--ink);
    font-size: 0.85rem;
  }
</style>
