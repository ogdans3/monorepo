<script lang="ts">
	import { acceptAttribute, decodeToRaw, sniffFormat, type RawImage } from '$lib/engine';
	import {
		cellAt,
		cellRects,
		coverSource,
		evenSplits,
		moveDivider,
		type CombineLayout
	} from '$lib/tools/layout';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	interface Slot {
		id: number;
		name: string;
		source: HTMLCanvasElement;
		w: number;
		h: number;
		pan: { x: number; y: number };
	}

	const LAYOUTS: { id: CombineLayout; label: string }[] = [
		{ id: 'horizontal', label: 'Side by side' },
		{ id: 'vertical', label: 'Stacked' },
		{ id: 'grid', label: 'Grid' }
	];

	let nextId = 1;
	let slots = $state<Slot[]>([]);
	let layout = $state<CombineLayout>('horizontal');
	let splits = $state<number[]>([]);
	let gridSplits = $state<[number, number]>([0.5, 0.5]);
	let gap = $state(0);
	let bgMode = $state<'white' | 'transparent' | 'custom'>('white');
	let bgColor = $state('#ffffff');
	let outW = $state(2000);
	let outH = $state(1400);
	let sizeTouched = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let wrapEl = $state<HTMLDivElement>();
	let wrapWidth = $state(0);
	let addInput = $state<HTMLInputElement>();

	const rects = $derived(
		cellRects(layout, slots.length, splits, gridSplits, outW, outH, gap)
	);
	const displayScale = $derived(wrapWidth > 0 && outW > 0 ? wrapWidth / outW : 0);

	function rawToCanvas(raw: RawImage): HTMLCanvasElement {
		const c = document.createElement('canvas');
		c.width = raw.width;
		c.height = raw.height;
		c.getContext('2d')?.putImageData(new ImageData(raw.data, raw.width, raw.height), 0, 0);
		return c;
	}

	async function onfiles(files: File[]) {
		loading = true;
		loadError = null;
		try {
			for (const file of files) {
				const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
				const format = sniffFormat(head, file.name);
				if (!format) throw new Error(`Could not read ${file.name} as an image`);
				const raw = await decodeToRaw(file, format);
				slots.push({
					id: nextId++,
					name: file.name,
					source: rawToCanvas(raw),
					w: raw.width,
					h: raw.height,
					pan: { x: 0.5, y: 0.5 }
				});
			}
			slots = slots.slice(0, 8); // enough for any sane collage
			afterSlotsChanged();
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read a file';
		} finally {
			loading = false;
		}
	}

	function afterSlotsChanged() {
		if (layout === 'grid' && slots.length !== 4) layout = slots.length > 2 ? 'vertical' : 'horizontal';
		splits = evenSplits(slots.length);
		if (!sizeTouched) autoSize();
	}

	/** A default output size where evenly split cells match the images' shapes. */
	function autoSize() {
		if (!slots.length) return;
		if (layout === 'horizontal') {
			const sumAspect = slots.reduce((s, i) => s + i.w / i.h, 0);
			outH = clampSize(Math.round(outW / sumAspect));
		} else if (layout === 'vertical') {
			const sumInvAspect = slots.reduce((s, i) => s + i.h / i.w, 0);
			outH = clampSize(Math.round(outW * sumInvAspect));
		} else {
			outH = clampSize(Math.round(outW * 0.75));
		}
	}

	const clampSize = (v: number) => Math.min(8000, Math.max(16, v || 16));

	function pickLayout(id: CombineLayout) {
		layout = id;
		splits = evenSplits(slots.length);
		gridSplits = [0.5, 0.5];
		if (!sizeTouched) autoSize();
	}

	function swap(i: number, j: number) {
		if (j < 0 || j >= slots.length) return;
		[slots[i], slots[j]] = [slots[j], slots[i]];
	}

	function removeSlot(i: number) {
		slots.splice(i, 1);
		afterSlotsChanged();
	}

	function draw(ctx: CanvasRenderingContext2D, scale: number) {
		const w = Math.round(outW * scale);
		const h = Math.round(outH * scale);
		ctx.clearRect(0, 0, w, h);
		if (bgMode !== 'transparent') {
			ctx.fillStyle = bgMode === 'white' ? '#ffffff' : bgColor;
			ctx.fillRect(0, 0, w, h);
		}
		for (let i = 0; i < slots.length && i < rects.length; i++) {
			const slot = slots[i];
			const r = rects[i];
			const cover = coverSource(slot.w, slot.h, r.w, r.h, slot.pan.x, slot.pan.y);
			ctx.drawImage(
				slot.source,
				cover.sx,
				cover.sy,
				cover.sw,
				cover.sh,
				r.x * scale,
				r.y * scale,
				r.w * scale,
				r.h * scale
			);
		}
	}

	// redraw the preview whenever anything it depends on changes
	$effect(() => {
		if (!canvasEl || !slots.length || displayScale <= 0) return;
		canvasEl.width = Math.round(outW * displayScale);
		canvasEl.height = Math.round(outH * displayScale);
		const ctx = canvasEl.getContext('2d');
		if (ctx) draw(ctx, displayScale);
	});

	function startDividerDrag(e: PointerEvent, kind: 'split' | 'grid-v' | 'grid-h', index: number) {
		if (!wrapEl) return;
		e.preventDefault();
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
		const rect = wrapEl.getBoundingClientRect();

		const onMove = (ev: PointerEvent) => {
			const fx = (ev.clientX - rect.left) / rect.width;
			const fy = (ev.clientY - rect.top) / rect.height;
			if (kind === 'split') {
				splits = moveDivider(splits, index, layout === 'horizontal' ? fx : fy);
			} else if (kind === 'grid-v') {
				gridSplits = [moveDivider([gridSplits[0]], 0, fx)[0], gridSplits[1]];
			} else {
				gridSplits = [gridSplits[0], moveDivider([gridSplits[1]], 0, fy)[0]];
			}
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

	function startPanDrag(e: PointerEvent) {
		if (!canvasEl || displayScale <= 0) return;
		const rect = canvasEl.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * outW;
		const py = ((e.clientY - rect.top) / rect.height) * outH;
		const index = cellAt(rects, px, py);
		if (index < 0 || index >= slots.length) return;

		e.preventDefault();
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
		const slot = slots[index];
		const r = rects[index];
		const coverScale = Math.max(r.w / slot.w, r.h / slot.h);
		const overflowX = slot.w - r.w / coverScale;
		const overflowY = slot.h - r.h / coverScale;
		const startPan = { ...slot.pan };
		const startX = e.clientX;
		const startY = e.clientY;

		const onMove = (ev: PointerEvent) => {
			const dxOut = ((ev.clientX - startX) / rect.width) * outW;
			const dyOut = ((ev.clientY - startY) / rect.height) * outH;
			if (overflowX > 0.5) {
				slot.pan.x = Math.min(1, Math.max(0, startPan.x - dxOut / coverScale / overflowX));
			}
			if (overflowY > 0.5) {
				slot.pan.y = Math.min(1, Math.max(0, startPan.y - dyOut / coverScale / overflowY));
			}
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

	function renderResult(): RawImage {
		const out = document.createElement('canvas');
		out.width = outW;
		out.height = outH;
		const ctx = out.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		ctx.imageSmoothingQuality = 'high';
		draw(ctx, 1);
		const data = ctx.getImageData(0, 0, outW, outH);
		return { width: outW, height: outH, data: data.data };
	}

	function onAddPicked() {
		if (!addInput?.files) return;
		const files = Array.from(addInput.files);
		addInput.value = '';
		if (files.length) void onfiles(files);
	}

	function startOver() {
		slots = [];
		splits = [];
		loadError = null;
		sizeTouched = false;
	}

	const prevLabel = $derived(layout === 'vertical' ? '↑' : '←');
	const nextLabel = $derived(layout === 'vertical' ? '↓' : '→');
</script>

{#if slots.length === 0}
	<div class="editor-load">
		<Dropzone headline="Drop images here" {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading images…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<div class="toolbar-group" role="group" aria-label="Layout">
				{#each LAYOUTS as l (l.id)}
					<button
						class="chip"
						class:active={layout === l.id}
						aria-pressed={layout === l.id}
						disabled={l.id === 'grid' && slots.length !== 4}
						title={l.id === 'grid' && slots.length !== 4 ? 'The grid needs exactly 4 images' : undefined}
						onclick={() => pickLayout(l.id)}
					>
						{l.label}
					</button>
				{/each}
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={() => addInput?.click()}>Add images</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
				<input
					bind:this={addInput}
					type="file"
					multiple
					accept={acceptAttribute()}
					onchange={onAddPicked}
					class="visually-hidden"
				/>
			</div>
		</div>

		<div class="stage" class:checker={bgMode === 'transparent'}>
			<div class="canvas-wrap" bind:this={wrapEl} bind:clientWidth={wrapWidth}>
				<canvas bind:this={canvasEl} onpointerdown={startPanDrag} aria-label="Combined image preview. Drag an image to position it inside its cell."></canvas>

				{#if layout !== 'grid'}
					{#each splits as pos, i (i)}
						<button
							class="divider"
							class:divider-v={layout === 'horizontal'}
							class:divider-h={layout === 'vertical'}
							style={layout === 'horizontal' ? `left: ${pos * 100}%` : `top: ${pos * 100}%`}
							aria-label="Divider {i + 1}. Drag to change the split."
							onpointerdown={(e) => startDividerDrag(e, 'split', i)}
						></button>
					{/each}
				{:else}
					<button
						class="divider divider-v"
						style="left: {gridSplits[0] * 100}%"
						aria-label="Vertical divider. Drag to change the split."
						onpointerdown={(e) => startDividerDrag(e, 'grid-v', 0)}
					></button>
					<button
						class="divider divider-h"
						style="top: {gridSplits[1] * 100}%"
						aria-label="Horizontal divider. Drag to change the split."
						onpointerdown={(e) => startDividerDrag(e, 'grid-h', 0)}
					></button>
				{/if}

				{#each slots as slot, i (slot.id)}
					{#if rects[i] && displayScale > 0}
						<div
							class="cell-controls"
							style:left="{(rects[i].x + rects[i].w) * displayScale - 8}px"
							style:top="{rects[i].y * displayScale + 8}px"
						>
							<button
								class="cell-btn"
								aria-label="Move {slot.name} earlier"
								disabled={i === 0}
								onclick={() => swap(i, i - 1)}>{prevLabel}</button
							>
							<button
								class="cell-btn"
								aria-label="Move {slot.name} later"
								disabled={i === slots.length - 1}
								onclick={() => swap(i, i + 1)}>{nextLabel}</button
							>
							<button class="cell-btn" aria-label="Remove {slot.name}" onclick={() => removeSlot(i)}
								>×</button
							>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		{#if slots.length === 1}
			<p class="hint" role="status">Add at least one more image to combine.</p>
		{:else}
			<p class="hint">Drag the dividers to change the split. Drag an image to choose what shows.</p>
		{/if}

		<div class="settings">
			<div class="quality spacing">
				<label for="gap">Spacing</label>
				<input id="gap" type="range" min="0" max="60" bind:value={gap} />
				<output class="mono" for="gap">{gap}px</output>
			</div>

			<div class="bg-row" role="group" aria-label="Background">
				<span class="settings-label">Background</span>
				<button class="chip" class:active={bgMode === 'white'} aria-pressed={bgMode === 'white'} onclick={() => (bgMode = 'white')}>White</button>
				<button class="chip" class:active={bgMode === 'transparent'} aria-pressed={bgMode === 'transparent'} onclick={() => (bgMode = 'transparent')}>Transparent</button>
				<button class="chip" class:active={bgMode === 'custom'} aria-pressed={bgMode === 'custom'} onclick={() => (bgMode = 'custom')}>Colour</button>
				{#if bgMode === 'custom'}
					<input type="color" bind:value={bgColor} aria-label="Background colour" />
				{/if}
			</div>

			<div class="size-row">
				<span class="settings-label">Output size</span>
				<input
					type="number"
					min="16"
					max="8000"
					value={outW}
					aria-label="Output width in pixels"
					onchange={(e) => ((outW = clampSize(+e.currentTarget.value)), (sizeTouched = true))}
				/>
				<span class="mono dim">×</span>
				<input
					type="number"
					min="16"
					max="8000"
					value={outH}
					aria-label="Output height in pixels"
					onchange={(e) => ((outH = clampSize(+e.currentTarget.value)), (sizeTouched = true))}
				/>
				<span class="mono dim">px</span>
			</div>
		</div>

		<ExportBar
			render={renderResult}
			baseName={slots[0]?.name ?? 'images'}
			suffix="-combined"
		/>
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
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		padding: 1rem;
		background: var(--surface);
	}

	.stage.checker {
		background-size: 16px 16px;
	}

	.canvas-wrap {
		position: relative;
		line-height: 0;
	}

	canvas {
		display: block;
		width: 100%;
		touch-action: none;
		cursor: grab;
	}

	canvas:active {
		cursor: grabbing;
	}

	.divider {
		position: absolute;
		padding: 0;
		border: 0;
		background: none;
		touch-action: none;
	}

	.divider::after {
		content: '';
		position: absolute;
		background: oklch(1 0 0 / 0.85);
		outline: 1px solid oklch(0.24 0.015 110 / 0.5);
	}

	.divider-v {
		top: 0;
		bottom: 0;
		width: 20px;
		transform: translateX(-50%);
		cursor: col-resize;
	}

	.divider-v::after {
		left: 9px;
		top: 0;
		bottom: 0;
		width: 2px;
	}

	.divider-h {
		left: 0;
		right: 0;
		height: 20px;
		transform: translateY(-50%);
		cursor: row-resize;
	}

	.divider-h::after {
		top: 9px;
		left: 0;
		right: 0;
		height: 2px;
	}

	.cell-controls {
		position: absolute;
		transform: translateX(-100%);
		display: flex;
		gap: 3px;
	}

	.cell-btn {
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: oklch(1 0 0 / 0.92);
		color: var(--ink);
		font-size: 0.8125rem;
		line-height: 1;
		cursor: pointer;
	}

	.cell-btn:hover:not(:disabled) {
		border-color: var(--muted);
	}

	.cell-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.hint {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.settings {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.spacing {
		max-width: 24rem;
	}

	.bg-row,
	.size-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.settings-label {
		font-size: 0.875rem;
		color: var(--muted);
		margin-right: 0.35rem;
		min-width: 6.5rem;
	}

	.size-row input {
		width: 6rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: 500 0.875rem var(--font-mono);
		color: var(--ink);
	}

	.bg-row input[type='color'] {
		width: 2.2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
	}

	.dim {
		color: var(--muted);
	}
</style>
