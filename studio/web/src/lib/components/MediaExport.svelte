<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Download, Share2 } from '@lucide/svelte';
  import type { Row } from '$lib/api';

  export let version: Row;
  // Web Share needs the complete File in memory. Large originals keep the
  // streaming download path instead of risking a mobile browser memory crash.
  const maxShareBytes = 100 * 1024 * 1024;
  let supported = false,
    loading = false,
    sharing = false,
    error = '',
    notice = '';
  let prepared: File | null = null;
  let controller: AbortController | null = null;
  let received = 0;
  $: media = version.mime?.startsWith('video/') || version.mime?.startsWith('image/');
  $: saveAction = version.mime?.startsWith('video/') ? 'Lagre video' : 'Lagre bilde';

  onMount(() => {
    try {
      supported = !!(
        media &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({
          files: [new File([], version.file_name, { type: version.mime })],
        })
      );
    } catch {
      supported = false;
    }
  });
  function reset() {
    controller?.abort();
    controller = null;
    prepared = null;
    loading = false;
    error = '';
    notice = '';
    received = 0;
  }
  onDestroy(reset);

  async function prepare() {
    if (loading || sharing) return;
    error = '';
    notice = '';
    if (Number(version.bytes) > maxShareBytes) {
      error =
        'Filer over 100 MB må lastes ned først. På iPhone: åpne filen i Filer → Del → ' +
        saveAction +
        ', hvis valget vises.';
      return;
    }
    const request = new AbortController();
    controller = request;
    loading = true;
    received = 0;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      request.abort();
    }, 120000);
    try {
      // Share the selected, full-quality original, never the potentially truncated proxy.
      const response = await fetch(`/api/files/${version.id}?download=1`, {
        credentials: 'same-origin',
        signal: request.signal,
      });
      if (!response.ok) throw new Error('Kunne ikke hente filen. Prøv igjen eller bruk Last ned.');
      if (Number(response.headers.get('Content-Length')) > maxShareBytes)
        throw new Error('Filen er for stor til direkte deling. Bruk Last ned og åpne den i Filer.');
      if (!response.body) throw new Error('Direkte deling støttes ikke her. Bruk Last ned.');
      const reader = response.body.getReader();
      const chunks: BlobPart[] = [];
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (received > maxShareBytes)
            throw new Error('Filen er for stor til direkte deling. Bruk Last ned.');
          chunks.push(value as Uint8Array<ArrayBuffer>);
        }
      } finally {
        reader.releaseLock();
      }
      if (controller !== request) return;
      if (!received || (Number(version.bytes) > 0 && received !== Number(version.bytes)))
        throw new Error('Hele filen ble ikke hentet. Prøv igjen.');
      const file = new File(chunks, version.file_name, { type: version.mime });
      if (!navigator.canShare({ files: [file] }))
        throw new Error('Denne filen kan ikke deles direkte her. Bruk Last ned.');
      prepared = file;
      notice =
        'Filen er klar. Trykk «Åpne delingsmenyen». På iPhone velger du «' +
        saveAction +
        '» for å lagre i Bilder, hvis valget vises.';
    } catch (e) {
      if (controller === request) {
        error = timedOut
          ? 'Nedlastingen tok for lang tid. Prøv igjen eller bruk Last ned.'
          : e instanceof Error
            ? e.message
            : 'Kunne ikke klargjøre filen. Bruk Last ned.';
        request.abort();
      }
    } finally {
      clearTimeout(timeout);
      if (controller === request) {
        controller = null;
        loading = false;
      }
    }
  }
  async function share() {
    if (!prepared || sharing) return;
    sharing = true;
    error = '';
    notice = '';
    try {
      // A fresh tap keeps iOS user activation intact even after a slow download.
      // Files only: some iOS destinations mishandle files combined with text/URLs.
      await navigator.share({ files: [prepared] });
      prepared = null;
      // Completion doesn't tell us which destination the user chose.
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        error = 'Kunne ikke åpne delingsmenyen. Prøv igjen, eller bruk Last ned → Filer → Del.';
      }
    } finally {
      sharing = false;
    }
  }
</script>

<div class="media-export">
  <div class="media-export-buttons">
    <a class="text-button" href={`/api/files/${version.id}?download=1`} download
      ><Download size={16} />Last ned</a
    >
    {#if supported}<button
        class="text-button"
        disabled={loading || sharing}
        aria-busy={loading || sharing}
        onclick={prepared ? share : prepare}
        ><Share2 size={16} />{loading
          ? `Klargjør ${Math.round(received / 1024 / 1024)} MB …`
          : sharing
            ? 'Delingsmeny åpen …'
            : prepared
              ? 'Åpne delingsmenyen'
              : 'Del / lagre'}</button
      >{/if}
    {#if loading || prepared}<button class="text-button" disabled={sharing} onclick={reset}
        >Avbryt</button
      >{/if}
  </div>
  {#if notice}<p class="small muted" role="status">{notice}</p>{/if}
  {#if error}<p class="small error" role="alert">{error}</p>{/if}
  {#if media}<details class="media-export-help">
      <summary>Bilder på iPhone</summary>
      <p>
        {#if supported}Velg «Del / lagre», deretter «Åpne delingsmenyen» og «{saveAction}», hvis
          valget vises. Alternativt:
        {/if}Bruk «Last ned», åpne filen i Filer og velg Del → {saveAction}. Tilgjengelige valg
        avhenger av iOS og filformatet.
      </p>
    </details>{/if}
</div>

<style>
  .media-export {
    margin-left: auto;
    max-width: 100%;
  }
  .media-export-buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 16px;
  }
  .media-export-buttons :global(.text-button) {
    font-size: 12px;
    min-height: 44px;
  }
  .media-export p {
    max-width: 430px;
    line-height: 1.55;
    margin: 6px 0;
  }
  .media-export-help {
    color: var(--muted);
    font-size: 11px;
    margin-top: 2px;
  }
  .media-export-help summary {
    cursor: pointer;
    padding: 5px 0;
  }
  @media (max-width: 560px) {
    .media-export {
      flex-basis: 100%;
      margin-left: 0;
    }
  }
</style>
