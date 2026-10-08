<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ArrowLeft, Upload, Download, Check, Clock3 } from '@lucide/svelte';
  import { api, uploadFile, seconds, formatDate, type Row } from '$lib/api';
  import MediaCard from './MediaCard.svelte';
  import ItemTools from './ItemTools.svelte';
  import ChannelPicker from './ChannelPicker.svelte';
  import ChannelLabels from './ChannelLabels.svelte';
  let folders: Row[] = [];
  async function organize(values: Row) {
    await act(async () => {
      await api(`/ads/${detail.item.id}/organization`, 'PATCH', values);
      await refresh();
    });
  }
  export let detail: Row;
  export let canEdit = false;
  export let onrefresh: () => Promise<void>;
  export let onopen: (id: string, version?: string) => void;
  export let onproduce: (id: string) => void;
  let busy = false,
    error = '',
    notice = '',
    comment = '',
    feedback = '',
    at: number | undefined;
  let uploadFileValue: File | null = null,
    versionNote = '',
    progress = 0,
    original = false,
    safeZones = false,
    media: HTMLMediaElement,
    fileInput: HTMLInputElement;
  let existing: Row[] = [],
    sourceVersion = '',
    importing = false,
    tools = false,
    editing = false;
  let title = detail.item.title,
    adType = detail.ad?.ad_type || '',
    brief = detail.ad?.brief || '';
  let textEditing = false,
    textTitle = '',
    textBody = '';
  let compareID = '',
    polls = 0;
  let versions: Row[] = [],
    people: Row[] = [];
  let mentions: string[] = [];
  $: startTime = $page.url.searchParams.has('t') ? Number($page.url.searchParams.get('t')) : null;
  $: if (media && media.readyState >= 1 && startTime !== null) seekStart(startTime);
  function seekStart(value: number | null) {
    if (media && value !== null && Number.isFinite(value) && value >= 0)
      media.currentTime = Number.isFinite(media.duration) ? Math.min(value, media.duration) : value;
  }
  $: versions = detail.versions || [];
  $: selected = versions.find((v) => v.id === $page.url.searchParams.get('version')) || versions[0];
  $: current = selected?.id === detail.item.current_version_id;
  $: review = detail.reviews?.find((r: Row) => r.version_id === selected?.id);
  $: approved = review?.status === 'approved' || (current && detail.item.status === 'approved');
  $: comparison = versions.find((v) => v.id === compareID);
  $: from =
    $page.url.searchParams.get('from') ||
    `/${detail.ad ? 'ads' : 'library'}?product=${detail.item.product_id}`;
  $: back =
    from.startsWith('/ads?') ||
    from === '/ads' ||
    from.startsWith('/library?') ||
    from === '/library' ||
    from.startsWith('/home')
      ? from
      : `/${detail.ad ? 'ads' : 'library'}?product=${detail.item.product_id}`;
  $: previewPending = (detail.extra?.jobs || []).some(
    (j: Row) =>
      j.version_id === selected?.id &&
      ['queued', 'running'].includes(j.status) &&
      ['thumbnail', 'proxy'].includes(j.kind),
  );
  $: versionNotes = (detail.notes || []).filter((n: Row) => n.version_id === selected?.id);
  function versionURL(id: string) {
    const url = new URL($page.url);
    url.searchParams.set('version', id);
    url.searchParams.delete('t');
    return url.pathname + url.search;
  }
  function preview(v: Row) {
    return v?.has_proxy && !original && !(startTime !== null && startTime > 600)
      ? `/api/previews/${v.id}?kind=proxy`
      : `/api/files/${v.id}`;
  }
  function poster(v: Row) {
    return v?.has_thumbnail ? `/api/previews/${v.id}?kind=thumbnail` : undefined;
  }
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    busy = true;
    error = '';
    notice = '';
    try {
      await fn();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function refresh() {
    await onrefresh();
  }
  async function upload(e: SubmitEvent) {
    e.preventDefault();
    if (!uploadFileValue) return;
    await act(async () => {
      const result = await uploadFile(
        detail.item.product_id,
        uploadFileValue!,
        {
          item_id: detail.item.id,
          ad_id: detail.ad ? detail.item.id : '',
          expected_version_id: detail.item.current_version_id || '',
          title: uploadFileValue!.name,
          body: versionNote,
          rights: detail.item.rights,
        },
        (v) => (progress = v),
      );
      uploadFileValue = null;
      if (fileInput) fileInput.value = '';
      versionNote = '';
      polls = 0;
      await refresh();
      await goto(versionURL(result.version_id), { noScroll: true });
      notice = 'Ny versjon er klar for gjennomgang.';
    });
  }
  async function reviewAd(status: string) {
    await act(async () => {
      await api(`/ads/${detail.item.id}/review`, 'POST', {
        version_id: selected.id,
        status,
        body: feedback,
      });
      feedback = '';
      await refresh();
      notice =
        status === 'approved'
          ? 'Denne versjonen er godkjent.'
          : 'Tilbakemeldingen er lagret for agenten.';
    });
  }
  async function postComment(e: SubmitEvent) {
    e.preventDefault();
    await act(async () => {
      await api(`/items/${detail.item.id}/notes`, 'POST', {
        body: comment,
        version_id: selected.id,
        at_seconds: at,
        mentions,
      });
      comment = '';
      mentions = [];
      at = undefined;
      await refresh();
    });
  }
  async function showExisting() {
    await act(async () => {
      existing = await api('/items?product=' + detail.item.product_id);
      importing = !importing;
    });
  }
  async function attach() {
    await act(async () => {
      const result = await api(`/ads/${detail.item.id}/versions/from-item`, 'POST', {
        source_version_id: sourceVersion,
        expected_version_id: detail.item.current_version_id || '',
      });
      importing = false;
      sourceVersion = '';
      await refresh();
      await goto(versionURL(result.version_id), { noScroll: true });
      notice = 'Versjonen er lagt til. Originalen er beholdt i biblioteket.';
    });
  }
  async function edit(e: SubmitEvent) {
    e.preventDefault();
    await act(async () => {
      await api('/ads/' + detail.item.id, 'PATCH', { title, ad_type: adType, brief });
      editing = false;
      await refresh();
    });
  }
  async function saveText() {
    await act(async () => {
      const v = await api(`/items/${detail.item.id}/versions`, 'POST', {
        title: textTitle,
        body: textBody,
        expected_version_id: detail.item.current_version_id,
      });
      textEditing = false;
      await refresh();
      await goto(versionURL(v.id), { noScroll: true });
    });
  }
  async function retryPreview(kind: string) {
    await act(async () => {
      await api('/jobs', 'POST', { version_id: selected.id, kind });
      polls = 0;
      await refresh();
      notice = 'Forhåndsvisningen er lagt i kø.';
    });
  }
  function seek(value: number) {
    if (media) {
      media.currentTime = value;
      media.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  onMount(() => {
    if (detail.ad)
      void api('/ad-folders?product=' + detail.item.product_id)
        .then((value) => (folders = value))
        .catch((e) => (error = e.message));
    // Poll only processing metadata, only while visible, and stop after five minutes.
    const timer = setInterval(() => {
      if (
        !document.hidden &&
        !busy &&
        polls < 60 &&
        (detail.extra?.jobs || []).some(
          (j: Row) =>
            ['queued', 'running'].includes(j.status) && ['thumbnail', 'proxy'].includes(j.kind),
        )
      ) {
        polls++;
        void refresh().catch(() => {});
      }
    }, 5000);
    return () => clearInterval(timer);
  });
</script>

<section class="review-page">
  <a class="review-back" href={back}
    ><ArrowLeft size={17} />{detail.ad ? 'Til annonser' : 'Til biblioteket'}</a
  >
  <header class="review-heading">
    <div>
      <p class="eyebrow">{detail.ad?.ad_type || 'BIBLIOTEK'} · {versions.length} VERSJONER</p>
      <h1>{detail.item.title}</h1>
      {#if selected}<p class="review-filename">{selected.file_name || selected.title}</p>{/if}
    </div>
    <button class="secondary" disabled={busy} onclick={() => act(refresh)}>Oppdater</button>
  </header>
  {#if error}<div class="error review-alert" role="alert">{error}</div>{/if}{#if notice}<p
      class="review-notice"
      role="status"
    >
      {notice}
    </p>{/if}
  <div class="review-layout">
    <div class="review-main">
      {#if selected}
        <div class="review-player-header">
          <label class="review-version-picker"
            >Vis versjon<select
              aria-label="Vis versjon"
              value={selected.id}
              onchange={(e) => goto(versionURL(e.currentTarget.value), { noScroll: true })}
              >{#each versions as v}<option value={v.id}
                  >v{v.number}{v.id === detail.item.current_version_id ? ' · nyeste' : ''}</option
                >{/each}</select
            ></label
          ><span
            class="review-status"
            class:approved
            class:changes={review?.status === 'changes_requested'}
            >{approved
              ? 'Godkjent'
              : review?.status === 'changes_requested'
                ? 'Trenger endringer'
                : 'Til gjennomgang'}</span
          >{#if selected.file_name}<a
              class="text-button"
              href={`/api/files/${selected.id}?download=1`}
              download><Download size={16} />Last ned</a
            >{/if}
        </div>
        {#if detail.ad}<section class="version-channels">
            {#if canEdit}<ChannelPicker
                label={`Kanaler for v${selected.number}`}
                value={selected.channels || []}
                disabled={busy}
                onchange={(channels) => organize({ version_id: selected.id, channels })}
              />
            {:else}<p class="small muted">Kanaler for v{selected.number}</p>
              <ChannelLabels value={selected.channels || []} />{/if}
          </section>{/if}
        <div class:comparing={!!comparison} class="review-players">
          <div>
            {#key selected.id}<div class="review-media">
                {#if selected.mime?.startsWith('video/')}<video
                    bind:this={media}
                    onloadedmetadata={() => seekStart(startTime)}
                    src={preview(selected)}
                    poster={poster(selected)}
                    preload="metadata"
                    controls
                    playsinline><track kind="captions" /></video
                  >
                {:else if selected.mime?.startsWith('image/')}<img
                    src={'/api/files/' + selected.id}
                    alt={selected.title}
                    decoding="async"
                  />
                {:else if selected.mime?.startsWith('audio/')}<audio
                    bind:this={media}
                    onloadedmetadata={() => seekStart(startTime)}
                    src={'/api/files/' + selected.id}
                    controls
                    preload="metadata"
                  ></audio>
                {:else}<p class="body-text">
                    {selected.body || 'Ingen fil i denne versjonen.'}
                  </p>{/if}
                {#if safeZones && selected.mime?.startsWith('video/')}<div
                    class="safe-overlay"
                    aria-hidden="true"
                  >
                    <span>Profil / tittel</span><span>Handlinger</span><span
                      >Posttekst / navigasjon</span
                    >
                  </div>{/if}
              </div>{/key}
          </div>
          {#if comparison}<div>
              <p class="small muted">Sammenligner med v{comparison.number}</p>
              <div class="review-media">
                {#if comparison.mime?.startsWith('video/')}<video
                    src={preview(comparison)}
                    poster={poster(comparison)}
                    preload="none"
                    controls
                    playsinline><track kind="captions" /></video
                  >{:else if comparison.mime?.startsWith('image/')}<img
                    src={'/api/files/' + comparison.id}
                    alt={comparison.title}
                    loading="lazy"
                  />{:else}<p>{comparison.body}</p>{/if}
              </div>
            </div>{/if}
        </div>
        {#if selected.mime?.startsWith('video/')}<details class="review-display-options">
            <summary>Visningsvalg</summary>
            {#if selected.has_proxy}<label class="check-row"
                ><input type="checkbox" bind:checked={original} />Spill originalfilen ·
                forhåndsvisning dekker inntil 10 minutter</label
              >{/if}
            <label class="check-row"
              ><input type="checkbox" bind:checked={safeZones} />Vis omtrentlige trygge soner for
              vertikal video</label
            >
          </details>{/if}
        {#if selected.file_name && (!selected.has_thumbnail || (selected.mime?.startsWith('video/') && !selected.has_proxy))}<div
            class="preview-processing"
          >
            <span class="small muted"
              >{previewPending
                ? 'Forhåndsvisningen klargjøres.'
                : 'Forhåndsvisningen mangler.'}</span
            >{#if canEdit && !previewPending}<button
                class="text-button"
                disabled={busy}
                onclick={() => retryPreview(!selected.has_thumbnail ? 'thumbnail' : 'proxy')}
                >Lag manglende forhåndsvisning</button
              >{/if}
          </div>{/if}
        {#if selected.body && selected.file_name}<p class="body-text version-description">
            {selected.body}
          </p>{/if}
        {#if !current}<p class="review-older">
            Du ser v{selected.number}.
            <a href={versionURL(detail.item.current_version_id)}>Gå til nyeste versjon →</a>
          </p>{/if}
        {#if review?.body}<blockquote class="review-feedback">
            <strong
              >{review.author} · {review.status === 'approved'
                ? 'Godkjent'
                : 'Ønsker endringer'}</strong
            >
            <p>{review.body}</p>
          </blockquote>{/if}
        {#if canEdit && current && detail.ad}<section class="review-decision">
            <h2>Din vurdering av v{selected.number}</h2>
            <label class="sr-only" for="review-feedback">Tilbakemelding til agenten</label><textarea
              id="review-feedback"
              bind:value={feedback}
              maxlength="10000"
              rows="3"
              placeholder="Hva fungerer, og hva skal endres i neste versjon?"></textarea>
            <div class="button-row">
              <button
                class="primary"
                disabled={busy || approved}
                onclick={() => reviewAd('approved')}
                ><Check size={16} />Godkjenn v{selected.number}</button
              ><button
                class="secondary"
                disabled={busy || !feedback.trim()}
                onclick={() => reviewAd('changes_requested')}>Be om endringer</button
              >
            </div>
          </section>{/if}
        {#if canEdit && current && !detail.ad}<div class="button-row">
            <button
              class="secondary"
              onclick={() => {
                textEditing = !textEditing;
                textTitle = selected.title;
                textBody = selected.body;
              }}>Ny versjon</button
            >{#if !approved}<button
                class="primary"
                disabled={busy}
                onclick={() =>
                  act(async () => {
                    await api(`/items/${detail.item.id}/approve`, 'POST', {
                      version_id: selected.id,
                    });
                    await refresh();
                  })}>Godkjenn</button
              >{/if}
          </div>{/if}
        {#if textEditing}<section class="review-panel">
            <label>Tittel<input bind:value={textTitle} /></label><label
              >Innhold<textarea bind:value={textBody} rows="6"></textarea></label
            ><button class="primary" disabled={busy} onclick={saveText}>Lagre ny versjon</button>
          </section>{/if}
        <section class="review-comments">
          <h2>Tilbakemeldinger <span class="muted">· v{selected.number}</span></h2>
          {#each versionNotes as n}<article>
              <div>
                <strong>{n.author}</strong>{#if n.at_seconds != null}<button
                    class="text-button"
                    onclick={() => seek(Number(n.at_seconds))}
                    >{seconds(Number(n.at_seconds))}</button
                  >{/if}<small>{formatDate(n.created_at)}</small>
              </div>
              <p>{n.body}</p>
              {#if n.resolved_at}<small class="muted">Løst</small>{/if}
              {#if canEdit}<button
                  class="text-button"
                  disabled={busy}
                  onclick={() =>
                    act(async () => {
                      await api(`/items/${detail.item.id}/notes/${n.id}`, 'PATCH', {
                        resolved: !n.resolved_at,
                      });
                      await refresh();
                    })}>{n.resolved_at ? 'Åpne igjen' : 'Marker løst'}</button
                >{/if}
            </article>{:else}<p class="small muted">
              Ingen kommentarer til denne versjonen ennå.
            </p>{/each}
          {#if canEdit}<form onsubmit={postComment}>
              <label class="sr-only" for="version-comment">Kommentar</label><textarea
                id="version-comment"
                bind:value={comment}
                rows="2"
                placeholder="En tanke eller tilbakemelding …"
                required></textarea>
              <div class="comment-time">
                <label
                  >Tidspunkt i video · sekunder<input
                    type="number"
                    min="0"
                    step="0.1"
                    bind:value={at}
                  /></label
                >{#if selected.mime?.startsWith('video/')}<button
                    type="button"
                    class="text-button"
                    onclick={() => (at = Math.round((media?.currentTime || 0) * 10) / 10)}
                    ><Clock3 size={15} />Bruk avspillingstid</button
                  >{/if}
              </div>
              <details
                class="comment-options"
                ontoggle={(e) => {
                  if (e.currentTarget.open)
                    void api('/products/' + detail.item.product_id + '/people')
                      .then((value) => (people = value))
                      .catch(() => {});
                }}
              >
                <summary>Nevn noen</summary><label
                  >Person eller agent<select multiple bind:value={mentions}
                    >{#each people as person}<option value={person.id}>{person.name}</option
                      >{/each}</select
                  ></label
                >
              </details>
              <button class="secondary" disabled={busy || !comment.trim()}>Legg til notat</button>
            </form>{/if}
        </section>
      {:else}<div class="review-no-file">
          <Upload size={32} strokeWidth={1.3} />
          <h2>Klar for første versjon</h2>
          <p>Last opp en video eller et bilde, eller la agenten levere til denne annonsen.</p>
        </div>{/if}
    </div>
    <aside class="review-sidebar">
      {#if detail.ad}<section class="review-panel ad-organization">
          <h2>Organisering</h2>
          {#if canEdit}<label
              >Mappe<select
                aria-label="Mappe"
                value={detail.ad.folder_id || ''}
                disabled={busy}
                onchange={(e) => organize({ folder_id: e.currentTarget.value })}
                ><option value="">Uten mappe</option>{#each folders as f}<option value={f.id}
                    >{f.name}</option
                  >{/each}</select
              ></label
            >
            <ChannelPicker
              label="Kanaler for annonsen"
              value={detail.ad.channels || []}
              disabled={busy}
              onchange={(channels) => organize({ channels })}
            />
          {:else}<p>{detail.ad.folder_name || 'Uten mappe'}</p>
            <p class="small muted">Kanaler for annonsen</p>
            <ChannelLabels value={detail.ad.channels || []} />{/if}
          <p class="small muted">Hver versjon kan merkes med egne kanaler.</p>
        </section>{/if}
      <section class="review-panel">
        <div class="section-heading">
          <h2>Versjoner</h2>
          <span class="muted">{versions.length}</span>
        </div>
        <div class="review-version-list">
          {#each versions as v}<a class:chosen={v.id === selected?.id} href={versionURL(v.id)}
              ><MediaCard item={v} />
              <div>
                <strong
                  >v{v.number} {v.id === detail.item.current_version_id ? '· nyeste' : ''}</strong
                ><span>{v.file_name || v.title}</span><small
                  >{formatDate(v.created_at)} · {v.created_by}</small
                ><ChannelLabels value={v.channels || []} />
              </div></a
            >{/each}
        </div>
        {#if versions.length > 1}<label class="compare-select"
            >Sammenlign med<select bind:value={compareID}
              ><option value="">Ingen sammenligning</option
              >{#each versions.filter((v) => v.id !== selected?.id) as v}<option value={v.id}
                  >v{v.number} · {v.file_name || v.title}</option
                >{/each}</select
            ></label
          >{/if}
      </section>
      {#if canEdit}<form class="review-panel" onsubmit={upload}>
          <h2>{versions.length ? 'Last opp neste versjon' : 'Last opp første versjon'}</h2>
          <p class="small muted">
            Filen legges til denne {detail.ad ? 'annonsen' : 'oppføringen'}. Tidligere versjoner
            beholdes.
          </p>
          <label
            >Video eller bilde<input
              type="file"
              bind:this={fileInput}
              accept="video/*,image/*"
              disabled={busy}
              onchange={(e) => (uploadFileValue = e.currentTarget.files?.[0] || null)}
            /></label
          ><label
            >Hva er endret?<textarea
              rows="2"
              bind:value={versionNote}
              placeholder="Ny hook, kortere intro, annen CTA …"></textarea></label
          ><button class="primary wide" disabled={busy || !uploadFileValue}
            ><Upload size={16} />{busy ? `Laster opp ${progress} %` : 'Lagre filversjon'}</button
          >{#if detail.ad}<button
              class="text-button"
              type="button"
              disabled={busy}
              onclick={showExisting}>Bruk en eksisterende opplasting</button
            >{/if}
        </form>{/if}
      {#if importing}<section class="review-panel">
          <h2>Samle eksisterende filer</h2>
          <p class="small muted">
            Velg en opplasting som hører til denne annonsen. Originalen beholdes.
          </p>
          <label
            >Eksisterende video eller bilde<select bind:value={sourceVersion}
              ><option value="">Velg en fil</option
              >{#each existing.filter((i) => i.id !== detail.item.id && i.current_version_id && ['video', 'image', 'carousel'].includes(i.kind)) as item}<option
                  value={item.current_version_id}>{item.title} · {item.file_name}</option
                >{/each}</select
            ></label
          ><button class="primary" disabled={busy || !sourceVersion} onclick={attach}
            >Legg til som neste versjon</button
          >
        </section>{/if}
      {#if detail.ad}<section class="review-panel">
          <div class="section-heading">
            <h2>Brief og annonsetype</h2>
            {#if canEdit}<button class="text-button" onclick={() => (editing = !editing)}
                >Rediger</button
              >{/if}
          </div>
          {#if editing}<form onsubmit={edit}>
              <label>Annonsetittel<input bind:value={title} maxlength="300" required /></label
              ><label>Annonsetype<input bind:value={adType} maxlength="80" required /></label><label
                >Brief<textarea bind:value={brief} rows="4" maxlength="20000"></textarea></label
              ><button class="primary" disabled={busy}>Lagre</button>
            </form>{:else}<p><strong>{detail.ad.ad_type}</strong></p>
            <p class="body-text">{detail.ad.brief || 'Ingen brief ennå.'}</p>{/if}
          <details class="agent-reference">
            <summary>Referanse for agenten</summary>
            <p class="small muted">Bruk samme annonse-ID for hver ny filversjon.</p>
            <code>{detail.item.id}</code>
            <p class="small">Nøkkel: {detail.ad.external_key}</p>
          </details>
        </section>{/if}
    </aside>
  </div>
  {#if selected && current}<details
      class="review-advanced"
      ontoggle={(e) => {
        if (e.currentTarget.open) {
          tools = true;
          void api('/items?product=' + detail.item.product_id)
            .then((data) => (existing = data))
            .catch(() => {});
        }
      }}
    >
      <summary>Flere verktøy · rettigheter, behandling og deling</summary>{#if tools}<ItemTools
          {detail}
          items={existing}
          {canEdit}
          onrefresh={refresh}
          onseek={seek}
          {onopen}
          {onproduce}
        />{/if}
    </details>{/if}
</section>
