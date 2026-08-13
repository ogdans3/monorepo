<script lang="ts">
	import { zipBlobs } from '$lib/engine';
	import { pdfName, pdfWithPages, readPdf, releasePdf, type LoadedPdf } from '$lib/tools/pdf';
	import { downloadBlob } from '../../download';
	import Dropzone from '../../Dropzone.svelte';
	import PdfPageGrid from './PdfPageGrid.svelte';

	let pdf = $state<LoadedPdf | null>(null);
	let mode = $state<'each' | 'cuts'>('each');
	let cutsText = $state('');
	let loading = $state(false);
	let working = $state(false);
	let loadError = $state<string | null>(null);

	/** The page groups each output file will hold. */
	const parts = $derived.by(() => {
		if (!pdf) return [] as number[][];
		const all = Array.from({ length: pdf.pageCount }, (_, i) => i + 1);
		if (mode === 'each') return all.map((n) => [n]);
		const cuts = [
			...new Set(
				cutsText
					.split(',')
					.map((s) => Math.floor(Number(s.trim())))
					.filter((n) => Number.isFinite(n) && n > 1 && n <= pdf!.pageCount)
			)
		].sort((a, b) => a - b);
		const groups: number[][] = [];
		let start = 1;
		for (const cut of cuts) {
			groups.push(all.slice(start - 1, cut - 1));
			start = cut;
		}
		groups.push(all.slice(start - 1));
		return groups.filter((g) => g.length);
	});

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readPdf(file);
			releasePdf(pdf);
			cutsText = '';
			pdf = loaded;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that PDF';
		} finally {
			loading = false;
		}
	}

	async function download() {
		if (!pdf || parts.length < 2) return;
		working = true;
		try {
			const entries = [];
			for (const [index, pages] of parts.entries()) {
				const bytes = await pdfWithPages(pdf.bytes, pages);
				const label =
					pages.length === 1 ? `-page-${pages[0]}` : `-part-${index + 1}-pages-${pages[0]}-${pages.at(-1)}`;
				entries.push({ name: pdfName(pdf.name, label), data: bytes });
			}
			downloadBlob(zipBlobs(entries), pdfName(pdf.name, '-split').replace(/\.pdf$/i, '.zip'));
		} finally {
			working = false;
		}
	}

	function startOver() {
		releasePdf(pdf);
		pdf = null;
		loadError = null;
	}

	$effect(() => () => releasePdf(pdf));
</script>

{#if !pdf}
	<div class="editor-load">
		<Dropzone headline="Drop a PDF here" multiple={false} accept=".pdf,application/pdf" {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading pages…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<div class="toolbar-group" role="group" aria-label="How to split">
				<button class="chip" class:active={mode === 'each'} aria-pressed={mode === 'each'} onclick={() => (mode = 'each')}>
					One file per page
				</button>
				<button class="chip" class:active={mode === 'cuts'} aria-pressed={mode === 'cuts'} onclick={() => (mode = 'cuts')}>
					Cut at pages
				</button>
			</div>
			{#if mode === 'cuts'}
				<label class="range">
					<span>Start a new file at page</span>
					<input class="mono" type="text" placeholder="e.g. 3, 7" bind:value={cutsText} />
				</label>
			{/if}
			<button class="btn-ghost start-over" onclick={startOver}>Start over</button>
		</div>

		<p class="hint" role="status">
			{#if parts.length < 2}
				This would make one file. Add a cut, or switch to one file per page.
			{:else}
				<strong>{parts.length}</strong> files:
				<span class="mono"
					>{parts
						.slice(0, 6)
						.map((g) => (g.length === 1 ? `p${g[0]}` : `p${g[0]}-${g.at(-1)}`))
						.join(', ')}{parts.length > 6 ? ', …' : ''}</span
				>
			{/if}
		</p>

		<PdfPageGrid pages={pdf.pages} label="Pages in this document" />

		<div class="result-bar">
			<span class="result-text mono">{pdf.pageCount} pages in</span>
			<button class="btn" onclick={download} disabled={working || parts.length < 2}>
				{working ? 'Splitting…' : `Download ${parts.length} files as zip`}
			</button>
		</div>
	</div>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.editor-load {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.editor-status,
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.hint strong {
		color: var(--ink);
	}

	.editor-error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.6rem 1.25rem;
	}

	.toolbar-group {
		display: flex;
		gap: 0.4rem;
		padding-bottom: 0.1rem;
	}

	.range {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.range input {
		width: 10rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font-size: 0.875rem;
		color: var(--ink);
	}

	.start-over {
		margin-left: auto;
	}

	.result-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
	}

	.result-text {
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
