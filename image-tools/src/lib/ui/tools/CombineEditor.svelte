<script lang="ts">
	import { acceptAttribute, type RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas } from './load';
	import {
		cellAt,
		cellRects,
		containRect,
		coverSource,
		fitWithin,
		moveDivider,
		naturalCanvas,
		splitFractionAt,
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
		/** `contain` shows the whole image, `cover` crops it into its cell. */
		fit: 'contain' | 'cover';
		pan: { x: number; y: number };
	}

	const MAX_SIZE = 8000;

	const LAYOUTS: { id: CombineLayout; label: string }[] = [
		{ id: 'horizontal', label: 'Side by side' },
		{ id: 'vertical', label: 'Stacked' },
		// The count is in the label because the reason it is unavailable cannot be
		// a tooltip: a disabled button fires no mouse events, so the title never
		// shows and the rule stays a secret from the one person who needs it.
		{ id: 'grid', label: 'Grid of 4' }
	];

	let nextId = 1;
	let slots = $state<Slot[]>([]);
	let layout = $state<CombineLayout>('horizontal');
	let splits = $state<number[]>([]);
	let gridSplits = $state<[number, number]>([0.5, 0.5]);
	let spacing = $state(0);
	let bgMode = $state<'white' | 'transparent' | 'custom'>('white');
	let bgColor = $state('#ffffff');
	let outW = $state(2000);
	let outH = $state(1400);
	/**
	 * The canvas as asked for, before the export limit is applied to it. Kept
	 * separately because the limit must never compound: with only the clamped
	 * size to work from, every spacing step past the limit would take its gutters
	 * out of a canvas that could not grow, and the images would shrink a little
	 * more each time.
	 */
	let baseW = $state(2000);
	let baseH = $state(1400);
	let sizeTouched = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();
	let wrapEl = $state<HTMLDivElement>();
	let wrapWidth = $state(0);
	let addInput = $state<HTMLInputElement>();

	// One spacing value does both jobs: the gutter between images and the frame
	// around them. It is space the images sit inside, not space taken out of them.
	const rects = $derived(
		cellRects(layout, slots.length, splits, gridSplits, outW, outH, spacing, spacing)
	);
	const displayScale = $derived(wrapWidth > 0 && outW > 0 ? wrapWidth / outW : 0);

	async function onfiles(files: File[]) {
		loading = true;
		loadError = null;
		try {
			for (const file of files) {
				const { raw, name } = await readImageFile(file);
				slots.push({
					id: nextId++,
					name,
					source: rawToCanvas(raw),
					w: raw.width,
					h: raw.height,
					// Whole image by default. Cropping is a choice you make per
					// image, not something the tool does to you on the way in.
					fit: 'contain',
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
		applyNatural();
	}

	/**
	 * Sizes the canvas from the images themselves and gives every cell the shape
	 * of the image in it, so the default result crops nothing.
	 *
	 * The size is skipped once someone has typed one in: they asked for an exact
	 * canvas and are entitled to keep it.
	 */
	function applyNatural() {
		if (!slots.length) return;
		const nat = naturalCanvas(layout, slots, spacing);
		splits = nat.splits;
		gridSplits = nat.gridSplits;
		if (!sizeTouched) setSize(nat.width, nat.height);
	}

	/**
	 * Applies a size, shrinking it to the export limit without changing its
	 * shape. Both axes scale by the same amount, so a canvas that has hit the
	 * limit keeps the images and the spacing in the proportions you can see.
	 */
	function setSize(w: number, h: number) {
		baseW = Math.max(16, Math.round(w));
		baseH = Math.max(16, Math.round(h));
		const fitted = fitWithin(baseW, baseH, MAX_SIZE);
		outW = clampSize(fitted.width);
		outH = clampSize(fitted.height);
	}

	/** True when the images want a bigger canvas than we are willing to export. */
	const capped = $derived(baseW > outW || baseH > outH);

	const clampSize = (v: number) => Math.min(MAX_SIZE, Math.max(16, v || 16));

	/**
	 * Spacing is added around the images rather than taken out of them, so the
	 * canvas grows by exactly what the new gutters and frame need. The splits are
	 * left alone, because a divider somebody dragged is not ours to reset.
	 *
	 * This happens even to an output size somebody typed in. Spacing that did not
	 * move the canvas would have to come out of the pictures, which is the thing
	 * this control exists not to do, so a typed size sets where the images start
	 * rather than locking the canvas for good.
	 */
	function setSpacing(next: number) {
		const delta = next - spacing;
		spacing = next;
		if (!slots.length || delta === 0) return;
		const n = slots.length;
		if (layout === 'grid') setSize(baseW + delta * 3, baseH + delta * 3);
		else if (layout === 'horizontal') setSize(baseW + delta * (n + 1), baseH + delta * 2);
		else setSize(baseW + delta * 2, baseH + delta * (n + 1));
	}

	function pickLayout(id: CombineLayout) {
		layout = id;
		applyNatural();
	}

	function setFit(i: number, fit: Slot['fit']) {
		slots[i].fit = fit;
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
			if (slot.fit === 'cover') {
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
			} else {
				// The whole image, centred. Where the cell is a different shape,
				// the background shows rather than the edges being cut off.
				const d = containRect(slot.w, slot.h, r);
				ctx.drawImage(slot.source, d.x * scale, d.y * scale, d.w * scale, d.h * scale);
			}
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
			// Pointer → output pixels → the content fraction the splits are in.
			const px = ((ev.clientX - rect.left) / rect.width) * outW;
			const py = ((ev.clientY - rect.top) / rect.height) * outH;
			if (kind === 'split') {
				const along = layout === 'horizontal' ? px : py;
				const total = layout === 'horizontal' ? outW : outH;
				const f = splitFractionAt(along, total, spacing, spacing, slots.length, index);
				splits = moveDivider(splits, index, f);
			} else if (kind === 'grid-v') {
				const f = splitFractionAt(px, outW, spacing, spacing, 2, 0);
				gridSplits = [moveDivider([gridSplits[0]], 0, f)[0], gridSplits[1]];
			} else {
				const f = splitFractionAt(py, outH, spacing, spacing, 2, 0);
				gridSplits = [gridSplits[0], moveDivider([gridSplits[1]], 0, f)[0]];
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
		// Nothing to pan when the whole image is already showing.
		if (slots[index].fit !== 'cover') return;

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

	const anyCropped = $derived(slots.some((s) => s.fit === 'cover'));

	/**
	 * Where a handle sits, as a percentage of the canvas: the middle of the
	 * gutter between the two cells it separates. The split fraction itself is a
	 * fraction of the content, which is a different number as soon as there is
	 * any spacing.
	 */
	function dividerPct(a: number, b: number, axis: 'x' | 'y'): number {
		const first = rects[a];
		const second = rects[b];
		if (!first || !second) return 50;
		const mid =
			axis === 'x'
				? (first.x + first.w + second.x) / 2 / outW
				: (first.y + first.h + second.y) / 2 / outH;
		return mid * 100;
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
					{#each splits as _pos, i (i)}
						<button
							class="divider"
							class:divider-v={layout === 'horizontal'}
							class:divider-h={layout === 'vertical'}
							style={layout === 'horizontal'
								? `left: ${dividerPct(i, i + 1, 'x')}%`
								: `top: ${dividerPct(i, i + 1, 'y')}%`}
							aria-label="Divider {i + 1}. Drag to change the split."
							onpointerdown={(e) => startDividerDrag(e, 'split', i)}
						></button>
					{/each}
				{:else}
					<button
						class="divider divider-v"
						style="left: {dividerPct(0, 1, 'x')}%"
						aria-label="Vertical divider. Drag to change the split."
						onpointerdown={(e) => startDividerDrag(e, 'grid-v', 0)}
					></button>
					<button
						class="divider divider-h"
						style="top: {dividerPct(0, 2, 'y')}%"
						aria-label="Horizontal divider. Drag to change the split."
						onpointerdown={(e) => startDividerDrag(e, 'grid-h', 0)}
					></button>
				{/if}

			</div>
		</div>

		<ul class="slots">
			{#each slots as slot, i (slot.id)}
				<li class="slot">
					<span class="slot-index mono dim">{i + 1}</span>
					<span class="slot-name">{slot.name}</span>
					<span class="slot-size mono dim">{slot.w} × {slot.h}</span>
					<span class="slot-fit" role="group" aria-label="How {slot.name} fills its cell">
						<button
							class="mini"
							class:active={slot.fit === 'contain'}
							aria-pressed={slot.fit === 'contain'}
							title="Show all of it, letting the background show where the cell is a different shape"
							onclick={() => setFit(i, 'contain')}>Fit</button
						>
						<button
							class="mini"
							class:active={slot.fit === 'cover'}
							aria-pressed={slot.fit === 'cover'}
							title="Crop it to fill its cell, then drag it in the preview to choose which part shows"
							onclick={() => setFit(i, 'cover')}>Fill</button
						>
					</span>
					<span class="slot-move">
						<button
							class="mini"
							aria-label="Move {slot.name} earlier"
							disabled={i === 0}
							onclick={() => swap(i, i - 1)}>{prevLabel}</button
						>
						<button
							class="mini"
							aria-label="Move {slot.name} later"
							disabled={i === slots.length - 1}
							onclick={() => swap(i, i + 1)}>{nextLabel}</button
						>
						<button class="mini" aria-label="Remove {slot.name}" onclick={() => removeSlot(i)}
							>×</button
						>
					</span>
				</li>
			{/each}
		</ul>

		{#if slots.length === 1}
			<p class="hint" role="status">Add at least one more image to combine.</p>
		{:else if anyCropped}
			<p class="hint">
				Drag the dividers to change the split. Drag an image set to Fill to choose which part
				shows.
			</p>
		{:else}
			<p class="hint">
				Every image is here in full. Drag the dividers to change the split, or switch one to Fill
				to crop it into its cell instead.
			</p>
		{/if}

		<div class="settings">
			<div class="quality spacing">
				<label for="gap">Spacing</label>
				<input
					id="gap"
					type="range"
					min="0"
					max="200"
					value={spacing}
					oninput={(e) => setSpacing(+e.currentTarget.value)}
				/>
				<output class="mono" for="gap">{spacing}px</output>
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
					onchange={(e) => (setSize(clampSize(+e.currentTarget.value), outH), (sizeTouched = true))}
				/>
				<span class="mono dim">×</span>
				<input
					type="number"
					min="16"
					max="8000"
					value={outH}
					aria-label="Output height in pixels"
					onchange={(e) => (setSize(outW, clampSize(+e.currentTarget.value)), (sizeTouched = true))}
				/>
				<span class="mono dim">px</span>
				{#if capped}
					<span class="dim">Held at the {MAX_SIZE}px limit, so the images share what is left.</span>
				{/if}
				{#if sizeTouched}
					<button
						class="btn-ghost"
						title="Back to the size the images ask for"
						onclick={() => {
							sizeTouched = false;
							applyNatural();
						}}>Fit to images</button
					>
				{/if}
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

	.slots {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.slot {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.1rem;
		border-bottom: 1px solid var(--line);
		font-size: 0.875rem;
	}

	.slot:last-child {
		border-bottom: 0;
	}

	.slot-index {
		width: 1.2rem;
		text-align: right;
	}

	.slot-name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.slot-size {
		font-size: 0.8125rem;
	}

	.slot-fit,
	.slot-move {
		display: flex;
		gap: 3px;
	}

	.mini {
		min-width: 26px;
		height: 26px;
		padding: 0 7px;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--bg);
		color: var(--ink);
		font-size: 0.8125rem;
		line-height: 1;
		cursor: pointer;
	}

	.mini:hover:not(:disabled) {
		border-color: var(--muted);
	}

	.mini:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.mini.active {
		background: var(--primary);
		border-color: var(--primary);
		color: #fff;
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
