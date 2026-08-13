<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	// canvas calls a plain fade "source-over", which is not a word anyone
	// searching for a blend mode would use, so the labels are ours
	const MODES = [
		{ id: 'normal', op: 'source-over' },
		{ id: 'multiply', op: 'multiply' },
		{ id: 'screen', op: 'screen' },
		{ id: 'overlay', op: 'overlay' },
		{ id: 'difference', op: 'difference' }
	] as const satisfies readonly { id: string; op: GlobalCompositeOperation }[];

	interface Layer {
		canvas: HTMLCanvasElement;
		w: number;
		h: number;
		name: string;
	}

	let base = $state<Layer | null>(null);
	let top = $state<Layer | null>(null);
	let mix = $state(50);
	let mode = $state<(typeof MODES)[number]['id']>('normal');
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let canvasEl = $state<HTMLCanvasElement>();

	async function onfiles(files: File[]) {
		loading = true;
		loadError = null;
		try {
			for (const file of files) {
				const { raw, name } = await readImageFile(file);
				const layer = { canvas: rawToCanvas(raw), w: raw.width, h: raw.height, name };
				if (!base) base = layer;
				else if (!top) top = layer;
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read a file';
		} finally {
			loading = false;
		}
	}

	function draw(target: HTMLCanvasElement) {
		if (!base) return;
		target.width = base.w;
		target.height = base.h;
		const ctx = target.getContext('2d');
		if (!ctx) return;
		ctx.clearRect(0, 0, base.w, base.h);
		ctx.drawImage(base.canvas, 0, 0);
		if (!top) return;
		// cover the base, so the result is never part empty
		const scale = Math.max(base.w / top.w, base.h / top.h);
		const w = top.w * scale;
		const h = top.h * scale;
		ctx.save();
		ctx.globalAlpha = mix / 100;
		ctx.globalCompositeOperation = MODES.find((m) => m.id === mode)?.op ?? 'source-over';
		ctx.drawImage(top.canvas, (base.w - w) / 2, (base.h - h) / 2, w, h);
		ctx.restore();
	}

	let queued = false;
	$effect(() => {
		if (!base || !canvasEl) return;
		void top;
		void mix;
		void mode;
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			if (canvasEl) draw(canvasEl);
		});
	});

	function renderResult(): RawImage {
		if (!base) throw new Error('No image loaded');
		const out = document.createElement('canvas');
		draw(out);
		const ctx = out.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		const data = ctx.getImageData(0, 0, out.width, out.height);
		return { width: out.width, height: out.height, data: data.data };
	}

	function swap() {
		if (!base || !top) return;
		[base, top] = [top, base];
	}

	function startOver() {
		base = null;
		top = null;
		loadError = null;
	}
</script>

{#if !base}
	<div class="editor-load">
		<Dropzone headline="Drop two images here" {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading images…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<div class="toolbar-group" role="group" aria-label="Blend mode">
				{#each MODES as m (m.id)}
					<button class="chip" class:active={mode === m.id} aria-pressed={mode === m.id} onclick={() => (mode = m.id)}>
						{m.id[0].toUpperCase() + m.id.slice(1)}
					</button>
				{/each}
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={swap} disabled={!top}>Swap</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="quality">
			<label for="blend-mix">Mix</label>
			<input id="blend-mix" type="range" min="0" max="100" bind:value={mix} disabled={!top} />
			<output class="mono" for="blend-mix">{mix}%</output>
		</div>

		<div class="stage">
			<div class="canvas-wrap checker" class:small={base.w < 320}>
				<canvas bind:this={canvasEl}></canvas>
			</div>
		</div>

		{#if !top}
			<div class="need-second">
				<p class="hint">Add a second image to blend with.</p>
				<Dropzone headline="Add the second image" multiple={false} {onfiles} />
			</div>
		{:else}
			<p class="hint mono">{base.name} + {top.name}</p>
		{/if}

		<ExportBar render={renderResult} baseName={base.name} suffix="-blended" />
	</div>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.editor-load,
	.need-second {
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
		justify-content: space-between;
		gap: 0.5rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
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
		max-height: 56vh;
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
