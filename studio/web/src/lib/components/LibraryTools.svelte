<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Row } from '$lib/api';
  export let product: string;
  export let items: Row[];
  export let canEdit = false;
  export let filterIDs: string[] | null = null;
  export let onchange: () => Promise<void>;
  let data: Row = { collections: [], favorites: [], trash: [] },
    mode = '',
    selected: string[] = [],
    name = '',
    tag = '',
    collection = '',
    csv = '',
    error = '',
    notice = '',
    busy = false;
  async function load() {
    data = await api('/library?product=' + product);
  }
  onMount(() => {
    load().catch((e) => (error = e.message));
  });
  async function act(fn: () => Promise<void>) {
    error = '';
    busy = true;
    try {
      await fn();
      await load();
      await onchange();
      notice = 'Lagret';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function filter() {
    filterIDs =
      mode === 'favorites'
        ? (data.favorites || []).map((f: Row) => f.item_id)
        : mode === 'inbox'
          ? items.filter((i) => i.inbox).map((i) => i.id)
          : mode === 'collection'
            ? data.collections.find((c: Row) => c.id === collection)?.items || []
            : null;
  }
  async function bulk(action: string, value = '') {
    await act(async () => {
      await api('/items/bulk', 'POST', { ids: selected, action, value });
      selected = [];
      filterIDs = null;
      mode = '';
    });
  }
</script>

<div class="library-tools">
  <div class="button-row wrap">
    <button
      class:chosen={mode === 'favorites'}
      class="secondary"
      onclick={() => {
        mode = mode === 'favorites' ? '' : 'favorites';
        filter();
      }}>Favoritter</button
    >
    <button
      class:chosen={mode === 'inbox'}
      class="secondary"
      onclick={() => {
        mode = mode === 'inbox' ? '' : 'inbox';
        filter();
      }}>Innboks <span>{items.filter((i) => i.inbox).length}</span></button
    >
    <select
      aria-label="Samling"
      bind:value={collection}
      onchange={() => {
        mode = collection ? 'collection' : '';
        filter();
      }}
      ><option value="">Alle samlinger</option>{#each data.collections || [] as c}<option
          value={c.id}>{c.name}</option
        >{/each}</select
    >
    <a class="text-button" href={'/api/export/csv?product=' + product}>Eksporter CSV</a>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if canEdit}<details class="tool-panel">
      <summary>Organiser og importer</summary>
      <div class="form-grid">
        <form
          onsubmit={(e) => {
            e.preventDefault();
            act(async () => {
              await api('/collections', 'POST', { product_id: product, name });
              name = '';
            });
          }}
        >
          <label>Ny samling<input bind:value={name} required /></label><button
            class="secondary"
            disabled={busy}>Opprett samling</button
          >
        </form>
        <form
          onsubmit={(e) => {
            e.preventDefault();
            act(async () => {
              const result = await api('/import/csv', 'POST', { product_id: product, csv });
              notice = result.count + ' elementer importert';
              csv = '';
            });
          }}
        >
          <label
            >Importer CSV<input
              type="file"
              accept=".csv,text/csv"
              onchange={async (e) => {
                const f = e.currentTarget.files?.[0];
                if (f) csv = await f.text();
              }}
            /></label
          ><label
            >CSV-innhold<textarea
              rows="3"
              bind:value={csv}
              placeholder="title,kind,body,rights&#10;En god hook,hook,Spørsmålet ditt,owned"
            ></textarea></label
          ><button class="secondary" disabled={busy || !csv}>Importer</button>
        </form>
      </div>
      <p class="small muted">Velg flere elementer for å flytte, merke, sortere eller eksportere.</p>
      <div class="selection-list">
        {#each items as item}<label class="check-row"
            ><input type="checkbox" bind:group={selected} value={item.id} /><span>{item.title}</span
            ></label
          >{/each}
      </div>
      <div class="button-row wrap">
        <button class="secondary" onclick={() => (selected = items.map((i) => i.id))}
          >Velg alle</button
        ><span>{selected.length} valgt</span>
      </div>
      {#if selected.length}<div class="form-grid">
          <label
            >Etikett<input bind:value={tag} /><button
              class="secondary"
              disabled={!tag || busy}
              onclick={() => bulk('tag', tag)}>Legg til etikett</button
            ></label
          ><label
            >Samling<select bind:value={collection}
              ><option value="">Velg samling</option>{#each data.collections || [] as c}<option
                  value={c.id}>{c.name}</option
                >{/each}</select
            ><button
              class="secondary"
              disabled={!collection || busy}
              onclick={() => bulk('collection', collection)}>Legg i samling</button
            ></label
          >
        </div>
        <div class="button-row wrap">
          <button class="secondary" onclick={() => bulk('sort')}>Fjern fra innboks</button><a
            class="secondary"
            href={'/api/export/package?ids=' + selected.join(',')}>Last ned pakke</a
          ><button class="text-button" onclick={() => bulk('trash')}>Flytt til papirkurv</button>
        </div>{/if}
      {#if notice}<p class="small" role="status">{notice}</p>{/if}
    </details>
    <details class="tool-panel">
      <summary>Papirkurv ({data.trash?.length || 0})</summary>{#each data.trash || [] as i}<div
          class="compact-row"
        >
          <span>{i.title}</span><button
            class="secondary"
            onclick={() =>
              act(async () => {
                await api('/items/bulk', 'POST', { ids: [i.id], action: 'restore' });
              })}>Gjenopprett</button
          >
        </div>{/each}{#if !data.trash?.length}<p class="muted">Papirkurven er tom.</p>{/if}
    </details>{/if}
</div>
