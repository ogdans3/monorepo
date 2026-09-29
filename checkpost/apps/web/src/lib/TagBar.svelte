<script lang="ts">
  import type { Tag } from '@checkpost/contract';
  import TagToggle from './TagToggle.svelte';

  let {
    tags,
    filter,
    byTag,
    canWrite,
    onfilter,
    onclear,
    onsort,
    onedit,
  }: {
    /** Already in display order. */
    tags: Tag[];
    filter: string[];
    byTag: boolean;
    canWrite: boolean;
    onfilter: (tagId: string) => void;
    onclear: () => void;
    onsort: (byTag: boolean) => void;
    onedit: () => void;
  } = $props();

  /**
   * Turning the first filter on puts Clear in front of the chips, which pushed
   * the chip just tapped off the right edge of a phone: the tap worked and the
   * thing tapped disappeared. So the chip is brought back into view.
   */
  function pick(event: MouseEvent, tagId: string) {
    const chip = event.currentTarget as HTMLElement;
    onfilter(tagId);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() =>
      chip.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: still ? 'auto' : 'smooth' }),
    );
  }
</script>

<!--
  One row that scrolls sideways, not two that stack. Every line this takes is
  a line the list does not get, on a screen that is mostly list. It is only
  drawn once the list has a tag, so an untagged list looks exactly as it did.
-->
<nav class="bar" aria-label="Sort and filter by tag">
  <div class="sort" role="group" aria-label="Order the rows by">
    <button type="button" aria-pressed={!byTag} onclick={() => onsort(false)}>Your order</button>
    <button type="button" aria-pressed={byTag} onclick={() => onsort(true)}>By tag</button>
  </div>

  {#if filter.length}
    <button type="button" class="clear" onclick={onclear} aria-label="Clear the tag filter">
      Clear
    </button>
  {/if}

  <div class="tags" role="group" aria-label="Show rows tagged">
    {#each tags as tag (tag.id)}
      <TagToggle {tag} on={filter.includes(tag.id)} onclick={(event) => pick(event, tag.id)} />
    {/each}
  </div>

  {#if canWrite}
    <button type="button" class="edit" onclick={onedit}>Edit tags</button>
  {/if}
</nav>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 0 16px;
    overflow-x: auto;
    /* The row scrolls; the page and the list under it do not. */
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    border-bottom: 1px solid var(--line);
    background: var(--bg);
  }

  .bar::-webkit-scrollbar {
    display: none;
  }

  .tags {
    display: flex;
    gap: 8px;
  }

  /* The same control as the order on Your lists, a size down to share a row. */
  .sort {
    display: inline-flex;
    flex: none;
    gap: 2px;
    padding: 3px;
    background: var(--surface);
    border-radius: var(--radius-md);
  }

  .sort button {
    min-height: 36px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
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

  /* As on Your lists: selected is a step up from what it sits on, whichever way
     the scheme runs. */
  @media (prefers-color-scheme: dark) {
    .sort button[aria-pressed='true'] {
      background: var(--surface-hover);
      box-shadow: none;
    }
  }

  .clear,
  .edit {
    flex: none;
    min-height: 40px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .clear {
    color: var(--primary);
  }

  .edit {
    color: var(--ink-muted);
  }
</style>
