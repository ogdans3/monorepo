<script lang="ts">
  import { onMount } from 'svelte';
  import { api, states, type Row } from '$lib/api';
  export let id: string;
  export let canEdit = false;
  export let onopen: (id: string) => void;
  export let onchange: () => Promise<void>;
  let data: Row | null = null,
    error = '',
    feedback = '',
    busy = false;
  async function load() {
    data = await api('/tasks/' + id);
  }
  onMount(() => {
    load().catch((e) => (error = e.message));
  });
  async function revise() {
    busy = true;
    try {
      await api('/tasks/' + id + '/revise', 'POST', { body: feedback });
      feedback = '';
      await load();
      await onchange();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

{#if error}<p class="error" role="alert">{error}</p>{/if}{#if data}<h2>{data.task.title}</h2>
  <p class="muted">{states[data.task.status]} · Revisjon {data.task.revision}</p>
  <p class="body-text">{data.task.brief}</p>
  {#if data.task.specification?.kind}<p>
      Produksjon: {data.task.specification.kind} · {data.task.specification.formats?.join(', ')}
    </p>
    <h3>Leveransekrav</h3>
    <ul>
      {#each data.task.specification.requirements || [] as req}<li>{req}</li>{/each}
    </ul>{/if}
  {#if data.task.progress?.stage}<p>
      {data.task.progress.stage}
      {data.task.progress.percent || ''}
    </p>{/if}
  {#each data.sources || [] as s}<article class="compact-row">
      <span>{s.role} · {s.title}</span>{#if s.file_name}<a
          class="text-button"
          href={'/api/files/' + s.version_id + '?download=1'}>Last ned</a
        >{/if}
    </article>{/each}
  {#each data.deliveries || [] as d}<article class="evaluation">
      <strong>Leveranse · revisjon {d.revision}</strong>
      <p>{d.manifest.notes}</p>
      {#each Object.entries(d.manifest.formats || {}) as [format, version]}<a
          class="secondary"
          href={'/api/files/' + version + '?download=1'}>Last ned {format}</a
        >{/each}{#each d.manifest.source_files || [] as version}<a
          class="text-button"
          href={'/api/files/' + version + '?download=1'}>Kildefil</a
        >{/each}
    </article>{/each}
  {#if data.task.item_id}<button class="primary" onclick={() => onopen(data!.task.item_id)}
      >Åpne leveransen</button
    >{/if}
  {#each data.feedback || [] as f}<article class="evaluation">
      <strong>{f.author} · revisjon {f.revision}</strong>
      <p>{f.body}</p>
    </article>{/each}
  {#if canEdit && ['review', 'done'].includes(data.task.status)}<form
      onsubmit={(e) => {
        e.preventDefault();
        revise();
      }}
    >
      <label>Be om endringer<textarea rows="3" bind:value={feedback} required></textarea></label
      ><button class="secondary" disabled={busy}>Send til ny revisjon</button>
    </form>{/if}
{:else}<p>Laster oppgaven …</p>{/if}
