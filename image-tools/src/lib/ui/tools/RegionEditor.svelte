<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { dragToShape, type Shape } from '$lib/tools/shapes';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let {
		variant,
		suffix
	}: {
		/** blur composites a blurred or pixelated copy, redact fills solid colour. */
		variant: 'blur' | 'redact';
		suffix: string;
	} = $props();

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let shapes = $state<Shape[]>([]);
	let pending = $state<Shape | null>(null);
	let kind = $state<Shape['kind']>('rect');
	let mode = $state<'blur' | 'pixelate'>('blur');
	let strength = $state(14);
	let colorMode = $state<'black' | 'white' | 'custom'>('black');
	let customColor = $state('#d33682');
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;
	let fx: HTMLCanvasElement | null = null;

	const color = $derived(
		colorMode === 'black' ? '#000000' : colorMode === 'white' ? '#ffffff' : customColor
	);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readImageFile(file);
			baseName = loaded.name;
			base = rawToCanvas(loaded.raw);
			fx = null;
			shapes = [];
			pending = null;
			img = loaded.raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	/** The whole image with the effect applied, clipped per shape at render. */
	function makeFx(): HTMLCanvasElement | null {
		if (variant !== 'blur' || !base) return null;
		const out = document.createElement('canvas');
		out.width = base.width;
		out.height = base.height;
		const ctx = out.getContext('2d');
		if (!ctx) return null;
		if (mode === 'blur') {
			ctx.filter = `blur(${strength}px)`;
			ctx.drawImage(base, 0, 0);
		} else {
			const block = Math.max(2, strength);
			const sw = Math.max(1, Math.round(base.width / block));
			const sh = Math.max(1, Math.round(base.height / block));
			const small = document.createElement('canvas');
			small.width = sw;
			small.height = sh;
			small.getContext('2d')?.drawImage(base, 0, 0, sw, sh);
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(small, 0, 0, sw, sh, 0, 0, base.width, base.height);
		}
		return out;
	}

	function tracePath(ctx: CanvasRenderingContext2D, s: Shape) {
		ctx.beginPath();
		if (s.kind === 'rect') ctx.rect(s.x, s.y, s.w, s.h);
		else ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
	}

	function composite(ctx: CanvasRenderingContext2D, all: Shape[]) {
		if (!base) return;
		ctx.drawImage(base, 0, 0);
		for (const s of all) {
			if (variant === 'blur') {
				if (!fx) fx = makeFx();
				if (!fx) continue;
				ctx.save();
				tracePath(ctx, s);
				ctx.clip();
				ctx.drawImage(fx, 0, 0);
				ctx.restore();
			} else {
				tracePath(ctx, s);
				ctx.fillStyle = color;
				ctx.fill();
			}
		}
	}

	function render() {
		if (!img || !canvasEl || !base) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		composite(ctx, pending ? [...shapes, pending] : shapes);
		if (pending) {
			// rubber band while drawing
			const scale = canvasEl.getBoundingClientRect().width / img.width || 1;
			ctx.save();
			tracePath(ctx, pending);
			ctx.setLineDash([6 / scale, 4 / scale]);
			ctx.lineWidth = Math.max(1, 1.5 / scale);
			ctx.strokeStyle = '#ffffff';
			ctx.stroke();
			ctx.restore();
		}
	}

	let renderQueued = false;
	function scheduleRender() {
		if (renderQueued) return;
		renderQueued = true;
		requestAnimationFrame(() => {
			renderQueued = false;
			render();
		});
	}

	// size the canvas and re-render when the image or effect settings change
	$effect(() => {
		if (!img || !canvasEl) return;
		canvasEl.width = img.width;
		canvasEl.height = img.height;
		void mode;
		void strength;
		void color;
		fx = null;
		scheduleRender();
	});

	function startDraw(e: PointerEvent) {
		if (!img || !canvasEl) return;
		e.preventDefault();
		const el = canvasEl;
		const rect = el.getBoundingClientRect();
		const point = (ev: PointerEvent): [number, number] => [
			((ev.clientX - rect.left) / rect.width) * img!.width,
			((ev.clientY - rect.top) / rect.height) * img!.height
		];
		const [x0, y0] = point(e);
		el.setPointerCapture(e.pointerId);

		const onMove = (ev: PointerEvent) => {
			const [x1, y1] = point(ev);
			pending = dragToShape(kind, x0, y0, x1, y1, img!.width, img!.height);
			scheduleRender();
		};
		const onUp = (ev: PointerEvent) => {
			const [x1, y1] = point(ev);
			const shape = dragToShape(kind, x0, y0, x1, y1, img!.width, img!.height);
			if (shape) shapes.push(shape);
			pending = null;
			scheduleRender();
			el.removeEventListener('pointermove', onMove);
			el.removeEventListener('pointerup', onUp);
			el.removeEventListener('pointercancel', onUp);
		};
		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerup', onUp);
		el.addEventListener('pointercancel', onUp);
	}

	function undo() {
		if (!shapes.length) return;
		shapes.pop();
		scheduleRender();
	}

	function onKey(e: KeyboardEvent) {
		if (!img) return;
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
			e.preventDefault();
			undo();
		}
	}

	function renderResult(): RawImage {
		if (!img || !base) throw new Error('No image loaded');
		const out = document.createElement('canvas');
		out.width = img.width;
		out.height = img.height;
		const ctx = out.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		composite(ctx, shapes);
		const data = ctx.getImageData(0, 0, img.width, img.height);
		return { width: img.width, height: img.height, data: data.data };
	}

	function startOver() {
		img = null;
		base = null;
		fx = null;
		shapes = [];
		pending = null;
		loadError = null;
	}
</script>

<svelte:window onkeydown={onKey} />

{#if !img}
	<div class="editor-load">
		<Dropzone headline="Drop an image here" multiple={false} {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading image…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<div class="toolbar-group" role="group" aria-label="Shape">
				<button class="chip" class:active={kind === 'rect'} aria-pressed={kind === 'rect'} onclick={() => (kind = 'rect')}>Box</button>
				<button class="chip" class:active={kind === 'ellipse'} aria-pressed={kind === 'ellipse'} onclick={() => (kind = 'ellipse')}>Oval</button>
			</div>

			{#if variant === 'blur'}
				<div class="toolbar-group" role="group" aria-label="Effect">
					<button class="chip" class:active={mode === 'blur'} aria-pressed={mode === 'blur'} onclick={() => (mode = 'blur')}>Blur</button>
					<button class="chip" class:active={mode === 'pixelate'} aria-pressed={mode === 'pixelate'} onclick={() => (mode = 'pixelate')}>Pixelate</button>
				</div>
			{:else}
				<div class="toolbar-group" role="group" aria-label="Colour">
					<button class="chip" class:active={colorMode === 'black'} aria-pressed={colorMode === 'black'} onclick={() => (colorMode = 'black')}>Black</button>
					<button class="chip" class:active={colorMode === 'white'} aria-pressed={colorMode === 'white'} onclick={() => (colorMode = 'white')}>White</button>
					<button class="chip" class:active={colorMode === 'custom'} aria-pressed={colorMode === 'custom'} onclick={() => (colorMode = 'custom')}>Colour</button>
					{#if colorMode === 'custom'}
						<input type="color" bind:value={customColor} aria-label="Redaction colour" />
					{/if}
				</div>
			{/if}

			<div class="toolbar-group">
				<button class="btn-ghost" onclick={undo} disabled={!shapes.length}>Undo</button>
				<button class="btn-ghost" onclick={() => ((shapes = []), scheduleRender())} disabled={!shapes.length}>Reset</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		{#if variant === 'blur'}
			<div class="quality">
				<label for="strength">Strength</label>
				<input id="strength" type="range" min="4" max="50" bind:value={strength} />
				<output class="mono" for="strength">{strength}</output>
			</div>
		{/if}

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas
					bind:this={canvasEl}
					onpointerdown={startDraw}
					aria-label="Image preview. Drag to draw a shape over the area to hide."
				></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			{#if shapes.length === 0}
				Drag across the part of the image you want covered.
			{:else}
				{shapes.length}
				{shapes.length === 1 ? 'area' : 'areas'} covered. Drag to add another, or undo the last one.
			{/if}
		</p>

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
		gap: 0.5rem 1.25rem;
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.toolbar-group:last-child {
		margin-left: auto;
	}

	.toolbar-group input[type='color'] {
		width: 2.2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
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
		max-height: 62vh;
		cursor: crosshair;
		touch-action: none;
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
</style>
