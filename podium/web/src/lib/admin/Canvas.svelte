<!--
	The slide being built, at the size that fits, with the grid it snaps to.
	Everything on it is picked up and moved, or pulled by its handles; a text
	is typed in where it stands; a file dropped on it lands where it fell.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import Stage from '$lib/stage/Stage.svelte';
	import { HANDLES, moveBox, nudgeBox, resizeBox, type Box, type Handle } from '$lib/geometry';
	import { measure, type Editor } from './editor.svelte';
	import type { Option, SlideElement } from '$lib/types';

	let { ed, grid = true }: { ed: Editor; grid?: boolean } = $props();

	let surface: HTMLDivElement | undefined = $state();
	let canvas: HTMLDivElement | undefined = $state();
	let typingBox: HTMLTextAreaElement | undefined = $state();
	let dragging = $state(false);
	let dropping = $state(false);

	type Gesture = {
		kind: 'element' | 'option';
		id: string;
		handle: Handle | null;
		start: Box;
		px: number;
		py: number;
		ratio: number;
		moved: boolean;
		pointer: number;
	};
	let gesture: Gesture | null = null;
	// A second press on the same text, soon after the first, is a double
	// click: told apart here, since the pointer is captured for dragging and
	// the browser's own double click goes to the surface instead.
	let lastPress = { id: '', at: 0 };

	const slide = $derived(ed.slide);
	const selected = $derived(ed.selected);
	const typing = $derived(slide?.elements.find((e) => e.id === ed.typing && e.type === 'text'));

	const box = (b: Box) => `left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%`;

	function describe(el: SlideElement): string {
		if (el.type === 'text') return `Tekst: ${el.text?.slice(0, 40) || 'tom'}`;
		if (el.type === 'image') return 'Bilde';
		if (el.type === 'video') return 'Video';
		return 'QR-kode';
	}

	function find(kind: 'element' | 'option', id: string): SlideElement | Option | undefined {
		const s = ed.slide;
		return kind === 'element' ? s?.elements.find((e) => e.id === id) : s?.options.find((o) => o.id === id);
	}

	function down(e: PointerEvent, kind: 'element' | 'option', id: string, handle: Handle | null = null) {
		if (e.button !== 0 || ed.typing === id || !surface) return;
		e.stopPropagation();
		e.preventDefault();
		const item = find(kind, id);
		if (!item) return;
		const now = performance.now();
		const again = !handle && lastPress.id === id && now - lastPress.at < 450;
		lastPress = again ? { id: '', at: 0 } : { id, at: now };
		if (again && kind === 'element' && (item as SlideElement).type === 'text') {
			startTyping(item as SlideElement);
			return;
		}
		ed.select(kind, id);
		gesture = {
			kind,
			id,
			handle,
			start: { x: item.x, y: item.y, w: item.w, h: item.h },
			px: e.clientX,
			py: e.clientY,
			ratio: item.w / item.h,
			moved: false,
			pointer: e.pointerId
		};
		surface.setPointerCapture(e.pointerId);
		canvas?.focus({ preventScroll: true });
	}

	function move(e: PointerEvent) {
		const g = gesture;
		if (!g || e.pointerId !== g.pointer || !surface) return;
		if (!g.moved && Math.hypot(e.clientX - g.px, e.clientY - g.py) < 3) return;
		const r = surface.getBoundingClientRect();
		const dx = ((e.clientX - g.px) / r.width) * 100;
		const dy = ((e.clientY - g.py) / r.height) * 100;
		// Alt lets go of the grid; Shift keeps a corner's proportions.
		const next = g.handle
			? resizeBox(g.start, g.handle, dx, dy, e.altKey, e.shiftKey ? g.ratio : undefined)
			: moveBox(g.start, dx, dy, e.altKey);
		ed.edit((s) => {
			const item = (g.kind === 'element' ? s.elements : s.options).find((x) => x.id === g.id);
			if (item) Object.assign(item, next);
		}, !g.moved);
		g.moved = true;
		dragging = true;
	}

	function up(e: PointerEvent) {
		if (!gesture || e.pointerId !== gesture.pointer) return;
		surface?.releasePointerCapture(e.pointerId);
		gesture = null;
		dragging = false;
	}

	function background(e: PointerEvent) {
		if (e.button !== 0) return;
		ed.clearSelection();
		canvas?.focus({ preventScroll: true });
	}

	async function startTyping(el: SlideElement) {
		ed.select('element', el.id);
		ed.typing = el.id;
	}

	// The box to type in takes the focus when it opens; a new text is
	// selected whole, to be typed over.
	$effect(() => {
		if (!typingBox || !typing) return;
		const fresh = typing.text === 'Tekst';
		tick().then(() => {
			typingBox?.focus();
			if (fresh) typingBox?.select();
			else typingBox?.setSelectionRange(typingBox.value.length, typingBox.value.length);
		});
	});

	function typingKey(e: KeyboardEvent) {
		if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
			e.preventDefault();
			ed.typing = null;
			canvas?.focus({ preventScroll: true });
		}
		e.stopPropagation();
	}

	function key(e: KeyboardEvent) {
		const from = e.target as HTMLElement;
		if (ed.typing || (from !== canvas && !from.classList.contains('hit'))) return;
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key.toLowerCase() === 'd') {
			e.preventDefault();
			ed.duplicateSelected();
			return;
		}
		const item = ed.selected;
		const sel = ed.selection;
		if (!item || !sel || mod) return;
		const nudge = (cols: number, rows: number) => {
			e.preventDefault();
			ed.edit((s) => {
				const it = (sel.kind === 'element' ? s.elements : s.options).find((x) => x.id === sel.id);
				if (it) Object.assign(it, nudgeBox(it, cols, rows, e.shiftKey));
			}, 'nudge:' + sel.id);
		};
		switch (e.key) {
			case 'ArrowLeft':
				return nudge(-1, 0);
			case 'ArrowRight':
				return nudge(1, 0);
			case 'ArrowUp':
				return nudge(0, -1);
			case 'ArrowDown':
				return nudge(0, 1);
			case 'Delete':
			case 'Backspace':
				e.preventDefault();
				ed.removeSelected();
				return;
			case 'Escape':
				ed.clearSelection();
				canvas?.focus({ preventScroll: true });
				return;
			case 'Enter':
				if (sel.kind === 'element' && (item as SlideElement).type === 'text') {
					e.preventDefault();
					startTyping(item as SlideElement);
				}
		}
	}

	function dragover(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
		dropping = true;
	}

	async function drop(e: DragEvent) {
		dropping = false;
		const files = [...(e.dataTransfer?.files ?? [])];
		if (files.length === 0 || !surface) return;
		e.preventDefault();
		const r = surface.getBoundingClientRect();
		const at = { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
		for (const file of files) await place(file, at);
	}

	/** Uploads a file and puts it on the slide: a picture or a video where it was dropped. */
	export async function place(file: File, at?: { x: number; y: number }) {
		const m = await ed.upload(file);
		if (!m) return;
		if (m.kind === 'audio') {
			ed.notice = `«${m.name}» er lastet opp. Velg den som lyd for stemmene under Presentasjonen.`;
			return;
		}
		ed.addMedia(m, await measure(m), at);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class="canvas"
	class:dropping
	bind:this={canvas}
	tabindex="0"
	role="application"
	aria-label="Siden. Piltaster flytter det som er valgt, Delete sletter det."
	onkeydown={key}
	ondragover={dragover}
	ondragleave={() => (dropping = false)}
	ondrop={drop}
>
	{#if slide}
		<Stage {slide} code={ed.p.code} mode="edit" marks={ed.p.marks} hidden={ed.typing} moving={ed.moving}>
			{#snippet overlay()}
				<div
					class="surface"
					class:grid
					class:dragging
					bind:this={surface}
					onpointerdown={background}
					onpointermove={move}
					onpointerup={up}
					onpointercancel={up}
					role="presentation"
				>
					{#each slide.elements as el (el.id)}
						<div
							class="hit"
							class:hollow={el.type === 'text' && !el.text?.trim()}
							style={box(el)}
							role="button"
							tabindex="0"
							aria-label={describe(el)}
							aria-pressed={ed.selection?.id === el.id}
							onfocus={() => ed.selection?.id !== el.id && ed.select('element', el.id)}
							onpointerdown={(e) => down(e, 'element', el.id)}
						></div>
					{/each}
					{#each slide.options as o (o.id)}
						<div
							class="hit"
							style={box(o)}
							role="button"
							tabindex="0"
							aria-label="Svar: {o.label}"
							aria-pressed={ed.selection?.id === o.id}
							onfocus={() => ed.selection?.id !== o.id && ed.select('option', o.id)}
							onpointerdown={(e) => down(e, 'option', o.id)}
						></div>
					{/each}

					{#if typing}
						<textarea
							class="typing"
							class:bold={(typing.weight ?? 400) >= 700}
							bind:this={typingBox}
							value={typing.text}
							style="left:{typing.x}%;top:{typing.y}%;width:{typing.w}%;min-height:{typing.h}%"
							style:font-size="calc({typing.size ?? 6} * var(--u))"
							style:text-align={typing.align ?? 'left'}
							style:color={typing.color || null}
							spellcheck="true"
							aria-label="Teksten"
							oninput={(e) => ed.setText(typing, e.currentTarget.value)}
							onblur={() => (ed.typing = null)}
							onkeydown={typingKey}
						></textarea>
					{:else if selected && ed.selection}
						{@const sel = ed.selection}
						<div class="frame" style={box(selected)}>
							{#each HANDLES as h (h)}
								<span
									class="handle {h}"
									role="presentation"
									onpointerdown={(e) => down(e, sel.kind, sel.id, h)}
								></span>
							{/each}
						</div>
					{/if}
				</div>
			{/snippet}
		</Stage>
	{/if}
	{#if dropping}<div class="drop" aria-hidden="true"><span>Slipp for å legge på siden</span></div>{/if}
</div>

<style>
	.canvas {
		position: relative;
		width: 100%;
		outline: none;
		box-shadow: 0 1px 2px oklch(0.2 0.02 250 / 0.12), 0 8px 28px -12px oklch(0.2 0.02 250 / 0.3);
	}

	.canvas:focus-visible {
		outline: 2px solid var(--desk-text);
		outline-offset: 4px;
	}

	.surface {
		position: absolute;
		inset: 0;
		touch-action: none;
	}

	/* The grid, square and quiet, a little stronger while something moves,
	   with the stage's two middle lines drawn a step stronger still. */
	.surface.grid::before,
	.surface.dragging::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		--line: color-mix(in oklab, currentColor 9%, transparent);
		--axis: color-mix(in oklab, currentColor 30%, transparent);
		background-image:
			linear-gradient(to right, transparent calc(50% - 0.5px), var(--axis) 0 calc(50% + 0.5px), transparent 0),
			linear-gradient(to bottom, transparent calc(50% - 0.5px), var(--axis) 0 calc(50% + 0.5px), transparent 0),
			linear-gradient(to right, var(--line) 1px, transparent 1px),
			linear-gradient(to bottom, var(--line) 1px, transparent 1px);
		background-size:
			100% 100%,
			100% 100%,
			calc(100% / 32) 100%,
			100% calc(100% / 18);
		background-repeat: no-repeat, no-repeat, repeat, repeat;
	}

	.surface.dragging::before {
		--line: color-mix(in oklab, currentColor 18%, transparent);
		--axis: color-mix(in oklab, currentColor 45%, transparent);
	}

	.hit {
		position: absolute;
		cursor: move;
	}

	.hit:hover {
		box-shadow: inset 0 0 0 1px color-mix(in oklab, currentColor 55%, transparent);
	}

	.hit.hollow {
		box-shadow: inset 0 0 0 1px color-mix(in oklab, currentColor 30%, transparent);
		background-image: repeating-linear-gradient(
			-45deg,
			color-mix(in oklab, currentColor 10%, transparent) 0 1px,
			transparent 1px 8px
		);
	}

	/* The selection reads on any slide: a light line and a dark one together. */
	.frame {
		position: absolute;
		pointer-events: none;
		box-shadow:
			0 0 0 1px oklch(0.99 0 0 / 0.95),
			0 0 0 2px oklch(0.16 0.012 250 / 0.92);
	}

	.handle {
		position: absolute;
		width: 9px;
		height: 9px;
		margin: -4.5px 0 0 -4.5px;
		background: oklch(0.99 0 0);
		border: 1px solid oklch(0.16 0.012 250);
		pointer-events: auto;
		touch-action: none;
	}

	.handle.nw {
		left: 0;
		top: 0;
		cursor: nwse-resize;
	}
	.handle.n {
		left: 50%;
		top: 0;
		cursor: ns-resize;
	}
	.handle.ne {
		left: 100%;
		top: 0;
		cursor: nesw-resize;
	}
	.handle.e {
		left: 100%;
		top: 50%;
		cursor: ew-resize;
	}
	.handle.se {
		left: 100%;
		top: 100%;
		cursor: nwse-resize;
	}
	.handle.s {
		left: 50%;
		top: 100%;
		cursor: ns-resize;
	}
	.handle.sw {
		left: 0;
		top: 100%;
		cursor: nesw-resize;
	}
	.handle.w {
		left: 0;
		top: 50%;
		cursor: ew-resize;
	}

	/* Typing on the slide: the same type in the same place, with a caret. */
	.typing {
		position: absolute;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font-family: inherit;
		font-weight: 400;
		line-height: 1.24;
		letter-spacing: -0.004em;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		overflow: hidden;
		resize: none;
		field-sizing: content;
		outline: none;
		caret-color: currentColor;
		box-shadow:
			0 0 0 1px oklch(0.99 0 0 / 0.95),
			0 0 0 2px oklch(0.16 0.012 250 / 0.92);
	}

	.typing.bold {
		font-weight: 700;
		line-height: 1.08;
		letter-spacing: -0.02em;
	}

	.drop {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: oklch(0.16 0.012 250 / 0.55);
		pointer-events: none;
	}

	.drop span {
		padding: 0.5rem 0.9rem;
		border-radius: var(--radius);
		background: var(--desk-raised);
		color: var(--desk-text);
		font-weight: 600;
	}
</style>
