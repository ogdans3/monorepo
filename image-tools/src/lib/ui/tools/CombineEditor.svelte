<script lang="ts">
	import { acceptAttribute, type RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas } from './load';
	import {
		cellAt,
		cellIndex,
		cellRects,
		columnsFor,
		containRect,
		coverSource,
		fitWithin,
		moveDivider,
		naturalCanvas,
		rowsFor,
		splitFractionAt,
		type CombineLayout,
		type GridSplits
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

	// Three names for one geometry: a strip is a grid one row deep, a stack is a
	// grid one column wide, and the grid is however many columns you ask for.
	const LAYOUTS: { id: CombineLayout; label: string }[] = [
		{ id: 'horizontal', label: 'Side by side' },
		{ id: 'vertical', label: 'Stacked' },
		{ id: 'grid', label: 'Grid' }
	];

	let nextId = 1;
	let slots = $state<Slot[]>([]);
	let layout = $state<CombineLayout>('horizontal');
	let splits = $state<GridSplits>({ rows: [], cols: [] });
	/** Columns asked for in the grid layout. The other two work theirs out. */
	let gridColumns = $state(2);
	/** Whether the shape is the one somebody chose or the one we guessed. */
	let shapeTouched = $state(false);
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
	const columns = $derived(columnsFor(layout, slots.length, gridColumns));
	const rows = $derived(rowsFor(slots.length, columns));
	const rects = $derived(cellRects(splits, slots.length, outW, outH, spacing, spacing));
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
		// Squarish by default, so five images are three and two rather than a
		// column of pairs with one stray at the bottom.
		if (!shapeTouched) gridColumns = Math.ceil(Math.sqrt(Math.max(1, slots.length)));
		gridColumns = Math.min(gridColumns, Math.max(1, slots.length));
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
		const nat = naturalCanvas(layout, slots, columns, spacing);
		splits = nat.splits;
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
		if (next === spacing || !slots.length) {
			spacing = next;
			return;
		}
		// How much bigger the canvas the images asked for has just become. Taking
		// the difference rather than the new size itself is what keeps a typed
		// output size and a dragged divider intact while still adding the room.
		const before = naturalCanvas(layout, slots, columns, spacing);
		const after = naturalCanvas(layout, slots, columns, next);
		spacing = next;
		setSize(baseW + (after.width - before.width), baseH + (after.height - before.height));
	}

	function pickLayout(id: CombineLayout) {
		layout = id;
		applyNatural();
	}

	/**
	 * Columns and rows are two views of one number: every image has to land in a
	 * cell, so choosing one decides the other. Setting rows to 2 with five images
	 * means three columns, and the tool says so rather than dropping an image.
	 */
	function setColumns(next: number) {
		gridColumns = Math.min(Math.max(1, Math.round(next) || 1), Math.max(1, slots.length));
		shapeTouched = true;
		applyNatural();
	}

	function setRows(next: number) {
		const wanted = Math.max(1, Math.round(next) || 1);
		setColumns(Math.ceil(slots.length / Math.min(wanted, Math.max(1, slots.length))));
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

	/**
	 * Drags one divider. A row divider moves the boundary between two rows down
	 * the canvas, and a column divider moves one boundary inside a single row,
	 * which is why it needs to know which row it belongs to.
	 */
	function startDividerDrag(
		e: PointerEvent,
		kind: 'row' | 'col',
		row: number,
		index: number
	) {
		if (!wrapEl) return;
		e.preventDefault();
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
		const rect = wrapEl.getBoundingClientRect();

		const onMove = (ev: PointerEvent) => {
			// Pointer → output pixels → the content fraction the splits are in.
			const px = ((ev.clientX - rect.left) / rect.width) * outW;
			const py = ((ev.clientY - rect.top) / rect.height) * outH;
			if (kind === 'row') {
				const f = splitFractionAt(py, outH, spacing, spacing, rows, index);
				splits = { ...splits, rows: moveDivider(splits.rows, index, f) };
			} else {
				const inRow = (splits.cols[row]?.length ?? 0) + 1;
				const f = splitFractionAt(px, outW, spacing, spacing, inRow, index);
				// In a grid the columns line up, so a column divider is one divider
				// wearing several hats and has to move in every row at once.
				const cols = splits.cols.map((set, r) =>
					layout === 'grid' || r === row ? moveDivider(set, index, f) : set
				);
				splits = { ...splits, cols };
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
		splits = { rows: [], cols: [] };
		loadError = null;
		sizeTouched = false;
		shapeTouched = false;
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

	/** Every divider on the canvas, ready to render: rows first, then each row's. */
	const handles = $derived.by(() => {
		const out: {
			key: string;
			kind: 'row' | 'col';
			row: number;
			index: number;
			pct: number;
			/** For a column divider, the top and height of the row it lives in, in %. */
			from: number;
			size: number;
			label: string;
		}[] = [];
		for (let r = 0; r < splits.rows.length; r++) {
			out.push({
				key: `row-${r}`,
				kind: 'row',
				row: r,
				index: r,
				pct: dividerPct(cellIndex(splits, r, 0), cellIndex(splits, r + 1, 0), 'y'),
				from: 0,
				size: 100,
				label: `Divider below row ${r + 1}. Drag to change the split.`
			});
		}
		for (let r = 0; r < splits.cols.length; r++) {
			// A grid's columns are shared, so one handle spanning the whole canvas
			// says what is true. A strip's belong to their row and only span it.
			const aligned = layout === 'grid';
			if (aligned && r > 0) break;
			const cell = rects[cellIndex(splits, r, 0)];
			const from = aligned || !cell ? 0 : (cell.y / outH) * 100;
			const size = aligned || !cell ? 100 : (cell.h / outH) * 100;
			for (let c = 0; c < (splits.cols[r]?.length ?? 0); c++) {
				out.push({
					key: `col-${r}-${c}`,
					kind: 'col',
					row: r,
					index: c,
					pct: dividerPct(cellIndex(splits, r, c), cellIndex(splits, r, c + 1), 'x'),
					from,
					size,
					label: aligned
						? `Column divider ${c + 1}. Drag to change the split.`
						: splits.rows.length > 0
							? `Divider ${c + 1} in row ${r + 1}. Drag to change the split.`
							: `Divider ${c + 1}. Drag to change the split.`
				});
			}
		}
		return out;
	});

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
						onclick={() => pickLayout(l.id)}
					>
						{l.label}
					</button>
				{/each}
				{#if layout === 'grid'}
					<span class="shape">
						<label for="grid-cols">Columns</label>
						<input
							id="grid-cols"
							type="number"
							min="1"
							max={Math.max(1, slots.length)}
							value={columns}
							onchange={(e) => setColumns(+e.currentTarget.value)}
						/>
						<label for="grid-rows">Rows</label>
						<input
							id="grid-rows"
							type="number"
							min="1"
							max={Math.max(1, slots.length)}
							value={rows}
							onchange={(e) => setRows(+e.currentTarget.value)}
						/>
					</span>
				{/if}
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

				{#each handles as handle (handle.key)}
					<button
						class="divider"
						class:divider-v={handle.kind === 'col'}
						class:divider-h={handle.kind === 'row'}
						style={handle.kind === 'col'
							? `left: ${handle.pct}%; top: ${handle.from}%; height: ${handle.size}%`
							: `top: ${handle.pct}%`}
						aria-label={handle.label}
						onpointerdown={(e) => startDividerDrag(e, handle.kind, handle.row, handle.index)}
					></button>
				{/each}

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
		align-items: center;
		gap: 0.4rem;
	}

	/* Rows and columns are two views of one number, so they sit together and
	   each one answers when the other moves. */
	.shape {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: 0.2rem;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.shape input {
		width: 3.4rem;
		padding: 0.3rem 0.4rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: 500 0.875rem var(--font-mono);
		color: var(--ink);
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

	/* A column divider is only as tall as the row it divides, so its height comes
	   from the row rather than from the canvas. */

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
