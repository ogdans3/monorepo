<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { replaceColor } from '$lib/tools/pixels';
	import { rgbToHex } from '$lib/tools/color';
	import { readImageFile } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let from = $state<{ r: number; g: number; b: number } | null>(null);
	let toColor = $state('#c62d6a');
	let tolerance = $state(20);
	let changed = $state(0);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();

	const fromHex = $derived(from ? rgbToHex(from) : null);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			from = null;
			changed = 0;
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function hexToRgb(hex: string) {
		const h = hex.replace('#', '');
		return {
			r: parseInt(h.slice(0, 2), 16),
			g: parseInt(h.slice(2, 4), 16),
			b: parseInt(h.slice(4, 6), 16)
		};
	}

	function result(): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
		if (!img) throw new Error('No image loaded');
		if (!from) return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
		const swapped = replaceColor(img.data, from, hexToRgb(toColor), tolerance);
		changed = swapped.changed;
		return { width: img.width, height: img.height, data: swapped.data };
	}

	let queued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void from;
		void toColor;
		void tolerance;
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			if (!canvasEl || !img) return;
			canvasEl.width = img.width;
			canvasEl.height = img.height;
			const out = result();
			canvasEl.getContext('2d')?.putImageData(new ImageData(out.data, out.width, out.height), 0, 0);
		});
	});

	function pick(e: MouseEvent) {
		if (!img || !canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const x = Math.min(img.width - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * img.width)));
		const y = Math.min(img.height - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * img.height)));
		const i = (y * img.width + x) * 4;
		// always sample the original, so picking twice is not cumulative
		from = { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] };
	}

	function renderResult(): RawImage {
		return result();
	}

	function startOver() {
		img = null;
		from = null;
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
			<span class="swatches">
				<span class="label">From</span>
				<span class="swatch" style:background={fromHex ?? 'transparent'} class:empty={!fromHex}></span>
				<span class="mono value">{fromHex ?? 'click the image'}</span>
				<span class="arrow" aria-hidden="true">→</span>
				<span class="label">To</span>
				<input type="color" bind:value={toColor} aria-label="New colour" />
				<span class="mono value">{toColor}</span>
			</span>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="quality">
			<label for="rc-tolerance">Tolerance</label>
			<input id="rc-tolerance" type="range" min="0" max="100" bind:value={tolerance} />
			<output class="mono" for="rc-tolerance">{tolerance}</output>
		</div>

		<div class="stage">
			<div class="canvas-wrap checker" class:small={img.width < 320}>
				<canvas
					bind:this={canvasEl}
					onclick={pick}
					aria-label="Image preview. Click the colour you want to replace."
				></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			{#if !from}
				Click the colour you want to change.
			{:else}
				{changed.toLocaleString('en')} pixels changed. Raise the tolerance to catch more shades.
			{/if}
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-recoloured" />
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
		align-items: center;
		gap: 0.6rem 1rem;
	}

	.swatches {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.label {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.value {
		font-size: 0.8125rem;
	}

	.swatch {
		width: 26px;
		height: 26px;
		border-radius: var(--r-s);
		border: 1px solid var(--line);
	}

	.swatch.empty {
		background-image: linear-gradient(45deg, var(--surface-deep) 25%, transparent 25%, transparent 75%, var(--surface-deep) 75%);
		background-size: 8px 8px;
	}

	.toolbar input[type='color'] {
		width: 2.2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
	}

	.toolbar > .btn-ghost {
		margin-left: auto;
	}

	.quality {
		max-width: 24rem;
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
		max-height: 58vh;
		cursor: crosshair;
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
