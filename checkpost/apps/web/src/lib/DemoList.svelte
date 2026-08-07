<script lang="ts">
  /**
   * The product, running. Not a screenshot, but the same row anatomy the app
   * ships (checkbox, text, right-edge affordance) so the landing page teaches
   * the gesture before anyone installs anything.
   */
  type Row = { id: number; text: string; done: boolean };

  let rows = $state<Row[]>([
    { id: 3, text: 'Firewood', done: false },
    { id: 4, text: 'Coffee, and the good one', done: false },
    { id: 5, text: 'Someone remember the cards', done: false },
    { id: 1, text: 'Book the ferry', done: true },
    { id: 2, text: 'Cabin key from Marit', done: true }
  ]);

  let lastToggled = $state<number | null>(null);

  const done = $derived(rows.filter((r) => r.done).length);

  function toggle(row: Row) {
    row.done = !row.done;
    lastToggled = row.id;
  }
</script>

<div class="sheet" aria-label="A Checkpost list, live">
  <header>
    <h3>Cabin, Friday</h3>
    <p class="count" aria-live="polite">{done} of {rows.length} done</p>
  </header>

  <ul>
    {#each rows as row, i (row.id)}
      <li style="--i: {i}">
        <button
          type="button"
          class="row"
          class:done={row.done}
          class:just={lastToggled === row.id}
          onclick={() => toggle(row)}
          aria-pressed={row.done}
        >
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
          <span class="text"><span class="t">{row.text}</span></span>
          <span class="edge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="15" height="15">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </button>
      </li>
    {/each}
  </ul>

  <footer>
    <span class="dot" aria-hidden="true"></span>
    <span>2 here</span>
  </footer>
</div>

<style>
  .sheet {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow:
      0 1px 2px oklch(0.2 0.01 350 / 0.04),
      0 24px 48px -24px oklch(0.2 0.01 350 / 0.22);
    overflow: hidden;
    width: min(100%, 27rem);
  }

  header {
    padding: 20px 20px 14px;
    border-bottom: 1px solid var(--line);
  }

  h3 {
    font-size: 1.35rem;
    letter-spacing: -0.02em;
  }

  .count {
    margin-top: 3px;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li + li .row {
    border-top: 1px solid var(--line);
  }

  li {
    animation: rise 480ms var(--ease) both;
    animation-delay: calc(120ms + var(--i) * 55ms);
  }

  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 13px;
    width: 100%;
    min-height: 56px;
    padding: 12px 8px 12px 20px;
    background: none;
    border: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    transition: background var(--fast) var(--ease);
  }

  .row:hover {
    background: var(--surface);
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

  .text {
    transition: color var(--base) var(--ease);
  }

  /* Checked is carried by three signals: the mark, the strikethrough and the
     dimming. The accent is confirmation, never the only cue.
     The rule is painted as a background gradient rather than a pseudo-element
     so it wipes across the words themselves and wraps with them, instead of
     ruling the full width of the row. */
  .t {
    background-image: linear-gradient(currentColor, currentColor);
    background-repeat: no-repeat;
    background-position: 0 58%;
    background-size: 0% 1.5px;
    transition: background-size var(--base) var(--ease);
  }

  .row.done .text {
    color: var(--ink-muted);
  }

  .row.done .t {
    background-size: 100% 1.5px;
  }

  .edge {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    color: var(--ink-faint);
  }

  /* The wash a remote change leaves behind, so you can see what changed. */
  .row.just {
    animation: wash 900ms var(--ease);
  }

  footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px 14px;
    border-top: 1px solid var(--line);
    background: var(--surface);
    font-size: 0.8rem;
    color: var(--ink-muted);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--primary);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }

  @keyframes wash {
    0%,
    60% {
      background: var(--primary-quiet);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    li {
      animation: none;
    }

    /* The wash is information, not decoration, so it stays. It becomes a flat
       tint with no transition rather than a fade. */
    .row.just {
      animation: wash 900ms steps(1, end);
    }
  }
</style>
