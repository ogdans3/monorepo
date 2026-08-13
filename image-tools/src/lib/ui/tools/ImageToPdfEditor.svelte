<script lang="ts">
	import { editedFileName } from '$lib/engine';
	import { readImageFile, rawToCanvas, steppedScale } from './load';
	import { untrack } from 'svelte';
	import { downloadBlob } from '../download';
	import Dropzone from '../Dropzone.svelte';
	import BackgroundPicker from '../BackgroundPicker.svelte';

	interface Page {
		id: number;
		name: string;
		source: HTMLCanvasElement;
		w: number;
		h: number;
		thumbUrl: string;
	}

	// The per-format pages under /pdf come preconfigured: they only accept the
	// format they are named after, and they start on the page size that suits
	// it. Scans and screenshots want A4, photographs want their own shape.
	let {
		accept,
		initialPageMode = 'match'
	}: { accept?: string; initialPageMode?: 'match' | 'a4' } = $props();

	let nextId = 1;
	let pages = $state<Page[]>([]);
	let pageMode = $state<'match' | 'a4'>(untrack(() => initialPageMode));
	let quality = $state(88);
	let background = $state('#ffffff');
	let working = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	async function onfiles(files: File[]) {
		loading = true;
		loadError = null;
		try {
			for (const file of files) {
				const { raw, name } = await readImageFile(file);
				const source = rawToCanvas(raw);
				const thumbH = 96;
				const thumbW = Math.max(1, Math.min(200, Math.round((raw.width / raw.height) * thumbH)));
				const thumb = steppedScale(source, thumbW, thumbH);
				const thumbBlob = await new Promise<Blob | null>((resolve) =>
					thumb.toBlob(resolve, 'image/jpeg', 0.75)
				);
				pages.push({
					id: nextId++,
					name,
					source,
					w: raw.width,
					h: raw.height,
					thumbUrl: thumbBlob ? URL.createObjectURL(thumbBlob) : ''
				});
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read a file';
		} finally {
			loading = false;
		}
	}

	/** JPEG bytes with transparency filled in, ready for embedding. */
	async function pageJpeg(page: Page): Promise<Uint8Array> {
		const flat = document.createElement('canvas');
		flat.width = page.w;
		flat.height = page.h;
		const ctx = flat.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		// a PDF page is opaque, so see-through parts need something behind them
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, page.w, page.h);
		ctx.drawImage(page.source, 0, 0);
		const blob = await new Promise<Blob | null>((resolve) =>
			flat.toBlob(resolve, 'image/jpeg', quality / 100)
		);
		if (!blob) throw new Error('Could not encode a page');
		return new Uint8Array(await blob.arrayBuffer());
	}

	async function downloadPdf() {
		if (!pages.length) return;
		working = true;
		try {
			const { PDFDocument } = await import('pdf-lib');
			const doc = await PDFDocument.create();
			const A4 = { w: 595.28, h: 841.89 };
			const MARGIN = 24;
			for (const page of pages) {
				const jpg = await doc.embedJpg(await pageJpeg(page));
				if (pageMode === 'match') {
					// 1 CSS px = 0.75 pt, so pages print at the natural 96 dpi size
					const w = page.w * 0.75;
					const h = page.h * 0.75;
					doc.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
				} else {
					const pdfPage = doc.addPage([A4.w, A4.h]);
					const scale = Math.min(
						(A4.w - MARGIN * 2) / page.w,
						(A4.h - MARGIN * 2) / page.h
					);
					const w = page.w * scale;
					const h = page.h * scale;
					pdfPage.drawImage(jpg, { x: (A4.w - w) / 2, y: (A4.h - h) / 2, width: w, height: h });
				}
			}
			const bytes = await doc.save();
			downloadBlob(
				new Blob([bytes as unknown as ArrayBuffer], { type: 'application/pdf' }),
				editedFileName(pages[0].name, '', '.pdf')
			);
		} finally {
			working = false;
		}
	}

	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= pages.length) return;
		[pages[i], pages[j]] = [pages[j], pages[i]];
	}

	function remove(i: number) {
		URL.revokeObjectURL(pages[i].thumbUrl);
		pages.splice(i, 1);
	}

	function startOver() {
		for (const p of pages) URL.revokeObjectURL(p.thumbUrl);
		pages = [];
		loadError = null;
	}

	$effect(() => () => {
		for (const p of pages) URL.revokeObjectURL(p.thumbUrl);
	});
</script>

{#if pages.length === 0}
	<div class="editor-load">
		<Dropzone headline="Drop images here" {accept} {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading images…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<div class="toolbar-group" role="group" aria-label="Page size">
				<button class="chip" class:active={pageMode === 'match'} aria-pressed={pageMode === 'match'} onclick={() => (pageMode = 'match')}>Match each image</button>
				<button class="chip" class:active={pageMode === 'a4'} aria-pressed={pageMode === 'a4'} onclick={() => (pageMode = 'a4')}>A4</button>
			</div>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="quality">
			<label for="pdf-quality">Quality</label>
			<input id="pdf-quality" type="range" min="1" max="100" bind:value={quality} />
			<output class="mono" for="pdf-quality">{quality}</output>
		</div>

		<BackgroundPicker bind:value={background} label="Behind transparent parts" />

		<ol class="pages">
			{#each pages as page, i (page.id)}
				<li class="page-row">
					<span class="page-num mono">{i + 1}</span>
					<span class="thumb checker">
						{#if page.thumbUrl}<img src={page.thumbUrl} alt="" />{/if}
					</span>
					<span class="page-name mono" title={page.name}>{page.name}</span>
					<span class="page-meta mono">{page.w} × {page.h}</span>
					<span class="page-actions">
						<button class="cell-btn" aria-label="Move {page.name} up" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
						<button class="cell-btn" aria-label="Move {page.name} down" disabled={i === pages.length - 1} onclick={() => move(i, 1)}>↓</button>
						<button class="cell-btn" aria-label="Remove {page.name}" onclick={() => remove(i)}>×</button>
					</span>
				</li>
			{/each}
		</ol>

		<div class="result-bar">
			<span class="result-text">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
			<button class="btn" onclick={downloadPdf} disabled={working}>
				{working ? 'Building PDF…' : 'Download PDF'}
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

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.quality {
		max-width: 24rem;
	}

	.pages {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}

	.page-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--line);
	}

	.page-num {
		width: 1.5rem;
		color: var(--muted);
		font-size: 0.8125rem;
		text-align: right;
	}

	.thumb {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: var(--r-s);
		border: 1px solid var(--line);
		overflow: hidden;
		display: grid;
		place-items: center;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.page-name {
		flex: 1;
		min-width: 0;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.page-meta {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.page-actions {
		display: flex;
		gap: 3px;
	}

	.cell-btn {
		width: 26px;
		height: 26px;
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
</style>
