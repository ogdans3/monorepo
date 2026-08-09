<script lang="ts">
	import { FORMATS, editedFileName, encodeRaw, zipBlobs, type FormatId } from '$lib/engine';
	import { downloadBlob } from '../download';
	import Dropzone from '../Dropzone.svelte';

	interface RenderedPage {
		n: number;
		canvas: HTMLCanvasElement;
		url: string;
		w: number;
		h: number;
	}

	let file = $state<File | null>(null);
	let baseName = $state('document');
	let pages = $state<RenderedPage[]>([]);
	let scale = $state(2);
	let formatId = $state<FormatId>('jpg');
	let quality = $state(90);
	let rendering = $state(false);
	let zipping = $state(false);
	let loadError = $state<string | null>(null);
	let renderRun = 0;

	const format = $derived(FORMATS[formatId]);

	async function onfiles(files: File[]) {
		const dropped = files[0];
		if (!dropped) return;
		loadError = null;
		const head = new Uint8Array(await dropped.slice(0, 5).arrayBuffer());
		// %PDF
		if (!(head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46)) {
			loadError = `${dropped.name} does not look like a PDF`;
			return;
		}
		baseName = dropped.name;
		file = dropped;
		await render();
	}

	async function render() {
		if (!file) return;
		const run = ++renderRun;
		rendering = true;
		try {
			const pdfjs = await import('pdfjs-dist');
			pdfjs.GlobalWorkerOptions.workerSrc = new URL(
				'pdfjs-dist/build/pdf.worker.min.mjs',
				import.meta.url
			).toString();
			const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
			const next: RenderedPage[] = [];
			for (let n = 1; n <= doc.numPages; n++) {
				const page = await doc.getPage(n);
				const viewport = page.getViewport({ scale });
				const canvas = document.createElement('canvas');
				canvas.width = Math.round(viewport.width);
				canvas.height = Math.round(viewport.height);
				await page.render({ canvas, viewport }).promise;
				if (run !== renderRun) return; // superseded by a newer render
				const preview = await new Promise<Blob | null>((resolve) =>
					canvas.toBlob(resolve, 'image/jpeg', 0.7)
				);
				next.push({
					n,
					canvas,
					url: preview ? URL.createObjectURL(preview) : '',
					w: canvas.width,
					h: canvas.height
				});
			}
			for (const p of pages) URL.revokeObjectURL(p.url);
			pages = next;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that PDF';
			file = null;
		} finally {
			if (run === renderRun) rendering = false;
		}
	}

	function pickScale(s: number) {
		if (scale === s) return;
		scale = s;
		void render();
	}

	async function pageBlob(page: RenderedPage): Promise<Blob> {
		const ctx = page.canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		const raw = ctx.getImageData(0, 0, page.w, page.h);
		return encodeRaw({ width: page.w, height: page.h, data: raw.data }, format, { quality });
	}

	async function downloadPage(page: RenderedPage) {
		downloadBlob(
			await pageBlob(page),
			editedFileName(baseName, `-page-${page.n}`, format.extensions[0])
		);
	}

	async function downloadZip() {
		zipping = true;
		try {
			const entries = [];
			for (const page of pages) {
				entries.push({
					name: editedFileName(baseName, `-page-${page.n}`, format.extensions[0]),
					data: new Uint8Array(await (await pageBlob(page)).arrayBuffer())
				});
			}
			downloadBlob(zipBlobs(entries), editedFileName(baseName, '-pages', '.zip'));
		} finally {
			zipping = false;
		}
	}

	function startOver() {
		renderRun++;
		for (const p of pages) URL.revokeObjectURL(p.url);
		pages = [];
		file = null;
		loadError = null;
	}

	$effect(() => () => {
		for (const p of pages) URL.revokeObjectURL(p.url);
	});
</script>

{#if !file}
	<div class="editor-load">
		<Dropzone headline="Drop a PDF here" multiple={false} accept=".pdf,application/pdf" {onfiles} />
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<div class="toolbar-group" role="group" aria-label="Resolution">
				{#each [{ s: 1, label: 'Small' }, { s: 2, label: 'Medium' }, { s: 3, label: 'Large' }] as opt (opt.s)}
					<button class="chip" class:active={scale === opt.s} aria-pressed={scale === opt.s} onclick={() => pickScale(opt.s)}>
						{opt.label}
					</button>
				{/each}
			</div>
			<div class="toolbar-group" role="group" aria-label="Format">
				{#each ['jpg', 'png', 'webp'] as const as id (id)}
					<button class="chip" class:active={formatId === id} aria-pressed={formatId === id} onclick={() => (formatId = id)}>
						{FORMATS[id].name}
					</button>
				{/each}
			</div>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		{#if format.lossy}
			<div class="quality">
				<label for="pdf-img-quality">Quality</label>
				<input id="pdf-img-quality" type="range" min="1" max="100" bind:value={quality} />
				<output class="mono" for="pdf-img-quality">{quality}</output>
			</div>
		{/if}

		{#if rendering}
			<p class="editor-status" role="status">Rendering pages…</p>
		{:else}
			<ul class="page-grid">
				{#each pages as page (page.n)}
					<li class="page-card">
						{#if page.url}<img src={page.url} alt="Page {page.n}" />{/if}
						<div class="page-foot">
							<span class="mono dim">{page.n} · {page.w} × {page.h}</span>
							<button class="btn-ghost" onclick={() => downloadPage(page)}>Download</button>
						</div>
					</li>
				{/each}
			</ul>

			<div class="result-bar">
				<span class="result-text">{pages.length} {pages.length === 1 ? 'page' : 'pages'}</span>
				<button class="btn" onclick={downloadZip} disabled={zipping || !pages.length}>
					{zipping ? 'Zipping…' : `Download all as zip`}
				</button>
			</div>
		{/if}
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
		align-items: center;
		gap: 0.5rem 1.25rem;
	}

	.toolbar-group {
		display: flex;
		gap: 0.4rem;
	}

	.toolbar > .btn-ghost {
		margin-left: auto;
	}

	.quality {
		max-width: 24rem;
	}

	.page-grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.9rem;
	}

	.page-card {
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
		overflow: hidden;
	}

	.page-card img {
		display: block;
		width: 100%;
		height: auto;
		border-bottom: 1px solid var(--line);
		background: #fff;
	}

	.page-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem 0.6rem;
	}

	.dim {
		color: var(--muted);
		font-size: 0.75rem;
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
