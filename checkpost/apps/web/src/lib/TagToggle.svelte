<script lang="ts">
  import type { Tag } from '@checkpost/contract';

  let {
    tag,
    on,
    disabled = false,
    label,
    onclick,
  }: {
    tag: Tag;
    on: boolean;
    disabled?: boolean;
    /** What a screen reader hears, when the name alone does not say it. */
    label?: string;
    onclick: () => void;
  } = $props();
</script>

<!--
  One control for both jobs, the filter and a row's tags, so they look like the
  same thing because they are. Off is the dot and the name on a hairline. On
  takes the tag's own tint and ink and the dot becomes a tick: on and off
  differ in shape, not only in colour.
-->
<button
  type="button"
  class="toggle"
  class:on
  data-tag-color={tag.color}
  aria-pressed={on}
  aria-label={label}
  {disabled}
  {onclick}
>
  {#if on}
    <svg class="mark" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M5 12.5 10 17.5 19 7"
        fill="none"
        stroke="currentColor"
        stroke-width="2.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {:else}
    <span class="dot" aria-hidden="true"></span>
  {/if}
  <span class="name">{tag.name}</span>
</button>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    max-width: 100%;
    /* 36 drawn, with the row it sits in making up the 48 a finger needs. */
    min-height: 36px;
    padding: 0 12px 0 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background var(--fast) var(--ease),
      border-color var(--fast) var(--ease),
      color var(--fast) var(--ease);
  }

  .toggle.on {
    border-color: transparent;
    background: var(--tag-tint);
    color: var(--tag-ink);
  }

  .toggle:disabled {
    cursor: default;
    color: var(--ink-faint);
    border-color: var(--line);
  }

  .toggle:disabled .dot {
    opacity: 0.5;
  }

  .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 999px;
    background: var(--tag-dot);
  }

  .mark {
    flex: none;
    margin: 0 -3px;
  }

  .name {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (hover: hover) {
    .toggle:not(:disabled):not(.on):hover {
      background: var(--surface);
    }
  }
</style>
