<script lang="ts">
	import { pdfBlob, pdfName, pdfWithPages, readPdf, releasePdf, type LoadedPdf } from '$lib/tools/pdf';
	import { downloadBlob } from '../../download';
	import Dropzone from '../../Dropzone.svelte';
	import PdfPageGrid from './PdfPageGrid.svelte';

	let pdf = $state<LoadedPdf | null>(null);
	let order = $state<number[]>([]);
	let loading = $state(false);
	let working = $state(false);
	let loadError = $state<string | null>(null);

	const untouched = $derived(
		!!pdf && order.length === pdf.pageCount && order.every((n, i) => n === i + 1)
	);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readPdf(file);
			releasePdf(pdf);
			order = loaded.pages.map((p) => p.n);
			pdf = loaded;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that PDF';
		} finally {
			loading = false;
		}
	}

	function move(index: number, dir: -1 | 1) {
		const j = index + dir;
		if (j < 0 || j >= order.length) return;
		const next = [...order];
		[next[index], next[j]] = [next[j], next[index]];
		order = next;
	}

	function drop(n: number) {
		order = order.filter((p) => p !== n);
	}

	function reset() {
		if (pdf) order = pdf.pages.map((p) => p.n);
	}

	function reverse() {
		order = [...order].reverse();
	}

	async function download() {
		if (!pdf || !order.length) return;
		working = true;
		try {
			downloadBlob(pdfBlob(await pdfWithPages(pdf.bytes, order)), pdfName(pdf.name, '-reordered'));
		} finally {
			working = false;
		}
	}

	function startOver() {
		releasePdf(pdf);
		pdf = null;
		order = [];
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
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={reverse}>Reverse order</button>
				<button class="btn-ghost" onclick={reset} disabled={untouched}>Reset</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<p class="hint" role="status">
			{order.length} of {pdf.pageCount} pages, in this order. Use the arrows to move a page and the
			cross to drop it.
		</p>

		<PdfPageGrid
			pages={pdf.pages}
			{order}
			onMove={move}
			onDrop={drop}
			label="Pages in their new order"
		/>

		<div class="result-bar">
			<span class="result-text mono">{pdfName(pdf.name, '-reordered')}</span>
			<button class="btn" onclick={download} disabled={working || order.length === 0}>
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

	.editor-error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}

	.toolbar {
		display: flex;
		justify-content: flex-end;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
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
