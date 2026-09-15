<script lang="ts">
  import { untrack } from 'svelte';
  import type { Access, ShareLink } from '@checkpost/contract';
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

  /**
   * Which link the QR, the address and the two buttons are showing.
   *
   * The choice comes first and everything below answers it, because "send them
   * a link that can only look" is the thing people came here to do and it used
   * to be four steps behind a button called "Make a link".
   */
  let picked = $state<'mine' | Access>('mine');

  /**
   * Links minted while this sheet has been open. A token comes back once and
   * only its hash is kept, so this is the entire window in which it exists:
   * closing the sheet is the end of it, which is what the copy says.
   */
  let minted = $state<Partial<Record<Access, string>>>({});

  let links = $state<ShareLink[]>([]);
  /**
   * Set when the list of links could not be fetched. Worth its own state rather
   * than a line in `status`: what is on screen when this happens is a list of
   * links that may already have been retired, and a sheet that says nothing
   * invites you to act on it.
   */
  let linksFailed = $state(false);
  let busy = $state(false);
  let confirming = $state<'rotate' | null>(null);

  const shown = $derived(picked === 'mine' ? mine : (minted[picked] ?? mine));
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const OFFER: Access[] = ['read', 'write', 'admin', 'copy'];

  /**
   * Short enough for a row of five, where the full labels are not. The sentence
   * under the row carries the meaning, for whichever one is picked.
   */
  const SHORT: Record<Access, string> = {
    read: 'Look only',
    write: 'Tick and add',
    admin: 'Everything',
    copy: 'Own copy',
  };

  const explains = $derived(
    picked === 'mine'
      ? `Your own link. Whoever has it can ${canAdmin ? 'do anything to' : 'use'} the list.`
      : ACCESS_BLURBS[picked],
  );

  $effect(() => {
    if (canAdmin) void refresh();
  });

  async function refresh() {
    try {
      links = await onlinks();
      linksFailed = false;
    } catch {
      // Not worth breaking the sheet over, but not worth hiding either: the
      // rows still on screen are now of unknown age, and one of them may be the
      // link that was just replaced.
      linksFailed = true;
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

  /**
   * Picks a level, minting the link the first time it is asked for and reusing
   * it after that, so looking through the row does not leave a trail of links.
   *
   * The label the API accepts is not asked for. It would be a text field
   * standing between the tap and the link, which is the step this removed.
   */
  async function pick(access: Access) {
    if (minted[access]) {
      picked = access;
      status = null;
      return;
    }
    busy = true;
    status = null;
    try {
      const made = await oncreate(access, '');
      minted = { ...minted, [access]: made.url };
      picked = access;
      status = 'Link made. It is shown while this sheet is open, and not again.';
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
      picked = 'mine';
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
      // A revoked link must not stay selected with its address still on screen.
      if (picked !== 'mine' && link.access === picked) picked = 'mine';
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
  {#if canAdmin}
    <!-- The choice is the first thing on the sheet, and the QR, the address and
         the two buttons below are all showing whichever one is picked. Sending
         a read link is two taps: the level, then Send. -->
    <p class="ask" id="share-what">Who is it for?</p>
    <div class="chips" role="group" aria-labelledby="share-what">
      <button
        type="button"
        class="chip"
        class:on={picked === 'mine'}
        aria-pressed={picked === 'mine'}
        onclick={() => ((picked = 'mine'), (status = null))}
      >
        Me
      </button>
      {#each OFFER as level (level)}
        <button
          type="button"
          class="chip"
          class:on={picked === level}
          aria-pressed={picked === level}
          disabled={busy}
          onclick={() => pick(level)}
        >
          {SHORT[level]}
        </button>
      {/each}
    </div>
  {/if}

  <p class="lede">{explains}</p>

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

  <p class="status" role="status">{status ?? ''}</p>

  {#if canAdmin}
    {#if links.length || linksFailed}
      <hr />
      <h3>
        Links that work right now
        {#if links.length}<span class="count">{links.length}</span>{/if}
      </h3>
      {#if linksFailed}
        <p class="fine">
          {links.length
            ? 'This could not be checked just now, so it may be out of date.'
            : 'The links on this list could not be loaded.'}
        </p>
        <button type="button" class="ghost" onclick={refresh} disabled={busy}>Try again</button>
      {/if}
      {#if links.length}
        <ul class="links">
          {#each links as link (link.id)}
            <li>
              <span class="what">
                <strong>{ACCESS_LABELS[link.access]}</strong>
                {#if link.isCurrent}<em>yours</em>{/if}
              </span>
              {#if !link.isCurrent}
                <button type="button" class="tiny" onclick={() => revoke(link)} disabled={busy}>
                  Revoke
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    <hr />
    <!-- Replacing acts on your own link, so it says so rather than sitting under
         a heading of its own with a second copy of the button in the list. -->
    {#if confirming === 'rotate'}
      <p class="fine">Yours stops working now and you get a new one. Everyone else's carries on.</p>
      <button type="button" class="primary" onclick={rotate} disabled={busy}>
        {busy ? 'Replacing…' : 'Replace my link'}
      </button>
      <button type="button" class="quiet" onclick={() => (confirming = null)}>Keep it</button>
    {:else}
      <button type="button" class="quiet" onclick={() => (confirming = 'rotate')}>
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
    margin-bottom: 16px;
    font-size: 0.92rem;
    color: var(--ink-muted);
    /* One sentence about the picked link. Long enough to matter, short enough
       that the QR under it is still the first thing the eye lands on. */
    min-height: 2.6em;
  }

  .qr {
    display: grid;
    place-items: center;
    /* Big enough to scan across a table, small enough that the four things you
       can make are on the same screen. Full width put "make a link for someone
       else" below the fold, which is most of why nobody found it. */
    width: min(11rem, 58%);
    margin: 0 auto;
    padding: 12px;
    background: var(--primary-quiet);
    border-radius: var(--radius-lg);
  }

  code {
    display: block;
    margin-top: 16px;
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

  .count {
    font-weight: 400;
    color: var(--ink-muted);
  }

  .fine {
    margin-bottom: 12px;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }

  /* Five plain choices in one wrapping row, all of them on screen at once.
     They used to be four full-width rows behind a button behind a heading, so
     the ordinary act — hand someone a link that can only look — was invisible
     until you went looking for it. */
  .ask {
    margin-bottom: 8px;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .chip {
    min-height: 40px;
    padding: 0 14px;
    flex: 0 1 auto;
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    box-shadow: inset 0 0 0 1px var(--line-strong);
    color: var(--ink-muted);
    font-size: 0.9rem;
    font-weight: 500;
    transition:
      background var(--fast) var(--ease),
      box-shadow var(--fast) var(--ease),
      color var(--fast) var(--ease);
  }

  .chip:hover:not(:disabled):not(.on) {
    background: var(--surface);
    color: var(--ink);
  }

  /* Never the ring alone: the picked one is also the only one at full ink and
     full weight, so it still reads as picked without seeing the colour. */
  .chip.on {
    background: var(--primary-quiet);
    box-shadow: inset 0 0 0 2px var(--primary);
    color: var(--ink);
    font-weight: 700;
  }

  .chip:disabled {
    opacity: 0.5;
  }

  .chip:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
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
    font-size: 0.92rem;
    font-weight: 500;
  }

  /* Inline, so "yours" sits beside the level rather than turning one row in the
     list into a two-line row that reads as a different kind of thing. */
  .what em {
    margin-left: 6px;
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
