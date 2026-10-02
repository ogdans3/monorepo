<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Row } from '$lib/api';
  export let product: string;
  export let canEdit = false;
  export let onrefresh: () => Promise<void>;
  export let onopen: (id: string) => void;
  export let onupload: () => void;
  let url = '',
    title = '',
    rights = 'reference_only',
    collection = '';
  let imports: Row[] = [],
    collections: Row[] = [];
  let error = '',
    notice = '',
    busy = false,
    loading = false,
    stopped = false,
    fingerprint = '';
  let historyOpen = false;
  const platformNames: Record<string, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    snapchat: 'Snapchat',
  };
  async function load() {
    if (loading || stopped) return;
    loading = true;
    try {
      const rows = await api('/imports?product=' + product);
      if (stopped) return;
      const next = rows
        .map((r: Row) => [r.id, r.item_id, r.media_status, r.classification?.category].join(':'))
        .join('|');
      imports = rows;
      if (!fingerprint && imports.some((i) => ['queued', 'downloading'].includes(i.status)))
        historyOpen = true;
      if (fingerprint && next !== fingerprint) await onrefresh();
      fingerprint = next;
    } finally {
      loading = false;
    }
  }
  async function act(work: () => Promise<void>) {
    busy = true;
    error = '';
    notice = '';
    try {
      await work();
      await load();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    await act(async () => {
      const result = await api('/imports', 'POST', {
        product_id: product,
        url,
        title,
        rights,
        collection_id: collection,
      });
      notice = result.duplicate
        ? 'Lenken finnes allerede i importlisten.'
        : 'Importen er startet. Du kan fortsette å jobbe.';
      historyOpen = true;
      url = '';
      title = '';
    });
  }
  function stage(i: Row) {
    if (i.status !== 'completed') return i.stage;
    if (i.duplicate) return 'Finnes allerede i biblioteket';
    if (['queued', 'running'].includes(i.media_status))
      return i.media_progress || 'Lager forhåndsvisning og leser innholdet';
    if (i.media_status === 'failed' || i.classification?.status === 'failed')
      return 'Video lagret · analyse kunne ikke fullføres';
    if (i.classification?.label && i.classification.category !== 'ukategorisert')
      return 'Importert · ' + i.classification.label;
    return 'Video lagret · sjekk kategori';
  }
  onMount(() => {
    stopped = false;
    load().catch((e) => (error = e.message));
    api('/library?product=' + product)
      .then((d) => {
        if (!stopped) collections = d.collections || [];
      })
      .catch(() => {});
    const timer = setInterval(() => load().catch((e) => (error = e.message)), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  });
</script>

<section class="link-import" aria-label="Importer video fra lenke">
  {#if canEdit}
    <form onsubmit={submit}>
      <label for="social-video-url">Hent en video fra en lenke</label>
      <div class="import-input-row">
        <input
          id="social-video-url"
          type="text"
          inputmode="url"
          bind:value={url}
          placeholder="Instagram, TikTok eller Snapchat Spotlight"
          required
          maxlength="2048"
        /><button class="primary" disabled={busy || !url.trim()}>Hent video</button>
      </div>
      <p class="small muted">
        Videoen lagres i biblioteket med kilde, kategori og søkbart innhold.
      </p>
      <details>
        <summary class="small">Tittel, samling og rettigheter</summary>
        <div class="form-grid">
          <label
            >Egen tittel<input
              bind:value={title}
              maxlength="300"
              placeholder="Hentes fra videoen hvis tomt"
            /></label
          >
          <label
            >Legg i samling<select bind:value={collection}
              ><option value="">Ingen samling</option>{#each collections as c}<option value={c.id}
                  >{c.name}</option
                >{/each}</select
            ></label
          >
          <label
            >Bruksrettigheter for import<select bind:value={rights}
              ><option value="reference_only">Kun referanse</option><option value="owned"
                >Eget materiale</option
              ><option value="licensed">Lisensiert</option><option value="unknown"
                >Ikke avklart</option
              ></select
            ></label
          >
        </div>
      </details>
    </form>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if notice}<p class="small" role="status">{notice}</p>{/if}
  {#if imports.length}<details class="import-history" bind:open={historyOpen}>
      <summary>Lenkeimporter <span class="muted">({imports.length})</span></summary>
      <div class="import-rows">
        {#each imports as i}
          <article class="import-row" data-import-status={i.status}>
            <div class="import-row-body">
              <span class="eyebrow">{platformNames[i.platform]}</span><strong
                >{i.title || 'Video fra ' + platformNames[i.platform]}</strong
              >
              <p class="small" role="status">{stage(i)}</p>
              <a
                class="small muted import-source"
                href={i.source_url}
                target="_blank"
                rel="noreferrer">Åpne kildelenken ↗</a
              >
              {#if i.status === 'downloading'}<progress
                  aria-label="Nedlastingsfremdrift"
                  max="100"
                  value={i.total_bytes > 0
                    ? Math.min(100, (100 * i.downloaded_bytes) / i.total_bytes)
                    : undefined}
                ></progress>{/if}
            </div>
            <div class="button-row wrap">
              {#if i.item_id}<button class="secondary" onclick={() => onopen(i.item_id)}
                  >Åpne video</button
                >{/if}
              {#if canEdit && ['queued', 'downloading'].includes(i.status)}<button
                  class="text-button"
                  disabled={busy}
                  onclick={() =>
                    act(async () => {
                      await api('/imports/' + i.id + '/cancel', 'POST', {});
                    })}>Stopp import</button
                >{/if}
              {#if canEdit && ['failed', 'cancelled'].includes(i.status)}<button
                  class="secondary"
                  disabled={busy}
                  onclick={() =>
                    act(async () => {
                      await api('/imports/' + i.id + '/retry', 'POST', {});
                    })}>Prøv igjen</button
                ><button class="text-button" onclick={onupload}>Last opp fil selv</button>{/if}
            </div>
          </article>
        {/each}
      </div>
    </details>{/if}
</section>
