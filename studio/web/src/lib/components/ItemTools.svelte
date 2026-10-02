<script lang="ts">
  import { onMount } from 'svelte';
  import { api, uploadFile, seconds, formatDate, type Row } from '$lib/api';
  export let detail: Row;
  export let items: Row[];
  export let canEdit = false;
  export let onrefresh: () => Promise<void>;
  export let onseek: (seconds: number) => void;
  export let onopen: (id: string) => void;
  export let onproduce: (id: string) => void;
  let error = '',
    notice = '',
    busy = false,
    tags = (detail.item.tags || []).join(', '),
    rights = detail.item.rights,
    license = detail.item.rights_details?.license || '',
    consent = detail.item.rights_details?.consent || '',
    expiry = detail.item.rights_details?.expires_at || '',
    adUse = detail.item.rights_details?.ad_use || false;
  let relationTarget = '',
    relationKind = 'uses',
    days = 7,
    shareURL = '',
    criteria =
      'Uklart eller i strid med briefen\nDelvis relevant\nTydelig og relevant\nSvært tydelig og troverdig',
    brief = '',
    progress = 0;
  let left = detail.versions?.[1]?.id || detail.versions?.[0]?.id,
    right = detail.item.current_version_id;
  $: lv = detail.versions?.find((v: Row) => v.id === left);
  $: rv = detail.versions?.find((v: Row) => v.id === right);
  $: leftLines = (lv?.body || '').split('\n');
  $: rightLines = (rv?.body || '').split('\n');
  async function act(fn: () => Promise<void>) {
    error = '';
    busy = true;
    try {
      await fn();
      await onrefresh();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function job(kind: string) {
    await act(async () => {
      await api('/jobs', 'POST', {
        version_id: detail.item.current_version_id,
        kind,
        input: { criteria: criteria.split('\n').filter(Boolean), brief },
      });
      notice = 'Jobben er lagt i kø';
    });
  }
  onMount(() => {
    const timer = setInterval(() => {
      if (detail.extra?.jobs?.some((j: Row) => ['queued', 'running'].includes(j.status)))
        onrefresh().catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  });
  function metric(e: Row) {
    return e.result?.answers?.quality;
  }
</script>

<div class="item-tools">
  {#if error}<p class="error" role="alert">{error}</p>{/if}{#if notice}<p
      class="small"
      role="status"
    >
      {notice}
    </p>{/if}
  <div class="button-row wrap">
    <button
      class="secondary"
      onclick={() =>
        act(async () => {
          await api(
            '/items/' + detail.item.id + '/favorite',
            detail.extra?.favorite ? 'DELETE' : 'POST',
            {},
          );
          notice = detail.extra?.favorite ? 'Fjernet fra favoritter' : 'Lagt til i favoritter';
        })}>{detail.extra?.favorite ? 'Fjern favoritt' : 'Lagre favoritt'}</button
    ><a class="secondary" href={'/api/export/package?ids=' + detail.item.id}>Eksporter pakke</a
    >{#if canEdit}<button
        class="secondary"
        onclick={() => onproduce(detail.item.current_version_id)}>Lag vår versjon</button
      >{/if}
  </div>
  {#if canEdit}<div class="button-row wrap">
      <span class="small muted">Din vurdering</span><button
        class="secondary"
        aria-label="Tommel opp"
        onclick={() =>
          act(async () => {
            await api('/items/' + detail.item.id + '/ratings', 'POST', {
              version_id: detail.item.current_version_id,
              value: 1,
            });
          })}>↑ Bra</button
      ><button
        class="secondary"
        aria-label="Tommel ned"
        onclick={() =>
          act(async () => {
            await api('/items/' + detail.item.id + '/ratings', 'POST', {
              version_id: detail.item.current_version_id,
              value: -1,
            });
          })}>↓ Svakt</button
      ><span class="small"
        >{(detail.extra?.ratings || [])
          .filter((r: Row) => r.version_id === detail.item.current_version_id)
          .reduce((n: number, r: Row) => n + r.value, 0)} poeng</span
      >
    </div>{/if}
  <details class="tool-panel">
    <summary>Etiketter, opphav og rettigheter</summary>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        act(async () => {
          await api('/items/' + detail.item.id + '/metadata', 'PATCH', {
            tags: tags
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean),
            rights,
            rights_details: { license, consent, expires_at: expiry, ad_use: adUse },
            metadata: detail.item.metadata || {},
            inbox: false,
          });
          notice = 'Metadata lagret';
        });
      }}
    >
      <label>Etiketter, adskilt med komma<input bind:value={tags} disabled={!canEdit} /></label
      ><label
        >Rettigheter<select bind:value={rights} disabled={!canEdit}
          ><option value="unknown">Ikke avklart</option><option value="owned">Eget materiale</option
          ><option value="licensed">Lisensiert</option><option value="reference_only"
            >Kun referanse</option
          ></select
        ></label
      ><label
        >Lisens og kilde<textarea bind:value={license} rows="2" disabled={!canEdit}
        ></textarea></label
      ><label
        >Samtykke fra personer<textarea bind:value={consent} rows="2" disabled={!canEdit}
        ></textarea></label
      ><label
        >Rettighetene utløper<input type="date" bind:value={expiry} disabled={!canEdit} /></label
      ><label class="check-row"
        ><input type="checkbox" bind:checked={adUse} disabled={!canEdit} />Kan brukes i annonser</label
      >{#if canEdit}<button class="secondary" disabled={busy}>Lagre metadata</button>{/if}
    </form>
    {#if detail.versions?.[0]?.provenance?.model}<p class="small muted">
        Modell: {detail.versions[0].provenance.model}
      </p>{/if}
  </details>
  <details class="tool-panel">
    <summary>Koblinger ({detail.extra?.relations?.length || 0})</summary
    >{#each detail.extra?.relations || [] as rel}<button
        class="text-button"
        onclick={() => onopen(rel.target_id)}>{rel.kind} · {rel.target_title}</button
      >{/each}
    {#if canEdit}<form
        onsubmit={(e) => {
          e.preventDefault();
          act(async () => {
            await api('/items/' + detail.item.id + '/relations', 'POST', {
              target_id: relationTarget,
              kind: relationKind,
            });
          });
        }}
      >
        <div class="form-grid">
          <label
            >Kobling<select bind:value={relationKind}
              ><option value="uses">Bruker</option><option value="variant">Variant av</option
              ><option value="inspired_by">Inspirert av</option><option value="part_of"
                >Del av</option
              ><option value="contradicts">Motsier</option><option value="supports">Støtter</option
              ></select
            ></label
          ><label
            >Element<select bind:value={relationTarget} required
              ><option value="">Velg innhold</option
              >{#each items.filter((i) => i.id !== detail.item.id) as i}<option value={i.id}
                  >{i.title}</option
                >{/each}</select
            ></label
          >
        </div>
        <button class="secondary" disabled={busy}>Koble til</button>
      </form>{/if}
  </details>
  <details class="tool-panel">
    <summary>Sammenlign versjoner og bytt fil</summary>
    <div class="form-grid">
      <label
        >Fra<select bind:value={left}
          >{#each detail.versions || [] as v}<option value={v.id}>v{v.number} · {v.title}</option
            >{/each}</select
        ></label
      ><label
        >Til<select bind:value={right}
          >{#each detail.versions || [] as v}<option value={v.id}>v{v.number} · {v.title}</option
            >{/each}</select
        ></label
      >
    </div>
    <div class="compare-grid">
      <section>
        {#if lv?.mime?.startsWith('image/')}<img
            src={'/api/files/' + lv.id}
            alt={lv.title}
          />{:else if lv?.mime?.startsWith('video/')}<video
            src={'/api/files/' + lv.id}
            controls
            playsinline><track kind="captions" /></video
          >{/if}{#each leftLines as line}{#if !rightLines.includes(line)}<del>{line || ' '}</del
            >{:else}<p>{line}</p>{/if}{/each}
      </section>
      <section>
        {#if rv?.mime?.startsWith('image/')}<img
            src={'/api/files/' + rv.id}
            alt={rv.title}
          />{:else if rv?.mime?.startsWith('video/')}<video
            src={'/api/files/' + rv.id}
            controls
            playsinline><track kind="captions" /></video
          >{/if}{#each rightLines as line}{#if !leftLines.includes(line)}<ins>{line || ' '}</ins
            >{:else}<p>{line}</p>{/if}{/each}
      </section>
    </div>
    {#if canEdit}<label
        >Last opp ny filversjon<input
          type="file"
          disabled={busy}
          onchange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f)
              act(async () => {
                await uploadFile(
                  detail.item.product_id,
                  f,
                  {
                    item_id: detail.item.id,
                    expected_version_id: detail.item.current_version_id,
                    title: detail.item.title,
                    body: detail.item.body,
                    rights,
                  },
                  (v) => (progress = v),
                );
                notice = 'Ny filversjon lagret';
              });
          }}
        /></label
      >{#if busy && progress}<progress value={progress} max="100"></progress>{/if}{/if}
  </details>
  <details class="tool-panel">
    <summary>Transkript, skjermtekst og sekvenser ({detail.extra?.segments?.length || 0})</summary
    >{#each detail.extra?.segments || [] as s}<div class="segment-row">
        <button class="text-button" onclick={() => onseek(Number(s.start_seconds))}
          >{seconds(Number(s.start_seconds))}</button
        ><span class="small muted">{s.kind}</span>
        <p>{s.body}</p>
      </div>{/each}
    {#if canEdit}<div class="button-row wrap">
        <button class="secondary" disabled={busy} onclick={() => job('media')}
          >Lag forhåndsvisning og indeks</button
        ><button class="secondary" disabled={busy} onclick={() => job('transcribe')}
          >Transkriber</button
        >
      </div>{/if}
  </details>
  {#if canEdit}<details class="tool-panel">
      <summary>Analyse, manus og Jev-vurdering</summary><label
        >Brief og vurderingsgrunnlag<textarea
          rows="3"
          bind:value={brief}
          placeholder="Hva skal innholdet oppnå?"></textarea></label
      ><label
        >Vurderingsnivåer – ett per linje<textarea rows="4" bind:value={criteria}></textarea></label
      >
      <div class="button-row wrap">
        <button class="secondary" disabled={busy} onclick={() => job('analysis')}>Analyser</button
        ><button class="secondary" disabled={busy} onclick={() => job('script')}>Skriv manus</button
        ><button class="secondary" disabled={busy} onclick={() => job('ranking')}
          >Vurder med Jev</button
        >
      </div>
      <p class="small muted">
        Jev vurderer transkript, skjermtekst og dokumentert analyse. Poengene er en
        kvalitetsvurdering.
      </p>
    </details>{/if}
  {#if detail.extra?.jobs?.length}<div class="job-list">
      {#each detail.extra.jobs as j}<div class="compact-row">
          <span
            >{j.kind} · {j.progress || j.status}{#each j.result?.warnings || [] as warning}<small
                class="muted">{warning}</small
              >{/each}</span
          >{#if canEdit && ['queued', 'running'].includes(j.status)}<button
              class="text-button"
              onclick={() =>
                act(async () => {
                  await api('/jobs/' + j.id + '/cancel', 'POST', {});
                })}>Stopp</button
            >{/if}
        </div>{/each}
    </div>{/if}
  {#each detail.extra?.evaluations || [] as e}<article class="evaluation">
      <strong>{e.model}</strong><small
        >{formatDate(e.created_at)} · {Number(e.cost_usd).toFixed(5)} USD</small
      >{#if metric(e)}<p class="score">
          {Number(metric(e).score).toFixed(2)}
          <span class="small muted">Sikkerhet {Math.round(metric(e).confidence * 100)} %</span>
        </p>
        <p>{Object.values(metric(e).legend || {}).join(' → ')}</p>{:else}<p>
          {e.result?.summary || e.result?.title || ''}
        </p>
        <p>
          {typeof e.result?.brand_check === 'string'
            ? e.result.brand_check
            : JSON.stringify(e.result?.brand_check || '')}
        </p>{/if}
    </article>{/each}
  <details class="tool-panel">
    <summary>Del med noen utenfor arbeidsrommet</summary>{#if canEdit}<div class="button-row">
        <label>Gyldig i dager<input type="number" min="1" max="30" bind:value={days} /></label
        ><button
          class="secondary"
          onclick={() =>
            act(async () => {
              const s = await api('/items/' + detail.item.id + '/shares', 'POST', {
                version_id: detail.item.current_version_id,
                days,
              });
              shareURL = s.url;
            })}>Lag delingslenke</button
        >
      </div>
      {#if shareURL}<input
          aria-label="Delingslenke"
          readonly
          value={shareURL}
          onclick={(e) => e.currentTarget.select()}
        />{/if}{/if}{#each detail.extra?.shares || [] as s}<div class="compact-row">
        <span>{s.revoked_at ? 'Tilbakekalt' : 'Utløper ' + formatDate(s.expires_at)}</span
        >{#if canEdit && !s.revoked_at}<button
            class="text-button"
            onclick={() =>
              act(async () => {
                await api('/items/' + detail.item.id + '/shares/' + s.id, 'DELETE');
              })}>Tilbakekall</button
          >{/if}
      </div>{/each}
  </details>
</div>
