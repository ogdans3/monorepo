<script lang="ts">
  import { X } from '@lucide/svelte';
  import type { Row } from '$lib/api';
  export let ad: Row;
  export let onclose: () => void;
  let original = false,
    failed = false;
  // Capture the selected render: list polling must not switch an ongoing playback.
  const number = ad.number;
  const version = ad.current_version_id,
    proxy = ad.has_proxy;
  $: src = proxy && !original ? `/api/previews/${version}?kind=proxy` : `/api/files/${version}`;
</script>

<div class="ad-inline-preview">
  <video
    {src}
    poster={ad.has_thumbnail ? `/api/previews/${version}?kind=thumbnail` : undefined}
    controls
    playsinline
    autoplay
    preload="none"
    aria-label={`Video: ${ad.title}`}
    onerror={() => (failed = true)}><track kind="captions" /></video
  >
  <div class="ad-playback-actions">
    <span>v{number}</span>
    {#if proxy && !original}<button
        class="text-button"
        onclick={() => {
          original = true;
          failed = false;
        }}>Spill originalen</button
      ><span>Forhåndsvisning · maks 10 min</span>{/if}
    <button class="text-button" onclick={onclose}><X size={15} />Lukk video</button>
  </div>
  {#if failed}<p class="small error" role="alert">
      Kunne ikke spille videoen. {proxy && !original
        ? 'Prøv originalen.'
        : 'Åpne annonsen for å laste ned filen.'}
    </p>{/if}
</div>
