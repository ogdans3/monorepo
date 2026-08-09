<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { adjustFilter } from '$lib/tools/transforms';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let brightness = $state(0);
	let contrast = $state(0);
	let saturation = $state(0);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const untouched = $derived(brightness === 0 && contrast === 0 && saturation === 0);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			base = rawToCanvas(raw);
			brightness = 0;
			contrast = 0;
			saturation = 0;
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function draw(target: HTMLCanvasElement) {
		if (!img || !base) return;
		target.width = img.width;
		target.height = img.height;
		const ctx = target.getContext('2d');
		if (!ctx) return;
		ctx.filter = adjustFilter(brightness, contrast, saturation);
		ctx.drawImage(base, 0, 0);
		ctx.filter = 'none';
	}

	let drawQueued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void brightness;
		void contrast;
		void saturation;
		if (drawQueued) return;
		drawQueued = true;
		requestAnimationFrame(() => {
			drawQueued = false;
			if (canvasEl) draw(canvasEl);
		});
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

	function reset() {
		brightness = 0;
		contrast = 0;
		saturation = 0;
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
		<div class="sliders">
			<div class="quality">
				<label for="adj-brightness">Brightness</label>
				<input id="adj-brightness" type="range" min="-100" max="100" bind:value={brightness} />
				<output class="mono" for="adj-brightness">{brightness}</output>
			</div>
			<div class="quality">
				<label for="adj-contrast">Contrast</label>
				<input id="adj-contrast" type="range" min="-100" max="100" bind:value={contrast} />
				<output class="mono" for="adj-contrast">{contrast}</output>
			</div>
			<div class="quality">
				<label for="adj-saturation">Saturation</label>
				<input id="adj-saturation" type="range" min="-100" max="100" bind:value={saturation} />
				<output class="mono" for="adj-saturation">{saturation}</output>
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={reset} disabled={untouched}>Reset</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<ExportBar render={renderResult} {baseName} suffix="-adjusted" />
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

	.sliders {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sliders .quality label {
		min-width: 5.5rem;
	}

	.sliders .quality output {
		min-width: 3.2ch;
	}

	.toolbar-group {
		display: flex;
		gap: 0.4rem;
		margin-top: 0.25rem;
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
</style>
