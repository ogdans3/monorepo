<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let text = $state('Your text here');
	let sizePct = $state(8);
	let colorMode = $state<'white' | 'black' | 'custom'>('white');
	let customColor = $state('#c62d6a');
	let outline = $state(true);
	let bold = $state(true);
	/** Position as a fraction of the image, so it survives any resize. */
	let pos = $state({ x: 0.5, y: 0.85 });
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const color = $derived(
		colorMode === 'white' ? '#ffffff' : colorMode === 'black' ? '#000000' : customColor
	);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			base = rawToCanvas(raw);
			pos = { x: 0.5, y: 0.85 };
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
		ctx.drawImage(base, 0, 0);

		const label = text.trim();
		if (!label) return;
		const fontPx = Math.max(10, (Math.min(img.width, img.height) * sizePct) / 100);
		ctx.font = `${bold ? '700' : '400'} ${fontPx}px ${getComputedStyle(document.body).fontFamily}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const x = img.width * pos.x;
		const y = img.height * pos.y;

		if (outline) {
			// an outline is what keeps text readable over a busy photo
			ctx.lineJoin = 'round';
			ctx.lineWidth = Math.max(2, fontPx / 8);
			ctx.strokeStyle = color === '#000000' ? '#ffffff' : '#000000';
			ctx.strokeText(label, x, y);
		}
		ctx.fillStyle = color;
		ctx.fillText(label, x, y);
	}

	let queued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void text;
		void sizePct;
		void color;
		void outline;
		void bold;
		void pos;
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			if (canvasEl) draw(canvasEl);
		});
	});

	function startDrag(e: PointerEvent) {
		if (!canvasEl) return;
		e.preventDefault();
		const el = canvasEl;
		el.setPointerCapture(e.pointerId);
		const rect = el.getBoundingClientRect();
		const move = (ev: PointerEvent) => {
			pos = {
				x: Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)),
				y: Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height))
			};
		};
		move(e);
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
			<label class="field">
				<span>Text</span>
				<input type="text" bind:value={text} placeholder="Your text here" />
			</label>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="controls">
			<div class="quality">
				<label for="text-size">Size</label>
				<input id="text-size" type="range" min="2" max="30" bind:value={sizePct} />
				<output class="mono" for="text-size">{sizePct}%</output>
			</div>
			<div class="row" role="group" aria-label="Colour">
				<button class="chip" class:active={colorMode === 'white'} aria-pressed={colorMode === 'white'} onclick={() => (colorMode = 'white')}>White</button>
				<button class="chip" class:active={colorMode === 'black'} aria-pressed={colorMode === 'black'} onclick={() => (colorMode = 'black')}>Black</button>
				<button class="chip" class:active={colorMode === 'custom'} aria-pressed={colorMode === 'custom'} onclick={() => (colorMode = 'custom')}>Colour</button>
				{#if colorMode === 'custom'}
					<input type="color" bind:value={customColor} aria-label="Text colour" />
				{/if}
			</div>
			<label class="check">
				<input type="checkbox" bind:checked={outline} />
				Outline
			</label>
			<label class="check">
				<input type="checkbox" bind:checked={bold} />
				Bold
			</label>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas
					bind:this={canvasEl}
					onpointerdown={startDrag}
					aria-label="Image preview. Drag to move the text."
				></canvas>
			</div>
		</div>

		<p class="hint">Drag on the image to move the text.</p>

		<ExportBar render={renderResult} {baseName} suffix="-text" />
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
		align-items: end;
		gap: 0.6rem 1rem;
	}

	.field {
		flex: 1;
		max-width: 22rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.field input {
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--ink);
	}

	.toolbar > .btn-ghost {
		margin-left: auto;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 1.5rem;
	}

	.controls .quality {
		flex: 1;
		min-width: 12rem;
		max-width: 18rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
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

	input[type='color'] {
		width: 2.2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
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
		cursor: grab;
		touch-action: none;
	}

	canvas:active {
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
