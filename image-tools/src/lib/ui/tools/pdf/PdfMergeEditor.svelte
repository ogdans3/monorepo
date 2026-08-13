<script lang="ts">
	import { loadPdfLib, looksLikePdf, pdfBlob } from '$lib/tools/pdf';
	import { downloadBlob } from '../../download';
	import Dropzone from '../../Dropzone.svelte';

	interface Item {
		id: number;
		name: string;
		bytes: Uint8Array;
		pageCount: number;
	}

	let nextId = 1;
	let items = $state<Item[]>([]);
	let loading = $state(false);
	let working = $state(false);
	let loadError = $state<string | null>(null);

	const totalPages = $derived(items.reduce((sum, i) => sum + i.pageCount, 0));

	async function onfiles(files: File[]) {
		loading = true;
		loadError = null;
		try {
			const { PDFDocument } = await loadPdfLib();
			for (const file of files) {
				const bytes = new Uint8Array(await file.arrayBuffer());
				if (!looksLikePdf(bytes)) throw new Error(`${file.name} does not look like a PDF`);
				const doc = await PDFDocument.load(bytes.slice());
				items.push({ id: nextId++, name: file.name, bytes, pageCount: doc.getPageCount() });
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read a file';
		} finally {
			loading = false;
		}
	}

	async function download() {
		if (items.length < 2) return;
		working = true;
		try {
			const { PDFDocument } = await loadPdfLib();
			const out = await PDFDocument.create();
			for (const item of items) {
				const source = await PDFDocument.load(item.bytes.slice());
				const pages = await out.copyPages(source, source.getPageIndices());
				for (const page of pages) out.addPage(page);
			}
			downloadBlob(pdfBlob(await out.save()), 'merged.pdf');
		} finally {
			working = false;
		}
	}

	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= items.length) return;
		[items[i], items[j]] = [items[j], items[i]];
	}

	function remove(i: number) {
		items.splice(i, 1);
	}
</script>

{#if items.length === 0}
	<div class="editor-load">
		<Dropzone headline="Drop PDF files here" accept=".pdf,application/pdf" {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading files…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<ol class="rows">
			{#each items as item, i (item.id)}
				<li class="row">
					<span class="pos mono">{i + 1}</span>
					<span class="name mono" title={item.name}>{item.name}</span>
					<span class="meta mono">{item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}</span>
					<span class="actions">
						<button class="cell-btn" aria-label="Move {item.name} up" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
						<button class="cell-btn" aria-label="Move {item.name} down" disabled={i === items.length - 1} onclick={() => move(i, 1)}>↓</button>
						<button class="cell-btn" aria-label="Remove {item.name}" onclick={() => remove(i)}>×</button>
					</span>
				</li>
			{/each}
		</ol>

		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}

		<div class="result-bar">
			<span class="result-text">
				{#if items.length < 2}
					Add at least one more PDF to merge.
				{:else}
					{items.length} files, <span class="mono">{totalPages}</span> pages in total
				{/if}
			</span>
			<div class="bar-actions">
				<Dropzone headline="Add more" accept=".pdf,application/pdf" {onfiles} />
				<button class="btn" onclick={download} disabled={working || items.length < 2}>
					{working ? 'Merging…' : 'Download merged PDF'}
				</button>
			</div>
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

	.editor-status {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.editor-error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0;
		border-bottom: 1px solid var(--line);
	}

	.pos {
		width: 1.5rem;
		text-align: right;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.name {
		flex: 1;
		min-width: 0;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.meta {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.actions {
		display: flex;
		gap: 3px;
	}

	.cell-btn {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		color: var(--ink);
		font-size: 0.8125rem;
		line-height: 1;
		cursor: pointer;
	}

	.cell-btn:hover:not(:disabled) {
		border-color: var(--muted);
	}

	.cell-btn:disabled {
		opacity: 0.4;
		cursor: default;
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
		font-size: 0.875rem;
		color: var(--muted);
	}

	.bar-actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	/* the extra dropzone in the bar is a compact affordance, not the hero one */
	.bar-actions :global(.zone) {
		padding: 0.45rem 0.9rem;
		border-radius: var(--r-s);
		border-width: 1px;
	}

	.bar-actions :global(.zone-headline) {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.bar-actions :global(.zone-hint) {
		display: none;
	}
</style>
