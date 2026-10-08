<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto, afterNavigate } from '$app/navigation';
  import AdsPage from '$lib/components/AdsPage.svelte';
  import ReviewPage from '$lib/components/ReviewPage.svelte';
  import MediaCard from '$lib/components/MediaCard.svelte';
  import {
    ArrowUp,
    ArrowUpRight,
    ArrowLeft,
    ArrowRight,
    Plus,
    Search,
    X,
    House,
    Library,
    CalendarDays,
    Columns3,
    MessageSquare,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileText,
    Film,
    Image,
    Mic,
    Link,
    Check,
    Copy,
    Download,
    Upload,
    Circle,
    Clock3,
    Square,
    LogOut,
    Menu,
    SlidersHorizontal,
    MoreHorizontal,
  } from '@lucide/svelte';
  import {
    api,
    contentCategories,
    uploadFile,
    seconds,
    kinds,
    states,
    formatDate,
    localInput,
    osloISO,
    type Row,
  } from '$lib/api';
  import '$lib/style.css';
  import ImportPanel from '$lib/components/ImportPanel.svelte';
  import LibraryTools from '$lib/components/LibraryTools.svelte';
  import Workbench from '$lib/components/Workbench.svelte';
  import TaskPanel from '$lib/components/TaskPanel.svelte';
  $: mcpEndpoint = $page.url.origin + '/mcp';
  let workArea = 'production',
    productionSeed = '',
    libraryFilterIDs: string[] | null = null,
    uploadPercent = 0;
  let campaigns: Row[] = [],
    people: Row[] = [],
    profiles: Row[] = [],
    savedSearches: Row[] = [];
  let searchScope = 'product',
    searchMode = 'all',
    searchKind = '',
    searchStatus = '',
    searchTag = '',
    searchSelection: string[] = [],
    searchBulkTag = '',
    searchRights = '',
    searchAuthor = '',
    searchCampaign = '',
    searchMinViews = 0,
    savedName = '';
  let chatAttachments: string[] = [],
    chatRole = 'chat',
    chatCampaign = '',
    runSource: EventSource | null = null;
  let monthOffset = 0;

  let loading = true,
    setup = false,
    user: Row | null = null,
    authMode = 'login',
    authError = '';
  let email = '',
    password = '',
    name = '',
    authToken = '';
  let ads: Row[] = [];
  let routeLoading = false,
    lastRoute = '',
    routeGeneration = 0;
  let view = 'ads',
    products: Row[] = [],
    product = '',
    items: Row[] = [],
    tasks: Row[] = [],
    publications: Row[] = [],
    conversations: Row[] = [];
  let settings: Row = { models: [] },
    invites: Row[] = [],
    agentKeys: Row[] = [];
  let busy = false,
    notice = '',
    error = '',
    query = '',
    results: Row[] = [],
    searching = false,
    searchTimer: ReturnType<typeof setTimeout>,
    searchGeneration = 0;
  let categoryFilter = '';
  let filter = '',
    statusFilter = '',
    boardState = 'ready',
    calendarOffset = 0,
    calendarMode = 'week',
    selectedDay = '';
  let dialog: HTMLDialogElement,
    modal = '',
    draft: Row = {},
    detail: Row | null = null;
  let file: File | null = null,
    uploadProgress = false,
    freshSecret = '',
    inviteLink = '';
  let conversationID = '',
    messages: Row[] = [],
    latestRun: Row | null = null,
    composer = '',
    modelOverride = '',
    runEvents: Row[] = [];
  let clipboardTimer: ReturnType<typeof setTimeout>;
  const nav = [
    { id: 'ads', label: 'Annonser', icon: Film },
    { id: 'home', label: 'Oversikt', icon: House },
    { id: 'library', label: 'Bibliotek', icon: Library },
    { id: 'calendar', label: 'Kalender', icon: CalendarDays },
    { id: 'tasks', label: 'Oppgaver', icon: Columns3 },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ];
  const columns = ['idea', 'ready', 'running', 'review', 'done'];
  const roleNames: Record<string, string> = {
    chat: 'Chat og planlegging',
    script: 'Manus og tekst',
    analysis: 'Videoanalyse',
    ranking: 'Vurdering · Jev',
    video: 'Videoproduksjon',
    design: 'Visuelle maler',
  };
  $: currentProduct = products.find((p) => p.id === product);
  $: visibleItems = items.filter(
    (i) =>
      (!filter || i.kind === filter) &&
      (!categoryFilter ||
        (i.metadata?.classification?.category || 'ukategorisert') === categoryFilter) &&
      (!statusFilter || i.status === statusFilter) &&
      (libraryFilterIDs === null || libraryFilterIDs.includes(i.id)),
  );
  $: upcoming = publications.filter((p) => p.status !== 'published').slice(0, 4);
  $: reviewTasks = tasks.filter((t) => t.status === 'review');
  $: activeRun = latestRun && ['queued', 'running'].includes(latestRun.status);
  $: canEdit = !!user && user.role !== 'reader' && currentProduct?.can_edit !== false;
  $: calendarDays = calendarMode === 'month' ? monthDays(monthOffset) : weekDays(calendarOffset);
  $: weekPublications = publications.filter((p) =>
    calendarDays.includes(localInput(new Date(p.scheduled_at)).slice(0, 10)),
  );
  $: listedPublications =
    calendarMode === 'list'
      ? publications
      : weekPublications.filter(
          (p) => !selectedDay || localInput(new Date(p.scheduled_at)).startsWith(selectedDay),
        );

  function iconFor(kind: string) {
    return kind === 'video'
      ? Film
      : kind === 'image' || kind === 'carousel'
        ? Image
        : kind === 'audio'
          ? Mic
          : kind === 'reference'
            ? Link
            : FileText;
  }
  function monthDays(offset: number) {
    const d = new Date(localInput().slice(0, 7) + '-01T12:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + offset);
    const start = new Date(d);
    start.setUTCDate(1 - ((start.getUTCDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + i);
      return day.toISOString().slice(0, 10);
    });
  }
  async function changeProduct(id: string) {
    products = await api('/products');
    product = id;
    runSource?.close();
    searchSelection = [];
    libraryFilterIDs = null;
    categoryFilter = '';
    conversationID = '';
    messages = [];
    latestRun = null;
    chatAttachments = [];
    chatCampaign = '';
    lastRoute = '';
    await goto('/' + (view === 'item' ? 'ads' : view) + '?product=' + encodeURIComponent(product));
  }
  async function refreshDetail() {
    if (!detail) return;
    const id = detail.item.id,
      generation = routeGeneration;
    const loaded = await api('/items/' + id);
    if (detail?.item.id === id && generation === routeGeneration) detail = loaded;
  }
  function produce(version: string) {
    closeModal();
    productionSeed = version;
    workArea = 'production';
    navigate('work');
  }
  function subscribeRun(id: string) {
    runSource?.close();
    runSource = new EventSource('/api/runs/' + id + '/stream');
    runSource.onmessage = (e) => {
      const run = JSON.parse(e.data);
      latestRun = { ...latestRun, ...run };
      if (!['queued', 'running'].includes(run.status)) {
        runSource?.close();
        loadConversation(conversationID).catch(() => {});
      }
    };
  }
  function weekDays(offset: number) {
    const now = new Date();
    const oslo = localInput(now).slice(0, 10);
    const d = new Date(oslo + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(d);
      day.setUTCDate(d.getUTCDate() + i);
      return day.toISOString().slice(0, 10);
    });
  }
  function toast(text: string) {
    notice = text;
    clearTimeout(clipboardTimer);
    clipboardTimer = setTimeout(() => (notice = ''), 3500);
  }
  async function safely(fn: () => Promise<void>) {
    error = '';
    busy = true;
    try {
      await fn();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function refresh() {
    const atView = view,
      atProduct = product,
      generation = routeGeneration;
    const accept = () => view === atView && product === atProduct && generation === routeGeneration;
    const suffix = '?product=' + encodeURIComponent(product);
    const requests: Promise<unknown>[] = [];
    if (view === 'ads')
      requests.push(
        api('/ads' + suffix).then((value) => {
          if (accept()) ads = value;
        }),
      );
    if (['home', 'library', 'calendar', 'tasks', 'work', 'chat'].includes(view))
      requests.push(
        api('/items' + suffix).then((value) => {
          if (accept()) items = value;
        }),
      );
    if (['home', 'tasks', 'work'].includes(view))
      requests.push(
        api('/tasks' + suffix).then((value) => {
          if (accept()) tasks = value;
        }),
      );
    if (['home', 'calendar', 'work'].includes(view))
      requests.push(
        api('/publications' + suffix).then((value) => {
          if (accept()) publications = value;
        }),
      );
    if (view === 'chat')
      requests.push(
        api('/conversations' + suffix).then((value) => {
          if (accept()) conversations = value;
        }),
      );
    if (['calendar', 'work', 'chat'].includes(view))
      requests.push(
        api('/campaigns' + suffix).then((value) => {
          if (accept()) campaigns = value;
        }),
      );
    if (['tasks', 'work'].includes(view))
      requests.push(
        api('/products/' + product + '/people').then((value) => {
          if (accept()) people = value;
        }),
      );
    if (['work', 'chat'].includes(view))
      requests.push(
        api('/profiles' + suffix).then((value) => {
          if (accept()) profiles = value;
        }),
      );
    if (['settings', 'chat'].includes(view))
      requests.push(
        api('/settings').then((value) => {
          if (accept()) settings = value;
        }),
      );
    if (view === 'settings' && user?.role === 'admin')
      requests.push(
        Promise.all([api('/invites'), api('/agent-tokens')]).then(([i, k]) => {
          if (!accept()) return;
          invites = i;
          agentKeys = k;
        }),
      );
    await Promise.all(requests);
  }
  async function syncRoute(force = false) {
    const url = new URL(window.location.href);
    const parts = url.pathname.split('/').filter(Boolean);
    const section = parts[0] || 'ads';
    const requested = url.searchParams.get('product');
    const nextProduct = products.some((p) => p.id === requested)
      ? requested!
      : product || products[0]?.id || '';
    const routeKey = url.pathname + ':' + nextProduct;
    if (!force && lastRoute === routeKey) return;
    const generation = ++routeGeneration;
    lastRoute = routeKey;
    product = nextProduct;
    error = '';
    view =
      parts[1] && ['ads', 'library'].includes(section)
        ? 'item'
        : ['ads', 'home', 'library', 'calendar', 'tasks', 'chat', 'work', 'settings'].includes(
              section,
            )
          ? section
          : 'ads';
    routeLoading = true;
    try {
      if (view === 'item') {
        const loaded = await api('/items/' + parts[1]);
        if (generation !== routeGeneration) return;
        detail = loaded;
        product = loaded.item.product_id;
      } else {
        detail = null;
        await refresh();
      }
    } catch (e) {
      if (generation === routeGeneration) {
        error = (e as Error).message;
        detail = null;
        lastRoute = '';
      }
    } finally {
      if (generation === routeGeneration) routeLoading = false;
    }
  }
  afterNavigate(() => {
    if (user && !loading) void syncRoute();
  });
  async function load() {
    const status = await api('/auth/status');
    setup = status.setup;
    user = status.user;
    if (user) {
      products = await api('/products');
      product = product || products[0]?.id || '';
      await syncRoute(true);
    } else if (setup) {
      authMode = 'setup';
    }
  }
  onMount(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.has('invite')) {
      authMode = 'invite';
      authToken = hash.get('invite') || '';
      history.replaceState(null, '', location.pathname);
    }
    if (hash.has('reset')) {
      authMode = 'reset';
      authToken = hash.get('reset') || '';
      history.replaceState(null, '', location.pathname);
    }
    if (hash.has('setup')) {
      authToken = hash.get('setup') || '';
      history.replaceState(null, '', location.pathname);
    }
    load()
      .catch((e) => (authError = e.message))
      .finally(() => (loading = false));
    const poll = setInterval(() => {
      if (conversationID && activeRun)
        loadConversation(conversationID).catch((e) => (error = e.message));
    }, 1500);
    return () => {
      runSource?.close();
      clearInterval(poll);
      clearTimeout(searchTimer);
      clearTimeout(clipboardTimer);
    };
  });
  async function authenticate(e: SubmitEvent) {
    e.preventDefault();
    authError = '';
    busy = true;
    try {
      await api(
        '/auth/' +
          (authMode === 'setup'
            ? 'bootstrap'
            : authMode === 'invite'
              ? 'accept'
              : authMode === 'reset'
                ? 'reset'
                : 'login'),
        'POST',
        { email, password, name, token: authToken },
      );
      if (authMode === 'reset') {
        authMode = 'login';
        authError = 'Passordet er endret. Logg inn.';
        authToken = '';
        password = '';
        return;
      }
      password = '';
      authToken = '';
      await load();
    } catch (e) {
      authError = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  async function navigate(next: string) {
    if (modal) closeModal();
    await goto('/' + next + '?product=' + encodeURIComponent(product));
  }
  function openModal(type: string, data: Row = {}) {
    if (type === 'publication') {
      const p = product;
      void api('/tasks?product=' + p)
        .then((value) => {
          if (product === p) tasks = value;
        })
        .catch(() => {});
    }
    modal = type;
    error = '';
    freshSecret = '';
    inviteLink = '';
    file = null;
    draft = {
      title: '',
      kind: 'hook',
      body: '',
      source_url: '',
      rights: 'unknown',
      status: 'idea',
      executor: 'external',
      assignee: '',
      channel: 'Instagram',
      scheduled_at: localInput(),
      caption: '',
      item_id: '',
      task_id: '',
      campaign_id: '',
      landing_url: '',
      reminder_minutes: 60,
      email: '',
      role: 'editor',
      ...data,
    };
    dialog.showModal();
  }
  function closeModal() {
    dialog.close();
    modal = '';
    error = '';
    freshSecret = '';
    inviteLink = '';
  }
  async function openItem(id: string, version = '', at?: number) {
    const from = $page.url.pathname + $page.url.search;
    const ad = view === 'ads' || items.find((i) => i.id === id)?.is_ad;
    if (modal) closeModal();
    await goto(
      `/${ad ? 'ads' : 'library'}/${id}?product=${product}&from=${encodeURIComponent(from)}${version ? '&version=' + version : ''}${at !== undefined && Number.isFinite(at) && at >= 0 ? '&t=' + at : ''}`,
    );
  }
  async function save(e: SubmitEvent) {
    e.preventDefault();
    await safely(async () => {
      if (modal === 'item') {
        if (file) {
          uploadProgress = true;
          try {
            const result = await uploadFile(product, file, draft, (v) => (uploadPercent = v));
            if (result.duplicate) toast('Filen finnes allerede i biblioteket');
          } finally {
            uploadProgress = false;
          }
        } else
          await api('/items', 'POST', {
            product_id: product,
            title: draft.title,
            kind: draft.kind,
            body: draft.body,
            source_url: draft.source_url,
            rights: draft.rights,
            tags: [],
          });
      } else if (modal === 'task') {
        await api('/tasks', 'POST', {
          product_id: product,
          title: draft.title,
          brief: draft.body,
          status: draft.status,
          executor: draft.executor,
          assignee: draft.assignee,
        });
        boardState = draft.status;
      } else if (modal === 'publication')
        await api('/publications', 'POST', {
          product_id: product,
          title: draft.title,
          channel: draft.channel,
          scheduled_at: osloISO(draft.scheduled_at),
          caption: draft.caption,
          item_id: draft.item_id || null,
          task_id: draft.task_id || null,
          assignee: draft.assignee,
          campaign_id: draft.campaign_id,
          landing_url: draft.landing_url,
          reminder_minutes: Number(draft.reminder_minutes),
        });
      else if (modal === 'invite') {
        const result = await api('/invites', 'POST', { email: draft.email, role: draft.role });
        inviteLink = result.url;
        invites = await api('/invites');
        return;
      } else if (modal === 'agent') {
        const result = await api('/agent-tokens', 'POST', {
          name: draft.title,
          product_id: product,
        });
        freshSecret = result.token;
        agentKeys = await api('/agent-tokens');
        return;
      }
      closeModal();
      await refresh();
      toast('Lagret');
    });
  }
  async function changeTask(t: Row, status: string) {
    await safely(async () => {
      await api('/tasks/' + t.id, 'PATCH', { status });
      await refresh();
    });
  }
  async function savePublication() {
    await safely(async () => {
      await api('/publications/' + draft.id, 'PATCH', {
        item_id: draft.item_id || undefined,
        scheduled_at: osloISO(draft.scheduled_at),
        title: draft.title,
        caption: draft.caption,
        channel: draft.channel,
        assignee: draft.assignee,
        task_id: draft.task_id || '',
        campaign_id: draft.campaign_id || '',
        landing_url: draft.landing_url || '',
        reminder_minutes: Number(draft.reminder_minutes),
      });
      await refresh();
      closeModal();
      toast('Publiseringspakken er oppdatert');
    });
  }
  async function markPublished() {
    await safely(async () => {
      await api('/publications/' + draft.id, 'PATCH', { status: 'published', url: draft.url });
      await refresh();
      closeModal();
      toast('Publisering registrert');
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Kopiert');
    } catch {
      error = 'Kunne ikke kopiere. Marker teksten og kopier manuelt.';
    }
  }
  function searchInput() {
    clearTimeout(searchTimer);
    searchSelection = [];
    const generation = ++searchGeneration;
    if (!query.trim()) {
      results = [];
      searching = false;
      return;
    }
    searching = true;
    searchTimer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          product: searchScope === 'all' ? '' : product,
          mode: searchMode,
          kind: searchKind,
          status: searchStatus,
          tag: searchTag,
          rights: searchRights,
          author: searchAuthor,
          campaign: searchCampaign,
          min_views: String(searchMinViews),
        });
        const found = await api('/search?' + params);
        if (generation === searchGeneration) results = found;
      } catch (e) {
        if (generation === searchGeneration) error = (e as Error).message;
      } finally {
        if (generation === searchGeneration) searching = false;
      }
    }, 250);
  }
  async function followResult(result: Row) {
    closeModal();
    if (result.product_id && result.product_id !== product) await changeProduct(result.product_id);
    if (['item', 'note', 'segment', 'frame'].includes(result.entity)) {
      await openItem(
        result.target_id,
        result.version_id || '',
        result.start_seconds == null ? undefined : Number(result.start_seconds),
      );
    } else if (result.entity === 'message') {
      await navigate('chat');
      await loadConversation(result.target_id);
    } else if (result.entity === 'task') {
      await navigate('tasks');
    } else if (result.entity === 'publication') {
      await navigate('calendar');
    } else if (['campaign', 'claim'].includes(result.entity)) {
      workArea = result.entity === 'campaign' ? 'campaigns' : 'knowledge';
      await navigate('work');
    } else await navigate('settings');
  }
  async function loadConversation(id: string) {
    const data = await api('/conversations/' + id);
    if (conversationID && conversationID !== id) return;
    conversationID = id;
    messages = data.messages || [];
    latestRun = data.runs?.[0] || null;
    if (latestRun) {
      const data = await api('/runs/' + latestRun.id);
      runEvents = data.events || [];
    }
  }
  async function selectConversation(id: string) {
    conversationID = id;
    await safely(() => loadConversation(id));
  }
  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (!composer.trim() || activeRun) return;
    await safely(async () => {
      if (!conversationID) {
        const result = await api('/conversations', 'POST', {
          product_id: product,
          title: composer.slice(0, 80),
        });
        conversationID = result.id;
      }
      await api('/conversations/' + conversationID + '/messages', 'POST', {
        body: composer,
        model: modelOverride,
        role: chatRole,
        campaign_id: chatCampaign,
        attachments: chatAttachments,
      });
      composer = '';
      await loadConversation(conversationID);
      if (latestRun) subscribeRun(latestRun.id);
      await refresh();
    });
  }
  async function stopRun() {
    if (latestRun)
      await safely(async () => {
        await api('/runs/' + latestRun!.id + '/cancel', 'POST', {});
        await loadConversation(conversationID);
      });
  }
  async function saveModel(model: Row) {
    await safely(async () => {
      await api('/settings/' + model.role, 'PUT', model);
      toast('Modellvalg lagret');
    });
  }
</script>

<svelte:head
  ><title>Studio · {currentProduct?.name || 'Ditt innhold, samlet'}</title><meta
    name="description"
    content="Bibliotek, produksjon og publisering samlet i et rolig arbeidsrom."
  /></svelte:head
>

{#if loading}
  <div class="boot">
    <span class="wordmark">studio<span>.</span></span>
    <p>Åpner arbeidsrommet …</p>
  </div>
{:else if !user}
  <main class="auth-page">
    <a class="wordmark" href="/">studio<span>.</span></a>
    <div class="auth-layout">
      <section class="auth-intro">
        <p class="eyebrow">FRA FØRSTE IDÉ TIL SISTE FINPUSS</p>
        <h1>Et sted for alt<br />dere lager.</h1>
        <p>Samle materialet. Finn retningen.<br />Få det ut i verden.</p>
        <div class="auth-process">
          <span>Idé</span><ArrowRight size={16} /><span>Innhold</span><ArrowRight size={16} /><span
            >Publisert</span
          >
        </div>
      </section>
      <section class="auth-form">
        <span class="section-number">01 / VELKOMMEN</span>
        <h2>
          {authMode === 'setup'
            ? 'Opprett arbeidsrommet'
            : authMode === 'invite'
              ? 'Bli med i Studio'
              : authMode === 'reset'
                ? 'Velg nytt passord'
                : 'Godt å se deg igjen'}
        </h2>
        <p class="muted">
          {authMode === 'setup'
            ? 'Den første brukeren blir administrator.'
            : authMode === 'invite'
              ? 'Bruk e-postadressen invitasjonen ble sendt til.'
              : 'Logg inn for å fortsette der dere slapp.'}
        </p>
        <form onsubmit={authenticate}>
          {#if authMode !== 'login' && authMode !== 'reset'}<label
              >Navnet ditt<input
                bind:value={name}
                autocomplete="name"
                required
                placeholder="Fornavn Etternavn"
              /></label
            >{/if}
          {#if authMode !== 'reset'}<label
              >E-post<input
                type="email"
                bind:value={email}
                autocomplete="email"
                required
                placeholder="deg@firma.no"
              /></label
            >{/if}
          <label
            >Passord<input
              type="password"
              bind:value={password}
              autocomplete={authMode === 'login' ? 'current-password' : 'new-password'}
              minlength={authMode === 'login' ? 1 : 12}
              maxlength="72"
              required
              placeholder={authMode === 'login' ? 'Ditt passord' : 'Minst 12 tegn'}
            /></label
          >
          {#if authMode === 'setup'}<label
              >Oppsettkode<input
                type="password"
                bind:value={authToken}
                required
                autocomplete="off"
              /><small>Finn BOOTSTRAP_TOKEN i den lokale .env-filen.</small></label
            >{/if}
          {#if authError}<p class="error" role="alert">{authError}</p>{/if}
          <button class="primary wide" disabled={busy}
            >{busy
              ? 'Et øyeblikk …'
              : authMode === 'setup'
                ? 'Opprett Studio'
                : authMode === 'invite'
                  ? 'Godta invitasjon'
                  : 'Logg inn'}<ArrowRight size={16} /></button
          >
        </form>
        <p class="small muted">
          {authMode === 'login'
            ? 'Tilgang gis gjennom en invitasjon fra administrator.'
            : 'Studio er privat. Du bestemmer hvem som får tilgang.'}
        </p>
      </section>
    </div>
    <footer>Et roligere sted å få ting gjort.</footer>
  </main>
{:else}
  <div class="app-shell">
    <aside class="sidebar">
      <button class="wordmark" onclick={() => navigate('home')}>studio<span>.</span></button><span
        class="workspace-label">ARBEIDSROM</span
      ><label class="product-picker"
        ><span class="product-dot">T</span><select
          aria-label="Velg produkt"
          bind:value={product}
          onchange={() => safely(() => changeProduct(product))}
          >{#each products as p}<option value={p.id}>{p.name}</option>{/each}</select
        ><ChevronDown size={14} /></label
      >
      <nav aria-label="Hovedmeny">
        {#each nav as n}<button class:active={view === n.id} onclick={() => navigate(n.id)}
            ><n.icon size={19} strokeWidth={1.7} /><span>{n.label}</span
            >{#if n.id === 'tasks' && reviewTasks.length}<span class="nav-count"
                >{reviewTasks.length}</span
              >{/if}</button
          >{/each}
      </nav>
      <button
        class="work-nav secondary"
        class:chosen={view === 'work'}
        onclick={() => {
          productionSeed = '';
          navigate('work');
        }}><Columns3 size={18} />Produksjon og innsikt</button
      >
      <div class="sidebar-bottom">
        <button class:active={view === 'settings'} onclick={() => navigate('settings')}
          ><Settings size={18} />Innstillinger</button
        >
        <div class="user-row">
          <span class="avatar">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong><small
              >{user.role === 'admin'
                ? 'Administrator'
                : user.role === 'reader'
                  ? 'Lesetilgang'
                  : 'Redaktør'}</small
            >
          </div>
          <button
            aria-label="Logg ut"
            onclick={() =>
              safely(async () => {
                await api('/auth/logout', 'POST', {});
                user = null;
              })}><LogOut size={16} /></button
          >
        </div>
      </div>
    </aside>
    <div class="main-column">
      <header class="topbar">
        <div class="breadcrumb">
          <span class="mobile-wordmark" onclick={() => navigate('home')} role="presentation"
            >studio.</span
          ><span>{currentProduct?.name}</span><span class="slash">/</span><strong
            >{nav.find((n) => n.id === view)?.label ||
              (view === 'item'
                ? 'Gjennomgang'
                : view === 'work'
                  ? 'Arbeidsrom'
                  : 'Innstillinger')}</strong
          >
        </div>
        <div class="topbar-actions">
          <button
            class="icon-button"
            aria-label="Produksjon og innsikt"
            onclick={() => {
              productionSeed = '';
              navigate('work');
            }}><Menu size={20} /></button
          >
          <button
            class="search-trigger"
            onclick={() => {
              openModal('search');
              query = '';
              results = [];
              api('/library?product=' + product)
                .then((d) => (savedSearches = d.searches || []))
                .catch(() => {});
            }}
            aria-label="Søk i Studio"><Search size={17} /><span>Søk i alt</span><kbd>⌕</kbd></button
          ><button
            class="mobile-settings icon-button"
            aria-label="Innstillinger"
            onclick={() => navigate('settings')}><Settings size={19} /></button
          >
        </div>
      </header>
      {#if error && !modal}<div class="page-error error" role="alert">
          {error}<button
            class="icon-button"
            aria-label="Lukk feilmelding"
            onclick={() => (error = '')}><X size={16} /></button
          >
        </div>{/if}
      <div class="mobile-product-switch">
        <label
          >Produkt<select
            aria-label="Bytt produkt"
            bind:value={product}
            onchange={() => safely(() => changeProduct(product))}
            >{#each products as p}<option value={p.id}>{p.name}</option>{/each}</select
          ></label
        >
      </div>
      <main class:chat-main={view === 'chat'}>
        {#if routeLoading}<p class="muted" role="status">Henter innhold …</p>
        {:else if view === 'ads'}{#key product}<AdsPage
              {ads}
              {product}
              {canEdit}
              onopen={openItem}
              onrefresh={refresh}
            />{/key}
        {:else if view === 'item' && detail}{#key detail.item.id}<ReviewPage
              {detail}
              {canEdit}
              onrefresh={refreshDetail}
              onopen={openItem}
              onproduce={produce}
            />{/key}
        {:else if view === 'work'}{#key product}<Workbench
              {product}
              {user}
              {items}
              {publications}
              {canEdit}
              bind:area={workArea}
              seed={productionSeed}
              onchange={refresh}
              onproduct={changeProduct}
              onopen={openItem}
            />{/key}
        {:else if view === 'home'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">
                {formatDate(new Date().toISOString(), {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <h1>Plass til neste idé.</h1>
              <p class="muted">Her er det som skjer i {currentProduct?.name}.</p>
            </div>
            {#if canEdit}<button class="primary" onclick={() => openModal('item')}
                ><Plus size={17} />Legg til innhold</button
              >{/if}
          </section>
          <section class="summary-strip" aria-label="Arbeidsrommet i tall">
            <button onclick={() => navigate('library')}
              ><span>Biblioteket</span><strong>{items.length.toString().padStart(2, '0')}</strong
              ><small>elementer samlet <ArrowUpRight size={15} /></small></button
            ><button onclick={() => navigate('tasks')}
              ><span>Under arbeid</span><strong
                >{tasks
                  .filter((t) => t.status === 'running')
                  .length.toString()
                  .padStart(2, '0')}</strong
              ><small>oppgaver pågår <ArrowUpRight size={15} /></small></button
            ><button onclick={() => navigate('calendar')}
              ><span>På planen</span><strong
                >{publications
                  .filter((p) => p.status !== 'published')
                  .length.toString()
                  .padStart(2, '0')}</strong
              ><small>kommende publiseringer <ArrowUpRight size={15} /></small></button
            >
          </section>
          <div class="home-columns">
            <section>
              <div class="section-heading">
                <h2>Neste ut</h2>
                <button class="text-button" onclick={() => navigate('calendar')}
                  >Se kalender<ArrowRight size={15} /></button
                >
              </div>
              {#if upcoming.length}<div class="list-panel">
                  {#each upcoming as p}<button
                      class="publication-row"
                      onclick={() =>
                        openModal('publish-detail', {
                          ...p,
                          scheduled_at: localInput(new Date(p.scheduled_at)),
                        })}
                      ><span class="date-block"
                        ><strong>{formatDate(p.scheduled_at, { day: 'numeric' })}</strong><small
                          >{formatDate(p.scheduled_at, { month: 'short' })}</small
                        ></span
                      ><span class="row-main"
                        ><strong>{p.title}</strong><small
                          >{p.channel} · {formatDate(p.scheduled_at, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</small
                        ></span
                      ><span class="dot" class:ready={p.content_ready}></span></button
                    >{/each}
                </div>{:else}<div class="empty-card">
                  <CalendarDays size={28} strokeWidth={1.3} />
                  <h3>Gi ideene en dato.</h3>
                  <p>Legg inn neste publisering.<br />Innholdet kan bli klart underveis.</p>
                  {#if canEdit}<button class="secondary" onclick={() => openModal('publication')}
                      >Planlegg en post<Plus size={15} /></button
                    >{/if}
                </div>{/if}
            </section>
            <section>
              <div class="section-heading">
                <h2>Trenger et blikk</h2>
                <span class="small muted">{reviewTasks.length} til gjennomgang</span>
              </div>
              {#if reviewTasks.length}<div class="list-panel">
                  {#each reviewTasks as t}<button
                      class="review-row"
                      onclick={() => {
                        if (t.item_id) openItem(t.item_id);
                        else navigate('tasks');
                      }}
                      ><span class="mini-icon"><FileText size={18} /></span><span class="row-main"
                        ><strong>{t.title}</strong><small>{t.assignee || 'Ingen ansvarlig'}</small
                        ></span
                      ><ArrowUpRight size={17} /></button
                    >{/each}
                </div>{:else}<div class="empty-card quiet">
                  <Check size={28} strokeWidth={1.3} />
                  <h3>Alt er sett over.</h3>
                  <p>Nye leveranser fra teamet og<br />agentene dukker opp her.</p>
                </div>{/if}
            </section>
          </div>
          <section class="start-note">
            <span class="note-index">ET GODT STED Å BEGYNNE</span>
            <h2>En tanke er nok.</h2>
            <p>Samle en referanse, skriv ned en hook eller gi en agent et konkret oppdrag.</p>
            <div>
              <button
                class="text-button"
                onclick={() => {
                  navigate('chat');
                  composer = 'Hjelp meg å lage en brief for neste Teorimester-video.';
                }}>Åpne chatten<ArrowRight size={16} /></button
              ><button class="text-button" onclick={() => openModal('task')}
                >Lag en oppgave<Plus size={16} /></button
              >
            </div>
          </section>
        {:else if view === 'library'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">DERE HAR LAGET. DERE VIL LAGE.</p>
              <h1>Biblioteket</h1>
              <p class="muted">Ideer, referanser og ferdig innhold. Samlet.</p>
            </div>
            {#if canEdit}<button class="primary" onclick={() => openModal('item')}
                ><Plus size={17} />Legg til</button
              >{/if}
          </section>
          {#key product}<ImportPanel
              {product}
              {canEdit}
              onrefresh={refresh}
              onopen={openItem}
              onupload={() => openModal('item')}
            />{/key}
          <div class="filterbar">
            <div class="chips">
              <button class:selected={!filter} onclick={() => (filter = '')}
                >Alt <span>{items.length}</span></button
              >{#each ['video', 'image', 'hook', 'script', 'reference', 'template'] as kind}<button
                  class:selected={filter === kind}
                  onclick={() => (filter = kind)}>{kinds[kind]}</button
                >{/each}
            </div>
            <select aria-label="Filtrer kategori" bind:value={categoryFilter}
              ><option value="">Alle kategorier</option
              >{#each Object.entries(contentCategories) as [id, label]}<option value={id}
                  >{label}</option
                >{/each}</select
            >
            <select aria-label="Filtrer status" bind:value={statusFilter}
              ><option value="">Alle statuser</option><option value="draft">Utkast</option><option
                value="approved">Godkjent</option
              ></select
            >
          </div>
          {#key product}<LibraryTools
              {product}
              {items}
              {canEdit}
              bind:filterIDs={libraryFilterIDs}
              onchange={refresh}
            />{/key}
          {#if visibleItems.length}<div class="asset-grid">
              {#each visibleItems as item}{@const Icon = iconFor(item.kind)}<button
                  class="asset-card"
                  onclick={() => openItem(item.id)}
                  ><div
                    class="asset-preview"
                    class:text-preview={!['video', 'image', 'audio'].includes(item.kind)}
                  >
                    {#if ['video', 'image', 'audio'].includes(item.kind)}<MediaCard
                        {item}
                      />{:else}<Icon size={25} strokeWidth={1.4} />{#if item.body}<p>
                          {item.body.slice(0, 140)}
                        </p>{/if}{/if}<span class="type-label">{kinds[item.kind]}</span>
                  </div>
                  <div class="asset-info">
                    <h3>{item.title}</h3>
                    {#if item.file_name && item.file_name !== item.title}<p class="asset-filename">
                        {item.file_name}
                      </p>{/if}
                    <div>
                      <span>{formatDate(item.created_at)}</span><span
                        class="status"
                        class:approved={item.status === 'approved'}>{states[item.status]}</span
                      >
                    </div>
                  </div></button
                >{/each}
            </div>{:else}<div class="empty-large">
              <Library size={36} strokeWidth={1.2} />
              <h2>{filter ? 'Ingen treff ennå.' : 'Alt begynner med det første.'}</h2>
              <p>
                {filter
                  ? 'Velg en annen type, eller legg til nytt innhold.'
                  : 'Last opp en fil, ta vare på en referanse eller skriv ned en idé.'}
              </p>
              {#if canEdit}<button class="primary" onclick={() => openModal('item')}
                  ><Plus size={16} />Legg til innhold</button
                >{/if}
            </div>{/if}
        {:else if view === 'calendar'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">EN TING OM GANGEN</p>
              <h1>Publiseringsplan</h1>
              <p class="muted">Hva som skal ut. Og alt du trenger for å poste.</p>
            </div>
            {#if canEdit}<button class="primary" onclick={() => openModal('publication')}
                ><Plus size={17} />Planlegg</button
              >{/if}
          </section>
          <div class="calendar-toolbar">
            <div class="week-switch">
              <button
                class="icon-button"
                aria-label="Forrige uke"
                onclick={() => {
                  if (calendarMode === 'month') monthOffset--;
                  else calendarOffset--;
                  selectedDay = '';
                }}><ChevronLeft size={19} /></button
              ><strong
                >{formatDate(calendarDays[0] + 'T12:00:00Z')} – {formatDate(
                  calendarDays[calendarDays.length - 1] + 'T12:00:00Z',
                )}</strong
              ><button
                class="icon-button"
                aria-label="Neste uke"
                onclick={() => {
                  if (calendarMode === 'month') monthOffset++;
                  else calendarOffset++;
                  selectedDay = '';
                }}><ChevronRight size={19} /></button
              ><button
                class="text-button"
                onclick={() => {
                  calendarOffset = 0;
                  monthOffset = 0;
                  selectedDay = '';
                }}>I dag</button
              >
            </div>
            <div class="segmented">
              <button
                class:selected={calendarMode === 'week'}
                onclick={() => {
                  calendarMode = 'week';
                  selectedDay = '';
                }}>Uke</button
              ><button
                class:selected={calendarMode === 'month'}
                onclick={() => {
                  calendarMode = 'month';
                  selectedDay = '';
                }}>Måned</button
              ><button
                class:selected={calendarMode === 'list'}
                onclick={() => (calendarMode = 'list')}>Liste</button
              >
            </div>
          </div>
          {#if calendarMode !== 'list'}<div
              class="week-grid"
              class:month-grid={calendarMode === 'month'}
            >
              {#each calendarDays as day}{@const dayPosts = publications.filter((p) =>
                  localInput(new Date(p.scheduled_at)).startsWith(day),
                )}<button
                  class:today={day === localInput().slice(0, 10)}
                  class:chosen={day === selectedDay}
                  onclick={() => (selectedDay = selectedDay === day ? '' : day)}
                  ><span>{formatDate(day + 'T12:00:00Z', { weekday: 'short' })}</span><strong
                    >{day.slice(-2)}</strong
                  >
                  <div class="day-dots">
                    {#each dayPosts.slice(0, 4) as p}<i
                        class:ready={p.content_ready || p.status === 'published'}
                      ></i>{/each}
                  </div></button
                >{/each}
            </div>{/if}
          <div class="section-heading">
            <h2>
              {selectedDay
                ? formatDate(selectedDay + 'T12:00:00Z', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })
                : calendarMode === 'list'
                  ? 'Alle publiseringer'
                  : calendarMode === 'month'
                    ? 'Denne måneden'
                    : 'Denne uken'}
            </h2>
            <span class="small muted">Europe/Oslo</span>
          </div>
          {#if listedPublications.length}<div class="schedule-list">
              {#each listedPublications as p}<button
                  class="schedule-card"
                  onclick={() =>
                    openModal('publish-detail', {
                      ...p,
                      scheduled_at: localInput(new Date(p.scheduled_at)),
                    })}
                  ><div class="schedule-time">
                    <strong
                      >{formatDate(p.scheduled_at, { hour: '2-digit', minute: '2-digit' })}</strong
                    ><span
                      >{formatDate(p.scheduled_at, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}</span
                    >
                  </div>
                  <div class="row-main">
                    <span class="eyebrow">{p.channel}</span>
                    <h3>{p.title}</h3>
                    <small>{p.assignee || 'Ingen ansvarlig'}</small>
                  </div>
                  <span class="status" class:approved={p.status === 'published' || p.content_ready}
                    >{p.status === 'published'
                      ? 'Publisert'
                      : p.content_ready
                        ? 'Klar til å postes'
                        : 'Sjekk godkjenning og rettigheter'}</span
                  ><ArrowUpRight size={18} /></button
                >{/each}
            </div>{:else}<div class="empty-large">
              <CalendarDays size={34} strokeWidth={1.2} />
              <h2>Her er det plass.</h2>
              <p>Planlegg en publisering, selv om innholdet ikke er ferdig.</p>
              {#if canEdit}<button
                  class="secondary"
                  onclick={() =>
                    openModal('publication', {
                      scheduled_at: (selectedDay || calendarDays[0]) + 'T10:00',
                    })}><Plus size={16} />Legg noe på planen</button
                >{/if}
            </div>{/if}
        {:else if view === 'tasks'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">FRA IDÉ TIL LEVERANSE</p>
              <h1>Arbeidet underveis</h1>
              <p class="muted">Oppgaver for dere og agentene deres.</p>
            </div>
            {#if canEdit}<button class="primary" onclick={() => openModal('task')}
                ><Plus size={17} />Ny oppgave</button
              >{/if}
          </section>
          <div class="board-tabs" aria-label="Oppgavestatus">
            {#each columns as col}
              <button
                class:active={boardState === col}
                aria-pressed={boardState === col}
                onclick={() => (boardState = col)}
                >{states[col]} <span>{tasks.filter((t) => t.status === col).length}</span></button
              >
            {/each}
          </div>
          <div class="kanban">
            {#each columns as col}<section
                class="kanban-column"
                class:mobile-hidden={col !== boardState}
              >
                <div class="column-heading">
                  <span class={'column-dot ' + col}></span>
                  <h2>{col === 'ready' ? 'Klar til arbeid' : states[col]}</h2>
                  <span>{tasks.filter((t) => t.status === col).length}</span>
                </div>
                {#each tasks.filter((t) => t.status === col) as t}<article class="task-card">
                    <span class="eyebrow"
                      >{t.executor === 'external' ? 'EKSTERN AGENT' : 'TEAM'}</span
                    >
                    <h3>
                      <button
                        class="task-title"
                        onclick={() => openModal('task-detail', { id: t.id })}>{t.title}</button
                      >
                    </h3>
                    {#if t.brief}<p>{t.brief.slice(0, 160)}</p>{/if}
                    <div class="task-meta">
                      <span>{t.assignee || 'Ikke tildelt'}</span>{#if t.lease_until}<Clock3
                          size={14}
                        />{/if}
                    </div>
                    {#if t.item_id}<button class="text-button" onclick={() => openItem(t.item_id)}
                        >Se leveransen<ArrowUpRight size={15} /></button
                      >{/if}{#if canEdit}<select
                        aria-label={'Status for ' + t.title}
                        value={t.status}
                        onchange={(e) => changeTask(t, e.currentTarget.value)}
                        >{#each columns as state}<option value={state}>{states[state]}</option
                          >{/each}</select
                      >{/if}
                  </article>{/each}{#if canEdit}<button
                    class="add-task"
                    onclick={() => openModal('task', { status: col })}
                    ><Plus size={15} />Legg til oppgave</button
                  >{/if}
              </section>{/each}
          </div>
          <p class="small muted board-note">
            Agenter kan hente oppgaver i «Klar til arbeid». Leveranser kommer tilbake til
            gjennomgang.
          </p>
        {:else if view === 'chat'}
          <div class="chat-top">
            <div>
              <h1>La oss få det gjort.</h1>
              <span class="small muted">{currentProduct?.name} · produktkontekst og bibliotek</span>
            </div>
            <button
              class="secondary"
              onclick={() => {
                conversationID = '';
                messages = [];
                latestRun = null;
                runEvents = [];
              }}><Plus size={16} /><span>Ny samtale</span></button
            >
          </div>
          {#if conversations.length}<select
              class="conversation-picker"
              aria-label="Velg samtale"
              value={conversationID}
              onchange={(e) => selectConversation(e.currentTarget.value)}
              ><option value="">Ny samtale</option>{#each conversations as c}<option value={c.id}
                  >{c.title}</option
                >{/each}</select
            >{/if}
          <div class="chat-scroll" aria-live="polite">
            {#if !messages.length}<div class="chat-welcome">
                <span class="chat-mark">s.</span>
                <h2>Hva har du på hjertet?</h2>
                <p>En løs idé, en konkret brief eller noe<br />du vil finne i biblioteket.</p>
                <div class="suggestions">
                  <button
                    onclick={() =>
                      (composer = 'Hjelp meg å skrive tre hooks for en video om teoriprøven.')}
                    >Skriv tre nye hooks<ArrowUpRight size={15} /></button
                  ><button
                    onclick={() =>
                      (composer =
                        'Finn referanser og manus som allerede finnes i biblioteket vårt.')}
                    >Finn materiale i biblioteket<ArrowUpRight size={15} /></button
                  ><button
                    onclick={() =>
                      (composer = 'Lag en brief for en 15 sekunders video for foreldre.')}
                    >Lag en produksjonsbrief<ArrowUpRight size={15} /></button
                  >
                </div>
              </div>{/if}{#each messages as m}<article
                class="chat-message"
                class:mine={m.role === 'user'}
              >
                <span class="message-author">{m.role === 'user' ? user.name : 'Studio'}</span>
                <p>{m.body}</p>
              </article>{/each}
            {#if latestRun}<div class="run-status">
                <span class:working={activeRun} class="dot"></span><span
                  >{states[latestRun.status]} · {latestRun.steps} steg · ${Number(
                    latestRun.cost_usd,
                  ).toFixed(4)}</span
                >{#if activeRun}<button class="text-button" onclick={stopRun}
                    ><Square size={12} />Stopp</button
                  >{/if}
              </div>
              {#if latestRun.stop_reason}<p class="run-reason">
                  {latestRun.stop_reason}
                </p>{/if}{#if runEvents.length}<details class="run-log">
                  <summary>Se jobblogg</summary>{#each runEvents as event}<div>
                      <span>{event.kind}</span><code>{JSON.stringify(event.detail)}</code>
                    </div>{/each}
                </details>{/if}{/if}
          </div>
          <form class="composer" onsubmit={send}>
            <details class="chat-context">
              <summary>Velg kontekst og oppgave</summary>
              <div class="form-grid">
                <label
                  >Oppgaveprofil<select bind:value={chatRole}
                    ><option value="chat">Chat og planlegging</option
                    >{#each profiles.filter((p) => p.provider === 'openrouter' && p.role !== 'chat') as p}<option
                        value={p.role}>{p.name || p.role}</option
                      >{/each}<option value="script">Manus</option></select
                  ></label
                ><label
                  >Kampanje<select bind:value={chatCampaign}
                    ><option value="">Ingen</option>{#each campaigns as c}<option value={c.id}
                        >{c.name}</option
                      >{/each}</select
                  ></label
                >
              </div>
              <div class="selection-list">
                {#each items as i}<label class="check-row"
                    ><input
                      type="checkbox"
                      bind:group={chatAttachments}
                      value={i.current_version_id}
                    />{i.title}</label
                  >{/each}
              </div>
              <label
                >Last opp vedlegg<input
                  type="file"
                  disabled={!canEdit || busy}
                  onchange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f)
                      safely(async () => {
                        const out = await uploadFile(product, f, {}, (v) => (uploadPercent = v));
                        await refresh();
                        chatAttachments = [...chatAttachments, out.version_id];
                      });
                  }}
                /></label
              >
            </details>
            <textarea
              aria-label="Melding til Studio"
              bind:value={composer}
              placeholder="Hva vil du lage eller finne?"
              rows="2"
              disabled={!canEdit}></textarea>
            <div class="composer-bottom">
              <select aria-label="Modell for denne samtalen" bind:value={modelOverride}
                ><option value=""
                  >{settings.models.find((m: Row) => m.role === 'chat')?.model ||
                    'Velg modell i innstillinger'}</option
                >{#each settings.models.filter((m: Row) => m.provider === 'openrouter' && m.model) as m}<option
                    value={m.model}>{m.model}</option
                  >{/each}</select
              ><button
                class="send-button"
                aria-label="Send melding"
                disabled={busy || activeRun || !composer.trim() || !canEdit}
                ><ArrowUp size={20} /></button
              >
            </div>
          </form>
          {#if latestRun?.partial}<p class="stream-answer body-text" aria-live="polite">
              {latestRun.partial}
            </p>{/if}
          <p class="composer-hint">
            {settings.ai_enabled && settings.openrouter_connected
              ? 'Studio kan søke og lagre utkast. Produksjonsagenter kobles til via MCP.'
              : 'Legg inn OpenRouter-nøkkel og aktiver AI i .env for å bruke chatten.'}
          </p>
        {:else if view === 'settings'}
          <section class="page-heading">
            <div>
              <p class="eyebrow">ET ARBEIDSROM SOM PASSER DERE</p>
              <h1>Innstillinger</h1>
              <p class="muted">Produkt, modeller og menneskene som er med.</p>
            </div>
          </section>
          <section class="settings-section">
            <h2>Produktgrunnlaget</h2>
            <p class="muted">Dette følger med når Studio jobber for {currentProduct?.name}.</p>
            {#if currentProduct}<form
                onsubmit={(e) => {
                  e.preventDefault();
                  safely(async () => {
                    await api('/products/' + product, 'PATCH', {
                      description: currentProduct.description,
                      brand: currentProduct.brand,
                      audience: currentProduct.audience,
                    });
                    toast('Produktgrunnlaget er lagret');
                  });
                }}
              >
                <label
                  >Om produktet<textarea
                    bind:value={currentProduct.description}
                    rows="3"
                    disabled={!canEdit}></textarea></label
                ><label
                  >Målgruppe<textarea
                    bind:value={currentProduct.audience}
                    rows="2"
                    disabled={!canEdit}></textarea></label
                ><label
                  >Merkevare og godkjente påstander<textarea
                    bind:value={currentProduct.brand}
                    rows="4"
                    placeholder="Tone, farger, formuleringer og fakta agentene skal bruke …"
                    disabled={!canEdit}></textarea></label
                >{#if canEdit}<button class="secondary" disabled={busy}
                    >Lagre produktgrunnlag</button
                  >{/if}
              </form>{/if}
          </section>
          <section class="settings-section">
            <div class="section-heading">
              <h2>Modeller og grenser</h2>
              <span class="status" class:approved={settings.ai_enabled}
                >{settings.ai_enabled ? 'AI aktivert' : 'AI avslått'}</span
              >
            </div>
            <p class="muted">
              Velg en modell per rolle. Chat kjører i Studio. Produksjonsoppgaver utføres foreløpig
              av eksterne MCP-agenter.
            </p>
            <p class="small muted">
              OpenRouter: {settings.openrouter_connected ? 'nøkkel konfigurert' : 'nøkkel mangler'} ·
              TypeSafe: {settings.typesafe_connected ? 'nøkkel konfigurert' : 'nøkkel mangler'}
            </p>
            <div class="model-list">
              {#each settings.models as model}<form
                  class="model-row"
                  onsubmit={(e) => {
                    e.preventDefault();
                    saveModel(model);
                  }}
                >
                  <div>
                    <strong>{roleNames[model.role]}</strong><small
                      >{model.provider === 'external'
                        ? 'Ekstern agent via MCP'
                        : model.role === 'chat'
                          ? 'Aktiv chatmotor'
                          : 'Kan kjøres fra innholdets detaljvisning'}</small
                    >
                  </div>
                  <label
                    >Modell-ID<input
                      bind:value={model.model}
                      placeholder={model.provider === 'typesafe'
                        ? 'jev-1.13.0'
                        : 'leverandør/modell'}
                      disabled={user.role !== 'admin'}
                    /></label
                  >{#if model.provider !== 'external'}<div class="limits-grid">
                      <label
                        >Maks steg<input
                          type="number"
                          min="1"
                          max="12"
                          bind:value={model.max_steps}
                          disabled={user.role !== 'admin'}
                        /></label
                      ><label
                        >Maks sekunder<input
                          type="number"
                          min="10"
                          max="300"
                          bind:value={model.timeout_seconds}
                          disabled={user.role !== 'admin'}
                        /></label
                      ><label
                        >USD per jobb<input
                          type="number"
                          min="0.001"
                          max="5"
                          step="0.001"
                          bind:value={model.max_cost_usd}
                          disabled={user.role !== 'admin'}
                        /></label
                      >
                    </div>{/if}{#if user.role === 'admin'}<button class="secondary" disabled={busy}
                      >Lagre</button
                    >{/if}
                </form>{/each}
            </div>
            <p class="small muted">
              Studio krever også en bruksgrense på OpenRouter-nøkkelen. Jobber starter aldri nye
              agentjobber automatisk.
            </p>
          </section>
          {#if user.role === 'admin'}<section class="settings-section">
              <div class="section-heading">
                <h2>Invitasjoner</h2>
                <button class="secondary" onclick={() => openModal('invite')}
                  ><Plus size={16} />Inviter</button
                >
              </div>
              <p class="muted">Kopier en invitasjonslenke og del den selv. Gyldig i syv dager.</p>
              {#each invites as invite}<div class="settings-list-row">
                  <span>{invite.email}<small>{invite.role}</small></span><span class="status"
                    >{invite.revoked_at
                      ? 'Tilbakekalt'
                      : invite.used_at
                        ? 'Brukt'
                        : new Date(invite.expires_at) < new Date()
                          ? 'Utløpt'
                          : 'Venter'}</span
                  >{#if !invite.used_at && !invite.revoked_at}<button
                      class="text-button"
                      onclick={() =>
                        safely(async () => {
                          await api('/invites/' + invite.id, 'DELETE');
                          invites = await api('/invites');
                        })}>Tilbakekall</button
                    >{/if}
                </div>{/each}
            </section>
            <section class="settings-section">
              <div class="section-heading">
                <h2>Eksterne agenter</h2>
                <button class="secondary" onclick={() => openModal('agent')}
                  ><Plus size={16} />Ny agentnøkkel</button
                >
              </div>
              <p class="muted">
                Hver nøkkel gir tilgang til ett produkt. Agenten kan hente oppgaver og levere
                innhold til gjennomgang.
              </p>
              <code class="endpoint">{mcpEndpoint}</code>{#each agentKeys as key}<div
                  class="settings-list-row"
                >
                  <span>{key.name}<small>{key.product_name}</small></span>{#if key.revoked_at}<span
                      class="status">Tilbakekalt</span
                    >{:else}<button
                      class="text-button"
                      onclick={() =>
                        safely(async () => {
                          await api('/agent-tokens/' + key.id, 'DELETE');
                          agentKeys = await api('/agent-tokens');
                        })}>Tilbakekall</button
                    >{/if}
                </div>{/each}
            </section>{/if}
          <button
            class="secondary"
            onclick={() =>
              safely(async () => {
                await api('/auth/logout', 'POST', {});
                user = null;
                authMode = 'login';
              })}><LogOut size={16} />Logg ut</button
          >
        {/if}
      </main>
    </div>
    <nav class="mobile-nav" aria-label="Mobilmeny">
      {#each nav as n}<button class:active={view === n.id} onclick={() => navigate(n.id)}
          ><n.icon size={21} strokeWidth={1.7} /><span>{n.label}</span></button
        >{/each}
    </nav>
  </div>
{/if}

{#if notice}<div class="toast" role="status"><Check size={16} />{notice}</div>{/if}
<dialog
  bind:this={dialog}
  onclose={() => {
    modal = '';
  }}
  class:search-dialog={modal === 'search'}
>
  <div class="dialog-header">
    <span class="eyebrow"
      >{modal === 'search' ? 'FINN DET DU TRENGER' : currentProduct?.name || 'STUDIO'}</span
    ><button class="icon-button" aria-label="Lukk" onclick={closeModal}><X size={21} /></button>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if modal === 'search'}
    <div class="global-search">
      <Search size={23} /><input
        aria-label="Søk"
        bind:value={query}
        oninput={searchInput}
        placeholder="Hva leter du etter?"
      />
    </div>
    <p class="small muted">
      Søk i innhold, transkript, skjermtekst, samtaler, oppgaver og resultater.
    </p>
    <div class="form-grid search-filters">
      <label
        >Omfang<select bind:value={searchScope} onchange={searchInput}
          ><option value="product">Dette produktet</option><option value="all"
            >Alle tilgjengelige produkter</option
          ></select
        ></label
      >
      <label
        >Søkemåte<select bind:value={searchMode} onchange={searchInput}
          ><option value="all">Tekst og semantikk</option><option value="text">Kun tekst</option
          ><option value="semantic">Semantisk</option><option value="visual"
            >Visuelt med tekst</option
          ></select
        ></label
      ><label
        >Innholdstype<select bind:value={searchKind} onchange={searchInput}
          ><option value="">Alle</option>{#each Object.entries(kinds) as [kind, label]}<option
              value={kind}>{label}</option
            >{/each}</select
        ></label
      ><label
        >Rettigheter<select bind:value={searchRights} onchange={searchInput}
          ><option value="">Alle</option><option value="owned">Eget materiale</option><option
            value="licensed">Lisensiert</option
          ><option value="reference_only">Referanse</option></select
        ></label
      ><label
        >Status<select bind:value={searchStatus} onchange={searchInput}
          ><option value="">Alle</option
          >{#each ['draft', 'review', 'approved', 'archived'] as st}<option value={st}
              >{states[st]}</option
            >{/each}</select
        ></label
      ><label>Etikett<input bind:value={searchTag} oninput={searchInput} /></label><label
        >Opphavsperson<input bind:value={searchAuthor} oninput={searchInput} /></label
      ><label
        >Kampanje<select bind:value={searchCampaign} onchange={searchInput}
          ><option value="">Alle</option>{#each campaigns as c}<option value={c.id}>{c.name}</option
            >{/each}</select
        ></label
      ><label
        >Min. visninger<input
          type="number"
          min="0"
          bind:value={searchMinViews}
          oninput={searchInput}
        /></label
      >
    </div>
    <details class="tool-panel">
      <summary>Bildesøk og lagrede søk</summary><label
        >Søk med et bilde<input
          type="file"
          accept="image/*"
          onchange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f)
              safely(async () => {
                if (f.size > 700000) throw new Error('Velg et bilde under 700 KB');
                const b = await new Promise<string>((resolve, reject) => {
                  const r = new FileReader();
                  r.onload = () => resolve(String(r.result).split(',')[1]);
                  r.onerror = reject;
                  r.readAsDataURL(f);
                });
                results = await api('/search/image', 'POST', { product_id: product, base64: b });
                query = 'Bildesøk';
              });
          }}
        /></label
      >
      <div class="button-row">
        <input
          aria-label="Navn på lagret søk"
          bind:value={savedName}
          placeholder="Gi søket et navn"
        /><button
          class="secondary"
          disabled={!savedName || !query}
          onclick={() =>
            safely(async () => {
              await api('/saved-searches', 'POST', {
                product_id: product,
                name: savedName,
                query: {
                  scope: searchScope,
                  q: query,
                  mode: searchMode,
                  kind: searchKind,
                  status: searchStatus,
                  tag: searchTag,
                  rights: searchRights,
                  author: searchAuthor,
                  campaign: searchCampaign,
                  min_views: String(searchMinViews),
                },
              });
              savedName = '';
              const d = await api('/library?product=' + product);
              savedSearches = d.searches || [];
            })}>Lagre søk</button
        >
      </div>
      {#each savedSearches as saved}<div class="compact-row">
          <button
            class="text-button"
            onclick={() => {
              query = saved.query.q;
              searchScope = saved.query.scope || 'product';
              searchMode = saved.query.mode || 'all';
              searchKind = saved.query.kind || '';
              searchStatus = saved.query.status || '';
              searchTag = saved.query.tag || '';
              searchRights = saved.query.rights || '';
              searchAuthor = saved.query.author || '';
              searchCampaign = saved.query.campaign || '';
              searchMinViews = Number(saved.query.min_views || 0);
              searchInput();
            }}>{saved.name}</button
          ><button
            class="text-button"
            onclick={() =>
              safely(async () => {
                await api('/saved-searches/' + saved.id, 'DELETE');
                savedSearches = savedSearches.filter((s) => s.id !== saved.id);
              })}>Fjern</button
          >
        </div>{/each}
    </details>
    {#if searchSelection.length}<div class="tool-panel">
        <p>{searchSelection.length} elementer valgt</p>
        <div class="button-row wrap">
          <a class="secondary" href={'/api/export/package?ids=' + searchSelection.join(',')}
            >Last ned pakke</a
          >{#if canEdit}<input
              aria-label="Etikett for valgte treff"
              placeholder="Etikett"
              bind:value={searchBulkTag}
            /><button
              class="secondary"
              disabled={!searchBulkTag || busy}
              onclick={() =>
                safely(async () => {
                  await api('/items/bulk', 'POST', {
                    ids: searchSelection,
                    action: 'tag',
                    value: searchBulkTag,
                  });
                  await refresh();
                  toast('Etikett lagt til');
                  searchInput();
                })}>Legg til etikett</button
            ><button
              class="text-button"
              onclick={() =>
                safely(async () => {
                  await api('/items/bulk', 'POST', { ids: searchSelection, action: 'trash' });
                  await refresh();
                  searchInput();
                })}>Til papirkurv</button
            >{/if}
        </div>
      </div>{/if}
    <div class="search-results">
      {#if searching}<p class="muted">Leter …</p>{:else if query && !results.length}<div
          class="empty-card"
        >
          <h3>Ingen treff.</h3>
          <p>Prøv et annet ord eller en kortere formulering.</p>
        </div>{:else if !query}<p class="search-help">
          Et ord fra et manus. En idé dere diskuterte.<br />Navnet på en publisering.
        </p>{:else}{#each results as result}<div class="search-result-row">
            {#if ['item', 'note', 'segment', 'frame'].includes(result.entity)}<input
                type="checkbox"
                aria-label={'Velg ' + result.title}
                checked={searchSelection.includes(result.target_id)}
                onchange={(e) => {
                  searchSelection = e.currentTarget.checked
                    ? [...new Set([...searchSelection, result.target_id])]
                    : searchSelection.filter((id) => id !== result.target_id);
                }}
              />{/if}<button onclick={() => followResult(result)}
              ><span class="eyebrow"
                >{kinds[result.kind] ||
                  (
                    {
                      task: 'Oppgave',
                      message: 'Samtale',
                      publication: 'Publisering',
                      note: 'Notat',
                    } as Record<string, string>
                  )[result.entity] ||
                  result.entity}</span
              >
              <h3>{result.title}</h3>
              <p>{result.excerpt}</p>
              <small class="muted"
                >{result.explanation}{#if result.start_seconds != null}
                  · {seconds(result.start_seconds)}{/if}{#if result.version_id}
                  · versjon {result.version_number || result.version_id.slice(0, 8)}{/if}</small
              ></button
            >
          </div>{/each}{/if}
    </div>
  {:else if modal === 'task-detail'}<TaskPanel
      id={draft.id}
      {canEdit}
      onopen={openItem}
      onchange={refresh}
    />
  {:else if modal === 'publish-detail'}
    <h2>{draft.title}</h2>
    <label>Tittel<input bind:value={draft.title} disabled={!canEdit} /></label><label
      >Kanal<select bind:value={draft.channel} disabled={!canEdit}
        >{#each ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'Snapchat'] as ch}<option
            >{ch}</option
          >{/each}</select
      ></label
    ><label
      >Posttekst<textarea bind:value={draft.caption} rows="4" disabled={!canEdit}></textarea></label
    ><label>Ansvarlig<input bind:value={draft.assignee} disabled={!canEdit} /></label><label
      >Kampanje<select bind:value={draft.campaign_id} disabled={!canEdit}
        ><option value="">Ingen kampanje</option>{#each campaigns as c}<option value={c.id}
            >{c.name}</option
          >{/each}</select
      ></label
    ><label
      >Landingsside med UTM-sporing<input
        type="url"
        bind:value={draft.landing_url}
        placeholder="https://…"
        disabled={!canEdit}
      /></label
    >{#if draft.tracking_url}<label
        >Sporingslenke<input readonly value={draft.tracking_url} /></label
      >{/if}<label
      >Påminnelse · minutter før<input
        type="number"
        min="0"
        max="10080"
        bind:value={draft.reminder_minutes}
        disabled={!canEdit}
      /></label
    >
    <p class="muted">
      {draft.channel} · {formatDate(osloISO(draft.scheduled_at), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </p>
    <span class="status" class:approved={draft.content_ready}
      >{draft.content_ready
        ? 'Godkjent innhold er klart'
        : 'Sjekk godkjenning og rettigheter'}</span
    >
    <label
      >Publiseringstid · Europe/Oslo<input
        type="datetime-local"
        bind:value={draft.scheduled_at}
        disabled={!canEdit}
      /></label
    ><label
      >Innhold<select bind:value={draft.item_id} disabled={!canEdit}
        ><option value="">Velg innhold</option>{#each items as i}<option value={i.id}
            >{i.title} · {states[i.status]}</option
          >{/each}</select
      ></label
    >{#if canEdit}<button class="secondary" onclick={savePublication} disabled={busy}
        >Oppdater pakken</button
      >{/if}
    <div class="publish-copy">
      <div class="section-heading">
        <h3>Posttekst</h3>
        <button class="text-button" onclick={() => copy(draft.caption || '')}
          ><Copy size={15} />Kopier</button
        >
      </div>
      <p class="body-text">{draft.caption || 'Ingen posttekst er lagt inn.'}</p>
    </div>
    {#if draft.version_id && draft.file_name}<a
        class="primary wide"
        href={'/api/files/' + draft.version_id + '?download=1'}
        download><Download size={17} />Last ned publiseringsfil</a
      >{/if}
    <a
      class="secondary wide"
      href={draft.channel === 'TikTok'
        ? 'https://www.tiktok.com/'
        : draft.channel === 'YouTube'
          ? 'https://studio.youtube.com/'
          : draft.channel === 'Facebook'
            ? 'https://www.facebook.com/'
            : draft.channel === 'Snapchat'
              ? 'https://www.snapchat.com/'
              : 'https://www.instagram.com/'}
      target="_blank"
      rel="noreferrer">Åpne {draft.channel}<ArrowUpRight size={16} /></a
    >
    {#if draft.status !== 'published' && canEdit}<form
        class="publish-confirm"
        onsubmit={(e) => {
          e.preventDefault();
          markPublished();
        }}
      >
        <label
          >Lenke til publisert post<input
            type="url"
            bind:value={draft.url}
            placeholder="https://…"
            required
          /></label
        ><button class="primary" disabled={busy || !draft.content_ready}
          ><Check size={16} />Marker som publisert</button
        >
      </form>{:else if draft.url}<a href={draft.url} target="_blank" rel="noreferrer"
        >Se publisert post</a
      >{/if}
  {:else if modal}
    <h2>
      {modal === 'item'
        ? 'Legg til i biblioteket'
        : modal === 'task'
          ? 'Et nytt oppdrag'
          : modal === 'publication'
            ? 'Sett en dato'
            : modal === 'invite'
              ? 'Inviter en kollega'
              : 'Koble til en agent'}
    </h2>
    {#if freshSecret}<p>Kopier nøkkelen nå. Den vises bare én gang.</p>
      <code class="secret">{freshSecret}</code><button
        class="primary"
        onclick={() => copy(freshSecret)}><Copy size={16} />Kopier nøkkel</button
      >
      <p class="small muted">MCP: {mcpEndpoint} · Authorization: Bearer nøkkel</p>
    {:else if inviteLink}<p>Del denne lenken med {draft.email}.</p>
      <code class="secret">{inviteLink}</code><button
        class="primary"
        onclick={() => copy(inviteLink)}><Copy size={16} />Kopier invitasjon</button
      >
    {:else}<form onsubmit={save}>
        {#if modal === 'invite'}<label
            >E-post<input
              type="email"
              bind:value={draft.email}
              required
              placeholder="kollega@firma.no"
            /></label
          ><label
            >Tilgang<select bind:value={draft.role}
              ><option value="editor">Redaktør</option><option value="reader">Lesetilgang</option
              ><option value="admin">Administrator</option></select
            ></label
          >
        {:else}<label
            >{modal === 'agent' ? 'Agentens navn' : 'Tittel'}<input
              bind:value={draft.title}
              required
              placeholder={modal === 'task'
                ? 'Lag tre hook-varianter til neste video'
                : 'Gi det et godt navn'}
              maxlength="300"
            /></label
          >{/if}
        {#if modal === 'item'}<div class="upload-zone">
            <Upload size={23} strokeWidth={1.4} /><strong
              >{file ? file.name : 'Legg ved en fil'}</strong
            ><span>Bilder, video og lyd · inntil 2 GB · fortsett avbrutte opplastinger</span><input
              type="file"
              aria-label="Last opp fil"
              onchange={(e) => {
                file = e.currentTarget.files?.[0] || null;
                if (file && !draft.title) draft.title = file.name;
              }}
            />
          </div>
          {#if !file}<label
              >Type<select bind:value={draft.kind}
                >{#each Object.entries(kinds) as [id, label]}<option value={id}>{label}</option
                  >{/each}</select
              ></label
            >{/if}<label
            >Innhold eller beskrivelse<textarea
              bind:value={draft.body}
              rows="5"
              placeholder="Skriv, lim inn eller ta vare på en tanke …"></textarea></label
          >{#if draft.kind === 'reference'}<label
              >Kildelenke<input
                type="url"
                bind:value={draft.source_url}
                placeholder="https://…"
              /></label
            ><button
              type="button"
              class="secondary"
              onclick={() =>
                safely(async () => {
                  const m = await api('/references/metadata', 'POST', { url: draft.source_url });
                  draft.title = m.title || draft.title;
                  draft.body = m.description || draft.body;
                })}>Hent tittel og beskrivelse</button
            >{/if}<label
            >Bruksrettigheter<select bind:value={draft.rights}
              ><option value="unknown">Ikke avklart</option><option value="owned"
                >Eget materiale</option
              ><option value="licensed">Lisensiert</option><option value="reference_only"
                >Kun referanse</option
              ></select
            ></label
          >{/if}
        {#if modal === 'task'}<label
            >Brief<textarea
              bind:value={draft.body}
              rows="5"
              placeholder="Hva skal lages, til hvem og i hvilket format?"></textarea></label
          >
          <div class="form-grid">
            <label
              >Utføres av<select bind:value={draft.executor}
                ><option value="external">Ekstern agent via MCP</option><option value="human"
                  >Et menneske</option
                ></select
              ></label
            ><label
              >Status<select bind:value={draft.status}
                >{#each columns as col}<option value={col}>{states[col]}</option>{/each}</select
              ></label
            >
          </div>
          <label
            >Ansvarlig<input bind:value={draft.assignee} placeholder="Navn eller agent" /></label
          >{/if}
        {#if modal === 'publication'}<div class="form-grid">
            <label
              >Kanal<select bind:value={draft.channel}
                >{#each ['Instagram', 'TikTok', 'Facebook', 'YouTube', 'Snapchat'] as ch}<option
                    >{ch}</option
                  >{/each}</select
              ></label
            ><label
              >Tid · Europe/Oslo<input
                type="datetime-local"
                bind:value={draft.scheduled_at}
                required
              /></label
            >
          </div>
          <label
            >Posttekst<textarea
              bind:value={draft.caption}
              rows="4"
              placeholder="Teksten som følger posten …"></textarea></label
          ><label
            >Koble til innhold<select bind:value={draft.item_id}
              ><option value="">Kommer senere</option>{#each items as i}<option value={i.id}
                  >{i.title}</option
                >{/each}</select
            ></label
          ><label
            >Produksjonsoppgave<select bind:value={draft.task_id}
              ><option value="">Ingen oppgave</option>{#each tasks as t}<option value={t.id}
                  >{t.title}</option
                >{/each}</select
            ></label
          ><label>Hvem skal poste?<input bind:value={draft.assignee} placeholder="Navn" /></label
          ><label
            >Kampanje<select bind:value={draft.campaign_id}
              ><option value="">Ingen kampanje</option>{#each campaigns as c}<option value={c.id}
                  >{c.name}</option
                >{/each}</select
            ></label
          ><label
            >Landingsside<input
              type="url"
              bind:value={draft.landing_url}
              placeholder="https://…"
            /></label
          ><label
            >Påminnelse · minutter før<input
              type="number"
              min="0"
              max="10080"
              bind:value={draft.reminder_minutes}
            /></label
          >{/if}
        {#if modal === 'agent'}<p class="muted">
            Nøkkelen får tilgang til {currentProduct?.name}. Den kan hente og levere oppgaver, men
            ikke godkjenne eller publisere.
          </p>{/if}
        <div class="dialog-footer">
          <button type="button" class="secondary" onclick={closeModal}>Avbryt</button><button
            class="primary"
            disabled={busy}
            >{uploadProgress
              ? 'Laster opp ' + uploadPercent + ' %'
              : busy
                ? 'Lagrer …'
                : modal === 'invite'
                  ? 'Lag invitasjonslenke'
                  : modal === 'agent'
                    ? 'Opprett nøkkel'
                    : 'Lagre'}<ArrowRight size={16} /></button
          >
        </div>
      </form>{/if}
  {/if}
</dialog>
