<script lang="ts">
	import { FORMATS, editedFileName, encodeRaw, formatBytes, type FormatId, type RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas, steppedScale } from './load';
	import { downloadBlob } from '../download';
	import Dropzone from '../Dropzone.svelte';

	interface Result {
		blob: Blob;
		quality: number;
		width: number;
		height: number;
	}

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let originalBytes = $state(0);
	let targetValue = $state(500);
	let targetUnit = $state<'KB' | 'MB'>('KB');
	let formatId = $state<FormatId>('jpg');
	let allowDownscale = $state(true);
	let working = $state(false);
	let result = $state<Result | null>(null);
	let failure = $state<string | null>(null);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let base: HTMLCanvasElement | null = null;
	let canvasEl = $state<HTMLCanvasElement>();
	let runId = 0;

	const targetBytes = $derived(Math.max(1024, Math.round(targetValue * (targetUnit === 'MB' ? 1024 * 1024 : 1024))));

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			originalBytes = file.size;
			base = rawToCanvas(raw);
			result = null;
			failure = null;
			img = raw;
			void run();
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function rawAtScale(scale: number): RawImage {
		if (!img || !base) throw new Error('No image loaded');
		if (scale >= 1) return img;
		const w = Math.max(16, Math.round(img.width * scale));
		const h = Math.max(16, Math.round(img.height * scale));
		const canvas = steppedScale(base, w, h);
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		const data = ctx.getImageData(0, 0, w, h);
		return { width: w, height: h, data: data.data };
	}

	/** Highest quality that fits under the target, or null when even q=1 is too big. */
	async function searchQuality(raw: RawImage, limit: number): Promise<{ blob: Blob; quality: number } | null> {
		const format = FORMATS[formatId];
		let lo = 1;
		let hi = 100;
		let best: { blob: Blob; quality: number } | null = null;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			const blob = await encodeRaw(raw, format, { quality: mid });
			if (blob.size <= limit) {
				best = { blob, quality: mid };
				lo = mid + 1;
			} else {
				hi = mid - 1;
			}
		}
		return best;
	}

	async function run() {
		if (!img || !base) return;
		const id = ++runId;
		working = true;
		failure = null;
		try {
			let scale = 1;
			for (let round = 0; round < 8; round++) {
				const raw = rawAtScale(scale);
				const best = await searchQuality(raw, targetBytes);
				if (id !== runId) return; // superseded by newer settings
				if (best) {
					result = { blob: best.blob, quality: best.quality, width: raw.width, height: raw.height };
					drawPreview(raw);
					return;
				}
				if (!allowDownscale) {
					result = null;
					failure = `Even the lowest quality lands above ${formatBytes(targetBytes)} at this size. Allow downscaling or raise the target.`;
					return;
				}
				scale *= 0.7;
				if (Math.round(img.width * scale) < 16) break;
			}
			result = null;
			failure = 'Could not reach that target even with heavy downscaling. Raise the target a little.';
		} finally {
			if (id === runId) working = false;
		}
	}

	function drawPreview(raw: RawImage) {
		if (!canvasEl) return;
		canvasEl.width = raw.width;
		canvasEl.height = raw.height;
		canvasEl.getContext('2d')?.putImageData(new ImageData(raw.data, raw.width, raw.height), 0, 0);
	}

	let debounce: ReturnType<typeof setTimeout> | undefined;
	function settingsChanged() {
		clearTimeout(debounce);
		debounce = setTimeout(() => void run(), 250);
	}

	function download() {
		if (!result) return;
		downloadBlob(result.blob, editedFileName(baseName, '-compressed', FORMATS[formatId].extensions[0]));
	}

	function startOver() {
		runId++;
		img = null;
		base = null;
		result = null;
		failure = null;
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
			<div class="target">
				<label class="target-field">
					<span>Target size</span>
					<input
						type="number"
						min="1"
						max="999"
						value={targetValue}
						onchange={(e) => ((targetValue = Math.max(1, +e.currentTarget.value || 1)), settingsChanged())}
					/>
				</label>
				<div class="toolbar-group" role="group" aria-label="Unit">
					<button class="chip" class:active={targetUnit === 'KB'} aria-pressed={targetUnit === 'KB'} onclick={() => ((targetUnit = 'KB'), settingsChanged())}>KB</button>
					<button class="chip" class:active={targetUnit === 'MB'} aria-pressed={targetUnit === 'MB'} onclick={() => ((targetUnit = 'MB'), settingsChanged())}>MB</button>
				</div>
			</div>
			<div class="toolbar-group" role="group" aria-label="Format">
				{#each ['jpg', 'webp'] as const as id (id)}
					<button class="chip" class:active={formatId === id} aria-pressed={formatId === id} onclick={() => ((formatId = id), settingsChanged())}>
						{FORMATS[id].name}
					</button>
				{/each}
			</div>
			<label class="downscale">
				<input type="checkbox" bind:checked={allowDownscale} onchange={settingsChanged} />
				Allow downscaling
			</label>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={(result?.width ?? img.width) < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		<div class="result-bar">
			{#if working}
				<span class="spinner" role="status" aria-label="Compressing"></span>
				<span class="result-text">Searching for the best quality under {formatBytes(targetBytes)}…</span>
			{:else if result}
				<span class="result-text" role="status">
					<span class="mono">{formatBytes(originalBytes)}</span>
					<span class="arrow" aria-hidden="true">→</span>
					<span class="mono strong">{formatBytes(result.blob.size)}</span>
					<span class="mono dim">· quality {result.quality} · {result.width} × {result.height} px</span>
				</span>
				<button class="btn" onclick={download}>Download</button>
			{:else if failure}
				<span class="result-text error" role="alert">{failure}</span>
			{/if}
		</div>
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
		gap: 0.6rem 1.25rem;
	}

	.target {
		display: flex;
		align-items: end;
		gap: 0.5rem;
	}

	.target-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.target-field input {
		width: 5.5rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: 500 0.875rem var(--font-mono);
		color: var(--ink);
	}

	.toolbar-group {
		display: flex;
		gap: 0.4rem;
		padding-bottom: 0.15rem;
	}

	.downscale {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--muted);
		padding-bottom: 0.45rem;
		cursor: pointer;
	}

	.downscale input {
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

	.result-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
		min-height: 3.4rem;
	}

	.result-text {
		flex: 1;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.result-text .strong {
		color: var(--ink);
		font-weight: 600;
	}

	.result-text.error {
		color: var(--danger);
	}

	.dim {
		color: var(--muted);
	}

	.spinner {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--line);
		border-top-color: var(--primary);
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}
</style>
