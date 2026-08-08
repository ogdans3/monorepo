<script lang="ts">
  import type { Item } from '@checkpost/contract';
  import { LIMITS } from '@checkpost/contract';
  import ItemRow from '$lib/ItemRow.svelte';
  import ItemSheet from '$lib/ItemSheet.svelte';
  import ShareSheet from '$lib/ShareSheet.svelte';
  import Sheet from '$lib/Sheet.svelte';
  import { ListSession } from '$lib/list-session.svelte';
  import { trackKeyboard } from '$lib/keyboard';
  import { untrack } from 'svelte';
  import { goto } from '$app/navigation';
  import { ACCESS_LABELS } from '@checkpost/contract';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  /**
   * One session per token, rebuilt when the address bar moves to a different
   * list. SvelteKit reuses this component when only the route parameter
   * changes, so creating the session once meant that taking a copy navigated to
   * the new list and then went on showing the old one.
   */
  let session = $state(new ListSession(untrack(() => data.token)));

  let draft = $state('');
  let composer = $state<HTMLTextAreaElement | null>(null);
  let scroller = $state<HTMLElement | null>(null);
  let openItem = $state<Item | null>(null);
  let sharing = $state(false);
  let menu = $state(false);
  let renaming = $state(false);
  let titleDraft = $state('');
  let confirmingClear = $state(false);
  let confirmingDelete = $state(false);
  let copying = $state(false);
  let copyFailed = $state<string | null>(null);

  $effect(() => {
    // Reruns when the token changes, and the cleanup stops the session it
    // replaces. Everything below reads the local `current`, never the state
    // variable, so the teardown can never stop the wrong one.
    const current = untrack(() => session).token === data.token
      ? untrack(() => session)
      : (session = new ListSession(data.token));
    void current.open();
    const stopTrackingKeyboard = trackKeyboard();
    return () => {
      current.stop();
      stopTrackingKeyboard();
    };
  });

  const shareUrl = $derived(
    session.token === data.token ? data.shareUrl : `${location.origin}/l/${session.token}`,
  );

  async function submit(event?: Event) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    draft = '';
    // Straight back to an empty field, still focused. Type, enter, type.
    composer?.focus();
    await session.add(text);
    requestAnimationFrame(() => scroller?.scrollTo({ top: scroller.scrollHeight }));
  }

  function keydown(event: KeyboardEvent) {
    // Enter submits, shift-enter is a newline, which is what a hardware
    // keyboard expects and costs a touch keyboard nothing.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  $effect(() => {
    // A new list means none of the previous list's sheets or drafts apply.
    void data.token;
    draft = '';
    openItem = null;
    sharing = false;
    menu = false;
    renaming = false;
    confirmingClear = false;
    confirmingDelete = false;
    copying = false;
    copyFailed = null;
  });

  function startRename() {
    titleDraft = session.list?.title ?? '';
    menu = false;
    renaming = true;
  }
</script>

<svelte:head>
  <title>{session.list?.title ?? 'Checkpost'}</title>
  <!-- A share link in a search index is a leaked list. -->
  <meta name="robots" content="noindex, nofollow, noarchive" />
  <meta name="referrer" content="no-referrer" />
</svelte:head>

{#if session.status === 'copy'}
  <main class="dead">
    <h1>Take your own copy</h1>
    <p>
      This link hands you a private copy of <strong>{session.copy?.title}</strong>, all
      {session.copy?.itemCount} of it, with nothing ticked off. It is yours alone. Whoever sent it
      never sees your copy, and you never see theirs.
    </p>
    <button
      type="button"
      class="cta"
      disabled={copying}
      onclick={async () => {
        copying = true;
        copyFailed = null;
        try {
          await goto(await session.takeCopy());
        } catch (error) {
          copyFailed = error instanceof Error ? error.message : 'Could not make your copy.';
          copying = false;
        }
      }}
    >
      {copying ? 'Making your copy…' : 'Make my copy'}
    </button>
    <p class="fine" role="status">{copyFailed ?? ''}</p>
  </main>
{:else if session.status === 'gone' || session.status === 'invalid'}
  <main class="dead">
    <h1>
      {session.status === 'invalid'
        ? "That link isn't valid"
        : session.goneReason === 'deleted'
          ? 'This list was deleted'
          : 'This link was replaced'}
    </h1>
    <p>
      {session.status === 'invalid'
        ? 'Check that you copied the whole thing, or ask for the link again.'
        : session.goneReason === 'deleted'
          ? 'Someone on the list deleted it. There is nothing left to open.'
          : 'Someone replaced the share link. Ask them for the new one and open it. You will be back on the list straight away.'}
    </p>
    <a href="/">Back to Checkpost</a>
  </main>
{:else}
  <div class="app">
    <header>
      <button
        type="button"
        class="title"
        onclick={startRename}
        disabled={!session.list || !session.canWrite}
      >
        <h1>{session.list?.title ?? ' '}</h1>
      </button>

      {#if session.list && !session.canWrite}
        <span class="badge">Read only</span>
      {/if}

      {#if session.presence > 1}
        <span class="presence" aria-label="{session.presence} people on this list">
          <span class="dot" aria-hidden="true"></span>
          {session.presence}
        </span>
      {/if}

      <button
        type="button"
        class="icon"
        onclick={() => (sharing = true)}
        aria-label="Share this list"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
          <path
            d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10-2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm-2 2h2v2h-2v-2zm4 0h2v2h-2v-2z"
          />
        </svg>
      </button>

      <button type="button" class="icon" onclick={() => (menu = true)} aria-label="More">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle
            cx="12"
            cy="19"
            r="1.8"
          />
        </svg>
      </button>
    </header>

    {#if session.status === 'offline'}
      <p class="banner">Offline. Your changes are saved here and will sync when you're back.</p>
    {/if}

    <main bind:this={scroller}>
      {#if session.status === 'loading'}
        <ul class="skeleton" aria-hidden="true">
          {#each [62, 44, 71] as width (width)}
            <li><span class="box"></span><span class="bar" style:width="{width}%"></span></li>
          {/each}
        </ul>
      {:else if !session.items.length}
        <div class="empty">
          <h2>Nothing on the list yet</h2>
          <p>
            {#if session.canWrite}
              Type below and press enter. Keep going, the field stays put so you can add several
              without stopping.
            {:else}
              Whoever it belongs to has not put anything on it. This link can only look.
            {/if}
          </p>
        </div>
      {:else}
        <ul class="rows">
          {#each session.openItems as item (item.id)}
            <ItemRow
              {item}
              washing={session.isWashing(item.id)}
              readonly={!session.canWrite}
              onToggle={() => session.toggle(item)}
              onOpen={() => (openItem = item)}
            />
          {/each}
        </ul>

        {#if session.doneItems.length}
          <div class="shelf">
            <span>Done · {session.doneItems.length}</span>
            {#if session.canWrite}
              <button type="button" onclick={() => (confirmingClear = true)}>Clear</button>
            {/if}
          </div>
          <ul class="rows">
            {#each session.doneItems as item (item.id)}
              <ItemRow
                {item}
                washing={session.isWashing(item.id)}
                readonly={!session.canWrite}
                onToggle={() => session.toggle(item)}
                onOpen={() => (openItem = item)}
              />
            {/each}
          </ul>
        {/if}
      {/if}
    </main>

    {#if session.canWrite}
      <form class="composer" onsubmit={submit}>
        <!-- Disabled until the list is here. `add` needs the list id, so typing
           before the snapshot arrived used to be swallowed in silence, which on
           a slow connection is exactly when someone starts typing. -->
      <textarea
        bind:this={composer}
        bind:value={draft}
        onkeydown={keydown}
        disabled={!session.list}
        rows="1"
        maxlength={LIMITS.itemText}
        placeholder={session.list ? 'Add something' : 'Loading…'}
        enterkeyhint="done"
        aria-label="Add an item"
      ></textarea>
      <button type="submit" disabled={!draft.trim() || !session.list} aria-label="Add item">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M12 19V5M5 12l7-7 7 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        </button>
      </form>
    {:else if session.list}
      <p class="composer readonly">
        This link can look at the list, and cannot change it.
      </p>
    {/if}
  </div>
{/if}

{#if session.message}
  <p class="toast" role="status">
    {session.message}
    <button type="button" onclick={() => (session.message = null)} aria-label="Dismiss">×</button>
  </p>
{/if}

{#if openItem}
  {@const item = openItem}
  <ItemSheet
    {item}
    onclose={() => (openItem = null)}
    onsave={(patch) => session.edit(item, patch)}
    onremove={() => session.remove(item)}
  />
{/if}

{#if sharing}
  <ShareSheet
    url={shareUrl}
    title={session.list?.title ?? 'Checkpost list'}
    canAdmin={session.canAdmin}
    onclose={() => (sharing = false)}
    onrotate={() => session.rotate()}
    onlinks={() => session.links()}
    oncreate={(access, label) => session.createLink(access, label)}
    onrevoke={(linkId) => session.revokeLink(linkId)}
  />
{/if}

{#if renaming}
  <Sheet title="Rename list" onclose={() => (renaming = false)}>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="rename"
      bind:value={titleDraft}
      maxlength={LIMITS.listTitle}
      autofocus
      onkeydown={(event) => {
        if (event.key === 'Enter') {
          session.rename(titleDraft);
          renaming = false;
        }
      }}
    />
    <button
      type="button"
      class="wide"
      onclick={() => {
        session.rename(titleDraft);
        renaming = false;
      }}>Save name</button
    >
  </Sheet>
{/if}

{#if menu}
  <Sheet title="This list" onclose={() => (menu = false)}>
    <ul class="menu">
      {#if session.canWrite}
        <li><button type="button" onclick={startRename}>Rename list</button></li>
        <li>
          <button
            type="button"
            disabled={!session.doneCount}
            onclick={() => {
              menu = false;
              confirmingClear = true;
            }}>Clear done items</button
          >
        </li>
      {/if}
      <li><a href={data.deepLink} rel="external">Open in the app</a></li>
      {#if session.canAdmin}
        <li>
          <button
            type="button"
            onclick={() => {
              menu = false;
              confirmingDelete = true;
            }}>Delete list for everyone</button
          >
        </li>
      {/if}
      {#if !session.canWrite}
        <li class="note">This link can look at the list, and cannot change it.</li>
      {/if}
    </ul>
  </Sheet>
{/if}

{#if confirmingClear}
  <Sheet title="Clear {session.doneCount} done" onclose={() => (confirmingClear = false)}>
    <p class="fine">They are removed for everyone on the list, straight away. There is no undo.</p>
    <button
      type="button"
      class="wide"
      onclick={() => {
        session.clearChecked();
        confirmingClear = false;
      }}>Clear them</button
    >
    <button type="button" class="wide quiet" onclick={() => (confirmingClear = false)}>Keep them</button>
  </Sheet>
{/if}

{#if confirmingDelete}
  <Sheet title="Delete this list?" onclose={() => (confirmingDelete = false)}>
    <p class="fine">
      The list and everything on it is gone for everyone, immediately. The link stops working.
      There is no undo.
    </p>
    <button
      type="button"
      class="wide"
      onclick={() => {
        session.deleteList();
        confirmingDelete = false;
      }}>Delete the list</button
    >
    <button type="button" class="wide quiet" onclick={() => (confirmingDelete = false)}>Keep it</button>
  </Sheet>
{/if}

<style>
  /* A fixed app shell. The page itself never scrolls, only the list does, which
     is what stops iOS from rubber-banding the composer off the screen. */
  .app {
    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    background: var(--bg);
  }

  /* Grid, not flex. A <button> refuses to shrink below its content inside a
     flex row in WebKit, so a long list name pushed the share and menu buttons
     clean off the right of the screen. `minmax(0, 1fr)` on the first column is
     the reliable way to say "this one gives". */
  header {
    display: grid;
    grid-auto-flow: column;
    grid-template-columns: minmax(0, 1fr);
    grid-auto-columns: auto;
    align-items: center;
    gap: 4px;
    padding: 4px 4px 4px 16px;
    padding-top: calc(4px + env(safe-area-inset-top, 0px));
    border-bottom: 1px solid var(--line);
  }

  .title {
    min-width: 0;
    width: 100%;
    overflow: hidden;
    padding: 10px 4px;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  h1 {
    width: 100%;
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .presence {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--primary);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .banner {
    padding: 8px 20px;
    background: var(--surface);
    color: var(--ink-muted);
    font-size: 0.85rem;
  }

  main {
    overflow-y: auto;
    /* Keeps a bounce inside the list rather than dragging the whole page. */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .rows {
    list-style: none;
  }

  /* The separator belongs to the list, not to a row, so it stays put while a
     row slides under the finger. Rows are a child component, hence :global. */
  .rows :global(li + li) {
    border-top: 1px solid var(--line);
  }

  .shelf {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
    padding: 8px 8px 8px 20px;
    background: var(--surface);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--ink-muted);
  }

  .shelf span {
    flex: 1;
  }

  .shelf button {
    min-height: 40px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    color: var(--ink-muted);
    cursor: pointer;
  }

  .composer {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 8px 8px 16px;
    border-top: 1px solid var(--line);
    background: var(--bg);
    box-shadow: 0 -2px 12px oklch(0.2 0.01 350 / 0.06);
    /* Clears the home indicator, and rides above the on-screen keyboard. */
    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px) + var(--keyboard, 0px));
  }

  .composer textarea {
    flex: 1;
    /* 16px minimum, or iOS zooms the page the moment this takes focus. */
    font: inherit;
    font-size: 16px;
    line-height: 1.45;
    color: var(--ink);
    background: none;
    border: 0;
    padding: 13px 0;
    resize: none;
    field-sizing: content;
    max-height: 7rem;
  }

  .composer textarea::placeholder {
    color: var(--ink-muted);
  }

  .composer textarea:focus-visible {
    outline: none;
  }

  .composer button {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    flex: none;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: var(--on-primary);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--fast) var(--ease);
  }

  /* A full-strength shape at low contrast, not a washed-out accent. Heavy
     colour on an inactive control is a lie about what it will do. */
  .composer button:disabled {
    background: var(--surface);
    color: var(--ink-faint);
    cursor: default;
  }

  .skeleton {
    list-style: none;
  }

  .skeleton li {
    display: flex;
    align-items: center;
    gap: 13px;
    height: 56px;
    padding: 0 20px;
  }

  .skeleton .box {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    background: var(--surface-hover);
    flex: none;
  }

  .skeleton .bar {
    height: 12px;
    border-radius: 6px;
    background: var(--surface-hover);
  }

  .empty {
    padding: 56px 32px;
  }

  .empty h2 {
    font-size: 1.2rem;
    font-weight: 600;
  }

  .empty p {
    margin-top: 8px;
    max-width: 34ch;
    color: var(--ink-muted);
  }

  .badge {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--surface);
    color: var(--ink-muted);
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .composer.readonly {
    display: block;
    padding: 16px 20px;
    color: var(--ink-muted);
    font-size: 0.88rem;
  }

  .menu .note {
    padding: 12px 4px;
    color: var(--ink-muted);
    font-size: 0.88rem;
  }

  .cta {
    min-height: 52px;
    margin-top: 8px;
    padding: 0 24px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .cta:disabled {
    opacity: 0.7;
  }

  .dead .fine {
    min-height: 1.3em;
    font-size: 0.88rem;
    color: var(--ink-muted);
  }

  .dead {
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 12px;
    min-height: 100dvh;
    max-width: 30rem;
    margin: 0 auto;
    padding: 40px 20px;
  }

  .dead h1 {
    font-size: clamp(1.8rem, 6vw, 2.3rem);
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .dead p {
    color: var(--ink-muted);
  }

  .dead a {
    margin-top: 8px;
    font-weight: 600;
    color: var(--primary);
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(84px + env(safe-area-inset-bottom, 0px) + var(--keyboard, 0px));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    width: min(calc(100% - 32px), 28rem);
    padding: 12px 8px 12px 16px;
    border-radius: var(--radius-md);
    background: var(--ink);
    color: var(--bg);
    font-size: 0.9rem;
    z-index: var(--z-overlay);
  }

  .toast button {
    width: 32px;
    height: 32px;
    flex: none;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .menu {
    list-style: none;
  }

  .menu button,
  .menu a {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 52px;
    padding: 0 4px;
    border: 0;
    background: none;
    font: inherit;
    color: var(--ink);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .menu button:disabled {
    color: var(--ink-faint);
    cursor: default;
  }

  .menu li + li {
    border-top: 1px solid var(--line);
  }

  .rename {
    width: 100%;
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 12px 16px;
  }

  .wide {
    display: block;
    width: 100%;
    min-height: 48px;
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
    color: var(--ink-muted);
  }

  .fine {
    color: var(--ink-muted);
  }
</style>
