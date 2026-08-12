<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { invertPixels } from '$lib/tools/invert';
	import { readImageFile } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let showOriginal = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let inverted: Uint8ClampedArray<ArrayBuffer> | null = null;

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			inverted = null;
			showOriginal = false;
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function invertedData(): Uint8ClampedArray<ArrayBuffer> {
		if (!img) throw new Error('No image loaded');
		if (!inverted) inverted = invertPixels(img.data);
		return inverted;
	}

	$effect(() => {
		if (!img || !canvasEl) return;
		void showOriginal;
		canvasEl.width = img.width;
		canvasEl.height = img.height;
		const data = showOriginal ? img.data : invertedData();
		canvasEl.getContext('2d')?.putImageData(new ImageData(data, img.width, img.height), 0, 0);
	});

	function renderResult(): RawImage {
		if (!img) throw new Error('No image loaded');
		return { width: img.width, height: img.height, data: invertedData() };
	}

	function startOver() {
		img = null;
		inverted = null;
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
			<div class="toolbar-group" role="group" aria-label="View">
				<button
					class="chip"
					class:active={!showOriginal}
					aria-pressed={!showOriginal}
					onclick={() => (showOriginal = false)}
				>
					Inverted
				</button>
				<button
					class="chip"
					class:active={showOriginal}
					aria-pressed={showOriginal}
					onclick={() => (showOriginal = true)}
				>
					Original
				</button>
			</div>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="stage">
			<div class="canvas-wrap checker" class:small={img.width < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			{showOriginal ? 'This is your original.' : 'Every colour is flipped to its opposite.'}
			The download is always the inverted version.
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-inverted" />
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

	.hint {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
