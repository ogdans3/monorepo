<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    onclose,
    children,
    action,
  }: {
    title: string;
    onclose: () => void;
    children: Snippet;
    action?: Snippet;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    // The native dialog gives focus trapping, inertness of the page behind it
    // and Escape for free. Reimplementing those by hand is how modals end up
    // unusable with a keyboard or a screen reader.
    dialog?.showModal();
  });
</script>

<dialog
  bind:this={dialog}
  onclose={onclose}
  onclick={(event) => {
    // A tap on the backdrop is a tap on the dialog element itself.
    if (event.target === dialog) dialog?.close();
  }}
>
  <div class="panel">
    <div class="grip" aria-hidden="true"></div>
    <header>
      <h2>{title}</h2>
      {#if action}{@render action()}{/if}
      <button type="button" class="close" onclick={() => dialog?.close()} aria-label="Close">
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
    </header>
    <div class="body">{@render children()}</div>
  </div>
</dialog>

<style>
  dialog {
    width: 100%;
    max-width: 34rem;
    margin: auto auto 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    overflow: visible;
  }

  dialog::backdrop {
    background: oklch(0.2 0.01 350 / 0.45);
    backdrop-filter: blur(2px);
  }

  .panel {
    background: var(--bg);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    /* Sits above the keyboard, and clears the home indicator. */
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--keyboard, 0px));
    max-height: 88dvh;
    display: flex;
    flex-direction: column;
    animation: rise 240ms var(--ease);
  }

  .grip {
    width: 36px;
    height: 4px;
    margin: 12px auto 4px;
    border-radius: 999px;
    background: var(--line-strong);
  }

  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 20px;
  }

  h2 {
    flex: 1;
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .close {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--ink-muted);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .body {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 4px 20px 20px;
  }

  @keyframes rise {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel {
      animation: none;
    }
  }
</style>
