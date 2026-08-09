<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { extractPalette, hslString, rgbString, rgbToHex, type PickedColor } from '$lib/tools/color';
	import { readImageFile, rawToCanvas, steppedScale } from './load';
	import Dropzone from '../Dropzone.svelte';

	interface Pick {
		color: PickedColor;
		hex: string;
	}

	let img = $state<RawImage | null>(null);
	let palette = $state<PickedColor[]>([]);
	let picks = $state<Pick[]>([]);
	let copied = $state<string | null>(null);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const current = $derived(picks[0] ?? null);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw } = await readImageFile(file);
			base = rawToCanvas(raw);
			picks = [];
			// palette from a downscaled copy, plenty for dominant colours
			const small = steppedScale(base, Math.min(200, raw.width), Math.min(200, raw.height));
			const smallData = small.getContext('2d')?.getImageData(0, 0, small.width, small.height);
			palette = smallData ? await extractPalette(smallData.data, 6) : [];
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!img || !canvasEl || !base) return;
		canvasEl.width = img.width;
		canvasEl.height = img.height;
		canvasEl.getContext('2d')?.drawImage(base, 0, 0);
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
		const i = (y * img.width + x) * 4;
		const color = { r: img.data[i], g: img.data[i + 1], b: img.data[i + 2] };
		picks = [{ color, hex: rgbToHex(color) }, ...picks].slice(0, 8);
	}

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		copied = text;
		setTimeout(() => (copied = null), 1400);
	}

	function startOver() {
		img = null;
		base = null;
		picks = [];
		palette = [];
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
			<p class="hint">Click anywhere in the image to sample a colour.</p>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas
					bind:this={canvasEl}
					onclick={onCanvasClick}
					aria-label="Image preview. Click to sample a colour."
				></canvas>
			</div>
		</div>

		{#if current}
			<div class="picked">
				<span class="swatch big" style:background={current.hex}></span>
				<div class="values">
					{#each [current.hex, rgbString(current.color), hslString(current.color)] as value (value)}
						<button class="value mono" onclick={() => copy(value)} title="Copy">
							{value}
							<span class="copy-state">{copied === value ? 'copied' : 'copy'}</span>
						</button>
					{/each}
				</div>
			</div>
			{#if picks.length > 1}
				<div class="history" aria-label="Earlier picks">
					{#each picks.slice(1) as pick, i (i)}
						<button
							class="swatch"
							style:background={pick.hex}
							title={pick.hex}
							aria-label="Copy {pick.hex}"
							onclick={() => copy(pick.hex)}
						></button>
					{/each}
				</div>
			{/if}
		{/if}

		{#if palette.length}
			<div class="block">
				<span class="block-title">Dominant palette</span>
				<div class="palette">
					{#each palette as color (rgbToHex(color))}
						{@const hex = rgbToHex(color)}
						<button class="palette-chip" onclick={() => copy(hex)} title="Copy {hex}">
							<span class="swatch" style:background={hex}></span>
							<span class="mono">{copied === hex ? 'copied' : hex}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
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
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
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
		max-height: 55vh;
		cursor: crosshair;
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

	.picked {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
	}

	.swatch {
		width: 26px;
		height: 26px;
		border-radius: var(--r-s);
		border: 1px solid var(--line);
		padding: 0;
		cursor: pointer;
	}

	.swatch.big {
		width: 46px;
		height: 46px;
		flex: none;
		cursor: default;
	}

	.values {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
	}

	.value {
		display: inline-flex;
		align-items: baseline;
		gap: 0.45rem;
		border: 0;
		background: none;
		padding: 0.1rem 0;
		font-size: 0.875rem;
		color: var(--ink);
		cursor: pointer;
	}

	.copy-state {
		font-size: 0.6875rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.value:hover .copy-state {
		color: var(--primary);
	}

	.history {
		display: flex;
		gap: 0.35rem;
	}

	.block {
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
	}

	.block-title {
		display: block;
		font-weight: 650;
		font-size: 0.9375rem;
		margin-bottom: 0.6rem;
	}

	.palette {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
	}

	.palette-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		border: 0;
		background: none;
		padding: 0;
		font-size: 0.8125rem;
		color: var(--ink);
		cursor: pointer;
	}

	.palette-chip:hover {
		color: var(--primary);
	}
</style>
