<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import {
		flipView,
		IDENTITY,
		orientedDims,
		rotateView,
		type Orientation
	} from '$lib/tools/transforms';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let orient = $state<Orientation>(IDENTITY);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const dims = $derived(img ? orientedDims(img.width, img.height, orient) : { w: 0, h: 0 });
	const untouched = $derived(orient.turns === 0 && !orient.flipH && !orient.flipV);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readImageFile(file);
			baseName = loaded.name;
			base = rawToCanvas(loaded.raw);
			orient = IDENTITY;
			img = loaded.raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function drawOriented(target: HTMLCanvasElement) {
		if (!img || !base) return;
		const { w, h } = orientedDims(img.width, img.height, orient);
		target.width = w;
		target.height = h;
		const ctx = target.getContext('2d');
		if (!ctx) return;
		ctx.save();
		ctx.translate(w / 2, h / 2);
		ctx.scale(orient.flipH ? -1 : 1, orient.flipV ? -1 : 1);
		ctx.rotate((orient.turns * Math.PI) / 2);
		ctx.drawImage(base, -img.width / 2, -img.height / 2);
		ctx.restore();
	}

	$effect(() => {
		if (!img || !canvasEl) return;
		void orient.turns;
		void orient.flipH;
		void orient.flipV;
		drawOriented(canvasEl);
	});

	function renderResult(): RawImage {
		const out = document.createElement('canvas');
		drawOriented(out);
		const ctx = out.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		const data = ctx.getImageData(0, 0, out.width, out.height);
		return { width: out.width, height: out.height, data: data.data };
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
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={() => (orient = rotateView(orient, -1))}>
					⟲ Rotate left
				</button>
				<button class="btn-ghost" onclick={() => (orient = rotateView(orient, 1))}>
					⟳ Rotate right
				</button>
				<button class="btn-ghost" onclick={() => (orient = flipView(orient, 'h'))}>
					⇋ Flip horizontal
				</button>
				<button class="btn-ghost" onclick={() => (orient = flipView(orient, 'v'))}>
					⇵ Flip vertical
				</button>
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={() => (orient = IDENTITY)} disabled={untouched}>
					Reset
				</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={dims.w < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			<span class="mono">{img.width} × {img.height}</span>
			<span class="arrow" aria-hidden="true">→</span>
			<span class="mono">{dims.w} × {dims.h} px</span>
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-rotated" />
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
		gap: 0.5rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
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

	.hint {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.hint .mono {
		color: var(--ink);
	}
</style>
