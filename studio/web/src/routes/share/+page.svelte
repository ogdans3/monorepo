<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Row } from '$lib/api';
  import '$lib/style.css';
  let data: Row | null = null,
    error = '',
    token = '';
  onMount(() => {
    token = location.hash.slice(1);
    history.replaceState(null, '', location.pathname);
    if (!token) {
      error = 'Delingslenken mangler';
      return;
    }
    api('/shared/' + encodeURIComponent(token))
      .then((v) => (data = v))
      .catch((e) => (error = e.message));
  });
</script>

<svelte:head
  ><title>Delt innhold · Studio</title><meta name="referrer" content="no-referrer" /></svelte:head
>
<main class="share-page">
  <span class="wordmark">studio.</span>{#if error}<p class="error">{error}</p>{:else if data}<p
      class="eyebrow"
    >
      DELT MED DEG · V{data.number}
    </p>
    <h1>{data.title}</h1>
    {#if data.mime?.startsWith('video/')}<video
        controls
        playsinline
        src={'/api/shared/' + token + '?file=1'}><track kind="captions" /></video
      >{:else if data.mime?.startsWith('image/')}<img
        src={'/api/shared/' + token + '?file=1'}
        alt={data.title}
      />{:else if data.mime?.startsWith('audio/')}<audio
        controls
        src={'/api/shared/' + token + '?file=1'}
      ></audio>{/if}
    <p class="body-text">{data.body}</p>{:else}<p>Åpner delt innhold …</p>{/if}
</main>
