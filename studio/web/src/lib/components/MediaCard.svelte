<script lang="ts">
  import { Film, Image, FileText, Play } from '@lucide/svelte';
  import type { Row } from '$lib/api';
  export let item: Row;
  let failed = false;
  $: id = item.current_version_id || item.id;
  $: thumbnail = item.has_thumbnail ? `/api/previews/${id}?kind=thumbnail` : '';
  $: if (thumbnail) failed = false;
</script>

<div class="review-thumbnail">
  {#if thumbnail && !failed}
    <img src={thumbnail} alt="" loading="lazy" decoding="async" onerror={() => (failed = true)} />
  {:else}
    <div class="thumbnail-pending">
      {#if item.mime?.startsWith('video/')}<Film size={26} strokeWidth={1.3} />
      {:else if item.mime?.startsWith('image/')}<Image size={26} strokeWidth={1.3} />
      {:else}<FileText size={26} strokeWidth={1.3} />{/if}
      <span
        >{item.mime?.startsWith('video/') || item.mime?.startsWith('image/')
          ? 'Forhåndsvisning klargjøres'
          : item.current_version_id || item.file_name
            ? 'Tekst eller fil'
            : 'Venter på første versjon'}</span
      >
    </div>
  {/if}
  {#if item.mime?.startsWith('video/')}<span class="thumbnail-play" aria-hidden="true"
      ><Play size={17} fill="currentColor" /></span
    >{/if}
</div>
