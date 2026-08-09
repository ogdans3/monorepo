<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { readImageFile } from './load';
	import {
		applyAspect,
		fullRect,
		moveRect,
		resizeRect,
		setSize,
		type Handle,
		type Rect
	} from '$lib/tools/cropmath';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	const ASPECTS: { label: string; value: number | null }[] = [
		{ label: 'Free', value: null },
		{ label: '1:1', value: 1 },
		{ label: '4:3', value: 4 / 3 },
		{ label: '3:2', value: 3 / 2 },
		{ label: '16:9', value: 16 / 9 },
		{ label: '9:16', value: 9 / 16 }
	];

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let crop = $state<Rect>({ x: 0, y: 0, w: 0, h: 0 });
	let aspect = $state<number | null>(null);
	let scale = $state(1); // displayed px per image px
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			crop = fullRect(raw.width, raw.height, aspect);
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	// paint the image and keep the display scale in sync with the layout
	$effect(() => {
		if (!img || !canvasEl) return;
		canvasEl.width = img.width;
		canvasEl.height = img.height;
		canvasEl.getContext('2d')?.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
		const measure = () => {
			if (canvasEl && img) scale = canvasEl.getBoundingClientRect().width / img.width;
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(canvasEl);
		return () => ro.disconnect();
	});

	function startDrag(e: PointerEvent, handle: Handle | 'move') {
		if (!img) return;
		e.preventDefault();
		e.stopPropagation();
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
		const startX = e.clientX;
		const startY = e.clientY;
		const start = { ...crop };
		const iw = img.width;
		const ih = img.height;

		const onMove = (ev: PointerEvent) => {
			const dx = (ev.clientX - startX) / scale;
			const dy = (ev.clientY - startY) / scale;
			crop =
				handle === 'move'
					? moveRect(start, dx, dy, iw, ih)
					: resizeRect(start, handle, dx, dy, iw, ih, aspect);
		};
		const onUp = () => {
			target.removeEventListener('pointermove', onMove);
			target.removeEventListener('pointerup', onUp);
			target.removeEventListener('pointercancel', onUp);
		};
		target.addEventListener('pointermove', onMove);
		target.addEventListener('pointerup', onUp);
		target.addEventListener('pointercancel', onUp);
	}

	function onFrameKey(e: KeyboardEvent) {
		if (!img) return;
		const step = e.shiftKey ? 10 : 1;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		const move = moves[e.key];
		if (!move) return;
		e.preventDefault();
		crop = moveRect(crop, move[0], move[1], img.width, img.height);
	}

	function pickAspect(value: number | null) {
		aspect = value;
		if (img) crop = applyAspect(crop, value, img.width, img.height);
	}

	function typedSize(which: 'w' | 'h', value: number) {
		if (!img) return;
		const w = which === 'w' ? value : crop.w;
		const h = which === 'h' ? value : crop.h;
		crop = setSize(crop, w, h, img.width, img.height, aspect);
	}

	function renderCrop(): RawImage {
		if (!img) throw new Error('No image loaded');
		const out = document.createElement('canvas');
		out.width = crop.w;
		out.height = crop.h;
		const ctx = out.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		ctx.putImageData(
			new ImageData(img.data, img.width, img.height),
			-crop.x,
			-crop.y,
			crop.x,
			crop.y,
			crop.w,
			crop.h
		);
		const sliced = ctx.getImageData(0, 0, crop.w, crop.h);
		return { width: crop.w, height: crop.h, data: sliced.data };
	}

	function startOver() {
		img = null;
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
			<div class="toolbar-group" role="group" aria-label="Aspect ratio">
				{#each ASPECTS as a (a.label)}
					<button
						class="chip"
						class:active={aspect === a.value}
						aria-pressed={aspect === a.value}
						onclick={() => pickAspect(a.value)}
					>
						{a.label}
					</button>
				{/each}
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={() => img && (crop = fullRect(img.width, img.height, aspect))}>
					Reset
				</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="stage">
			<div class="canvas-wrap" class:small={img.width < 320}>
				<canvas bind:this={canvasEl}></canvas>
				<!-- a draggable crop widget is inherently custom: it needs pointer and
				     keyboard handling on a focusable container, and its handles are
				     buttons, so it cannot itself be a button -->
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="crop-frame"
					role="application"
					aria-label="Crop area. Drag to move, use the handles to resize, arrow keys to nudge."
					tabindex="0"
					style:left="{crop.x * scale}px"
					style:top="{crop.y * scale}px"
					style:width="{crop.w * scale}px"
					style:height="{crop.h * scale}px"
					onpointerdown={(e) => startDrag(e, 'move')}
					onkeydown={onFrameKey}
				>
					<div class="thirds" aria-hidden="true"></div>
					{#each ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const as h (h)}
						<button
							class="handle handle-{h}"
							aria-label="Resize from {h}"
							onpointerdown={(e) => startDrag(e, h)}
						></button>
					{/each}
				</div>
			</div>
		</div>

		<div class="size-row">
			<label class="size-field">
				<span>Width</span>
				<input
					type="number"
					min="8"
					max={img.width}
					value={crop.w}
					onchange={(e) => typedSize('w', +e.currentTarget.value)}
				/>
			</label>
			<span class="size-x mono">×</span>
			<label class="size-field">
				<span>Height</span>
				<input
					type="number"
					min="8"
					max={img.height}
					value={crop.h}
					onchange={(e) => typedSize('h', +e.currentTarget.value)}
				/>
			</label>
			<span class="size-meta mono">from {img.width} × {img.height} px</span>
		</div>

		<ExportBar render={renderCrop} {baseName} suffix="-cropped" />
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

	.stage {
		display: flex;
		justify-content: center;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		padding: 1rem;
	}

	.canvas-wrap {
		position: relative;
		line-height: 0;
		/* the frame dims its surroundings with a huge box-shadow. clip it here
		   so the dimming covers the image, not the whole page */
		overflow: hidden;
	}

	canvas {
		display: block;
		max-width: 100%;
		max-height: 62vh;
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

	.crop-frame {
		position: absolute;
		border: 1.5px solid #fff;
		outline: 1px solid oklch(0.24 0.015 110 / 0.6);
		box-shadow: 0 0 0 9999px oklch(0.24 0.015 110 / 0.45);
		cursor: move;
		touch-action: none;
		padding: 0;
		background: none;
	}

	.crop-frame:focus-visible {
		outline: 2px solid var(--primary);
	}

	.thirds {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(to right, transparent calc(33.33% - 0.5px), oklch(1 0 0 / 0.55) 33.33%, transparent calc(33.33% + 0.5px)),
			linear-gradient(to right, transparent calc(66.66% - 0.5px), oklch(1 0 0 / 0.55) 66.66%, transparent calc(66.66% + 0.5px)),
			linear-gradient(to bottom, transparent calc(33.33% - 0.5px), oklch(1 0 0 / 0.55) 33.33%, transparent calc(33.33% + 0.5px)),
			linear-gradient(to bottom, transparent calc(66.66% - 0.5px), oklch(1 0 0 / 0.55) 66.66%, transparent calc(66.66% + 0.5px));
		pointer-events: none;
	}

	.handle {
		position: absolute;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		background: none;
		touch-action: none;
	}

	.handle::after {
		content: '';
		position: absolute;
		inset: 5px;
		background: #fff;
		border: 1px solid oklch(0.24 0.015 110 / 0.6);
		border-radius: 2px;
	}

	.handle-nw { left: -11px; top: -11px; cursor: nwse-resize; }
	.handle-n  { left: calc(50% - 11px); top: -11px; cursor: ns-resize; }
	.handle-ne { right: -11px; top: -11px; cursor: nesw-resize; }
	.handle-e  { right: -11px; top: calc(50% - 11px); cursor: ew-resize; }
	.handle-se { right: -11px; bottom: -11px; cursor: nwse-resize; }
	.handle-s  { left: calc(50% - 11px); bottom: -11px; cursor: ns-resize; }
	.handle-sw { left: -11px; bottom: -11px; cursor: nesw-resize; }
	.handle-w  { left: -11px; top: calc(50% - 11px); cursor: ew-resize; }

	.size-row {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.6rem;
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

	.size-x {
		color: var(--muted);
		padding-bottom: 0.45rem;
	}

	.size-meta {
		margin-left: auto;
		color: var(--muted);
		font-size: 0.8125rem;
		padding-bottom: 0.45rem;
	}
</style>
