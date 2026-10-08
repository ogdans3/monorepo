<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { Plus, Search, ArrowRight } from '@lucide/svelte';
  import { api, formatDate, type Row } from '$lib/api';
  import MediaCard from './MediaCard.svelte';
  export let ads: Row[] = [];
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
  $: types = [...new Set([...presets, ...ads.map((a) => a.ad_type)])];
  $: filtered = ads.filter(
    (a) =>
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
      if (document.hidden || busy || refreshing || polls >= 40) return;
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
</div>
{#if filtered.length}<div class="ad-grid">
    {#each filtered as ad}<a
        class="ad-card"
        href={`/ads/${ad.id}?product=${product}&from=${encodeURIComponent($page.url.pathname + $page.url.search)}`}
      >
        <MediaCard item={ad} />
        <div class="ad-card-body">
          <div class="ad-card-meta">
            <span>{ad.ad_type}</span><span>{ad.number ? 'v' + ad.number : 'Ingen versjon'}</span>
          </div>
          <h2>{ad.title}</h2>
          {#if ad.file_name && ad.file_name !== ad.title}<p class="ad-filename">
              {ad.file_name}
            </p>{/if}
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
      </a>{/each}
  </div>{:else}<div class="empty-large">
    <h2>{ads.length ? 'Ingen annonser passer søket' : 'Klar for første annonse'}</h2>
    <p>
      Opprett en annonse, eller samle eksisterende videoer. Agenten leverer videre versjoner til
      samme annonse.
    </p>
  </div>{/if}
