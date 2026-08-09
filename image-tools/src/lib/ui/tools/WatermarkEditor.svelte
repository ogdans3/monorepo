<script lang="ts">
	import { acceptAttribute, type RawImage } from '$lib/engine';
	import { anchorPoint, ANCHORS, type AnchorPosition } from '$lib/tools/watermark';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let mode = $state<'text' | 'logo'>('text');
	let text = $state('© your name');
	let logo = $state<{ canvas: HTMLCanvasElement; w: number; h: number } | null>(null);
	let sizePct = $state(5);
	let opacity = $state(40);
	let colorMode = $state<'white' | 'black' | 'custom'>('white');
	let customColor = $state('#d33682');
	let position = $state<AnchorPosition>('br');
	let tiled = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let logoInput = $state<HTMLInputElement>();
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
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	async function onLogoPicked() {
		const file = logoInput?.files?.[0];
		if (logoInput) logoInput.value = '';
		if (!file) return;
		try {
			const { raw } = await readImageFile(file);
			logo = { canvas: rawToCanvas(raw), w: raw.width, h: raw.height };
			mode = 'logo';
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that logo';
		}
	}

	interface Mark {
		w: number;
		h: number;
		paint: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
	}

	function buildMark(ctx: CanvasRenderingContext2D, W: number): Mark | null {
		if (mode === 'logo') {
			if (!logo) return null;
			const w = Math.max(8, (W * sizePct * 2) / 100);
			const h = (w * logo.h) / logo.w;
			return { w, h, paint: (c, x, y) => c.drawImage(logo!.canvas, x, y, w, h) };
		}
		const label = text.trim();
		if (!label) return null;
		const fontPx = Math.max(8, (W * sizePct) / 100);
		ctx.font = `600 ${fontPx}px ${getComputedStyle(document.body).fontFamily}`;
		const w = ctx.measureText(label).width;
		return {
			w,
			h: fontPx,
			paint: (c, x, y) => {
				c.font = `600 ${fontPx}px ${getComputedStyle(document.body).fontFamily}`;
				c.fillStyle = color;
				c.textBaseline = 'top';
				c.fillText(label, x, y);
			}
		};
	}

	function draw(target: HTMLCanvasElement) {
		if (!img || !base) return;
		target.width = img.width;
		target.height = img.height;
		const ctx = target.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(base, 0, 0);
		const mark = buildMark(ctx, img.width);
		if (!mark) return;
		ctx.save();
		ctx.globalAlpha = opacity / 100;
		if (tiled) {
			const stepX = mark.w + img.width * 0.08;
			const stepY = mark.h + img.height * 0.1;
			let row = 0;
			for (let y = -mark.h; y < img.height + mark.h; y += stepY) {
				const offset = row % 2 === 1 ? stepX / 2 : 0;
				for (let x = -mark.w - offset; x < img.width + mark.w; x += stepX) {
					mark.paint(ctx, x + offset, y);
				}
				row++;
			}
		} else {
			const { x, y } = anchorPoint(position, img.width, img.height, mark.w, mark.h);
			mark.paint(ctx, x, y);
		}
		ctx.restore();
	}

	let drawQueued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void mode;
		void text;
		void logo;
		void sizePct;
		void opacity;
		void color;
		void position;
		void tiled;
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
			<div class="toolbar-group" role="group" aria-label="Watermark type">
				<button class="chip" class:active={mode === 'text'} aria-pressed={mode === 'text'} onclick={() => (mode = 'text')}>Text</button>
				<button class="chip" class:active={mode === 'logo'} aria-pressed={mode === 'logo'} onclick={() => (mode = 'logo')}>Logo</button>
			</div>
			{#if mode === 'text'}
				<input class="text-input mono" type="text" bind:value={text} aria-label="Watermark text" placeholder="© your name" />
				<div class="toolbar-group" role="group" aria-label="Colour">
					<button class="chip" class:active={colorMode === 'white'} aria-pressed={colorMode === 'white'} onclick={() => (colorMode = 'white')}>White</button>
					<button class="chip" class:active={colorMode === 'black'} aria-pressed={colorMode === 'black'} onclick={() => (colorMode = 'black')}>Black</button>
					<button class="chip" class:active={colorMode === 'custom'} aria-pressed={colorMode === 'custom'} onclick={() => (colorMode = 'custom')}>Colour</button>
					{#if colorMode === 'custom'}
						<input type="color" bind:value={customColor} aria-label="Watermark colour" />
					{/if}
				</div>
			{:else}
				<button class="btn-ghost" onclick={() => logoInput?.click()}>
					{logo ? 'Change logo' : 'Choose a logo'}
				</button>
				<input bind:this={logoInput} type="file" accept={acceptAttribute()} onchange={onLogoPicked} class="visually-hidden" />
			{/if}
			<button class="btn-ghost start-over" onclick={startOver}>Start over</button>
		</div>

		<div class="controls">
			<div class="quality">
				<label for="wm-size">Size</label>
				<input id="wm-size" type="range" min="2" max="15" bind:value={sizePct} />
				<output class="mono" for="wm-size">{sizePct}%</output>
			</div>
			<div class="quality">
				<label for="wm-opacity">Opacity</label>
				<input id="wm-opacity" type="range" min="5" max="100" bind:value={opacity} />
				<output class="mono" for="wm-opacity">{opacity}</output>
			</div>
			<div class="placement">
				<div class="anchor-grid" role="group" aria-label="Position">
					{#each ANCHORS as a (a.id)}
						<button
							class="anchor"
							class:active={position === a.id && !tiled}
							aria-pressed={position === a.id && !tiled}
							aria-label={a.label}
							disabled={tiled}
							onclick={() => (position = a.id)}
						></button>
					{/each}
				</div>
				<label class="tile">
					<input type="checkbox" bind:checked={tiled} />
					Tile across the image
				</label>
			</div>
		</div>

		{#if mode === 'logo' && !logo}
			<p class="hint" role="status">Pick a logo file to stamp onto the image.</p>
		{/if}

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<ExportBar render={renderResult} {baseName} suffix="-watermarked" />
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
		gap: 0.5rem 1rem;
	}

	.toolbar-group {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
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

	.text-input {
		flex: 1;
		min-width: 10rem;
		max-width: 18rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font-size: 0.875rem;
		color: var(--ink);
	}

	.start-over {
		margin-left: auto;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 2rem;
	}

	.controls .quality {
		flex: 1;
		min-width: 13rem;
		max-width: 20rem;
	}

	.placement {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.anchor-grid {
		display: grid;
		grid-template-columns: repeat(3, 16px);
		gap: 4px;
		padding: 6px;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--surface);
	}

	.anchor {
		width: 16px;
		height: 16px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 3px;
		background: #fff;
		cursor: pointer;
	}

	.anchor:hover:not(:disabled) {
		border-color: var(--muted);
	}

	.anchor.active {
		background: var(--primary);
		border-color: var(--primary);
	}

	.anchor:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.tile {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--muted);
		cursor: pointer;
	}

	.tile input {
		accent-color: var(--primary);
	}

	.hint {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
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
