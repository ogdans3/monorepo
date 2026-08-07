<script lang="ts">
  import qrcode from 'qrcode-generator';

  let { value, size = 224 }: { value: string; size?: number } = $props();

  /**
   * Drawn as one SVG path rather than a grid of rects, so a 43-character token
   * is a few hundred bytes of markup instead of a few thousand nodes. Error
   * correction stays at medium: this code is held up across a table, not
   * printed on a box.
   */
  const svg = $derived.by(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      const count = qr.getModuleCount();
      let path = '';
      for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
          if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
        }
      }
      return { path, count };
    } catch {
      return null;
    }
  });
</script>

{#if svg}
  <!-- A QR code is invisible to a screen reader, so it carries the URL as its
       label rather than the words "QR code". -->
  <svg
    role="img"
    aria-label="QR code for {value}"
    viewBox="0 0 {svg.count} {svg.count}"
    width={size}
    height={size}
    shape-rendering="crispEdges"
  >
    <path d={svg.path} fill="currentColor" />
  </svg>
{:else}
  <p class="fallback">Could not draw the QR code. Use the link below.</p>
{/if}

<style>
  svg {
    display: block;
    color: var(--ink);
    max-width: 100%;
    height: auto;
  }

  .fallback {
    font-size: 0.85rem;
    color: var(--ink-muted);
    text-align: center;
    max-width: 14rem;
  }
</style>
