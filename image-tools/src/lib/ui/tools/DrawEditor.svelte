<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import {
		arrowHead,
		arrowLineEnd,
		clampToImage,
		dragBounds,
		isWorthKeeping,
		type Drawing,
		type DrawKind
	} from '$lib/tools/draw';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let { suffix }: { suffix: string } = $props();

	const KINDS: { id: DrawKind; label: string }[] = [
		{ id: 'rect', label: 'Box' },
		{ id: 'ellipse', label: 'Circle' },
		{ id: 'arrow', label: 'Arrow' },
		{ id: 'line', label: 'Line' }
	];

	/**
	 * Colours that survive being drawn on a photograph. Red first because that
	 * is what people reach for when they are pointing at something, and white
	 * and black last because they are what works when the picture is busy.
	 */
	const SWATCHES = ['#e5342a', '#f5a623', '#f5e04a', '#3aa757', '#2f7dd1', '#ffffff', '#111111'];

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let drawings = $state<Drawing[]>([]);
	let pending = $state<Drawing | null>(null);
	let kind = $state<DrawKind>('arrow');
	let colour = $state(SWATCHES[0]);
	let width = $state(6);
	let filled = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const closed = $derived(kind === 'rect' || kind === 'ellipse');
	/**
	 * Stroke width in image pixels, so a 4000px photo gets a mark you can see
	 * and a 200px thumbnail does not get one that covers it. The slider is a
	 * percentage of the smaller side.
	 */
	const strokeFor = (image: RawImage, thickness: number) =>
		Math.max(1, (Math.min(image.width, image.height) * thickness) / 400);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readImageFile(file);
			baseName = loaded.name;
			base = rawToCanvas(loaded.raw);
			drawings = [];
			pending = null;
			img = loaded.raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function stroke(ctx: CanvasRenderingContext2D, d: Drawing, image: RawImage) {
		// Each mark keeps the thickness it was drawn at, so moving the slider
		// afterwards does not resize the ones already on the picture.
		const line = strokeFor(image, d.width);
		ctx.lineWidth = line;
		ctx.strokeStyle = d.colour;
		ctx.fillStyle = d.colour;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		return line;
	}

	function paint(ctx: CanvasRenderingContext2D, d: Drawing, image: RawImage) {
		const line = stroke(ctx, d, image);
		if (d.kind === 'rect' || d.kind === 'ellipse') {
			const { x, y, w, h } = dragBounds(d);
			ctx.beginPath();
			if (d.kind === 'rect') ctx.rect(x, y, w, h);
			else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
			if (d.filled) ctx.fill();
			else ctx.stroke();
			return;
		}

		const from = { x: d.x0, y: d.y0 };
		const to = { x: d.x1, y: d.y1 };
		const end = d.kind === 'arrow' ? arrowLineEnd(from, to, line) : to;
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();

		if (d.kind === 'arrow') {
			const [a, b] = arrowHead(from, to, line);
			ctx.beginPath();
			ctx.moveTo(to.x, to.y);
			ctx.lineTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.closePath();
			ctx.fill();
		}
	}

	function composite(ctx: CanvasRenderingContext2D, all: Drawing[], image: RawImage) {
		if (!base) return;
		ctx.drawImage(base, 0, 0);
		for (const d of all) paint(ctx, d, image);
	}

	function render() {
		if (!img || !canvasEl || !base) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;
		// The shape being dragged is painted for real rather than as a rubber
		// band, because what it will look like is the thing you are deciding.
		composite(ctx, pending ? [...drawings, pending] : drawings, img);
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

	$effect(() => {
		if (!img || !canvasEl) return;
		canvasEl.width = img.width;
		canvasEl.height = img.height;
		scheduleRender();
	});

	function startDraw(e: PointerEvent) {
		if (!img || !canvasEl) return;
		e.preventDefault();
		const el = canvasEl;
		const image = img;
		const rect = el.getBoundingClientRect();
		const at = (ev: PointerEvent) => ({
			x: ((ev.clientX - rect.left) / rect.width) * image.width,
			y: ((ev.clientY - rect.top) / rect.height) * image.height
		});
		const start = at(e);
		el.setPointerCapture(e.pointerId);

		const shape = (ev: PointerEvent): Drawing => {
			const now = at(ev);
			return clampToImage(
				{
					kind,
					x0: start.x,
					y0: start.y,
					x1: now.x,
					y1: now.y,
					colour,
					width,
					filled: filled && closed
				},
				image.width,
				image.height
			);
		};

		const onMove = (ev: PointerEvent) => {
			pending = shape(ev);
			scheduleRender();
		};
		const onUp = (ev: PointerEvent) => {
			const drawn = shape(ev);
			if (isWorthKeeping(drawn)) drawings.push(drawn);
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
		if (!drawings.length) return;
		drawings.pop();
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
		composite(ctx, drawings, img);
		const data = ctx.getImageData(0, 0, img.width, img.height);
		return { width: img.width, height: img.height, data: data.data };
	}

	function startOver() {
		img = null;
		base = null;
		drawings = [];
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
				{#each KINDS as k (k.id)}
					<button
						class="chip"
						class:active={kind === k.id}
						aria-pressed={kind === k.id}
						onclick={() => (kind = k.id)}
					>
						{k.label}
					</button>
				{/each}
				{#if closed}
					<button
						class="chip"
						class:active={filled}
						aria-pressed={filled}
						onclick={() => (filled = !filled)}
					>
						Filled
					</button>
				{/if}
			</div>

			<div class="toolbar-group">
				<button class="btn-ghost" onclick={undo} disabled={!drawings.length}>Undo</button>
				<button
					class="btn-ghost"
					onclick={() => ((drawings = []), scheduleRender())}
					disabled={!drawings.length}>Reset</button
				>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="colours" role="group" aria-label="Colour">
			{#each SWATCHES as swatch (swatch)}
				<button
					class="swatch"
					class:active={colour === swatch}
					style:background={swatch}
					aria-label="Draw in {swatch}"
					aria-pressed={colour === swatch}
					onclick={() => (colour = swatch)}
				></button>
			{/each}
			<input type="color" bind:value={colour} aria-label="Any other colour" />
			<div class="quality">
				<label for="draw-width">Thickness</label>
				<input id="draw-width" type="range" min="1" max="30" bind:value={width} />
				<output class="mono" for="draw-width">{width}</output>
			</div>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas
					bind:this={canvasEl}
					onpointerdown={startDraw}
					aria-label="Image preview. Drag to draw the shape you picked."
				></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			{#if drawings.length === 0}
				Drag on the image to draw. An arrow points the way you drag it.
			{:else}
				{drawings.length}
				{drawings.length === 1 ? 'mark' : 'marks'} drawn. Drag to add another, or undo the last.
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
		justify-content: space-between;
		gap: 0.5rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.colours {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	/*
	 * The drawing colour is content, not chrome, so it is shown as itself
	 * rather than through the site's one accent. The ring is what marks the
	 * chosen one, since a swatch cannot change colour to show it is selected.
	 */
	.swatch {
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 99px;
		cursor: pointer;
		transition: box-shadow 150ms var(--ease);
	}

	.swatch.active {
		box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--ink);
	}

	.swatch:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 3px;
	}

	.colours input[type='color'] {
		width: 2.2rem;
		height: 26px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
	}

	.colours .quality {
		margin-left: auto;
		max-width: 15rem;
	}

	.stage {
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		padding: 1rem;
		background: var(--surface);
	}

	.canvas-wrap {
		line-height: 0;
	}

	.canvas-wrap.small {
		max-width: 320px;
		margin: 0 auto;
	}

	canvas {
		display: block;
		width: 100%;
		touch-action: none;
		cursor: crosshair;
	}

	.hint {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
