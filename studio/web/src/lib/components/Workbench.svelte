<script lang="ts">
  import { onMount } from 'svelte';
  import { api, formatDate, localInput, osloISO, states, type Row } from '$lib/api';
  export let product: string;
  export let user: Row;
  export let items: Row[];
  export let publications: Row[];
  export let canEdit = false;
  export let area = 'production';
  export let seed = '';
  export let onchange: () => Promise<void>;
  export let onproduct: (id: string) => Promise<void>;
  export let onopen: (id: string) => void;
  let templates: Row[] = [],
    campaigns: Row[] = [],
    experiments: Row[] = [],
    claims: Row[] = [],
    jobs: Row[] = [],
    notifications: Row[] = [],
    profiles: Row[] = [],
    members: Row[] = [],
    history: Row[] = [],
    insights: Row = { results: [], conversions: [] },
    operations: Row | null = null;
  let busy = false,
    error = '',
    notice = '',
    form = '',
    editID = '',
    sources: string[] = seed ? [seed] : [],
    formats = ['9:16'],
    requirements = ['Undertekster', 'Korrekt logo', 'Kildefiler'],
    values: Record<string, string> = {},
    fields: Row[] = [{ name: 'headline', label: 'Overskrift', required: true, default: '' }],
    lockedColor = '#3c493c',
    lockedLogo = '',
    lockedFont = '';
  let draft: Row = {},
    hookIDs: string[] = [],
    bodyIDs: string[] = [],
    ctaIDs: string[] = [],
    csv = '',
    currency = 'NOK',
    resetEmail = '',
    secret = '',
    productName = '',
    memberRestriction = false;
  const areas = [
    ['production', 'Produksjon'],
    ['campaigns', 'Kampanjer'],
    ['insights', 'Resultater'],
    ['knowledge', 'Kunnskap'],
    ['activity', 'Aktivitet'],
    ['admin', 'Arbeidsrom'],
  ];
  async function load() {
    const q = '?product=' + product;
    [templates, campaigns, experiments, claims, jobs, notifications, profiles, insights] =
      await Promise.all([
        api('/templates' + q),
        api('/campaigns' + q),
        api('/experiments' + q),
        api('/claims' + q),
        api('/jobs' + q),
        api('/notifications'),
        api('/profiles' + q),
        api('/insights' + q + '&currency=' + currency),
      ]);
    history = await api('/products/' + product + '/history');
    const ps = await api('/products');
    memberRestriction = !!ps.find((p: Row) => p.id === product)?.restricted;
    if (user.role === 'admin') {
      [members, operations] = await Promise.all([
        api('/products/' + product + '/members'),
        api('/operations'),
      ]);
    }
  }
  onMount(() => {
    load()
      .then(() => {
        if (seed) start('production');
      })
      .catch((e) => (error = e.message));
  });
  async function act(fn: () => Promise<void>, close = false) {
    busy = true;
    error = '';
    notice = '';
    try {
      await fn();
      if (close) {
        form = '';
        editID = '';
      }
      await load();
      await onchange();
      if (!notice) notice = 'Lagret';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  function start(next: string, row: Row = {}) {
    form = next;
    editID = row.id || '';
    error = '';
    secret = '';
    draft = {
      name: '',
      title: '',
      brief: '',
      kind: 'video',
      template_id: '',
      campaign_id: '',
      instructions: '',
      goal: '',
      starts_at: '',
      ends_at: '',
      budget: 0,
      channels: ['Instagram'],
      status: 'planned',
      hypothesis: '',
      metric: 'conversions',
      variants: [],
      conclusion: '',
      statement: '',
      scope: 'product',
      confidence: 'medium',
      sources: '',
      contradicts: '',
      publication_id: publications[0]?.id || '',
      measured_at: localInput(),
      mode: 'organic',
      views: 0,
      clicks: 0,
      likes: 0,
      spend: 0,
      currency,
      role: 'chat',
      provider: 'openrouter',
      model: '',
      fallback_model: '',
      max_steps: 6,
      max_tokens: 2048,
      timeout_seconds: 120,
      max_cost_usd: 0.1,
      profile: '',
      ...row,
    };
    if (next === 'claim') {
      draft.kind = row.kind || 'claim';
      draft.sources = (row.sources || []).join('\n');
    }
    if (next === 'template') {
      draft.kind = row.kind || 'visual';
      fields = row.fields
        ? structuredClone(row.fields)
        : [{ name: 'headline', label: 'Overskrift', required: true, default: '' }];
      lockedColor = row.locked?.color || '#3c493c';
      lockedLogo = row.locked?.logo || '';
      lockedFont = row.locked?.font || '';
    }
    if (next === 'production' || next === 'variants') {
      values = {};
      sources = seed ? [seed] : [];
    }
  }
  $: chosenTemplate = templates.find((t) => t.id === draft.template_id);
  async function save(e: SubmitEvent) {
    e.preventDefault();
    await act(async () => {
      if (form === 'template') {
        await api('/templates' + (editID ? '/' + editID : ''), editID ? 'PUT' : 'POST', {
          product_id: product,
          name: draft.name,
          kind: draft.kind,
          fields,
          locked: { color: lockedColor, logo: lockedLogo, font: lockedFont },
          example_version_id: draft.example_version_id || '',
          instructions: draft.instructions,
          revision: draft.revision || 1,
        });
      }
      if (form === 'production' || form === 'variants') {
        const payload = {
          product_id: product,
          title: draft.title,
          brief: draft.brief,
          kind: draft.kind,
          template_id: draft.template_id,
          campaign_id: draft.campaign_id,
          source_versions: sources,
          fields: values,
          formats,
          requirements,
          profile: draft.profile || draft.kind,
        };
        const out = await api(
          form === 'variants' ? '/production/variants' : '/production',
          'POST',
          form === 'variants'
            ? { ...payload, hooks: hookIDs, bodies: bodyIDs, ctas: ctaIDs }
            : payload,
        );
        notice =
          form === 'variants'
            ? out.count + ' varianter opprettet'
            : 'Oppgaven er klar for en agent';
      }
      if (form === 'campaign') {
        await api('/campaigns' + (editID ? '/' + editID : ''), editID ? 'PUT' : 'POST', {
          product_id: product,
          name: draft.name,
          goal: draft.goal,
          starts_at: draft.starts_at || null,
          ends_at: draft.ends_at || null,
          budget: Number(draft.budget),
          channels: draft.channels,
          status: draft.status,
        });
      }
      if (form === 'experiment') {
        await api('/experiments' + (editID ? '/' + editID : ''), editID ? 'PUT' : 'POST', {
          product_id: product,
          campaign_id: draft.campaign_id || '',
          name: draft.name,
          hypothesis: draft.hypothesis,
          metric: draft.metric,
          variants: draft.variants,
          conclusion: draft.conclusion,
        });
      }
      if (form === 'measurement') {
        await api('/measurements', 'POST', {
          publication_id: draft.publication_id,
          measured_at: osloISO(draft.measured_at),
          mode: draft.mode,
          views: Number(draft.views),
          clicks: Number(draft.clicks),
          likes: Number(draft.likes),
          spend: Number(draft.spend),
          currency: draft.currency,
          source: 'manual',
        });
      }
      if (form === 'claim') {
        await api('/claims', 'POST', {
          product_id: product,
          scope: draft.scope,
          statement: draft.statement,
          sources: draft.sources.split('\n').filter(Boolean),
          confidence: draft.confidence,
          kind: draft.kind,
          contradicts: draft.contradicts,
        });
      }
      if (form === 'profile') {
        await api('/profiles', 'PUT', {
          product_id: product,
          role: draft.role,
          name: draft.name,
          provider: draft.provider,
          model: draft.model,
          fallback_model: draft.fallback_model,
          max_steps: Number(draft.max_steps),
          max_tokens: Number(draft.max_tokens),
          timeout_seconds: Number(draft.timeout_seconds),
          max_cost_usd: Number(draft.max_cost_usd),
        });
      }
    }, true);
  }
  function netRevenue(pub: string) {
    return (insights.conversions || [])
      .filter((c: Row) => c.publication_id === pub)
      .reduce((n: number, c: Row) => n + Number(c.revenue || 0), 0);
  }
</script>

<section class="page-heading">
  <div>
    <p class="eyebrow">FRA MATERIALE TIL LÆRING</p>
    <h1>{areas.find((a) => a[0] === area)?.[1] || 'Arbeidsrom'}</h1>
    <p class="muted">Alt rundt innholdet, samlet på ett sted.</p>
  </div>
</section>
<nav class="work-tabs" aria-label="Arbeidsområder">
  {#each areas as [id, label]}<button
      class:active={area === id}
      onclick={() => {
        area = id;
        form = '';
        secret = '';
      }}>{label}</button
    >{/each}
</nav>
{#if error}<p class="error" role="alert">{error}</p>{/if}{#if notice}<p
    class="notice-inline"
    role="status"
  >
    {notice}
  </p>{/if}
{#if form}
  <section class="work-card form-card">
    <div class="section-heading">
      <h2>
        {(
          {
            production: 'Bestill produksjon',
            variants: 'Lag annonsevarianter',
            template: 'Produksjonsmal',
            campaign: 'Kampanje',
            experiment: 'Eksperiment',
            measurement: 'Registrer resultater',
            claim: 'Ny kunnskap',
            profile: 'Modellprofil',
          } as Record<string, string>
        )[form]}
      </h2>
      <button class="text-button" onclick={() => (form = '')}>Lukk</button>
    </div>
    <form onsubmit={save}>
      {#if ['production', 'variants'].includes(form)}
        <label>Tittel<input bind:value={draft.title} required maxlength="300" /></label><label
          >Brief<textarea
            rows="4"
            bind:value={draft.brief}
            required
            placeholder="Mål, budskap, varighet og hva som skal leveres …"></textarea></label
        >
        <div class="form-grid">
          <label
            >Produksjonstype<select bind:value={draft.kind}
              ><option value="video">Video</option><option value="design">Bilder og karusell</option
              ><option value="script">Manus</option></select
            ></label
          ><label
            >Kampanje<select bind:value={draft.campaign_id}
              ><option value="">Ingen kampanje</option>{#each campaigns as c}<option value={c.id}
                  >{c.name}</option
                >{/each}</select
            ></label
          >
        </div>
        <label
          >Mal<select bind:value={draft.template_id} onchange={() => (values = {})}
            ><option value="">Fri produksjon</option>{#each templates as t}<option value={t.id}
                >{t.name}</option
              >{/each}</select
          ></label
        >
        {#if chosenTemplate}<p class="muted">{chosenTemplate.instructions}</p>
          {#each chosenTemplate.fields || [] as field}<label
              >{field.label}<input
                bind:value={values[field.name]}
                required={field.required && !field.default}
                placeholder={field.default}
              /></label
            >{/each}
          <p class="small muted">Merkevarefeltene i malen er låst for agenten.</p>{/if}
        <label
          >Modellprofil<select bind:value={draft.profile}
            ><option value="">Standard for produksjonstypen</option>{#each profiles as p}<option
                value={p.role}>{p.name || p.role} · {p.model || p.provider}</option
              >{/each}</select
          ></label
        >
        <fieldset>
          <legend>Leveranseformater</legend>
          <div class="button-row wrap">
            {#each ['9:16', '1:1', '4:5', '16:9'] as format}<label class="check-row"
                ><input type="checkbox" bind:group={formats} value={format} />{format}</label
              >{/each}
          </div>
        </fieldset>
        <fieldset>
          <legend>Leveransekrav</legend
          >{#each ['Undertekster', 'Korrekt logo', 'Kildefiler', 'Musikk med rettigheter', 'Telefonmockup', 'Intro og outro', 'Sjekket mot brief', 'Plattformens trygge soner'] as req}<label
              class="check-row"
              ><input type="checkbox" bind:group={requirements} value={req} />{req}</label
            >{/each}
        </fieldset>
        {#if form === 'variants'}<p class="muted">
            {hookIDs.length} hooks × {bodyIDs.length} hoveddeler × {ctaIDs.length} CTA-er = {hookIDs.length *
              bodyIDs.length *
              ctaIDs.length} varianter. Maks 50.
          </p>
          <div class="form-grid">
            <label
              >Hooks<select multiple bind:value={hookIDs} size="5"
                >{#each items as i}<option value={i.current_version_id}>{i.title}</option
                  >{/each}</select
              ></label
            ><label
              >Hoveddeler<select multiple bind:value={bodyIDs} size="5"
                >{#each items as i}<option value={i.current_version_id}>{i.title}</option
                  >{/each}</select
              ></label
            ><label
              >CTA-er<select multiple bind:value={ctaIDs} size="5"
                >{#each items as i}<option value={i.current_version_id}>{i.title}</option
                  >{/each}</select
              ></label
            >
          </div>{:else}<fieldset>
            <legend>Materiale agenten skal bruke</legend>
            <div class="selection-list">
              {#each items as i}<label class="check-row"
                  ><input
                    type="checkbox"
                    bind:group={sources}
                    value={i.current_version_id}
                  />{i.title}</label
                >{/each}
            </div>
          </fieldset>{/if}
      {:else if form === 'template'}
        <label>Malnavn<input bind:value={draft.name} required /></label><label
          >Maltype<select bind:value={draft.kind}
            ><option value="visual">Visuell mal</option><option value="structure"
              >Strukturmal</option
            ><option value="prompt">Promptmal</option></select
          ></label
        ><label>Instruksjoner<textarea rows="4" bind:value={draft.instructions}></textarea></label
        ><label
          >Eksempel<select bind:value={draft.example_version_id}
            ><option value="">Uten eksempel</option>{#each items as i}<option
                value={i.current_version_id}>{i.title}</option
              >{/each}</select
          ></label
        >
        <h3>Redigerbare felt</h3>
        {#each fields as f, index}<div class="form-grid">
            <label>Feltnøkkel<input bind:value={f.name} required /></label><label
              >Feltnavn<input bind:value={f.label} required /></label
            ><label>Standardverdi<input bind:value={f.default} /></label><label class="check-row"
              ><input type="checkbox" bind:checked={f.required} />Påkrevd</label
            ><button
              type="button"
              class="text-button"
              onclick={() => (fields = fields.filter((_, i) => i !== index))}>Fjern felt</button
            >
          </div>{/each}<button
          type="button"
          class="secondary"
          onclick={() =>
            (fields = [
              ...fields,
              { name: 'field' + fields.length, label: '', required: false, default: '' },
            ])}>Legg til felt</button
        >
        <h3>Låst merkevare</h3>
        <label>Farge<input type="color" bind:value={lockedColor} /></label><label
          >Logo – lenke eller bibliotek-ID<input bind:value={lockedLogo} /></label
        ><label>Font og lisens<input bind:value={lockedFont} /></label>
      {:else if form === 'campaign'}
        <label>Kampanjenavn<input bind:value={draft.name} required /></label><label
          >Mål<textarea rows="3" bind:value={draft.goal}></textarea></label
        >
        <div class="form-grid">
          <label>Fra<input type="date" bind:value={draft.starts_at} /></label><label
            >Til<input type="date" bind:value={draft.ends_at} /></label
          ><label
            >Planlagt budsjett · NOK<input
              type="number"
              min="0"
              step="0.01"
              bind:value={draft.budget}
            /></label
          ><label
            >Status<select bind:value={draft.status}
              ><option value="planned">Planlagt</option><option value="active">Aktiv</option><option
                value="completed">Ferdig</option
              ></select
            ></label
          >
        </div>
        <fieldset>
          <legend>Kanaler</legend
          >{#each ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Snapchat'] as channel}<label
              class="check-row"
              ><input type="checkbox" bind:group={draft.channels} value={channel} />{channel}</label
            >{/each}
        </fieldset>
      {:else if form === 'experiment'}
        <label>Navn<input bind:value={draft.name} required /></label><label
          >Hypotese<textarea rows="3" bind:value={draft.hypothesis} required></textarea></label
        ><label
          >Kampanje<select bind:value={draft.campaign_id}
            ><option value="">Ingen</option>{#each campaigns as c}<option value={c.id}
                >{c.name}</option
              >{/each}</select
          ></label
        ><label
          >Måletall<select bind:value={draft.metric}
            ><option value="conversions">Konverteringer</option><option value="ctr"
              >Klikkrate</option
            ><option value="views">Visninger</option><option value="revenue">Omsetning</option
            ></select
          ></label
        >
        <fieldset>
          <legend>Varianter</legend>
          <div class="selection-list">
            {#each items as i}<label class="check-row"
                ><input type="checkbox" bind:group={draft.variants} value={i.id} />{i.title}</label
              >{/each}
          </div>
        </fieldset>
        <label
          >Konklusjon<textarea
            rows="4"
            bind:value={draft.conclusion}
            placeholder="Hva lærte vi? Lagres også i biblioteket."></textarea></label
        >
      {:else if form === 'measurement'}
        <label
          >Publisering<select bind:value={draft.publication_id} required
            >{#each publications as p}<option value={p.id}>{p.title}</option>{/each}</select
          ></label
        >
        <div class="form-grid">
          <label
            >Målt tidspunkt<input
              type="datetime-local"
              bind:value={draft.measured_at}
              required
            /></label
          ><label
            >Type<select bind:value={draft.mode}
              ><option value="organic">Organisk</option><option value="paid">Betalt</option></select
            ></label
          ><label
            >Valuta<select bind:value={draft.currency}
              ><option>NOK</option><option>USD</option><option>EUR</option></select
            ></label
          ><label>Visninger<input type="number" min="0" bind:value={draft.views} /></label><label
            >Klikk<input type="number" min="0" bind:value={draft.clicks} /></label
          ><label>Liker<input type="number" min="0" bind:value={draft.likes} /></label><label
            >Forbruk<input type="number" min="0" step="0.01" bind:value={draft.spend} /></label
          >
        </div>
      {:else if form === 'claim'}
        <label
          >Påstand eller kundesitat<textarea rows="4" bind:value={draft.statement} required
          ></textarea></label
        >
        <div class="form-grid">
          <label
            >Type<select bind:value={draft.kind}
              ><option value="claim">Påstand</option><option value="customer_quote"
                >Kundesitat</option
              ><option value="objection">Innvending</option></select
            ></label
          ><label
            >Nivå<select bind:value={draft.scope}
              ><option value="product">Produkt</option><option value="company">Selskap</option
              ><option value="platform">Plattform</option></select
            ></label
          ><label
            >Sikkerhet<select bind:value={draft.confidence}
              ><option value="low">Lav</option><option value="medium">Middels</option><option
                value="high">Høy</option
              ></select
            ></label
          >
        </div>
        <label>Kilder – én per linje<textarea rows="3" bind:value={draft.sources}></textarea></label
        ><label
          >Motsier tidligere kunnskap<select bind:value={draft.contradicts}
            ><option value="">Ingen kjent motsetning</option>{#each claims as c}<option value={c.id}
                >{c.statement.slice(0, 100)}</option
              >{/each}</select
          ></label
        >
      {:else if form === 'profile'}
        <label>Profilnavn<input bind:value={draft.name} required /></label><label
          >Oppgave / profil-ID<input
            bind:value={draft.role}
            required
            placeholder="chat, script, analysis, ranking …"
          /></label
        >
        <div class="form-grid">
          <label
            >Leverandør<select bind:value={draft.provider}
              ><option value="openrouter">OpenRouter</option><option value="typesafe"
                >TypeSafe Jev</option
              ><option value="external">Ekstern agent</option></select
            ></label
          ><label>Modell<input bind:value={draft.model} placeholder="leverandør/modell" /></label
          ><label
            >Reservemodell<input bind:value={draft.fallback_model} placeholder="Valgfritt" /></label
          ><label
            >Maks steg<input type="number" min="1" max="12" bind:value={draft.max_steps} /></label
          ><label
            >Maks output-tokens<input
              type="number"
              min="128"
              max="8192"
              bind:value={draft.max_tokens}
            /></label
          ><label
            >Tidsgrense · sekunder<input
              type="number"
              min="10"
              max="300"
              bind:value={draft.timeout_seconds}
            /></label
          ><label
            >Maks kostnad · USD<input
              type="number"
              min="0.001"
              max="5"
              step="0.001"
              bind:value={draft.max_cost_usd}
            /></label
          >
        </div>
        <p class="small muted">
          Reservemodellen brukes bare når hovedmodellen ikke kan valideres før et kall. Ingen
          automatisk gjentakelse av betalte kall.
        </p>
      {/if}
      <div class="button-row">
        <button class="primary" disabled={busy}
          >{busy
            ? 'Lagrer …'
            : ['production', 'variants'].includes(form)
              ? 'Opprett produksjon'
              : 'Lagre'}</button
        ><button type="button" class="secondary" onclick={() => (form = '')}>Avbryt</button>
      </div>
    </form>
  </section>
{/if}
{#if area === 'production'}
  {#if canEdit}<div class="button-row wrap">
      <button class="primary" onclick={() => start('production')}>Bestill produksjon</button><button
        class="secondary"
        onclick={() => start('variants')}>Lag varianter</button
      ><button class="secondary" onclick={() => start('template')}>Ny mal</button>
    </div>{/if}
  <div class="work-grid">
    {#each templates as t}<article class="work-card">
        <span class="eyebrow">{t.kind} · v{t.revision}</span>
        <h2>{t.name}</h2>
        <p>{t.instructions}</p>
        <p class="small muted">{t.fields?.map((f: Row) => f.label).join(' · ')}</p>
        {#if canEdit}<div class="button-row">
            <button
              class="secondary"
              onclick={() => {
                start('production');
                draft.template_id = t.id;
              }}>Bruk mal</button
            ><button class="text-button" onclick={() => start('template', t)}>Rediger</button>
          </div>{/if}
      </article>{/each}
  </div>
  {#if !templates.length}<div class="empty-card">
      <h3>Gjør godt arbeid lett å gjenta.</h3>
      <p>
        Lag visuelle maler, strukturmaler eller promptmaler. Agentene får feltene og merkevaren med
        i oppgaven.
      </p>
    </div>{/if}
  <h2>Analysejobber</h2>
  {#each jobs as j}<article class="compact-row">
      <div>
        <strong>{j.kind} · {states[j.status] || j.status}</strong>
        <p class="small muted">{j.progress}</p>
      </div>
      {#if canEdit && ['queued', 'running'].includes(j.status)}<button
          class="secondary"
          onclick={() =>
            act(async () => {
              await api('/jobs/' + j.id + '/cancel', 'POST', {});
            })}>Stopp</button
        >{/if}
    </article>{/each}
{:else if area === 'campaigns'}
  {#if canEdit}<div class="button-row">
      <button class="primary" onclick={() => start('campaign')}>Ny kampanje</button><button
        class="secondary"
        onclick={() => start('experiment')}>Nytt eksperiment</button
      >
    </div>{/if}
  <div class="work-grid">
    {#each campaigns as c}<article class="work-card">
        <span class="eyebrow">{c.status}</span>
        <h2>{c.name}</h2>
        <p>{c.goal}</p>
        <p class="small muted">
          {c.channels?.join(' · ')} · {Number(c.budget).toLocaleString('nb-NO')} NOK
        </p>
        <p>{c.starts_at?.slice(0, 10) || ''} → {c.ends_at?.slice(0, 10) || ''}</p>
        {#if canEdit}<button class="secondary" onclick={() => start('campaign', c)}
            >Rediger kampanje</button
          >{/if}
      </article>{/each}
  </div>
  <h2>Eksperimenter</h2>
  {#each experiments as ex}<article class="work-card">
      <h3>{ex.name}</h3>
      <p>{ex.hypothesis}</p>
      {#if ex.conclusion}<p class="body-text">{ex.conclusion}</p>{/if}
      <div class="button-row">
        {#if canEdit}<button class="secondary" onclick={() => start('experiment', ex)}
            >Oppdater og konkluder</button
          >{/if}{#if ex.knowledge_id}<button
            class="text-button"
            onclick={() => onopen(ex.knowledge_id)}>Åpne læringen</button
          >{/if}
      </div>
    </article>{/each}
{:else if area === 'insights'}
  <div class="button-row wrap">
    {#if canEdit}<button class="primary" onclick={() => start('measurement')}
        >Registrer resultater</button
      >{/if}<label
      >Valuta<select bind:value={currency} onchange={() => act(async () => {})}
        ><option>NOK</option><option>USD</option><option>EUR</option></select
      ></label
    >
  </div>
  <p class="muted">{insights.comparison}</p>
  <div class="work-grid">
    {#each insights.results || [] as result}<article class="work-card">
        <span class="eyebrow"
          >{result.channel} · {result.mode === 'paid' ? 'BETALT' : 'ORGANISK'} · {Math.floor(
            result.age_hours / 24,
          )} døgn</span
        >
        <h3>{result.title}</h3>
        <div class="metric-grid">
          <div>
            <strong>{Number(result.views).toLocaleString('nb-NO')}</strong><small>Visninger</small>
          </div>
          <div>
            <strong>{result.ctr ? Number(result.ctr).toFixed(1) + ' %' : '—'}</strong><small
              >Klikkrate</small
            >
          </div>
          <div>
            <strong>{Number(result.spend).toFixed(0)}</strong><small>Forbruk · {currency}</small>
          </div>
          <div>
            <strong>{netRevenue(result.id).toFixed(0)}</strong><small
              >Netto inntekt · {currency}</small
            >
          </div>
        </div>
        {#if result.relative_views}<p>
            {Number(result.relative_views).toFixed(2)}× medianen for samme kanal, alder og type.
          </p>{/if}
      </article>{/each}
  </div>
  {#if !insights.results?.length}<div class="empty-card">
      <h3>Fra magefølelse til erfaring.</h3>
      <p>
        Registrer tall fra postene, eller importer en CSV. Behold måletidspunktet for å sammenligne
        poster med lik alder.
      </p>
    </div>{/if}
  {#if canEdit}<details class="tool-panel">
      <summary>Importer målinger fra CSV</summary>
      <p class="small muted">
        Kolonner: publication_id, measured_at (ISO), mode (organic/paid), views, clicks, likes,
        spend, currency.
      </p>
      <label
        >CSV-fil<input
          type="file"
          accept=".csv"
          onchange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (f) csv = await f.text();
          }}
        /></label
      ><label>CSV-innhold<textarea rows="5" bind:value={csv}></textarea></label><button
        class="secondary"
        disabled={!csv || busy}
        onclick={() =>
          act(async () => {
            const out = await api('/measurements/import', 'POST', { csv });
            notice = out.count + ' målinger importert';
            csv = '';
          })}>Importer målinger</button
      >
    </details>{/if}
  <h2>Konverteringer</h2>
  {#each insights.conversions || [] as c}<article class="compact-row">
      <span
        >{publications.find((p) => p.id === c.publication_id)?.title ||
          'Uten publiseringskobling'}</span
      ><span>{c.signups} registreringer · {c.purchases} kjøp · {c.refunds} refusjoner</span>
    </article>{/each}
{:else if area === 'knowledge'}
  {#if canEdit}<button class="primary" onclick={() => start('claim')}>Legg til kunnskap</button
    >{/if}
  <div class="work-grid">
    {#each claims as c}<article class="work-card">
        <span class="eyebrow"
          >{(
            { product: 'Produkt', company: 'Selskap', platform: 'Plattform' } as Record<
              string,
              string
            >
          )[c.scope]} · {(
            { claim: 'Påstand', finding: 'Funn', quote: 'Kundesitat' } as Record<string, string>
          )[c.kind] || c.kind} · {(
            { low: 'Lav sikkerhet', medium: 'Middels sikkerhet', high: 'Høy sikkerhet' } as Record<
              string,
              string
            >
          )[c.confidence]}</span
        >
        <p class="body-text">{c.statement}</p>
        {#each c.sources || [] as source}<p class="small">{source}</p>{/each}{#if c.contradicts}<p
            class="status"
          >
            {c.resolved_at ? 'Motsetning gjennomgått' : 'Motsier tidligere kunnskap'}
          </p>
          {#if canEdit && !c.resolved_at}<button
              class="secondary"
              onclick={() =>
                act(async () => {
                  await api('/claims/' + c.id, 'PATCH', {
                    product_id: product,
                    statement: c.statement,
                    resolved: true,
                  });
                })}>Marker gjennomgått</button
            >{/if}{/if}
      </article>{/each}
  </div>
{:else if area === 'activity'}
  <button class="secondary" onclick={() => act(async () => {})}>Oppdater</button
  >{#each notifications as n}<article class="compact-row" class:unread={!n.read}>
      <div><strong>{n.title}</strong><small>{formatDate(n.created_at)}</small></div>
      {#if !n.read}<button
          class="text-button"
          onclick={() =>
            act(async () => {
              await api('/notifications/' + n.id + '/read', 'POST', {});
            })}>Marker lest</button
        >{/if}
    </article>{/each}{#if !notifications.length}<p class="muted">Ingen varsler ennå.</p>{/if}
{:else if area === 'admin'}
  <section class="work-card">
    <h2>Produktgrunnlag og kontekst</h2>
    <a
      class="secondary"
      href={'/api/products/' + product + '/context'}
      download="studio-context.json">Last ned agentkontekst</a
    >
    <details class="tool-panel">
      <summary>Historikk ({history.length})</summary>{#each history as h}<article
          class="evaluation"
        >
          <strong>v{h.revision} · {h.author}</strong>
          <p>{h.snapshot.description}</p>
          <p>{h.snapshot.brand}</p>
          <p class="small">{formatDate(h.created_at)}</p>
        </article>{/each}
    </details>
  </section>
  <section class="work-card">
    <div class="section-heading">
      <h2>Modellprofiler for produktet</h2>
      {#if user.role === 'admin'}<button class="secondary" onclick={() => start('profile')}
          >Ny profil</button
        >{/if}
    </div>
    <p class="muted">Produktprofiler overstyrer standardvalgene under Innstillinger.</p>
    {#each profiles as p}<div class="compact-row">
        <div>
          <strong>{p.name || p.role}</strong><small
            >{p.provider} · {p.model || 'Ikke valgt'} · maks {p.max_cost_usd} USD</small
          >
        </div>
        {#if user.role === 'admin'}<button class="text-button" onclick={() => start('profile', p)}
            >Rediger</button
          >{/if}
      </div>{/each}
  </section>
  {#if user.role === 'admin'}
    <section class="work-card">
      <h2>Nytt produkt</h2>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          act(async () => {
            const p = await api('/products', 'POST', {
              name: productName,
              description: '',
              restricted: false,
            });
            productName = '';
            await onproduct(p.id);
          });
        }}
      >
        <label>Produktnavn<input bind:value={productName} required /></label><button
          class="secondary"
          disabled={busy}>Opprett produkt</button
        >
      </form>
    </section>
    <section class="work-card">
      <h2>Tilgang til produktet</h2>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          act(async () => {
            await api('/products/' + product + '/members', 'PUT', {
              restricted: memberRestriction,
            });
          });
        }}
      >
        <label class="check-row"
          ><input type="checkbox" bind:checked={memberRestriction} />Begrens produktet til medlemmer
          nedenfor</label
        ><button class="secondary" disabled={busy}>Lagre tilgang</button>
      </form>
      {#each members as member}<div class="compact-row">
          <span>{member.name} <small>{member.email}</small></span
          >{#if member.workspace_role === 'admin'}<span class="small muted">Administrator</span
            >{:else}<select
              aria-label={'Produktrolle for ' + member.name}
              value={member.role || ''}
              onchange={(e) => {
                const role = e.currentTarget.value;
                act(async () => {
                  await api('/products/' + product + '/members', 'PUT', {
                    user_id: member.id,
                    role,
                  });
                });
              }}
              ><option value="">Ingen særskilt tilgang</option><option value="reader">Leser</option
              ><option value="editor">Redaktør</option></select
            >{/if}
        </div>{/each}
    </section>
    <section class="work-card">
      <h2>Passordgjenoppretting</h2>
      <p class="muted">
        Lag en engangslenke og del den med riktig person. Den utløper etter 30 minutter.
      </p>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          act(async () => {
            const r = await api('/password-resets', 'POST', { email: resetEmail });
            secret = r.url;
          });
        }}
      >
        <label>Brukerens e-post<input type="email" bind:value={resetEmail} required /></label
        ><button class="secondary" disabled={busy}>Lag gjenopprettingslenke</button>
      </form>
    </section>
    <section class="work-card">
      <h2>Konverteringer fra produktet</h2>
      <p class="muted">Koble registreringer, kjøp og refusjoner til kampanjer og publiseringer.</p>
      <button
        class="secondary"
        onclick={() =>
          act(async () => {
            const k = await api('/conversion-keys', 'POST', { product_id: product });
            secret = k.token;
            notice = 'Nøkkelen vises bare én gang. Nøkkel-ID: ' + k.id;
          })}>Lag konverteringsnøkkel</button
      >
    </section>
    {#if secret}<label
        >Lenke eller nøkkel – kopier nå<input
          readonly
          value={secret}
          onclick={(e) => e.currentTarget.select()}
        /></label
      >{/if}
    {#if operations}<section class="work-card">
        <h2>Forbruk og grenser</h2>
        <p>
          {(Number(operations.storage?.[0]?.bytes || 0) / 1024 / 1024).toFixed(1)} MB lagret · {Number(
            operations.cost?.[0]?.today || 0,
          ).toFixed(4)} USD i dag
        </p>
        {#if operations.limits?.[0]}{@const limits = operations.limits[0]}
          <form
            onsubmit={(e) => {
              e.preventDefault();
              act(async () => {
                await api('/operations/limits', 'PUT', {
                  storage_bytes: Number(limits.storage_bytes),
                  daily_ai_usd: Number(limits.daily_ai_usd),
                  max_active_jobs: Number(limits.max_active_jobs),
                });
              });
            }}
          >
            <div class="form-grid">
              <label
                >Lagringsgrense · byte<input
                  type="number"
                  min="1048576"
                  bind:value={limits.storage_bytes}
                /></label
              ><label
                >AI-budsjett per døgn · USD<input
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  bind:value={limits.daily_ai_usd}
                /></label
              ><label
                >Maks jobber i kø<input
                  type="number"
                  min="1"
                  max="100"
                  bind:value={limits.max_active_jobs}
                /></label
              >
            </div>
            <button class="secondary" disabled={busy}>Lagre grenser</button>
          </form>{/if}{#each operations.runs || [] as run}<p class="small">
            {run.model} · {run.count} kjøringer · {Number(run.cost_usd).toFixed(4)} USD
          </p>{/each}
      </section>
      <details class="tool-panel">
        <summary>Aktivitetslogg</summary>{#each operations.audit || [] as event}<p class="small">
            {formatDate(event.created_at)} · {event.actor} · {event.action}
          </p>{/each}
      </details>{/if}
    <section class="work-card">
      <h2>Ta med arbeidsrommet</h2>
      <a class="secondary" href="/api/export/workspace">Last ned data og originalfiler</a>
      <p class="small muted">
        Private chatter og innloggingsnøkler er ikke med i innholdseksporten. Full
        sikkerhetskopiering kjøres lokalt med backup-skriptet.
      </p>
    </section>
  {/if}
{/if}
