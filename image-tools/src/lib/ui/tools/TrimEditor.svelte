<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { trimBounds } from '$lib/tools/pixels';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let tolerance = $state(6);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	/** null means nothing to trim, so the image is left alone. */
	const bounds = $derived.by(() =>
		img ? trimBounds(img.data, img.width, img.height, tolerance) : null
	);
	const trimmed = $derived.by(() => {
		if (!img) return null;
		return bounds ?? { x: 0, y: 0, w: img.width, h: img.height };
	});

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			base = rawToCanvas(raw);
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function draw(target: HTMLCanvasElement) {
		if (!base || !trimmed) return;
		const { x, y, w, h } = trimmed;
		target.width = w;
		target.height = h;
		target.getContext('2d')?.drawImage(base, x, y, w, h, 0, 0, w, h);
	}

	$effect(() => {
		if (!img || !canvasEl) return;
		void tolerance;
		draw(canvasEl);
	});

	function renderResult(): RawImage {
		if (!img) throw new Error('No image loaded');
		const out = document.createElement('canvas');
		draw(out);
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
			<div class="quality main">
				<label for="trim-tolerance">Tolerance</label>
				<input id="trim-tolerance" type="range" min="0" max="40" bind:value={tolerance} />
				<output class="mono" for="trim-tolerance">{tolerance}</output>
			</div>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="stage">
			<div class="canvas-wrap checker" class:small={(trimmed?.w ?? img.width) < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			<span class="mono">{img.width} × {img.height}</span>
			<span class="arrow" aria-hidden="true">→</span>
			<span class="mono strong">{trimmed?.w} × {trimmed?.h} px</span>
			{#if !bounds}
				· This image is all one colour, so there is nothing to trim.
			{:else if trimmed?.w === img.width && trimmed?.h === img.height}
				· No flat border found. Raise the tolerance if there is one you can see.
			{/if}
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-trimmed" />
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

	.hint .strong {
		color: var(--ink);
		font-weight: 600;
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
		gap: 0.6rem 1rem;
	}

	.main {
		flex: 1;
		min-width: 13rem;
		max-width: 20rem;
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
		border: 1px solid var(--line);
	}

	canvas {
		display: block;
		max-width: 100%;
		max-height: 60vh;
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
</style>
