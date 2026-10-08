<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Plus, Search, ArrowRight, Star, Folder, Play } from '@lucide/svelte';
  import { api, formatDate, type Row } from '$lib/api';
  import MediaCard from './MediaCard.svelte';
  import AdPreview from './AdPreview.svelte';
  import ChannelLabels from './ChannelLabels.svelte';
  import { channels } from '$lib/channels';
  export let ads: Row[] = [];
  export let folders: Row[] = [];
  export let product: string;
  export let canEdit = false;
  export let onopen: (id: string) => void;
  export let onrefresh: () => Promise<void>;
  let creating = false,
    busy = false,
    error = '',
    title = '',
    adType = 'Produktdemo',
    brief = '',
    source = '';
  let existing: Row[] = [];
  let savingFavorites: string[] = [];
  let folderForm = false,
    folderName = '',
    editingFolder = '',
    playing = '';
  $: folder = $page.url.searchParams.get('folder') || '';
  $: channel = $page.url.searchParams.get('channel') || '';
  $: activeFolder = folders.find((f) => f.id === folder);
  $: if (playing && !filtered.some((ad) => ad.id === playing)) playing = '';
  async function organize(ad: Row, folder_id: string) {
    busy = true;
    error = '';
    try {
      await api(`/ads/${ad.id}/organization`, 'PATCH', { folder_id });
      await onrefresh();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function editFolder(id = '', name = '') {
    editingFolder = id;
    folderName = name;
    folderForm = true;
  }
  async function saveFolder(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = '';
    try {
      const saved = await api(
        '/ad-folders' + (editingFolder ? '/' + editingFolder : ''),
        editingFolder ? 'PATCH' : 'POST',
        { product_id: product, name: folderName },
      );
      await onrefresh();
      folderForm = false;
      filter('folder', saved.id);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function removeFolder() {
    busy = true;
    error = '';
    try {
      await api('/ad-folders/' + editingFolder, 'DELETE');
      await onrefresh();
      folderForm = false;
      filter('folder', 'unfiled');
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  const presets = [
    'UGC',
    'Produktdemo',
    'Skjermopptak',
    'Testimonial',
    'Problem → løsning',
    'Hook-test',
    'Annet',
  ];
  $: query = $page.url.searchParams.get('q') || '';
  $: type = $page.url.searchParams.get('type') || '';
  $: status = $page.url.searchParams.get('status') || '';
  $: favoritesOnly = $page.url.searchParams.get('favorites') === '1';
  $: types = [...new Set([...presets, ...ads.map((a) => a.ad_type)])];
  $: filtered = ads.filter(
    (a) =>
      (!favoritesOnly || a.favorite) &&
      (!folder || (folder === 'unfiled' ? !a.folder_id : a.folder_id === folder)) &&
      (!channel ||
        (a.channels || []).includes(channel) ||
        (a.version_channels || []).includes(channel)) &&
      (!type || a.ad_type === type) &&
      (!status || a.review_status === status) &&
      `${a.title} ${a.file_name || ''} ${a.external_key}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  $: reviewCount = ads.filter((a) => a.current_version_id && a.review_status === 'review').length;
  function filter(name: string, value: string) {
    const url = new URL($page.url);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    void goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
  }
  onMount(() => {
    let polls = 0,
      refreshing = false;
    async function refreshVisible() {
      if (document.hidden || busy || savingFavorites.length || refreshing || polls >= 40) return;
      polls++;
      refreshing = true;
      try {
        await onrefresh();
      } catch {
      } finally {
        refreshing = false;
      }
    }
    const focus = () => {
      polls = 0;
      void refreshVisible();
    };
    const timer = setInterval(refreshVisible, 15000);
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  });
  async function toggleFavorite(ad: Row) {
    if (savingFavorites.includes(ad.id)) return;
    const favorite = !ad.favorite;
    savingFavorites = [...savingFavorites, ad.id];
    error = '';
    try {
      await api(`/items/${ad.id}/favorite`, favorite ? 'POST' : 'DELETE');
      ads = ads.map((item) => (item.id === ad.id ? { ...item, favorite } : item));
    } catch (e) {
      error = (e as Error).message;
    } finally {
      savingFavorites = savingFavorites.filter((id) => id !== ad.id);
    }
  }
  async function start() {
    creating = !creating;
    if (creating) {
      try {
        existing = await api('/items?product=' + product);
      } catch (e) {
        error = (e as Error).message;
      }
    }
  }
  async function create(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = '';
    try {
      const ad = await api('/ads', 'POST', {
        product_id: product,
        title,
        ad_type: adType,
        brief,
        item_id: source,
        folder_id: folder === 'unfiled' ? '' : folder,
      });
      creating = false;
      await onrefresh();
      onopen(ad.id);
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<section class="page-heading ads-heading">
  <div>
    <p class="eyebrow">PRODUKSJON · GJENNOMGANG · ITERASJON</p>
    <h1>Annonser</h1>
    <p>Én annonse. Alle versjonene samlet.</p>
  </div>
  <div class="button-row">
    <button class="secondary" onclick={onrefresh}>Oppdater</button>{#if canEdit}<button
        class="primary"
        onclick={start}><Plus size={17} />Ny annonse</button
      >{/if}
  </div>
</section>
<div class="ads-summary">
  <span><strong>{ads.length}</strong> annonser</span><span
    ><strong>{reviewCount}</strong> til gjennomgang</span
  ><span><strong>{ads.filter((a) => a.review_status === 'approved').length}</strong> godkjente</span
  >
</div>
{#if error}<p class="error" role="alert">{error}</p>{/if}
{#if creating}<form class="ad-create-panel" onsubmit={create}>
    <div class="section-heading">
      <h2>Samle en idé og dens versjoner</h2>
      <button class="text-button" type="button" onclick={() => (creating = false)}>Avbryt</button>
    </div>
    <label
      >Annonsetittel<input
        bind:value={title}
        maxlength="300"
        placeholder="For eksempel: Bestå teoriprøven · elevhistorie"
        required
      /></label
    >
    <div class="form-grid">
      <label
        >Annonsetype<input bind:value={adType} list="ad-types" maxlength="80" required /><datalist
          id="ad-types"
          >{#each types as type}<option value={type}></option>{/each}</datalist
        ></label
      >
      <label
        >Start med eksisterende innhold<select
          bind:value={source}
          onchange={() => {
            const item = existing.find((i) => i.id === source);
            if (item && !title) title = item.title;
          }}
          ><option value="">Tom annonse · last opp første versjon etterpå</option
          >{#each existing.filter((i) => !i.is_ad && ['video', 'image', 'carousel'].includes(i.kind)) as item}<option
              value={item.id}>{item.title}</option
            >{/each}</select
        ></label
      >
    </div>
    <label
      >Brief<textarea
        bind:value={brief}
        rows="3"
        maxlength="20000"
        placeholder="Hva skal annonsen formidle, og hvem skal den nå?"></textarea></label
    >
    <button class="primary" disabled={busy || !title.trim()}
      >Opprett annonse<ArrowRight size={16} /></button
    >
  </form>{/if}
<div class="ad-folders-bar">
  <nav class="ad-folders" aria-label="Annonsemapper">
    <button class:chosen={!folder} aria-pressed={!folder} onclick={() => filter('folder', '')}
      >Alle <span>{ads.length}</span></button
    >
    <button
      class:chosen={folder === 'unfiled'}
      aria-pressed={folder === 'unfiled'}
      onclick={() => filter('folder', 'unfiled')}
      >Uten mappe <span>{ads.filter((a) => !a.folder_id).length}</span></button
    >
    {#each folders as f}<button
        class:chosen={folder === f.id}
        aria-pressed={folder === f.id}
        onclick={() => filter('folder', f.id)}
        ><Folder size={15} />{f.name}<span>{ads.filter((a) => a.folder_id === f.id).length}</span
        ></button
      >{/each}
  </nav>
  {#if canEdit}<div class="button-row">
      <button class="text-button" onclick={() => editFolder()}><Plus size={15} />Ny mappe</button
      >{#if activeFolder}<button
          class="text-button"
          onclick={() => editFolder(activeFolder.id, activeFolder.name)}>Rediger mappe</button
        >{/if}
    </div>{/if}
</div>
{#if folderForm}<form class="ad-folder-form review-panel" onsubmit={saveFolder}>
    <label
      >Mappenavn<input
        bind:value={folderName}
        maxlength="80"
        required
        placeholder="For eksempel: Ferdig"
      /></label
    >
    <div class="button-row">
      <button class="primary" disabled={busy}>Lagre mappe</button><button
        type="button"
        class="secondary"
        onclick={() => (folderForm = false)}>Avbryt</button
      >{#if editingFolder}<button
          type="button"
          class="text-button"
          disabled={busy}
          onclick={removeFolder}>Fjern mappe</button
        >{/if}
    </div>
    {#if editingFolder}<p class="small muted">
        Fjerner du mappen, flyttes annonsene til «Uten mappe». Alle filer og versjoner beholdes.
      </p>{/if}
  </form>{/if}
<div class="ads-filters">
  <label class="ad-search"
    ><Search size={17} /><input
      aria-label="Søk i annonser"
      placeholder="Søk i titler og filnavn …"
      value={query}
      oninput={(e) => filter('q', e.currentTarget.value)}
    /></label
  ><select
    aria-label="Annonsetype"
    value={type}
    onchange={(e) => filter('type', e.currentTarget.value)}
    ><option value="">Alle annonsetyper</option>{#each types as type}<option value={type}
        >{type}</option
      >{/each}</select
  ><select
    aria-label="Gjennomgangsstatus"
    value={status}
    onchange={(e) => filter('status', e.currentTarget.value)}
    ><option value="">Alle statuser</option><option value="review">Til gjennomgang</option><option
      value="changes_requested">Trenger endringer</option
    ><option value="approved">Godkjent</option></select
  >
  <select
    aria-label="Kanalfilter"
    value={channel}
    onchange={(e) => filter('channel', e.currentTarget.value)}
    ><option value="">Alle kanaler</option>{#each channels as c}<option value={c.id}
        >{c.name}</option
      >{/each}</select
  >
  <button
    class="secondary ad-favorites-filter"
    class:chosen={favoritesOnly}
    aria-pressed={favoritesOnly}
    onclick={() => filter('favorites', favoritesOnly ? '' : '1')}
  >
    <Star size={16} fill={favoritesOnly ? 'currentColor' : 'none'} />Favoritter
  </button>
</div>
{#if filtered.length}<div class="ad-grid">
    {#each filtered as ad (ad.id)}<article class="ad-card">
        {#if playing === ad.id}<AdPreview {ad} onclose={() => (playing = '')} />
        {:else if ad.mime?.startsWith('video/')}<button
            class="ad-play"
            aria-label={`Spill av ${ad.title}`}
            onclick={() => (playing = ad.id)}
            ><MediaCard item={ad} /><span class="ad-play-label"
              ><Play size={16} fill="currentColor" />Spill av</span
            ></button
          >
        {:else}<a
            class="ad-media-link"
            aria-label={`Åpne ${ad.title}`}
            href={`/ads/${ad.id}?product=${product}&from=${encodeURIComponent($page.url.pathname + $page.url.search)}`}
            ><MediaCard item={ad} /></a
          >{/if}
        <a
          class="ad-card-link"
          href={`/ads/${ad.id}?product=${product}&from=${encodeURIComponent($page.url.pathname + $page.url.search)}`}
        >
          <div class="ad-card-body">
            <div class="ad-card-meta">
              <span>{ad.ad_type}</span><span>{ad.number ? 'v' + ad.number : 'Ingen versjon'}</span>
            </div>
            <h2>{ad.title}</h2>
            {#if ad.file_name && ad.file_name !== ad.title}<p class="ad-filename">
                {ad.file_name}
              </p>{/if}
            {#if ad.channels?.length}<div class="ad-platform-row">
                <span>Annonse</span><ChannelLabels value={ad.channels} />
              </div>{/if}
            {#if ad.version_channels?.length}<div class="ad-platform-row">
                <span>v{ad.number}</span><ChannelLabels value={ad.version_channels} />
              </div>{/if}
            <div class="ad-card-footer">
              <span
                class="review-status"
                class:approved={ad.review_status === 'approved'}
                class:changes={ad.review_status === 'changes_requested'}
                >{!ad.current_version_id
                  ? 'Klart for opplasting'
                  : ad.review_status === 'approved'
                    ? 'Godkjent'
                    : ad.review_status === 'changes_requested'
                      ? 'Trenger endringer'
                      : 'Til gjennomgang'}</span
              ><span>{ad.version_count} versjoner · {formatDate(ad.updated_at)}</span>
            </div>
          </div>
        </a>
        <div class="ad-card-folder">
          {#if canEdit}<label
              ><Folder size={15} /><span class="sr-only">Mappe for {ad.title}</span><select
                aria-label={`Mappe for ${ad.title}`}
                value={ad.folder_id || ''}
                disabled={busy}
                onchange={(e) => organize(ad, e.currentTarget.value)}
                ><option value="">Uten mappe</option>{#each folders as f}<option value={f.id}
                    >{f.name}</option
                  >{/each}</select
              ></label
            >{:else if ad.folder_name}<span><Folder size={15} />{ad.folder_name}</span>{/if}
        </div>
        <button
          type="button"
          class="ad-favorite"
          class:chosen={ad.favorite}
          aria-label={ad.favorite ? 'Fjern favoritt' : 'Lagre favoritt'}
          aria-pressed={!!ad.favorite}
          title={ad.favorite ? 'Fjern fra favoritter' : 'Legg til i favoritter'}
          disabled={savingFavorites.includes(ad.id)}
          aria-busy={savingFavorites.includes(ad.id)}
          onclick={() => toggleFavorite(ad)}
        >
          <Star size={20} fill={ad.favorite ? 'currentColor' : 'none'} />
        </button>
      </article>{/each}
  </div>{:else}<div class="empty-large">
    <h2>
      {favoritesOnly
        ? 'Ingen favoritter passer søket'
        : ads.length
          ? folder
            ? 'Ingen annonser i denne mappen passer filtrene'
            : 'Ingen annonser passer søket'
          : 'Klar for første annonse'}
    </h2>
    <p>
      {#if favoritesOnly}Trykk på stjernen på en annonse for å lagre den som favoritt.
      {:else if folder}Velg «Alle» for å flytte annonser hit, eller opprett en ny annonse i mappen.
      {:else}Opprett en annonse, eller samle eksisterende videoer. Agenten leverer videre versjoner
        til samme annonse.{/if}
    </p>
  </div>{/if}
