<!--
	The presenter's list: every presentation as a line in a ledger, the one
	on screen marked live, and the way to make a new one.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { ExternalLink, Plus, Trash2 } from '@lucide/svelte';
	import Wordmark from '$lib/admin/Wordmark.svelte';
	import { session } from '$lib/admin/session.svelte';
	import { api, message } from '$lib/api';
	import { changed } from '$lib/format';
	import type { Presentation } from '$lib/types';

	let list = $state<Presentation[] | null>(null);
	let error = $state('');
	let making = $state(false);
	let title = $state('');
	let busy = $state(false);
	let titleInput: HTMLInputElement | undefined = $state();

	async function load() {
		try {
			list = (await api<{ presentations: Presentation[] }>('GET', '/api/admin/presentations')).presentations;
		} catch (err) {
			error = message(err);
		}
	}

	onMount(load);

	async function open() {
		making = true;
		await tick();
		titleInput?.focus();
	}

	async function create(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		error = '';
		try {
			const res = await api<{ presentation: Presentation }>('POST', '/api/admin/presentations', { title });
			await goto(`/admin/${res.presentation.id}`);
		} catch (err) {
			error = message(err);
			busy = false;
		}
	}

	async function remove(p: Presentation) {
		if (!confirm(`Slette «${p.title}»? Alle sidene, stemmene og filene i den forsvinner, og det kan ikke angres.`)) return;
		try {
			await api('DELETE', `/api/admin/presentations/${p.id}`);
			list = list?.filter((x) => x.id !== p.id) ?? null;
		} catch (err) {
			error = message(err);
		}
	}
</script>

<svelte:head>
	<title>Presentasjoner · Podium</title>
</svelte:head>

<div class="desk page">
	<header class="top">
		<Wordmark href="/admin" />
		<button class="btn quiet small" onclick={() => session.signOut()}>Logg ut</button>
	</header>

	<main>
		<div class="heading">
			<h1>Presentasjoner</h1>
			{#if !making}
				<button class="btn primary" onclick={open}><Plus size={16} strokeWidth={2} />Ny presentasjon</button>
			{/if}
		</div>

		{#if making}
			<form class="new" onsubmit={create}>
				<label class="field">
					<span>Tittel</span>
					<input
						class="input"
						bind:this={titleInput}
						bind:value={title}
						maxlength="200"
						placeholder="For eksempel: Allmøte i oktober"
						onkeydown={(e) => e.key === 'Escape' && (making = false)}
					/>
				</label>
				<button class="btn primary" disabled={busy}>{busy ? 'Lager …' : 'Lag presentasjonen'}</button>
				<button type="button" class="btn quiet" onclick={() => (making = false)}>Avbryt</button>
			</form>
		{/if}

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		{#if list === null}
			{#if !error}<p class="quiet">Henter …</p>{/if}
		{:else if list.length === 0}
			{#if !making}
				<div class="none">
					<p>Ingen presentasjoner ennå.</p>
					<p class="quiet">
						En presentasjon er sider med tekst, bilder og video, og spørsmål salen svarer på fra telefonen.
					</p>
				</div>
			{/if}
		{:else}
			<table>
				<thead>
					<tr>
						<th scope="col">Tittel</th>
						<th scope="col" class="num">Kode</th>
						<th scope="col" class="num">Sider</th>
						<th scope="col">Endret</th>
						<th scope="col"><span class="visually-hidden">Status og handlinger</span></th>
					</tr>
				</thead>
				<tbody>
					{#each list as p (p.id)}
						<tr>
							<td class="name"><a href="/admin/{p.id}">{p.title || 'Uten tittel'}</a></td>
							<td class="num figure code">{p.code}</td>
							<td class="num tabular">{p.slideCount}</td>
							<td class="quiet tabular">{changed(p.updatedAt)}</td>
							<td class="actions">
								{#if p.liveSlideId}<span class="live">Direkte</span>{/if}
								<a class="btn quiet small" href="/vis/{p.code}" target="podium-vis-{p.code}">
									<ExternalLink size={15} strokeWidth={1.75} />Visning
								</a>
								<button class="btn quiet small icon" onclick={() => remove(p)} aria-label="Slett {p.title}" title="Slett">
									<Trash2 size={15} strokeWidth={1.75} />
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</main>
</div>

<style>
	.page {
		min-height: 100dvh;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 3.5rem;
		padding: 0 clamp(1rem, 4vw, 3rem);
		border-bottom: 1px solid var(--rule);
	}

	main {
		width: min(100%, 64rem);
		margin: 0 auto;
		padding: 3rem clamp(1rem, 4vw, 3rem) 4rem;
	}

	.heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.75rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 720;
		letter-spacing: -0.02em;
	}

	.new {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: end;
		gap: 0.6rem;
		margin-bottom: 2rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid var(--rule);
	}

	.new .input {
		min-height: 2.25rem;
		font-size: 0.9375rem;
	}

	.new .btn {
		height: 2.25rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th {
		padding: 0 0.75rem 0.6rem 0;
		border-bottom: 1px solid var(--rule-strong);
		color: var(--quiet);
		font-size: 0.75rem;
		font-weight: 600;
		text-align: left;
	}

	td {
		height: 3.25rem;
		padding: 0 0.75rem 0 0;
		border-bottom: 1px solid var(--rule);
	}

	.num {
		text-align: right;
		padding-right: 2rem;
	}

	.name {
		width: 100%;
		max-width: 0;
	}

	.name a {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		text-decoration: none;
	}

	.name a:hover {
		text-decoration: underline;
	}

	.code {
		font-size: 1rem;
		letter-spacing: 0.06em;
	}

	td.quiet {
		white-space: nowrap;
		padding-right: 1.5rem;
	}

	.actions {
		padding-right: 0;
		white-space: nowrap;
		text-align: right;
	}

	.actions > * {
		vertical-align: middle;
	}

	.live {
		display: inline-flex;
		align-items: center;
		height: 1.5rem;
		margin-right: 0.5rem;
		padding: 0 0.5rem;
		border-radius: var(--radius);
		background: var(--amber);
		color: var(--amber-ink);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.none {
		display: grid;
		gap: 0.4rem;
		max-width: 34rem;
		padding: 2rem 0;
		border-top: 1px solid var(--rule);
	}

	.none p:first-child {
		font-weight: 600;
	}

	.quiet {
		color: var(--quiet);
	}

	.error {
		margin-bottom: 1.25rem;
		color: var(--alarm);
	}

	@media (max-width: 40rem) {
		th:nth-child(3),
		td:nth-child(3),
		th:nth-child(4),
		td:nth-child(4) {
			display: none;
		}

		.new {
			grid-template-columns: 1fr;
		}
	}
</style>
