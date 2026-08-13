<script lang="ts">
	import { loadPdfLib, pdfBlob, pdfName, readPdf, releasePdf, type LoadedPdf } from '$lib/tools/pdf';
	import { downloadBlob } from '../../download';
	import Dropzone from '../../Dropzone.svelte';
	import PdfPageGrid from './PdfPageGrid.svelte';

	let pdf = $state<LoadedPdf | null>(null);
	let picked = $state(new Set<number>());
	/** Extra quarter turns per page number. */
	let turns = $state<Record<number, number>>({});
	let loading = $state(false);
	let working = $state(false);
	let loadError = $state<string | null>(null);

	const changed = $derived(Object.values(turns).some((t) => t % 4 !== 0));
	const targets = $derived.by(() => {
		if (!pdf) return [];
		return picked.size
			? [...picked].sort((a, b) => a - b)
			: Array.from({ length: pdf.pageCount }, (_, i) => i + 1);
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
			turns = {};
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
	}

	function rotate(dir: 1 | -1) {
		const next = { ...turns };
		for (const n of targets) next[n] = (((next[n] ?? 0) + dir) % 4 + 4) % 4;
		turns = next;
	}

	async function download() {
		if (!pdf) return;
		working = true;
		try {
			const { PDFDocument, degrees } = await loadPdfLib();
			const doc = await PDFDocument.load(pdf.bytes.slice());
			doc.getPages().forEach((page, i) => {
				const extra = turns[i + 1] ?? 0;
				if (!extra) return;
				// rotation is a page property, so nothing is redrawn and text stays text
				const current = page.getRotation().angle;
				page.setRotation(degrees((current + extra * 90) % 360));
			});
			downloadBlob(pdfBlob(await doc.save()), pdfName(pdf.name, '-rotated'));
		} finally {
			working = false;
		}
	}

	function startOver() {
		releasePdf(pdf);
		pdf = null;
		picked = new Set();
		turns = {};
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
				<button class="btn-ghost" onclick={() => rotate(-1)}>⟲ Rotate left</button>
				<button class="btn-ghost" onclick={() => rotate(1)}>⟳ Rotate right</button>
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={() => (turns = {})} disabled={!changed}>Reset</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<p class="hint" role="status">
			{#if picked.size === 0}
				Rotating every page. Click pages to rotate only those.
			{:else}
				Rotating {picked.size} of {pdf.pageCount} pages.
			{/if}
		</p>

		<PdfPageGrid
			pages={pdf.pages}
			selected={picked}
			rotation={turns}
			onToggle={toggle}
			label="Pages, click to rotate only those"
		/>

		<div class="result-bar">
			<span class="result-text mono">{pdfName(pdf.name, '-rotated')}</span>
			<button class="btn" onclick={download} disabled={working || !changed}>
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
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
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
