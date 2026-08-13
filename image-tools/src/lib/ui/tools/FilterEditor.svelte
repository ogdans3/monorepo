<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { grayscale, sepia } from '$lib/tools/pixels';
	import { readImageFile, rawToCanvas, steppedScale } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let {
		variant,
		suffix
	}: {
		/** Four effects that are all "one slider over the whole image". */
		variant: 'grayscale' | 'sepia' | 'pixelate' | 'vignette';
		suffix: string;
	} = $props();

	const COPY = {
		grayscale: { label: 'Strength', min: 0, max: 100, start: 100, unit: '%' },
		sepia: { label: 'Strength', min: 0, max: 100, start: 100, unit: '%' },
		pixelate: { label: 'Block size', min: 2, max: 60, start: 12, unit: 'px' },
		vignette: { label: 'Strength', min: 0, max: 100, start: 45, unit: '%' }
	} as const;
	// variant is fixed per route, so reading it once is the point
	// svelte-ignore state_referenced_locally
	const copy = COPY[variant];

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	// svelte-ignore state_referenced_locally
	let amount = $state(copy.start);
	let spread = $state(55);
	let lighten = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

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
		if (!img || !base) return;
		const { width, height } = img;
		target.width = width;
		target.height = height;
		const ctx = target.getContext('2d');
		if (!ctx) return;

		if (variant === 'pixelate') {
			const block = Math.max(2, amount);
			const sw = Math.max(1, Math.round(width / block));
			const sh = Math.max(1, Math.round(height / block));
			const small = steppedScale(base, sw, sh);
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(small, 0, 0, sw, sh, 0, 0, width, height);
			return;
		}

		if (variant === 'vignette') {
			ctx.drawImage(base, 0, 0);
			const inner = (spread / 100) * 0.9;
			const radius = Math.hypot(width, height) / 2;
			const gradient = ctx.createRadialGradient(
				width / 2,
				height / 2,
				radius * inner,
				width / 2,
				height / 2,
				radius
			);
			const tone = lighten ? '255, 255, 255' : '0, 0, 0';
			gradient.addColorStop(0, `rgba(${tone}, 0)`);
			gradient.addColorStop(1, `rgba(${tone}, ${amount / 100})`);
			ctx.fillStyle = gradient;
			ctx.fillRect(0, 0, width, height);
			return;
		}

		// grayscale and sepia: full-strength pixels, then faded back over the
		// original so the slider is a real mix rather than a second filter
		const mapped = variant === 'grayscale' ? grayscale(img.data) : sepia(img.data);
		const scratch = document.createElement('canvas');
		scratch.width = width;
		scratch.height = height;
		scratch.getContext('2d')?.putImageData(new ImageData(mapped, width, height), 0, 0);
		ctx.drawImage(base, 0, 0);
		ctx.globalAlpha = amount / 100;
		ctx.drawImage(scratch, 0, 0);
		ctx.globalAlpha = 1;
	}

	let queued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void amount;
		void spread;
		void lighten;
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
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
				<label for="filter-amount">{copy.label}</label>
				<input
					id="filter-amount"
					type="range"
					min={copy.min}
					max={copy.max}
					bind:value={amount}
				/>
				<output class="mono" for="filter-amount">{amount}{copy.unit}</output>
			</div>
			{#if variant === 'vignette'}
				<div class="quality main">
					<label for="filter-spread">Size</label>
					<input id="filter-spread" type="range" min="0" max="95" bind:value={spread} />
					<output class="mono" for="filter-spread">{spread}%</output>
				</div>
				<label class="check">
					<input type="checkbox" bind:checked={lighten} />
					Lighten instead
				</label>
			{/if}
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="stage">
			<div class="canvas-wrap checker" class:small={img.width < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<ExportBar render={renderResult} {baseName} {suffix} />
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
		gap: 0.6rem 1.75rem;
	}

	.main {
		flex: 1;
		min-width: 13rem;
		max-width: 20rem;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--muted);
		cursor: pointer;
	}

	.check input {
		accent-color: var(--primary);
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
