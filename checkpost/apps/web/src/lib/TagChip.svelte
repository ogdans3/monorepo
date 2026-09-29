<script lang="ts">
  import type { Tag } from '@checkpost/contract';

  let {
    tag,
    quiet = false,
  }: {
    tag: Tag;
    /**
     * On a done row. The tint goes and the name dims with the rest of the row,
     * and the dot stays, so the row still says which tag it is while it reads
     * as finished.
     */
    quiet?: boolean;
  } = $props();
</script>

<span class="chip" class:quiet data-tag-color={tag.color}>
  <span class="dot" aria-hidden="true"></span>
  <span class="name">{tag.name}</span>
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    min-height: 24px;
    padding: 2px 8px 2px 7px;
    border-radius: var(--radius-sm);
    background: var(--tag-tint);
    color: var(--tag-ink);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.25;
  }

  .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 999px;
    background: var(--tag-dot);
  }

  /* A name is the one thing a tag is, so it wraps rather than truncating.
     Thirty characters fit a phone row at every text size but the largest. */
  .name {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .chip.quiet {
    background: none;
    padding-left: 0;
    color: var(--ink-muted);
  }
</style>
