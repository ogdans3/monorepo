<script lang="ts">
  import { untrack } from 'svelte';
  import type { Item, Tag } from '@checkpost/contract';
  import { LIMITS, tagKey } from '@checkpost/contract';
  import Sheet from './Sheet.svelte';
  import TagToggle from './TagToggle.svelte';

  let {
    item,
    tags = [],
    tagIds = [],
    onclose,
    onsave,
    onremove,
    onmove,
    ontoggletag,
    onaddtag,
    onedittags,
    canMoveUp = false,
    canMoveDown = false,
  }: {
    item: Item;
    /** Every tag on the list, in display order. */
    tags?: Tag[];
    /**
     * The row's tags as they are now, not as they were when the sheet opened.
     * Unlike the text fields, a tag lands at a tap, so what the chips show has
     * to be the row's own state, including a change from somebody else.
     */
    tagIds?: string[];
    onclose: () => void;
    onsave: (patch: { text?: string; note?: string }) => void;
    onremove: () => void;
    /** Step the item one place. Absent on a checked item and on a read link. */
    onmove?: (direction: -1 | 1) => void;
    ontoggletag: (tagId: string) => void;
    onaddtag: (name: string) => void;
    onedittags: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
  } = $props();

  let newTag = $state('');
  const full = $derived(tags.length >= LIMITS.tagsPerList);
  const atLimit = $derived(tagIds.length >= LIMITS.tagsPerItem);
  /** The tag the list already has by the name being typed, if it has one. */
  const known = $derived(
    newTag.trim() ? (tags.find((tag) => tagKey(tag.name) === tagKey(newTag)) ?? null) : null,
  );
  const addable = $derived(
    Boolean(newTag.trim()) && !atLimit && (known ? !tagIds.includes(known.id) : !full),
  );

  function addTag(event: Event) {
    event.preventDefault();
    if (!addable) return;
    onaddtag(newTag);
    // Straight back to an empty field, like the composer, so three tags are
    // three names and three presses of enter.
    newTag = '';
  }

  // Deliberately the value as it was when the sheet opened. The sheet is
  // recreated on each open, and live-updating a field somebody is typing in
  // because a remote change arrived would be hostile.
  let text = $state(untrack(() => item.text));
  let note = $state(untrack(() => item.note));
  let confirming = $state(false);

  function save() {
    const trimmed = text.trim();
    const patch = {
      ...(trimmed && trimmed !== item.text ? { text: trimmed } : {}),
      ...(note !== item.note ? { note } : {}),
    };
    // A sheet opened to tag a row has nothing left to save by the time Save
    // is pressed: the tags landed at their taps.
    if (Object.keys(patch).length > 0) onsave(patch);
    onclose();
  }
</script>

<Sheet title="Item" {onclose}>
  {#snippet action()}
    <button type="button" class="save" onclick={save}>Save</button>
  {/snippet}

  <label class="field">
    <span>Item</span>
    <textarea bind:value={text} rows="1" maxlength={LIMITS.itemText} placeholder="What is it?"
    ></textarea>
  </label>

  <label class="field">
    <span>Note</span>
    <textarea
      bind:value={note}
      rows="3"
      maxlength={LIMITS.itemNote}
      placeholder="Anything worth remembering. Size, aisle, who is bringing it"
    ></textarea>
  </label>

  <div class="tags" role="group" aria-labelledby="tags-label">
    <span class="label" id="tags-label">Tags</span>
    {#if tags.length}
      <div class="chips">
        {#each tags as tag (tag.id)}
          {@const on = tagIds.includes(tag.id)}
          <TagToggle {tag} {on} disabled={!on && atLimit} onclick={() => ontoggletag(tag.id)} />
        {/each}
      </div>
    {:else}
      <p class="hint">Tags group the list and filter it, for everyone on it.</p>
    {/if}

    <form class="add" onsubmit={addTag}>
      <input
        bind:value={newTag}
        maxlength={LIMITS.tagName}
        placeholder="Add a tag"
        aria-label="Add a tag"
        enterkeyhint="done"
        autocomplete="off"
        disabled={atLimit}
      />
      <button type="submit" disabled={!addable}>Add</button>
    </form>
    {#if atLimit}
      <p class="hint">A row holds {LIMITS.tagsPerItem} tags.</p>
    {:else if full && newTag.trim() && !known}
      <p class="hint">
        This list holds {LIMITS.tagsPerList} tags. Delete one in Edit tags to make room.
      </p>
    {/if}
    {#if tags.length}
      <button type="button" class="link" onclick={onedittags}>Edit tags</button>
    {/if}
  </div>

  <!--
    The same job as the drag handle, without the drag. The handle is a
    shortcut, not the only way in, which is what the design contract means by
    no gesture-only affordance. It is also the only way to move something a
    long way in a list that does not fit on one screen.
  -->
  {#if onmove}
    <div class="move" role="group" aria-label="Position in the list">
      <span>Position</span>
      <button type="button" class="quiet" disabled={!canMoveUp} onclick={() => onmove(-1)}>
        Move up
      </button>
      <button type="button" class="quiet" disabled={!canMoveDown} onclick={() => onmove(1)}>
        Move down
      </button>
    </div>
  {/if}

  {#if confirming}
    <div class="confirm">
      <p>
        It disappears for everyone on the list, straight away. There is no undo.
      </p>
      <button type="button" class="danger" onclick={() => { onremove(); onclose(); }}>
        Remove it
      </button>
      <button type="button" class="quiet" onclick={() => (confirming = false)}>Keep it</button>
    </div>
  {:else}
    <button type="button" class="quiet remove" onclick={() => (confirming = true)}>
      Remove from list
    </button>
  {/if}
</Sheet>

<style>
  .move {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .move > span {
    flex: 1;
    font-size: 0.875rem;
    color: var(--ink-muted);
  }

  .move button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .save {
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--primary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .field {
    display: grid;
    gap: 6px;
    margin-bottom: 16px;
  }

  .field span {
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  textarea {
    /* 16px minimum, or iOS zooms the whole page when the field takes focus. */
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    resize: none;
    field-sizing: content;
    width: 100%;
  }

  textarea:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
    border-color: transparent;
  }

  .quiet,
  .danger {
    display: block;
    width: 100%;
    min-height: 48px;
    margin-top: 8px;
    border-radius: var(--radius-md);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .quiet {
    border: 0;
    background: none;
    color: var(--ink-muted);
  }

  .remove {
    margin-top: 16px;
  }

  /* There is no destructive red in this palette. A second red alongside a rose
     accent would muddy both, so the consequence is spelled out above the button
     instead. Words carry the warning, not hue. */
  .danger {
    border: 0;
    background: var(--primary);
    color: var(--on-primary);
  }

  .confirm {
    margin-top: 16px;
    padding: 16px;
    background: var(--surface);
    border-radius: var(--radius-md);
  }

  .confirm p {
    margin-bottom: 4px;
    color: var(--ink-muted);
    font-size: 0.95rem;
  }

  .tags {
    display: grid;
    gap: 10px;
    margin-bottom: 16px;
  }

  .tags .label {
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .hint {
    font-size: 0.85rem;
    color: var(--ink-muted);
  }

  .add {
    display: flex;
    gap: 8px;
  }

  .add input {
    flex: 1;
    min-width: 0;
    /* 16px minimum, or iOS zooms the page the moment this takes focus. */
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 11px 14px;
  }

  .add input:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
    border-color: transparent;
  }

  .add input:disabled {
    color: var(--ink-faint);
  }

  .add button {
    flex: none;
    min-height: 46px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  /* A full-strength shape at low contrast, as the composer's button does. */
  .add button:disabled {
    background: var(--surface);
    color: var(--ink-faint);
    cursor: default;
  }

  .link {
    justify-self: start;
    min-height: 40px;
    padding: 0 2px;
    border: 0;
    background: none;
    font: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--ink-muted);
    text-decoration: underline;
    text-decoration-color: var(--line-strong);
    text-underline-offset: 3px;
    cursor: pointer;
  }
</style>
