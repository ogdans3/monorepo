<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let flipH = $state(true); // mirroring is what people come for, start there
	let flipV = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const untouched = $derived(!flipH && !flipV);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			base = rawToCanvas(raw);
			flipH = true;
			flipV = false;
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
		ctx.save();
		ctx.translate(img.width / 2, img.height / 2);
		ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
		ctx.drawImage(base, -img.width / 2, -img.height / 2);
		ctx.restore();
	}

	$effect(() => {
		if (!img || !canvasEl) return;
		void flipH;
		void flipV;
		draw(canvasEl);
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
			<div class="toolbar-group" role="group" aria-label="Mirror and flip">
				<button
					class="chip"
					class:active={flipH}
					aria-pressed={flipH}
					onclick={() => (flipH = !flipH)}
				>
					Mirror left-right
				</button>
				<button
					class="chip"
					class:active={flipV}
					aria-pressed={flipV}
					onclick={() => (flipV = !flipV)}
				>
					Flip upside down
				</button>
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={() => ((flipH = false), (flipV = false))} disabled={untouched}>
					Show original
				</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			{#if untouched}
				This is your original. Turn on a button above to mirror or flip it.
			{:else if flipH && flipV}
				Mirrored left to right and flipped upside down.
			{:else if flipH}
				Mirrored left to right, like looking in a mirror.
			{:else}
				Flipped upside down.
			{/if}
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-flipped" />
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
		align-items: center;
		gap: 0.5rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
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

	.hint {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
