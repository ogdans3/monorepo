<script lang="ts">
	import {
		parsePageRange,
		pdfBlob,
		pdfName,
		pdfWithPages,
		readPdf,
		releasePdf,
		type LoadedPdf
	} from '$lib/tools/pdf';
	import { downloadBlob } from '../../download';
	import Dropzone from '../../Dropzone.svelte';
	import PdfPageGrid from './PdfPageGrid.svelte';

	let {
		mode,
		suffix
	}: {
		/** keep: the picked pages survive. drop: they are the ones removed. */
		mode: 'keep' | 'drop';
		suffix: string;
	} = $props();

	let pdf = $state<LoadedPdf | null>(null);
	let picked = $state(new Set<number>());
	let rangeText = $state('');
	let loading = $state(false);
	let working = $state(false);
	let loadError = $state<string | null>(null);

	const resultPages = $derived.by(() => {
		if (!pdf) return [];
		const all = Array.from({ length: pdf.pageCount }, (_, i) => i + 1);
		return mode === 'keep' ? all.filter((n) => picked.has(n)) : all.filter((n) => !picked.has(n));
	});

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readPdf(file);
			releasePdf(pdf);
			picked = new Set();
			rangeText = '';
			pdf = loaded;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that PDF';
		} finally {
			loading = false;
		}
	}

	function toggle(n: number) {
		const next = new Set(picked);
		if (next.has(n)) next.delete(n);
		else next.add(n);
		picked = next;
		rangeText = '';
	}

	function applyRange(value: string) {
		if (!pdf) return;
		rangeText = value;
		picked = new Set(value.trim() ? parsePageRange(value, pdf.pageCount) : []);
	}

	async function download() {
		if (!pdf || !resultPages.length) return;
		working = true;
		try {
			const bytes = await pdfWithPages(pdf.bytes, resultPages);
			downloadBlob(pdfBlob(bytes), pdfName(pdf.name, suffix));
		} finally {
			working = false;
		}
	}

	function startOver() {
		releasePdf(pdf);
		pdf = null;
		picked = new Set();
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
			<label class="range">
				<span>{mode === 'keep' ? 'Pages to keep' : 'Pages to remove'}</span>
				<input
					class="mono"
					type="text"
					placeholder="e.g. 1-3, 7"
					value={rangeText}
					oninput={(e) => applyRange(e.currentTarget.value)}
				/>
			</label>
			<div class="toolbar-group">
				<button
					class="btn-ghost"
					onclick={() => applyRange(`1-${pdf?.pageCount ?? 1}`)}
					disabled={!pdf}>Select all</button
				>
				<button class="btn-ghost" onclick={() => applyRange('')} disabled={picked.size === 0}>
					Clear
				</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<p class="hint" role="status">
			{#if picked.size === 0}
				Click the pages {mode === 'keep' ? 'you want to keep' : 'you want to remove'}, or type a
				range above.
			{:else}
				{picked.size} of {pdf.pageCount} pages picked. The new file will have
				<strong>{resultPages.length}</strong>
				{resultPages.length === 1 ? 'page' : 'pages'}.
			{/if}
		</p>

		<PdfPageGrid
			pages={pdf.pages}
			selected={picked}
			onToggle={toggle}
			label="Pages, click to {mode === 'keep' ? 'keep' : 'remove'}"
		/>

		<div class="result-bar">
			<span class="result-text mono">{pdfName(pdf.name, suffix)}</span>
			<button class="btn" onclick={download} disabled={working || resultPages.length === 0}>
				{working ? 'Building…' : 'Download PDF'}
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

	.range {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.range input {
		width: 11rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font-size: 0.875rem;
		color: var(--ink);
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-left: auto;
		padding-bottom: 0.1rem;
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
