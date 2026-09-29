<script lang="ts">
  import type { Tag, TagColor } from '@checkpost/contract';
  import { LIMITS, TAG_COLORS, tagKey } from '@checkpost/contract';
  import Sheet from './Sheet.svelte';

  let {
    tags,
    rowsWith,
    onrename,
    onrecolor,
    ondelete,
    oncreate,
    onclose,
  }: {
    /** Already in display order. */
    tags: Tag[];
    rowsWith: (tagId: string) => number;
    onrename: (tag: Tag, name: string) => Promise<boolean>;
    onrecolor: (tag: Tag, color: TagColor) => void;
    ondelete: (tag: Tag) => void;
    oncreate: (name: string) => void;
    onclose: () => void;
  } = $props();

  const NAMES: Record<TagColor, string> = {
    clay: 'Clay',
    ochre: 'Ochre',
    olive: 'Olive',
    sage: 'Sage',
    teal: 'Teal',
    steel: 'Steel',
    iris: 'Iris',
    plum: 'Plum',
  };

  /** One tag open for editing at a time, so the sheet stays a list. */
  let open = $state<string | null>(null);
  let nameDraft = $state('');
  let confirming = $state(false);
  let fresh = $state('');

  const editing = $derived(tags.find((tag) => tag.id === open) ?? null);
  const clash = $derived.by(() => {
    const key = tagKey(nameDraft);
    if (!editing || !key) return null;
    return tags.find((tag) => tag.id !== editing.id && tagKey(tag.name) === key) ?? null;
  });
  const renameable = $derived(
    Boolean(editing && nameDraft.trim() && !clash && nameDraft.trim() !== editing.name),
  );
  const full = $derived(tags.length >= LIMITS.tagsPerList);
  /** A new name the list already has, which Add would do nothing with. */
  const freshKnown = $derived(
    fresh.trim() ? (tags.find((tag) => tagKey(tag.name) === tagKey(fresh)) ?? null) : null,
  );

  function rows(count: number) {
    return count === 0 ? 'No rows' : count === 1 ? '1 row' : `${count} rows`;
  }

  function toggle(tag: Tag) {
    confirming = false;
    if (open === tag.id) {
      open = null;
      return;
    }
    open = tag.id;
    // Taken once, when it opens. A rename arriving from somebody else while
    // this field is being typed in must not rewrite it under the cursor.
    nameDraft = tag.name;
  }

  async function rename() {
    if (!editing || !renameable) return;
    await onrename(editing, nameDraft);
  }

  function create(event: Event) {
    event.preventDefault();
    if (!fresh.trim() || full || freshKnown) return;
    oncreate(fresh);
    fresh = '';
  }
</script>

<Sheet title="Tags" {onclose}>
  {#if tags.length === 0}
    <p class="fine">No tags yet. Make one here, or from any row's sheet.</p>
  {:else}
    <ul class="tags">
      {#each tags as tag (tag.id)}
        {@const count = rowsWith(tag.id)}
        <li data-tag-color={tag.color}>
          <button
            type="button"
            class="head"
            aria-expanded={open === tag.id}
            onclick={() => toggle(tag)}
          >
            <span class="dot" aria-hidden="true"></span>
            <span class="name">{tag.name}</span>
            <span class="count">{rows(count)}</span>
            <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M6 9l6 6 6-6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          {#if open === tag.id}
            <div class="edit">
              <form
                class="rename"
                onsubmit={(event) => {
                  event.preventDefault();
                  void rename();
                }}
              >
                <label>
                  <span>Name</span>
                  <input
                    bind:value={nameDraft}
                    maxlength={LIMITS.tagName}
                    enterkeyhint="done"
                    autocomplete="off"
                    aria-invalid={Boolean(clash)}
                    aria-describedby={clash ? `clash-${tag.id}` : undefined}
                  />
                </label>
                <button type="submit" class="save" disabled={!renameable}>Save name</button>
              </form>
              {#if clash}
                <p class="hint" id="clash-{tag.id}" role="status">
                  There is already a tag called “{clash.name}”.
                </p>
              {/if}

              <div class="colours" role="group" aria-label="Colour">
                {#each TAG_COLORS as color (color)}
                  <button
                    type="button"
                    class="swatch"
                    data-tag-color={color}
                    aria-pressed={tag.color === color}
                    aria-label={NAMES[color]}
                    title={NAMES[color]}
                    onclick={() => onrecolor(tag, color)}
                  >
                    <span class="well" aria-hidden="true">
                      {#if tag.color === color}
                        <svg viewBox="0 0 24 24" width="16" height="16">
                          <path
                            d="M5 12.5 10 17.5 19 7"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      {/if}
                    </span>
                  </button>
                {/each}
              </div>

              {#if confirming}
                <div class="confirm">
                  <p>
                    {#if count === 0}
                      No rows wear it. It goes for everyone, and there is no undo.
                    {:else}
                      Takes {tag.name} off {rows(count).toLowerCase()}, for everyone. There is no undo.
                    {/if}
                  </p>
                  <button
                    type="button"
                    class="danger"
                    onclick={() => {
                      open = null;
                      confirming = false;
                      ondelete(tag);
                    }}>Delete the tag</button
                  >
                  <button type="button" class="quiet" onclick={() => (confirming = false)}>Keep it</button>
                </div>
              {:else}
                <button type="button" class="quiet remove" onclick={() => (confirming = true)}>
                  Delete tag
                </button>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <form class="new" onsubmit={create}>
    <input
      bind:value={fresh}
      maxlength={LIMITS.tagName}
      placeholder="New tag"
      aria-label="New tag"
      enterkeyhint="done"
      autocomplete="off"
      disabled={full}
    />
    <button type="submit" disabled={!fresh.trim() || full || Boolean(freshKnown)}>Add</button>
  </form>
  {#if full}
    <p class="hint">This list holds {LIMITS.tagsPerList} tags. Delete one to make room.</p>
  {:else if freshKnown}
    <p class="hint" role="status">There is already a tag called “{freshKnown.name}”.</p>
  {/if}
</Sheet>

<style>
  .tags {
    list-style: none;
    margin: 0 -4px;
  }

  .tags li + li {
    border-top: 1px solid var(--line);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    padding: 0 4px;
    border: 0;
    background: none;
    font: inherit;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .dot {
    width: 10px;
    height: 10px;
    flex: none;
    border-radius: 999px;
    background: var(--tag-dot);
  }

  .name {
    flex: 1;
    min-width: 0;
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  .count {
    flex: none;
    font-size: 0.85rem;
    color: var(--ink-muted);
  }

  .chevron {
    flex: none;
    color: var(--ink-faint);
    transition: transform var(--fast) var(--ease);
  }

  .head[aria-expanded='true'] .chevron {
    transform: rotate(180deg);
  }

  .edit {
    display: grid;
    gap: 12px;
    padding: 4px 4px 16px;
  }

  .rename {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .rename label {
    display: grid;
    flex: 1;
    gap: 6px;
    min-width: 0;
  }

  .rename label span {
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  input {
    width: 100%;
    /* 16px minimum, or iOS zooms the page the moment this takes focus. */
    font: inherit;
    font-size: 16px;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 11px 14px;
  }

  input:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 1px;
    border-color: transparent;
  }

  input[aria-invalid='true'] {
    border-color: var(--ink-muted);
  }

  .save,
  .new button {
    flex: none;
    min-height: 46px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius-md);
    background: var(--primary);
    color: var(--on-primary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  /* A full-strength shape at low contrast, as the composer's button does. */
  .save:disabled,
  .new button:disabled {
    background: var(--surface);
    color: var(--ink-faint);
    cursor: default;
  }

  .hint {
    font-size: 0.85rem;
    color: var(--ink-muted);
  }

  /* Eight equal columns, so the eight always share one row. As a wrapping row
     the last swatch dropped onto a line of its own on a phone, which read as a
     ninth thing rather than the end of the set. */
  .colours {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    margin: 0 -6px;
  }

  .swatch {
    display: grid;
    place-items: center;
    width: 100%;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .well {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: var(--tag-dot);
    /* White on the light dots, near black on the dark ones: the page colour
       is the one that clears 3:1 against both. */
    color: var(--bg);
  }

  /* The chosen one carries a ring and a tick, so it is not told by colour. */
  .swatch[aria-pressed='true'] .well {
    box-shadow:
      0 0 0 2px var(--bg),
      0 0 0 4px var(--ink);
  }

  .confirm {
    padding: 14px;
    background: var(--surface);
    border-radius: var(--radius-md);
  }

  .confirm p {
    margin-bottom: 4px;
    color: var(--ink-muted);
    font-size: 0.95rem;
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
    margin-top: 0;
  }

  /* No second red, as everywhere else: the words above carry the warning. */
  .danger {
    border: 0;
    background: var(--primary);
    color: var(--on-primary);
  }

  .new {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .fine {
    color: var(--ink-muted);
    margin-bottom: 4px;
  }
</style>
