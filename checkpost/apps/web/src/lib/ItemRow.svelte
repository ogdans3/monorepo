<script lang="ts">
  import type { Item } from '@checkpost/contract';

  let {
    item,
    washing = false,
    onToggle,
    onOpen,
  }: {
    item: Item;
    washing?: boolean;
    onToggle: () => void;
    onOpen: () => void;
  } = $props();

  /**
   * Swipe to open, matching the app. Tracked with pointer events rather than a
   * library, because the only thing this needs is a horizontal drag with a
   * threshold, and a gesture that fights the page scroll is worse than none.
   */
  let dragging = $state(false);
  let offset = $state(0);
  let startX = 0;
  let startY = 0;
  let decided: 'horizontal' | 'vertical' | null = null;

  const THRESHOLD = 0.32;
  const MAX = 96;

  function down(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    decided = null;
    dragging = true;
  }

  function move(event: PointerEvent) {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // Let a vertical intent scroll the list. Claiming every touch would make
      // the page feel stuck.
      decided = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (decided === 'horizontal') (event.target as Element).setPointerCapture?.(event.pointerId);
    }
    if (decided !== 'horizontal') return;

    // Rightwards only, and it slows as it goes so the edge feels like a limit.
    offset = dx <= 0 ? 0 : Math.min(MAX, dx ** 0.85);
  }

  function up() {
    if (!dragging) return;
    const released = offset;
    dragging = false;
    offset = 0;
    decided = null;
    if (released > MAX * THRESHOLD) onOpen();
  }
</script>

<li
  class="row"
  class:done={item.checked}
  class:washing
  class:dragging
  style:--offset="{offset}px"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
>
  <span class="hint" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="18" height="18"
      ><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle
        cx="19"
        cy="12"
        r="1.6"
      /></svg
    >
  </span>

  <div class="sheet">
    <button type="button" class="tick" onclick={onToggle} aria-pressed={item.checked}>
      <span class="box" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15">
          <path
            d="M5 12.5 10 17.5 19 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="text">
        <span class="t">{item.text}</span>
        {#if item.note.trim()}<span class="note">{item.note.trim()}</span>{/if}
      </span>
    </button>

    <button type="button" class="edge" onclick={onOpen} aria-label="Open {item.text}">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M9 5l7 7-7 7"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</li>

<style>
  .row {
    position: relative;
    list-style: none;
    background: var(--surface);
    /* The swipe is horizontal only, so the browser keeps vertical scrolling
       on the compositor instead of waiting on our pointer handler. */
    touch-action: pan-y;
  }

  .hint {
    position: absolute;
    inset: 0 auto 0 0;
    display: grid;
    place-items: center;
    width: 56px;
    color: var(--ink-muted);
    pointer-events: none;
  }

  .hint svg {
    fill: currentColor;
  }

  .sheet {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: stretch;
    background: var(--bg);
    transform: translate3d(var(--offset, 0), 0, 0);
    transition: background 900ms var(--ease);
  }

  .row:not(.dragging) .sheet {
    transition:
      transform var(--base) var(--ease),
      background 900ms var(--ease);
  }

  /* The wash is information rather than decoration. It is how you notice what
     somebody else did, so it survives reduced motion as a flat tint. */
  .row.washing .sheet {
    background: var(--primary-quiet);
    transition: none;
  }

  .tick {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 13px;
    min-height: 56px;
    padding: 13px 4px 13px 20px;
    background: none;
    border: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }

  .box {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 1.5px solid var(--ink-faint);
    border-radius: var(--radius-sm);
    color: transparent;
    transition:
      background var(--fast) var(--ease),
      border-color var(--fast) var(--ease),
      color var(--fast) var(--ease);
  }

  .row.done .box {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--on-primary);
  }

  /* A block, not a grid. As a grid item the text span stretched to the full
     column and took the strikethrough with it, ruling the empty space to the
     right of short items. */
  .text {
    display: block;
    min-width: 0;
  }

  /* Checked is carried by the mark, the strikethrough and the dimming. The
     accent is confirmation, never the only cue. Painted as a background
     gradient so it wipes across the words and wraps with them. */
  .t {
    background-image: linear-gradient(currentColor, currentColor);
    background-repeat: no-repeat;
    background-position: 0 58%;
    background-size: 0% 1.5px;
    transition:
      background-size var(--base) var(--ease),
      color var(--base) var(--ease);
    overflow-wrap: anywhere;
  }

  .row.done .text {
    color: var(--ink-muted);
  }

  .row.done .t {
    background-size: 100% 1.5px;
  }

  .note {
    display: block;
    margin-top: 2px;
    font-size: 0.8rem;
    color: var(--ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Always drawn, never hover-revealed. This is a touch product, and it is the
     way to open an item without knowing about the swipe. */
  .edge {
    display: grid;
    place-items: center;
    width: 48px;
    background: none;
    border: 0;
    color: var(--ink-faint);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet,
    .box,
    .t {
      transition: none;
    }
  }
</style>
