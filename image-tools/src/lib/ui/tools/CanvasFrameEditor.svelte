<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let {
		variant,
		suffix
	}: {
		/** Three tools that all add room around the image and fill it. */
		variant: 'extend' | 'border' | 'shadow';
		suffix: string;
	} = $props();

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');

	// extend
	let padTop = $state(40);
	let padRight = $state(40);
	let padBottom = $state(40);
	let padBottomLinked = $state(true);
	// border
	let borderWidth = $state(24);
	let innerLine = $state(false);
	// shadow
	let shadowBlur = $state(24);
	let shadowOffset = $state(10);

	// variant is fixed per route, so this is a starting value by design
	// svelte-ignore state_referenced_locally
	let fillMode = $state<'white' | 'black' | 'transparent' | 'custom'>(
		variant === 'shadow' ? 'transparent' : 'white'
	);
	let customFill = $state('#ffffff');
	let shadowColor = $state('#000000');

	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const fill = $derived(
		fillMode === 'white'
			? '#ffffff'
			: fillMode === 'black'
				? '#000000'
				: fillMode === 'custom'
					? customFill
					: null
	);

	/** Padding on each side, per variant. */
	const pad = $derived.by(() => {
		if (variant === 'border') {
			return { top: borderWidth, right: borderWidth, bottom: borderWidth, left: borderWidth };
		}
		if (variant === 'shadow') {
			const room = shadowBlur + Math.abs(shadowOffset) + 8;
			return { top: room, right: room, bottom: room, left: room };
		}
		const bottom = padBottomLinked ? padTop : padBottom;
		return { top: padTop, right: padRight, bottom, left: padRight };
	});

	const outSize = $derived.by(() => {
		if (!img) return { w: 0, h: 0 };
		return { w: img.width + pad.left + pad.right, h: img.height + pad.top + pad.bottom };
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

	function squareUp() {
		if (!img) return;
		const diff = Math.abs(img.width - img.height);
		const half = Math.round(diff / 2);
		padBottomLinked = true;
		if (img.width > img.height) {
			padTop = half;
			padRight = 0;
		} else {
			padTop = 0;
			padRight = half;
		}
	}

	function draw(target: HTMLCanvasElement) {
		if (!img || !base) return;
		const { w, h } = outSize;
		target.width = Math.max(1, w);
		target.height = Math.max(1, h);
		const ctx = target.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, w, h);

		if (fill) {
			ctx.fillStyle = fill;
			ctx.fillRect(0, 0, w, h);
		}

		if (variant === 'shadow') {
			ctx.save();
			ctx.shadowColor = shadowColor;
			ctx.shadowBlur = shadowBlur;
			ctx.shadowOffsetY = shadowOffset;
			ctx.drawImage(base, pad.left, pad.top);
			ctx.restore();
			// draw again without a shadow so the image itself stays crisp
			ctx.drawImage(base, pad.left, pad.top);
			return;
		}

		ctx.drawImage(base, pad.left, pad.top);

		if (variant === 'border' && innerLine && borderWidth >= 6) {
			const inset = Math.max(2, Math.round(borderWidth / 3));
			ctx.strokeStyle = fill === '#ffffff' || fillMode === 'transparent' ? '#00000033' : '#ffffff66';
			ctx.lineWidth = 1;
			ctx.strokeRect(inset + 0.5, inset + 0.5, w - inset * 2 - 1, h - inset * 2 - 1);
		}
	}

	let queued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void pad;
		void fill;
		void innerLine;
		void shadowBlur;
		void shadowOffset;
		void shadowColor;
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
		<div class="controls">
			{#if variant === 'extend'}
				<div class="quality">
					<label for="pad-v">Top and bottom</label>
					<input id="pad-v" type="range" min="0" max="400" bind:value={padTop} />
					<output class="mono" for="pad-v">{padTop}px</output>
				</div>
				<div class="quality">
					<label for="pad-h">Left and right</label>
					<input id="pad-h" type="range" min="0" max="400" bind:value={padRight} />
					<output class="mono" for="pad-h">{padRight}px</output>
				</div>
				<button class="btn-ghost" onclick={squareUp}>Pad to a square</button>
			{:else if variant === 'border'}
				<div class="quality">
					<label for="border-width">Width</label>
					<input id="border-width" type="range" min="1" max="200" bind:value={borderWidth} />
					<output class="mono" for="border-width">{borderWidth}px</output>
				</div>
				<label class="check">
					<input type="checkbox" bind:checked={innerLine} />
					Inner line
				</label>
			{:else}
				<div class="quality">
					<label for="shadow-blur">Softness</label>
					<input id="shadow-blur" type="range" min="0" max="80" bind:value={shadowBlur} />
					<output class="mono" for="shadow-blur">{shadowBlur}px</output>
				</div>
				<div class="quality">
					<label for="shadow-offset">Distance</label>
					<input id="shadow-offset" type="range" min="-40" max="60" bind:value={shadowOffset} />
					<output class="mono" for="shadow-offset">{shadowOffset}px</output>
				</div>
				<span class="colour-pick">
					<span class="check-label">Shadow</span>
					<input type="color" bind:value={shadowColor} aria-label="Shadow colour" />
				</span>
			{/if}
		</div>

		<div class="row" role="group" aria-label={variant === 'border' ? 'Border colour' : 'Background'}>
			<span class="row-label">{variant === 'border' ? 'Border' : 'Background'}</span>
			<button class="chip" class:active={fillMode === 'white'} aria-pressed={fillMode === 'white'} onclick={() => (fillMode = 'white')}>White</button>
			<button class="chip" class:active={fillMode === 'black'} aria-pressed={fillMode === 'black'} onclick={() => (fillMode = 'black')}>Black</button>
			<button class="chip" class:active={fillMode === 'transparent'} aria-pressed={fillMode === 'transparent'} onclick={() => (fillMode = 'transparent')}>Transparent</button>
			<button class="chip" class:active={fillMode === 'custom'} aria-pressed={fillMode === 'custom'} onclick={() => (fillMode = 'custom')}>Colour</button>
			{#if fillMode === 'custom'}
				<input type="color" bind:value={customFill} aria-label="Fill colour" />
			{/if}
			<button class="btn-ghost start-over" onclick={startOver}>Start over</button>
		</div>

		<div class="stage">
			<div class="canvas-wrap checker" class:small={outSize.w < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			<span class="mono">{img.width} × {img.height}</span>
			<span class="arrow" aria-hidden="true">→</span>
			<span class="mono strong">{outSize.w} × {outSize.h} px</span>
			{#if fillMode === 'transparent'}
				· Download as PNG or WebP to keep the new space transparent.
			{/if}
		</p>

		<ExportBar
			render={renderResult}
			{baseName}
			{suffix}
			formats={fillMode === 'transparent' ? ['png', 'webp', 'jpg'] : ['png', 'jpg', 'webp']}
		/>
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

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1.75rem;
	}

	.controls .quality {
		flex: 1;
		min-width: 12rem;
		max-width: 18rem;
	}

	.check,
	.colour-pick {
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

	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.row-label,
	.check-label {
		font-size: 0.875rem;
		color: var(--muted);
		min-width: 5.5rem;
	}

	.check-label {
		min-width: 0;
	}

	input[type='color'] {
		width: 2.2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
	}

	.start-over {
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
		max-height: 58vh;
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
