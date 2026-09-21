<script lang="ts">
  import { goto } from '$app/navigation';
  import Sheet from '$lib/Sheet.svelte';
  import { api } from '$lib/api';
  import { library, type SavedList } from '$lib/library.svelte';
  import { ago } from '$lib/time';

  let creating = $state(false);
  let failed = $state<string | null>(null);
  let forgetting = $state<SavedList | null>(null);
  let forgettingAll = $state(false);

  async function newList() {
    if (creating) return;
    creating = true;
    failed = null;
    try {
      const created = await api.createList('Untitled list');
      // Filed away by the list page itself, the moment it has the snapshot.
      await goto(`/l/${created.token}`);
    } catch (error) {
      failed = error instanceof Error ? error.message : 'Could not make a list. Try again.';
      creating = false;
    }
  }

  /** What the list looked like when this browser last saw it. */
  function progress(list: SavedList): string {
    if (list.total === 0) return 'Empty';
    if (list.done >= list.total) return `All ${list.total} done`;
    return `${list.done} of ${list.total} done`;
  }

  function why(gone: NonNullable<SavedList['gone']>): string {
    if (gone === 'deleted') return 'Deleted';
    if (gone === 'rotated') return 'Link replaced';
    return 'Link does not work';
  }

  /**
   * The stamp the page is ordered by, so the order is legible in the rows
   * themselves rather than only in the control at the top.
   */
  function when(list: SavedList): string {
    return library.sort === 'added'
      ? `added ${ago(list.addedAt)}`
      : `opened ${ago(list.openedAt)}`;
  }
</script>

<svelte:head>
  <title>Your lists · Checkpost</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<header class="bar">
  <div class="inner">
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

    <button type="button" class="new" onclick={newList} disabled={creating}>
      {creating ? 'Making it…' : 'New list'}
    </button>
  </div>
</header>

<main>
  <div class="head">
    <h1>Your lists</h1>

    {#if library.lists.length > 1}
      <div class="sort" role="group" aria-label="Order the lists by">
        <button
          type="button"
          aria-pressed={library.sort === 'opened'}
          onclick={() => library.setSort('opened')}>Last opened</button
        >
        <button
          type="button"
          aria-pressed={library.sort === 'added'}
          onclick={() => library.setSort('added')}>Added</button
        >
      </div>
    {/if}
  </div>

  {#if failed}
    <p class="toast" role="status">{failed}</p>
  {/if}

  {#if !library.loaded}
    <ul class="skeleton" aria-hidden="true">
      {#each [58, 41, 66] as width (width)}
        <li><span class="bar-line" style:width="{width}%"></span><span class="bar-line thin"></span></li>
      {/each}
    </ul>
  {:else if library.lists.length === 0}
    <div class="empty">
      <h2>No lists yet</h2>
      <p>
        A list is a link. Make one, send the link to whoever needs it, and you are both on the same
        list. Every list you open in this browser turns up here.
      </p>
      <button type="button" class="new wide" onclick={newList} disabled={creating}>
        {creating ? 'Making it…' : 'Make a list'}
      </button>
    </div>
  {:else}
    {#if library.favourites.length > 0}
      <h2 class="group">Favourites</h2>
      <ul>
        {#each library.favourites as list (list.id)}
          {@render row(list)}
        {/each}
      </ul>
    {/if}

    {#if library.rest.length > 0}
      {#if library.favourites.length > 0}
        <h2 class="group">Everything else</h2>
      {/if}
      <ul>
        {#each library.rest as list (list.id)}
          {@render row(list)}
        {/each}
      </ul>
    {/if}

    <p class="fine">
      Kept in this browser. This page is the only record that these links exist, so clearing your
      site data loses them, and anyone else using this browser can open them.
      <button type="button" class="link" onclick={() => (forgettingAll = true)}>Forget all</button>
    </p>
  {/if}
</main>

{#snippet row(list: SavedList)}
  <li class="row" class:gone={list.gone !== null}>
    <a class="open" href="/l/{list.token}">
      <span class="name">{list.title}</span>
      <span class="meta">
        <span class="what">{list.gone ? why(list.gone) : progress(list)}</span>
        <span class="dot" aria-hidden="true">·</span>
        <span class="when">{when(list)}</span>
      </span>
    </a>

    <button
      type="button"
      class="star"
      aria-pressed={list.favourite}
      aria-label="{list.favourite ? 'Remove' : 'Add'} {list.title} {list.favourite
        ? 'from'
        : 'to'} favourites"
      onclick={() => library.setFavourite(list.id, !list.favourite)}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"
          fill={list.favourite ? 'currentColor' : 'none'}
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <button
      type="button"
      class="forget"
      aria-label="Forget {list.title}"
      onclick={() => (forgetting = list)}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M6 6l12 12M18 6L6 18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </li>
{/snippet}

{#if forgetting}
  {@const list = forgetting}
  <Sheet title="Forget “{list.title}”?" onclose={() => (forgetting = null)}>
    <p class="fine">
      The list itself is untouched, and anyone else holding the link still has it. This browser
      forgets the link, and unless you have it saved somewhere else you will not get back in.
    </p>
    <button
      type="button"
      class="wide"
      onclick={() => {
        library.forget(list.id);
        forgetting = null;
      }}>Forget it</button
    >
    <button type="button" class="wide quiet" onclick={() => (forgetting = null)}>Keep it</button>
  </Sheet>
{/if}

{#if forgettingAll}
  <Sheet title="Forget all {library.lists.length} lists?" onclose={() => (forgettingAll = false)}>
    <p class="fine">
      Every link on this page goes, in this browser only. The lists themselves are untouched, and
      anyone else holding a link still has it. There is no undo.
    </p>
    <button
      type="button"
      class="wide"
      onclick={() => {
        library.forgetAll();
        forgettingAll = false;
      }}>Forget them all</button
    >
    <button type="button" class="wide quiet" onclick={() => (forgettingAll = false)}>Keep them</button
    >
  </Sheet>
{/if}

<style>
  .bar {
    padding: 18px clamp(20px, 5vw, 56px);
  }

  /* The bar shares the content column. A wordmark at the far left of the
     viewport and a heading 200px further in read as two different pages. */
  .inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    max-width: 44rem;
    margin: 0 auto;
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
    max-width: 44rem;
    margin: 0 auto;
    padding: 8px clamp(20px, 5vw, 56px) 96px;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }

  h1 {
    font-size: 1.75rem;
    letter-spacing: -0.03em;
  }

  /* A segmented control, not a select: there are two answers and both fit. */
  .sort {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--surface);
    border-radius: var(--radius-md);
  }

  .sort button {
    min-height: 42px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background var(--fast) var(--ease),
      color var(--fast) var(--ease);
  }

  .sort button[aria-pressed='true'] {
    background: var(--bg);
    color: var(--ink);
    box-shadow: 0 1px 2px oklch(0.2 0.01 350 / 0.08);
  }

  /* In the dark scheme the page background is the darkest surface there is, so
     a pill painted with it reads as a hole punched in the track rather than as
     the one that is on. Whichever way the scheme runs, selected is a step up
     from what it sits on. */
  @media (prefers-color-scheme: dark) {
    .sort button[aria-pressed='true'] {
      background: var(--surface-hover);
      box-shadow: none;
    }
  }

  .group {
    margin: 28px 0 6px;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--ink-muted);
  }

  .group:first-of-type {
    margin-top: 4px;
  }

  ul {
    list-style: none;
  }

  /* Rows on the page background, hairline-separated. Cards are not the answer
     here any more than they are inside a list. */
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
  }

  .row + .row {
    border-top: 1px solid var(--line);
  }

  .open {
    display: grid;
    gap: 4px;
    min-height: 72px;
    padding: 12px 8px 12px 0;
    align-content: center;
    text-decoration: none;
    color: inherit;
  }

  .name {
    font-size: 1rem;
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  /* Two facts and a separator. There was a progress meter here, drawn the way
     the app's home screen draws one, and on a phone it pushed the timestamp
     into an ellipsis to say what the words next to it already said. */
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 6px;
    font-size: 0.8125rem;
    color: var(--ink-muted);
  }

  .dot {
    color: var(--ink-faint);
  }

  .row.gone .name {
    color: var(--ink-muted);
  }

  .row.gone .name {
    text-decoration: line-through;
    text-decoration-color: var(--ink-faint);
  }

  .star,
  .forget {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink-faint);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      color var(--fast) var(--ease),
      background var(--fast) var(--ease);
  }

  .star:hover,
  .forget:hover {
    background: var(--surface-hover);
    color: var(--ink-muted);
  }

  /* Filled versus outline carries this, not colour: the accent is
     confirmation of a shape change, never the only signal. */
  .star[aria-pressed='true'] {
    color: var(--primary);
  }

  .star[aria-pressed='true'] svg {
    animation: mark var(--fast) var(--ease);
  }

  @keyframes mark {
    from {
      transform: scale(0.82);
    }
  }

  .new {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--fast) var(--ease);
  }

  .new:hover {
    background: var(--primary-hover);
  }

  .new:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .new.wide {
    width: 100%;
    max-width: 17rem;
    min-height: 52px;
    margin-top: 20px;
  }

  .empty {
    padding: 40px 0 0;
    max-width: 38ch;
  }

  .empty h2 {
    font-size: 1.15rem;
    letter-spacing: -0.02em;
  }

  .empty p {
    margin-top: 8px;
    color: var(--ink-muted);
  }

  .fine {
    margin-top: 32px;
    max-width: 62ch;
    color: var(--ink-muted);
    font-size: 0.8125rem;
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--primary);
    font: inherit;
    font-size: inherit;
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .toast {
    margin-bottom: 16px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
    font-size: 0.9rem;
  }

  /* Three rows at the real height, so the page does not jump when they land. */
  .skeleton {
    list-style: none;
  }

  .skeleton li {
    display: grid;
    gap: 8px;
    align-content: center;
    min-height: 72px;
    padding: 12px 0;
  }

  .skeleton li + li {
    border-top: 1px solid var(--line);
  }

  .bar-line {
    display: block;
    height: 12px;
    border-radius: 6px;
    background: var(--surface-hover);
  }

  .bar-line.thin {
    width: 30%;
    height: 9px;
  }

  /* The sheets' own buttons, matching the list screen's confirm sheets. */
  .wide {
    display: block;
    width: 100%;
    min-height: 52px;
    margin-top: 12px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .wide.quiet {
    background: none;
    color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--line-strong);
  }
</style>
