<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let radiusPct = $state(12); // percent of half the shorter side
	let circle = $state(false);
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
			circle = false;
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function draw(target: HTMLCanvasElement) {
		if (!img || !base) return;
		// circle mode crops to a centred square first, which is what avatars want
		const size = Math.min(img.width, img.height);
		const w = circle ? size : img.width;
		const h = circle ? size : img.height;
		const sx = circle ? (img.width - size) / 2 : 0;
		const sy = circle ? (img.height - size) / 2 : 0;
		const radius = circle ? size / 2 : (Math.min(w, h) / 2) * (radiusPct / 100);

		target.width = w;
		target.height = h;
		const ctx = target.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, w, h);
		ctx.save();
		ctx.beginPath();
		ctx.roundRect(0, 0, w, h, radius);
		ctx.clip();
		ctx.drawImage(base, sx, sy, w, h, 0, 0, w, h);
		ctx.restore();
	}

	let drawQueued = false;
	$effect(() => {
		if (!img || !canvasEl) return;
		void radiusPct;
		void circle;
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
			<div class="quality radius" class:disabled={circle}>
				<label for="corner-radius">Radius</label>
				<input
					id="corner-radius"
					type="range"
					min="0"
					max="100"
					bind:value={radiusPct}
					disabled={circle}
				/>
				<output class="mono" for="corner-radius">{circle ? 'max' : `${radiusPct}%`}</output>
			</div>
			<label class="circle-toggle">
				<input type="checkbox" bind:checked={circle} />
				Circle
			</label>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="stage">
			<div class="canvas-wrap checker" class:small={(circle ? Math.min(img.width, img.height) : img.width) < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<ExportBar render={renderResult} {baseName} suffix="-rounded" formats={['png', 'webp', 'jpg']} />
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

	.radius {
		flex: 1;
		min-width: 14rem;
		max-width: 24rem;
	}

	.radius.disabled {
		opacity: 0.55;
	}

	.circle-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--muted);
		cursor: pointer;
	}

	.circle-toggle input {
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
