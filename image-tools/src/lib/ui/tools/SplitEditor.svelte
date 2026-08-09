<script lang="ts">
	import { FORMATS, editedFileName, encodeRaw, zipBlobs, type FormatId } from '$lib/engine';
	import { tileRects } from '$lib/tools/split';
	import { readImageFile, rawToCanvas } from './load';
	import { downloadBlob } from '../download';
	import Dropzone from '../Dropzone.svelte';

	let img = $state<{ w: number; h: number } | null>(null);
	let baseName = $state('image');
	let rows = $state(1);
	let cols = $state(3);
	let formatId = $state<FormatId>('png');
	let quality = $state(90);
	let zipping = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const tiles = $derived(img ? tileRects(img.w, img.h, rows, cols) : []);
	const format = $derived(FORMATS[formatId]);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			base = rawToCanvas(raw);
			img = { w: raw.width, h: raw.height };
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	// preview with the grid overlay drawn on top
	$effect(() => {
		if (!img || !canvasEl || !base) return;
		canvasEl.width = img.w;
		canvasEl.height = img.h;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(base, 0, 0);
		const scale = canvasEl.getBoundingClientRect().width / img.w || 1;
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
		ctx.lineWidth = Math.max(1, 1.5 / scale);
		ctx.setLineDash([8 / scale, 6 / scale]);
		for (const t of tiles) {
			ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1);
		}
	});

	const clampGrid = (v: number) => Math.max(1, Math.min(12, Math.round(v) || 1));

	async function downloadZip() {
		if (!img || !base) return;
		zipping = true;
		try {
			const entries = [];
			for (const t of tiles) {
				const c = document.createElement('canvas');
				c.width = t.w;
				c.height = t.h;
				const ctx = c.getContext('2d');
				if (!ctx) continue;
				ctx.drawImage(base, t.x, t.y, t.w, t.h, 0, 0, t.w, t.h);
				const raw = ctx.getImageData(0, 0, t.w, t.h);
				const blob = await encodeRaw(
					{ width: t.w, height: t.h, data: raw.data },
					format,
					{ quality }
				);
				entries.push({
					name: editedFileName(baseName, `-r${t.row + 1}c${t.col + 1}`, format.extensions[0]),
					data: new Uint8Array(await blob.arrayBuffer())
				});
			}
			downloadBlob(zipBlobs(entries), editedFileName(baseName, '-tiles', '.zip'));
		} finally {
			zipping = false;
		}
	}

	function startOver() {
		img = null;
		base = null;
		loadError = null;
	}
</script>

{#if !img}
	<div class="editor-load">
		<Dropzone headline="Drop an image here" multiple={false} {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading image…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<label class="grid-field">
				<span>Rows</span>
				<input
					type="number"
					min="1"
					max="12"
					value={rows}
					onchange={(e) => (rows = clampGrid(+e.currentTarget.value))}
				/>
			</label>
			<span class="mono dim">×</span>
			<label class="grid-field">
				<span>Columns</span>
				<input
					type="number"
					min="1"
					max="12"
					value={cols}
					onchange={(e) => (cols = clampGrid(+e.currentTarget.value))}
				/>
			</label>
			<div class="toolbar-group" role="group" aria-label="Tile format">
				{#each ['png', 'jpg', 'webp'] as const as id (id)}
					<button class="chip" class:active={formatId === id} aria-pressed={formatId === id} onclick={() => (formatId = id)}>
						{FORMATS[id].name}
					</button>
				{/each}
			</div>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		{#if format.lossy}
			<div class="quality">
				<label for="split-quality">Quality</label>
				<input id="split-quality" type="range" min="1" max="100" bind:value={quality} />
				<output class="mono" for="split-quality">{quality}</output>
			</div>
		{/if}

		<div class="stage">
			<div class="canvas-wrap" class:small={img.w < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<div class="result-bar">
			<span class="result-text">
				{tiles.length}
				{tiles.length === 1 ? 'tile' : 'tiles'} of about
				<span class="mono">{tiles[0]?.w} × {tiles[0]?.h} px</span>
			</span>
			<button class="btn" onclick={downloadZip} disabled={zipping || tiles.length < 2}>
				{zipping ? 'Zipping…' : `Download ${tiles.length} tiles as zip`}
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
		align-items: end;
		gap: 0.5rem 0.8rem;
	}

	.grid-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.grid-field input {
		width: 4.5rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: 500 0.875rem var(--font-mono);
		color: var(--ink);
	}

	.dim {
		color: var(--muted);
		padding-bottom: 0.45rem;
	}

	.toolbar-group {
		display: flex;
		gap: 0.4rem;
		padding-bottom: 0.15rem;
		margin-left: 0.5rem;
	}

	.toolbar > .btn-ghost {
		margin-left: auto;
	}

	.stage {
		display: flex;
		justify-content: center;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		padding: 1rem;
	}

	.canvas-wrap {
		line-height: 0;
	}

	canvas {
		display: block;
		max-width: 100%;
		max-height: 62vh;
	}

	.canvas-wrap.small {
		width: min(480px, 100%);
	}

	.canvas-wrap.small canvas {
		width: 100%;
		height: auto;
		max-height: none;
		image-rendering: pixelated;
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

	.result-text .mono {
		color: var(--ink);
	}
</style>
