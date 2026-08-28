<script lang="ts">
	import { arrowHead, edgeAnchor, hits, midpoint, pathOf, route, type Point } from '$lib/flow/geometry';
	import {
		addNode,
		connect,
		moveNode,
		remove,
		setText,
		wrapText,
		type FlowDoc,
		type FlowNode,
		type NodeShape
	} from '$lib/flow/model';

	let {
		doc,
		selected = $bindable(),
		tool = $bindable(),
		commit,
		onedit
	}: {
		doc: FlowDoc;
		/** Ids of the selected node or edge. One at a time is enough here. */
		selected: string | null;
		/** The shape the next click on empty paper drops, or null to just select. */
		tool: NodeShape | null;
		commit: (next: FlowDoc, coalesce?: boolean) => void;
		/** Asks the page to open the text editor for a node. */
		onedit: (id: string) => void;
	} = $props();

	let svg = $state<SVGSVGElement>();
	/** Pan and zoom, as a plain transform rather than a library. */
	let view = $state({ x: 0, y: 0, scale: 1 });
	/** The arrow being dragged out of a node, before it lands anywhere. */
	let linking = $state<{ from: string; to: Point } | null>(null);
	let hovered = $state<string | null>(null);

	const nodeById = $derived(new Map(doc.nodes.map((node) => [node.id, node])));

	/**
	 * Every edge, already routed. Derived rather than computed while drawing so
	 * that dragging a node re-routes exactly the arrows attached to it and
	 * nothing else has to be told about it.
	 */
	const wires = $derived(
		doc.edges
			.map((edge) => {
				const from = nodeById.get(edge.from);
				const to = nodeById.get(edge.to);
				if (!from || !to) return null;
				// The other nodes, so an arrow that skips ahead goes round them.
				const points = route(from, to, doc.nodes);
				return { edge, points, head: arrowHead(points), mid: midpoint(points) };
			})
			.filter((wire): wire is NonNullable<typeof wire> => wire !== null)
	);

	/** Screen coordinates to diagram coordinates. */
	function at(event: { clientX: number; clientY: number }): Point {
		const box = svg?.getBoundingClientRect();
		if (!box) return { x: 0, y: 0 };
		return {
			x: (event.clientX - box.left - view.x) / view.scale,
			y: (event.clientY - box.top - view.y) / view.scale
		};
	}

	function nodeAt(point: Point): FlowNode | undefined {
		// Backwards: the last drawn is the one on top, so it is hit first.
		for (let i = doc.nodes.length - 1; i >= 0; i--) {
			if (hits(doc.nodes[i], point)) return doc.nodes[i];
		}
		return undefined;
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		const point = at(event);
		const node = nodeAt(point);

		if (!node) {
			if (tool) {
				const { doc: next, id } = addNode(doc, tool, round(point.x), round(point.y));
				commit(next);
				selected = id;
				tool = null;
				// On release, not now: the rest of this click ends with focus back
				// on the canvas, which would blur the name box the moment it opened.
				track(event, () => {}, () => onedit(id));
			} else {
				selected = null;
				startPan(event);
			}
			return;
		}

		selected = node.id;
		if (event.shiftKey || event.metaKey || event.ctrlKey) startLink(event, node);
		else startDrag(event, node);
	}

	function startPan(event: PointerEvent) {
		const start = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
		track(event, (move) => {
			view = { ...view, x: start.vx + (move.clientX - start.x), y: start.vy + (move.clientY - start.y) };
		});
	}

	function startDrag(event: PointerEvent, node: FlowNode) {
		const grab = at(event);
		const offset = { x: node.x - grab.x, y: node.y - grab.y };
		let moved = false;
		track(
			event,
			(move) => {
				const point = at(move);
				// Coalesced, so a drag is one step in the history rather than a
				// hundred, and the step before it is where the node started.
				commit(moveNode(doc, node.id, round(point.x + offset.x), round(point.y + offset.y)), moved);
				moved = true;
			},
			() => {
				if (!moved) return;
			}
		);
	}

	function startLink(event: PointerEvent, node: FlowNode) {
		linking = { from: node.id, to: at(event) };
		track(
			event,
			(move) => {
				linking = { from: node.id, to: at(move) };
				hovered = nodeAt(at(move))?.id ?? null;
			},
			(end) => {
				const target = nodeAt(at(end));
				if (target && target.id !== node.id) commit(connect(doc, node.id, target.id));
				linking = null;
				hovered = null;
			}
		);
	}

	/** Pointer capture, one place, so no handler forgets to let go. */
	function track(
		event: PointerEvent,
		onMove: (event: PointerEvent) => void,
		onUp?: (event: PointerEvent) => void
	) {
		// SVGElement rather than Element: the pointer events are on the former.
		const target = event.currentTarget as SVGElement;
		event.preventDefault();
		target.setPointerCapture(event.pointerId);
		const move = (e: PointerEvent) => onMove(e);
		const up = (e: PointerEvent) => {
			onUp?.(e);
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', up);
			target.removeEventListener('pointercancel', up);
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', up);
		target.addEventListener('pointercancel', up);
	}

	/** Positions land on a 8px grid, which is what keeps a diagram tidy-ish. */
	const round = (value: number) => Math.round(value / 8) * 8;

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		const box = svg?.getBoundingClientRect();
		if (!box) return;
		const scale = Math.min(2.5, Math.max(0.3, view.scale * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
		// Zoom towards the pointer rather than the corner, so the thing being
		// looked at stays under it.
		const px = event.clientX - box.left;
		const py = event.clientY - box.top;
		view = {
			scale,
			x: px - ((px - view.x) / view.scale) * scale,
			y: py - ((py - view.y) / view.scale) * scale
		};
	}

	export function fit(): void {
		if (!doc.nodes.length || !svg) return;
		const box = svg.getBoundingClientRect();
		let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
		for (const node of doc.nodes) {
			left = Math.min(left, node.x - node.w / 2);
			top = Math.min(top, node.y - node.h / 2);
			right = Math.max(right, node.x + node.w / 2);
			bottom = Math.max(bottom, node.y + node.h / 2);
		}
		const pad = 48;
		const scale = Math.min(1.4, (box.width - pad * 2) / (right - left || 1), (box.height - pad * 2) / (bottom - top || 1));
		view = {
			scale,
			x: box.width / 2 - ((left + right) / 2) * scale,
			y: box.height / 2 - ((top + bottom) / 2) * scale
		};
	}

	export function deleteSelected(): void {
		if (!selected) return;
		commit(remove(doc, [selected]));
		selected = null;
	}

	function label(node: FlowNode): string[] {
		return wrapText(node.text || '', node.shape);
	}

	function outline(node: FlowNode): string {
		const { x, y, w, h } = node;
		const l = x - w / 2;
		const t = y - h / 2;
		if (node.shape === 'decision') return `${x},${t} ${x + w / 2},${y} ${x},${t + h} ${l},${y}`;
		const skew = Math.min(w * 0.18, 26);
		return `${l + skew},${t} ${l + w},${t} ${l + w - skew},${t + h} ${l},${t + h}`;
	}
</script>

<svg
	bind:this={svg}
	class="canvas"
	class:placing={tool !== null}
	role="application"
	aria-label="Flow chart canvas. Click to place a shape, drag to move it, shift-drag from a shape to connect it."
	onpointerdown={onPointerDown}
	onwheel={onWheel}
>
	<defs>
		<pattern id="grid" width={24 * view.scale} height={24 * view.scale}
			patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
			<circle cx="1" cy="1" r="1" fill="var(--grid)" />
		</pattern>
	</defs>
	<rect class="paper" width="100%" height="100%" fill="url(#grid)" />

	<g transform="translate({view.x} {view.y}) scale({view.scale})">
		{#each wires as wire (wire.edge.id)}
			<g
				class="wire"
				class:selected={selected === wire.edge.id}
				onpointerdown={(e) => {
					e.stopPropagation();
					selected = wire.edge.id;
				}}
				role="presentation"
			>
				<path class="hit" d={pathOf(wire.points)} />
				<path class="line" d={pathOf(wire.points)} />
				<polygon
					class="head"
					points="{wire.points[wire.points.length - 1].x},{wire.points[wire.points.length - 1]
						.y} {wire.head[0].x},{wire.head[0].y} {wire.head[1].x},{wire.head[1].y}"
				/>
				{#if wire.edge.label.trim()}
					<rect
						class="label-plate"
						x={wire.mid.x - (wire.edge.label.length * 7 + 12) / 2}
						y={wire.mid.y - 11}
						width={wire.edge.label.length * 7 + 12}
						height="20"
						rx="4"
					/>
					<text class="edge-label" x={wire.mid.x} y={wire.mid.y + 4}>{wire.edge.label}</text>
				{/if}
			</g>
		{/each}

		{#if linking}
			{@const from = nodeById.get(linking.from)}
			{#if from}
				{@const start = edgeAnchor(from, linking.to)}
				<path class="linking" d="M {start.x} {start.y} L {linking.to.x} {linking.to.y}" />
			{/if}
		{/if}

		{#each doc.nodes as node (node.id)}
			<g
				class="node {node.shape}"
				class:selected={selected === node.id}
				class:target={hovered === node.id && linking !== null && linking.from !== node.id}
				ondblclick={(e) => {
					e.stopPropagation();
					onedit(node.id);
				}}
				role="presentation"
			>
				{#if node.shape === 'decision' || node.shape === 'io'}
					<polygon points={outline(node)} />
				{:else if node.shape === 'note'}
					<path
						d="M {node.x - node.w / 2} {node.y - node.h / 2} H {node.x + node.w / 2 - 14} L {node.x +
							node.w / 2} {node.y - node.h / 2 + 14} V {node.y + node.h / 2} H {node.x -
							node.w / 2} Z"
					/>
				{:else}
					<rect
						x={node.x - node.w / 2}
						y={node.y - node.h / 2}
						width={node.w}
						height={node.h}
						rx={node.shape === 'terminator' ? node.h / 2 : 10}
					/>
				{/if}

				{#each label(node) as line, i}
					<text
						class="node-label"
						x={node.x}
						y={node.y - ((label(node).length - 1) * 20) / 2 + i * 20 + 6}
					>{line}</text>
				{/each}
				{#if !node.text}
					<text class="node-label hint" x={node.x} y={node.y + 6}>double click to name</text>
				{/if}
			</g>
		{/each}
	</g>
</svg>

<style>
	.canvas {
		display: block;
		width: 100%;
		height: 100%;
		background: var(--paper);
		touch-action: none;
		cursor: grab;
	}

	.canvas.placing {
		cursor: copy;
	}

	.node rect,
	.node polygon,
	.node path {
		fill: var(--surface);
		stroke: var(--ink);
		stroke-width: 2;
		cursor: move;
	}

	.node.note rect,
	.node.note path {
		fill: oklch(0.98 0.03 95);
		stroke: var(--muted);
		stroke-width: 1.5;
	}

	.node.selected rect,
	.node.selected polygon,
	.node.selected path {
		stroke: var(--accent);
		stroke-width: 2.5;
	}

	.node.target rect,
	.node.target polygon,
	.node.target path {
		fill: var(--accent-wash);
		stroke: var(--accent);
	}

	.node-label {
		text-anchor: middle;
		font-size: 15px;
		fill: var(--ink);
		pointer-events: none;
		user-select: none;
	}

	.node-label.hint {
		fill: var(--muted);
		font-size: 13px;
		font-style: italic;
	}

	.wire .line {
		fill: none;
		stroke: var(--muted);
		stroke-width: 2;
	}

	.wire .head {
		fill: var(--muted);
	}

	/* A two pixel line is not a two pixel target. */
	.wire .hit {
		fill: none;
		stroke: transparent;
		stroke-width: 14;
		cursor: pointer;
	}

	.wire.selected .line,
	.wire.selected .head {
		stroke: var(--accent);
		fill: var(--accent);
	}

	.wire.selected .line {
		fill: none;
	}

	.label-plate {
		fill: var(--paper);
	}

	.edge-label {
		text-anchor: middle;
		font-size: 13px;
		fill: var(--muted);
		pointer-events: none;
		user-select: none;
	}

	.linking {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
</style>
