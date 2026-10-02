<!--
	The editor: the slides down the left, the slide being built in the middle,
	what is selected on the right, and across the top the presentation and its
	live controls. Everything saves itself.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		ExternalLink,
		Grid3x3,
		Image,
		ListChecks,
		Play,
		QrCode,
		Redo2,
		Smartphone,
		Square,
		Type,
		Undo2,
		Video,
		X
	} from '@lucide/svelte';
	import Canvas from '$lib/admin/Canvas.svelte';
	import Inspector from '$lib/admin/Inspector.svelte';
	import SlideList from '$lib/admin/SlideList.svelte';
	import { Editor } from '$lib/admin/editor.svelte';
	import { api, message } from '$lib/api';
	import { follow } from '$lib/live';
	import type { Presentation } from '$lib/types';

	let ed = $state<Editor | null>(null);
	let failed = $state('');
	let canvas: Canvas | undefined = $state();
	let grid = $state(localStorage.getItem('podium.grid') !== 'off');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => {
		let stop = () => {};
		let gone = false;
		api<{ presentation: Presentation; phones: number }>('GET', `/api/admin/presentations/${page.params.id}`)
			.then((res) => {
				if (gone) return;
				const editor = new Editor(res.presentation, res.phones);
				ed = editor;
				stop = follow(res.presentation.code, {
					state: (s) => editor.onState(s),
					vote: (v) => editor.onVote(v),
					room: (r) => (editor.phones = r.phones)
				});
			})
			.catch((err) => (failed = message(err)));
		const leave = (e: BeforeUnloadEvent) => {
			if (ed?.unsaved) e.preventDefault();
		};
		window.addEventListener('beforeunload', leave);
		return () => {
			gone = true;
			stop();
			ed?.dispose();
			window.removeEventListener('beforeunload', leave);
		};
	});

	// Leaving with a change not yet saved saves it first.
	beforeNavigate(({ cancel, to, type }) => {
		if (!ed?.unsaved || type === 'leave' || !to) return;
		cancel();
		const editor = ed;
		editor.flush().then(() => {
			if (!editor.unsaved) goto(to.url);
		});
	});

	$effect(() => {
		localStorage.setItem('podium.grid', grid ? 'on' : 'off');
	});

	$effect(() => {
		const n = ed?.notice;
		clearTimeout(noticeTimer);
		if (n) noticeTimer = setTimeout(() => ed && (ed.notice = ''), 9000);
	});

	const inField = (t: EventTarget | null) =>
		t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

	function keys(e: KeyboardEvent) {
		if (!ed) return;
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key.toLowerCase() === 's') {
			e.preventDefault();
			ed.flush();
			return;
		}
		if (inField(e.target) || !mod) return;
		if (e.key.toLowerCase() === 'z') {
			e.preventDefault();
			if (e.shiftKey) ed.redo();
			else ed.undo();
		} else if (e.key.toLowerCase() === 'y') {
			e.preventDefault();
			ed.redo();
		}
	}

	function paste(e: ClipboardEvent) {
		if (!ed || inField(e.target)) return;
		const files = [...(e.clipboardData?.files ?? [])];
		if (files.length === 0) return;
		e.preventDefault();
		for (const f of files) canvas?.place(f);
	}

	function pick(accept: string) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.multiple = true;
		input.onchange = () => {
			for (const f of input.files ?? []) canvas?.place(f);
		};
		input.click();
	}

	function display() {
		return window.open(`/vis/${ed?.p.code}`, `podium-vis-${ed?.p.code}`);
	}

	function start() {
		// The window first, while the click still counts as one: a window
		// opened after waiting for the server is a pop-up to be blocked.
		display();
		ed?.start();
	}

	const STATUS = { saved: 'Lagret', saving: 'Lagrer …', unsaved: 'Ikke lagret ennå', error: 'Ikke lagret' };
</script>

<svelte:head>
	<title>{ed ? `${ed.p.title || 'Uten tittel'} · Podium` : 'Podium'}</title>
</svelte:head>

<svelte:window onkeydown={keys} onpaste={paste} />

{#if failed}
	<main class="desk failed">
		<p>{failed}</p>
		<a class="btn" href="/admin"><ArrowLeft size={16} strokeWidth={1.75} />Til presentasjonene</a>
	</main>
{:else if ed}
	{@const live = ed.p.liveSlideId}
	<div class="desk editor">
		<header class="top">
			<a class="btn quiet icon" href="/admin" aria-label="Til presentasjonene" title="Til presentasjonene"><ArrowLeft size={18} strokeWidth={1.75} /></a>
			<input
				class="title"
				value={ed.p.title}
				maxlength="200"
				aria-label="Tittel"
				placeholder="Uten tittel"
				onchange={(e) => ed?.rename(e.currentTarget.value.trim())}
				onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			/>
			<span class="status" class:error={ed.status === 'error'} title={ed.status === 'error' ? ed.problem : undefined} aria-live="polite">
				{STATUS[ed.status]}{#if ed.status === 'error'}: {ed.problem}{/if}
			</span>

			<div class="live-bar">
				<span class="code" title="Koden salen skriver inn">Kode <b class="figure">{ed.p.code}</b></span>
				{#if live}
					<span class="on">Direkte <span class="where tabular">· side {ed.liveIndex + 1} av {ed.slides.length}</span></span>
					<div class="stepper">
						<button class="btn icon small" aria-label="Forrige side" title="Forrige side" disabled={ed.liveIndex <= 0} onclick={() => ed?.step(-1)}><ChevronLeft size={17} strokeWidth={2} /></button>
						<button class="btn icon small" aria-label="Neste side" title="Neste side" disabled={ed.liveIndex >= ed.slides.length - 1} onclick={() => ed?.step(1)}><ChevronRight size={17} strokeWidth={2} /></button>
					</div>
					<!-- Always there, and only seen when it applies, so nothing beside it moves. -->
					<button
						class="btn small show"
						class:idle={!ed.slide || ed.slide.id === live}
						disabled={!ed.slide || ed.slide.id === live}
						aria-hidden={!ed.slide || ed.slide.id === live}
						onclick={() => ed?.slide && ed.show(ed.slide.id)}>Vis side {ed.current + 1}</button
					>
					<span class="phones tabular" title="Telefoner med avstemningen åpen"
						><Smartphone size={15} strokeWidth={1.75} />{ed.phones === 1 ? '1 telefon' : `${ed.phones} telefoner`}</span
					>
					<button class="btn small" onclick={() => ed?.stop()}><Square size={13} strokeWidth={2.25} />Avslutt</button>
				{:else}
					<button class="btn primary" onclick={start}><Play size={15} strokeWidth={2.25} />Start</button>
				{/if}
				<button class="btn quiet icon" aria-label="Åpne visningen" title="Åpne visningen" onclick={display}><ExternalLink size={17} strokeWidth={1.75} /></button>
			</div>
		</header>

		<SlideList {ed} />

		<main class="middle">
			<div class="tools" role="toolbar" aria-label="Legg til på siden">
				<button class="btn quiet small" onclick={() => ed?.addText()}><Type size={16} strokeWidth={1.75} />Tekst</button>
				<button class="btn quiet small" onclick={() => pick('image/*')}><Image size={16} strokeWidth={1.75} />Bilde</button>
				<button class="btn quiet small" onclick={() => pick('video/*')}><Video size={16} strokeWidth={1.75} />Video</button>
				<button class="btn quiet small" onclick={() => ed?.addQr()}><QrCode size={16} strokeWidth={1.75} />QR-kode</button>
				<button class="btn quiet small" onclick={() => ed?.addOption()}><ListChecks size={16} strokeWidth={1.75} />Svar</button>
				<span class="sep" aria-hidden="true"></span>
				<button class="btn quiet icon small" aria-label="Angre" title="Angre (⌘Z)" disabled={!ed.canUndo} onclick={() => ed?.undo()}><Undo2 size={16} strokeWidth={1.75} /></button>
				<button class="btn quiet icon small" aria-label="Gjør om" title="Gjør om (⇧⌘Z)" disabled={!ed.canRedo} onclick={() => ed?.redo()}><Redo2 size={16} strokeWidth={1.75} /></button>
				<button class="btn quiet icon small" aria-label="Rutenett" title="Rutenett" aria-pressed={grid} class:pressed={grid} onclick={() => (grid = !grid)}><Grid3x3 size={16} strokeWidth={1.75} /></button>
				<span class="uploads" aria-live="polite">
					{#each ed.uploads as u (u.id)}
						<span class="upload"><span class="name">{u.name}</span><span class="tabular">{Math.round(u.done * 100)} %</span></span>
					{/each}
				</span>
			</div>

			{#if ed.notice}
				<p class="notice" role="status">
					<span>{ed.notice}</span>
					<button class="btn quiet icon small" aria-label="Lukk" onclick={() => ed && (ed.notice = '')}><X size={15} strokeWidth={1.75} /></button>
				</p>
			{/if}

			<div class="area">
				<div class="fit">
					<Canvas bind:this={canvas} {ed} {grid} />
				</div>
			</div>

			<p class="keys">
				Dra for å flytte, dra i håndtakene for å endre størrelse. Hold Alt for å slippe rutenettet, Shift for å holde formen.
				Dobbeltklikk på en tekst for å skrive i den.
			</p>
		</main>

		<Inspector {ed} place={async (f) => canvas?.place(f)} />
	</div>
{:else}
	<main class="desk" style="min-height: 100dvh" aria-busy="true"></main>
{/if}

<style>
	.editor {
		display: grid;
		grid-template-columns: 13.5rem minmax(0, 1fr) 19.5rem;
		grid-template-rows: 3.5rem minmax(0, 1fr);
		height: 100dvh;
		overflow: hidden;
	}

	.top {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0 0.75rem 0 0.6rem;
		border-bottom: 1px solid var(--rule);
		min-width: 0;
	}

	.title {
		flex: 0 1 22rem;
		min-width: 6rem;
		height: 2.1rem;
		padding: 0 0.5rem;
		border: 1px solid transparent;
		border-radius: var(--radius);
		background: transparent;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: -0.01em;
		text-overflow: ellipsis;
	}

	.title:hover {
		border-color: var(--rule);
	}

	.title:focus-visible {
		outline: none;
		border-color: var(--desk-text);
		background: var(--desk-raised);
	}

	.status {
		flex: 0 1 auto;
		min-width: 0;
		color: var(--quiet);
		font-size: 0.8125rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status.error {
		color: var(--alarm);
	}

	.live-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-left: auto;
		white-space: nowrap;
	}

	.code {
		color: var(--quiet);
		font-size: 0.8125rem;
	}

	.code b {
		color: var(--desk-text);
		font-size: 1.0625rem;
		letter-spacing: 0.06em;
		margin-left: 0.15rem;
	}

	.on {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		height: 1.6rem;
		padding: 0 0.55rem;
		border-radius: var(--radius);
		background: var(--amber);
		color: var(--amber-ink);
		font-size: 0.8125rem;
		font-weight: 700;
	}

	.where {
		font-weight: 560;
	}

	.show.idle {
		visibility: hidden;
	}

	.stepper {
		display: flex;
		gap: 0.25rem;
	}

	.phones {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--quiet);
		font-size: 0.875rem;
		font-weight: 560;
	}

	.middle {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		min-width: 0;
		min-height: 0;
		background: var(--desk-sunk);
	}

	.tools {
		grid-row: 1;
		display: flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.45rem 0.75rem;
		border-bottom: 1px solid var(--rule);
		background: var(--desk);
		min-width: 0;
	}

	.tools .sep {
		width: 1px;
		height: 1.25rem;
		margin: 0 0.4rem;
		background: var(--rule);
	}

	.tools .pressed {
		background: var(--sunk);
	}

	.uploads {
		display: flex;
		gap: 0.75rem;
		margin-left: auto;
		min-width: 0;
		font-size: 0.8125rem;
		color: var(--quiet);
	}

	.upload {
		display: inline-flex;
		gap: 0.4rem;
		min-width: 0;
	}

	.upload .name {
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.notice {
		grid-row: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin: 0;
		padding: 0.3rem 0.5rem 0.3rem 1rem;
		border-bottom: 1px solid var(--rule);
		background: var(--desk-raised);
		font-size: 0.875rem;
	}

	.area {
		grid-row: 3;
		container-type: size;
		display: grid;
		place-items: center;
		min-height: 0;
		padding: 1.75rem;
	}

	.fit {
		width: min(100cqw, calc(100cqh * 16 / 9));
	}

	.keys {
		grid-row: 4;
		padding: 0 1rem 0.8rem;
		color: var(--quiet);
		font-size: 0.75rem;
		text-align: center;
	}

	.failed {
		min-height: 100dvh;
		display: grid;
		place-content: center;
		justify-items: start;
		gap: 1rem;
	}

	@media (max-width: 60rem) {
		.editor {
			grid-template-columns: 10rem minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			height: auto;
			min-height: 100dvh;
			overflow: visible;
		}

		.top {
			flex-wrap: wrap;
			padding-block: 0.4rem;
		}

		.editor :global(.inspector) {
			grid-column: 1 / -1;
			border-left: 0;
			border-top: 1px solid var(--rule);
		}

		.area {
			height: 60vh;
		}
	}
</style>
