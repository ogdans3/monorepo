<script lang="ts">
  import { untrack } from 'svelte';
  import type { Item } from '@checkpost/contract';
  import { LIMITS } from '@checkpost/contract';
  import Sheet from './Sheet.svelte';

  let {
    item,
    onclose,
    onsave,
    onremove,
  }: {
    item: Item;
    onclose: () => void;
    onsave: (patch: { text?: string; note?: string }) => void;
    onremove: () => void;
  } = $props();

  // Deliberately the value as it was when the sheet opened. The sheet is
  // recreated on each open, and live-updating a field somebody is typing in
  // because a remote change arrived would be hostile.
  let text = $state(untrack(() => item.text));
  let note = $state(untrack(() => item.note));
  let confirming = $state(false);

  function save() {
    const trimmed = text.trim();
    onsave({
      ...(trimmed && trimmed !== item.text ? { text: trimmed } : {}),
      ...(note !== item.note ? { note } : {}),
    });
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
</style>
