<script lang="ts">
	import { decodeToRaw, sniffFormat, type RawImage } from '$lib/engine';
	import { floodErase } from '$lib/tools/floodfill';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	interface EraseOp {
		x: number;
		y: number;
		tol: number;
	}

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let ops = $state<EraseOp[]>([]);
	let tolerance = $state(25);
	let erasedTotal = $state(0);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let current: ImageData | null = null; // working pixels, exported on download

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
			const format = sniffFormat(head, file.name);
			if (!format) throw new Error(`Could not read ${file.name} as an image`);
			const raw = await decodeToRaw(file, format);
			baseName = file.name;
			ops = [];
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	/** Replay every click against the untouched original. Undo stays exact. */
	function apply() {
		if (!img || !canvasEl) return;
		const work = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
		let erased = 0;
		for (const op of ops) {
			erased += floodErase(work.data, img.width, img.height, op.x, op.y, op.tol);
		}
		canvasEl.getContext('2d')?.putImageData(work, 0, 0);
		current = work;
		erasedTotal = erased;
	}

	$effect(() => {
		if (!img || !canvasEl) return;
		canvasEl.width = img.width;
		canvasEl.height = img.height;
		apply();
	});

	function onCanvasClick(e: MouseEvent) {
		if (!img || !canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const x = Math.min(
			img.width - 1,
			Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * img.width))
		);
		const y = Math.min(
			img.height - 1,
			Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * img.height))
		);
		ops.push({ x, y, tol: tolerance });
		apply();
	}

	// the slider retunes the most recent click, live
	let applyQueued = false;
	function onTolerance() {
		if (!ops.length) return;
		ops[ops.length - 1].tol = tolerance;
		if (applyQueued) return;
		applyQueued = true;
		requestAnimationFrame(() => {
			applyQueued = false;
			apply();
		});
	}

	function undo() {
		if (!ops.length) return;
		ops.pop();
		apply();
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
		if (!img || !current) throw new Error('No image loaded');
		return { width: img.width, height: img.height, data: current.data };
	}

	function startOver() {
		img = null;
		ops = [];
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
			<div class="quality tolerance">
				<label for="tolerance">Tolerance</label>
				<input
					id="tolerance"
					type="range"
					min="0"
					max="100"
					bind:value={tolerance}
					oninput={onTolerance}
				/>
				<output class="mono" for="tolerance">{tolerance}</output>
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={undo} disabled={!ops.length}>Undo</button>
				<button class="btn-ghost" onclick={() => ((ops = []), apply())} disabled={!ops.length}>
					Reset
				</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="stage">
			<div class="canvas-wrap checker" class:small={img.width < 320}>
				<canvas
					bind:this={canvasEl}
					onclick={onCanvasClick}
					aria-label="Image preview. Click a colour to make it transparent."
				></canvas>
			</div>
		</div>

		<p class="hint" role="status">
			{#if ops.length === 0}
				Click the colour you want gone. The tolerance slider decides how many similar shades go
				with it.
			{:else}
				{ops.length}
				{ops.length === 1 ? 'click' : 'clicks'}, {erasedTotal.toLocaleString('en')} pixels erased.
				Adjust the slider to retune your last click, or click another colour.
			{/if}
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-transparent" formats={['png', 'webp', 'jpg']} />
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
		gap: 0.5rem 1rem;
	}

	.tolerance {
		flex: 1;
		min-width: 14rem;
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
		border: 1px solid var(--line);
	}

	canvas {
		display: block;
		max-width: 100%;
		max-height: 62vh;
		cursor: crosshair;
	}

	/* small images blow up to a workable size, keeping their aspect.
	   the width sits on the wrap: a percentage on the canvas would resolve
	   against the shrink-wrapped parent and collapse right back. */
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
