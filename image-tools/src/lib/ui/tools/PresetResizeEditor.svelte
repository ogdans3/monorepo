<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { coverSource } from '$lib/tools/layout';
	import { readImageFile, rawToCanvas, steppedScale } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let {
		width,
		height,
		label
	}: {
		width: number;
		height: number;
		/** What the size is for, e.g. "a YouTube thumbnail". */
		label: string;
	} = $props();

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	/** Which part of the overflow shows, 0 to 1, so nothing is ever stretched. */
	let pan = $state({ x: 0.5, y: 0.5 });
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	/** Is there anything to drag, or does the image already fit the shape? */
	const overflow = $derived.by(() => {
		if (!img) return { x: 0, y: 0 };
		const scale = Math.max(width / img.width, height / img.height);
		return {
			x: Math.round(img.width * scale - width),
			y: Math.round(img.height * scale - height)
		};
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
			pan = { x: 0.5, y: 0.5 };
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function draw(target: HTMLCanvasElement) {
		if (!img || !base) return;
		target.width = width;
		target.height = height;
		const ctx = target.getContext('2d');
		if (!ctx) return;
		const { sx, sy, sw, sh } = coverSource(img.width, img.height, width, height, pan.x, pan.y);
		// shrink in steps first when the crop is much larger than the frame,
		// so a big photo does not come out muddy
		const source =
			sw > width * 2 ? steppedScale(cropTo(sx, sy, sw, sh), width, height) : base;
		if (source === base) {
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(base, sx, sy, sw, sh, 0, 0, width, height);
		} else {
			ctx.drawImage(source, 0, 0);
		}
	}

	function cropTo(sx: number, sy: number, sw: number, sh: number): HTMLCanvasElement {
		const out = document.createElement('canvas');
		out.width = Math.max(1, Math.round(sw));
		out.height = Math.max(1, Math.round(sh));
		out.getContext('2d')?.drawImage(base!, sx, sy, sw, sh, 0, 0, out.width, out.height);
		return out;
	}

	let queued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void pan;
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			if (canvasEl) draw(canvasEl);
		});
	});

	function startPan(e: PointerEvent) {
		if (!canvasEl || (overflow.x === 0 && overflow.y === 0)) return;
		e.preventDefault();
		const el = canvasEl;
		el.setPointerCapture(e.pointerId);
		const rect = el.getBoundingClientRect();
		const startX = e.clientX;
		const startY = e.clientY;
		const start = { ...pan };
		const move = (ev: PointerEvent) => {
			const dx = ((ev.clientX - startX) / rect.width) * width;
			const dy = ((ev.clientY - startY) / rect.height) * height;
			pan = {
				x: overflow.x ? Math.min(1, Math.max(0, start.x - dx / overflow.x)) : 0.5,
				y: overflow.y ? Math.min(1, Math.max(0, start.y - dy / overflow.y)) : 0.5
			};
		};
		const up = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', up);
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', up);
	}

	function renderResult(): RawImage {
		if (!img) throw new Error('No image loaded');
		const out = document.createElement('canvas');
		draw(out);
		const ctx = out.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		const data = ctx.getImageData(0, 0, width, height);
		return { width, height, data: data.data };
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
		<p class="preset-note">
			It will come out at exactly <span class="mono">{width} × {height}</span> pixels, ready for
			{label}.
		</p>
		{#if loading}<p class="editor-status" role="status">Reading image…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<span class="target mono">{width} × {height} px</span>
			<button class="btn-ghost" onclick={() => (pan = { x: 0.5, y: 0.5 })}>Centre</button>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={width < 320}>
				<canvas
					bind:this={canvasEl}
					onpointerdown={startPan}
					class:draggable={overflow.x > 0 || overflow.y > 0}
					aria-label="Preview at {width} by {height}. Drag to choose which part shows."
				></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			<span class="mono">{img.width} × {img.height}</span>
			<span class="arrow" aria-hidden="true">→</span>
			<span class="mono strong">{width} × {height} px</span>
			{#if overflow.x > 0 || overflow.y > 0}
				· Drag the image to choose which part is kept.
			{:else}
				· Your image is already this shape, so nothing is cropped.
			{/if}
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-{width}x{height}" />
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
	.hint,
	.preset-note {
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
		gap: 0.5rem;
	}

	.target {
		font-size: 0.875rem;
		color: var(--muted);
		margin-right: auto;
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
		max-height: 56vh;
		touch-action: none;
	}

	canvas.draggable {
		cursor: grab;
	}

	canvas.draggable:active {
		cursor: grabbing;
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
