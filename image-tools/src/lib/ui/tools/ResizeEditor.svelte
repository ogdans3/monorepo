<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { lockedDims } from '$lib/tools/transforms';
	import { readImageFile, rawToCanvas, steppedScale } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let w = $state(0);
	let h = $state(0);
	let lock = $state(true);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const pct = $derived(img ? Math.round((w / img.width) * 100) : 100);
	const upscaling = $derived(img ? w > img.width || h > img.height : false);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readImageFile(file);
			baseName = loaded.name;
			base = rawToCanvas(loaded.raw);
			w = loaded.raw.width;
			h = loaded.raw.height;
			img = loaded.raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	const clampPx = (v: number) => Math.min(10000, Math.max(1, Math.round(v) || 1));

	function setWidth(value: number) {
		if (!img) return;
		if (lock) ({ w, h } = lockedDims(img.width, img.height, { w: value }));
		else w = clampPx(value);
	}

	function setHeight(value: number) {
		if (!img) return;
		if (lock) ({ w, h } = lockedDims(img.width, img.height, { h: value }));
		else h = clampPx(value);
	}

	function setPercent(p: number) {
		if (!img) return;
		w = clampPx((img.width * p) / 100);
		h = clampPx((img.height * p) / 100);
	}

	function steppedResize(tw: number, th: number): HTMLCanvasElement {
		if (!base) throw new Error('No image loaded');
		return steppedScale(base, tw, th);
	}

	// live preview at the target size
	$effect(() => {
		if (!img || !canvasEl || w < 1 || h < 1) return;
		const resized = steppedResize(w, h);
		canvasEl.width = resized.width;
		canvasEl.height = resized.height;
		canvasEl.getContext('2d')?.drawImage(resized, 0, 0);
	});

	function renderResult(): RawImage {
		const out = steppedResize(w, h);
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
			<div class="size-fields">
				<label class="size-field">
					<span>Width</span>
					<input
						type="number"
						min="1"
						max="10000"
						value={w}
						onchange={(e) => setWidth(+e.currentTarget.value)}
					/>
				</label>
				<span class="mono dim">×</span>
				<label class="size-field">
					<span>Height</span>
					<input
						type="number"
						min="1"
						max="10000"
						value={h}
						onchange={(e) => setHeight(+e.currentTarget.value)}
					/>
				</label>
				<label class="lock">
					<input type="checkbox" bind:checked={lock} />
					Lock aspect ratio
				</label>
			</div>
			<div class="toolbar-group" role="group" aria-label="Scale to percentage">
				{#each [25, 50, 75, 100] as p (p)}
					<button class="chip" class:active={pct === p && lock} onclick={() => setPercent(p)}>
						{p}%
					</button>
				{/each}
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={w < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			<span class="mono">{img.width} × {img.height}</span>
			<span class="arrow" aria-hidden="true">→</span>
			<span class="mono">{w} × {h} px</span>
			<span class="mono dim">({pct}%)</span>
			{#if upscaling}· Upscaling can't add detail, expect some softness.{/if}
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-resized" />
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
		align-items: end;
		gap: 0.75rem 1.25rem;
	}

	.size-fields {
		display: flex;
		align-items: end;
		gap: 0.5rem;
	}

	.size-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.size-field input {
		width: 6.5rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: 500 0.875rem var(--font-mono);
		color: var(--ink);
	}

	.lock {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--muted);
		padding-bottom: 0.45rem;
		cursor: pointer;
	}

	.lock input {
		accent-color: var(--primary);
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.toolbar-group:last-child {
		margin-left: auto;
	}

	.dim {
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

	.hint {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.hint .mono {
		color: var(--ink);
	}
</style>
