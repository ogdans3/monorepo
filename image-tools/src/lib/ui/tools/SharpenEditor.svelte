<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { unsharpMask } from '$lib/tools/unsharp';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let amount = $state(40);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;
	let blurred: Uint8ClampedArray | null = null;

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			base = rawToCanvas(raw);
			blurred = null;
			amount = 40;
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	/** The blurred copy the mask subtracts. Radius scales gently with size. */
	function blurredData(): Uint8ClampedArray {
		if (blurred) return blurred;
		if (!img || !base) throw new Error('No image loaded');
		const radius = Math.max(1, Math.round(Math.min(img.width, img.height) / 600));
		const c = document.createElement('canvas');
		c.width = img.width;
		c.height = img.height;
		const ctx = c.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		ctx.filter = `blur(${radius}px)`;
		ctx.drawImage(base, 0, 0);
		blurred = ctx.getImageData(0, 0, img.width, img.height).data;
		return blurred;
	}

	function sharpened(): ImageData {
		if (!img) throw new Error('No image loaded');
		const out = unsharpMask(img.data, blurredData(), amount / 50);
		return new ImageData(out, img.width, img.height);
	}

	let drawQueued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void amount;
		if (drawQueued) return;
		drawQueued = true;
		requestAnimationFrame(() => {
			drawQueued = false;
			if (!canvasEl || !img) return;
			canvasEl.width = img.width;
			canvasEl.height = img.height;
			canvasEl.getContext('2d')?.putImageData(sharpened(), 0, 0);
		});
	});

	function renderResult(): RawImage {
		if (!img) throw new Error('No image loaded');
		const data = sharpened();
		return { width: img.width, height: img.height, data: data.data };
	}

	function startOver() {
		img = null;
		base = null;
		blurred = null;
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
			<div class="quality strength">
				<label for="sharpen-amount">Amount</label>
				<input id="sharpen-amount" type="range" min="0" max="100" bind:value={amount} />
				<output class="mono" for="sharpen-amount">{amount}</output>
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={() => (amount = 0)} disabled={amount === 0}>Reset</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<ExportBar render={renderResult} {baseName} suffix="-sharpened" />
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
		justify-content: space-between;
		gap: 0.5rem 1rem;
	}

	.strength {
		flex: 1;
		min-width: 14rem;
		max-width: 24rem;
	}

	.toolbar-group {
		display: flex;
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
</style>
