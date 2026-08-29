<script lang="ts">
	import { arrowHead, edgeAnchor, hits, midpoint, pathOf, route, type Point } from '$lib/flow/geometry';
	import {
		addConnected,
		addNode,
		connect,
		hasChildren,
		hiddenUnder,
		moveNode,
		nodeText,
		remove,
		updateNode,
		visibleDoc,
		type Direction,
		type FlowDoc,
		type FlowNode,
		type NodeShape
	} from '$lib/flow/model';

	let {
		doc: full,
		selected = $bindable(),
		tool = $bindable(),
		presenting = false,
		commit,
		onedit
	}: {
		doc: FlowDoc;
		/** Ids of the selected node or edge. One at a time is enough here. */
		selected: string | null;
		/** The shape the next click on empty paper drops, or null to just select. */
		tool: NodeShape | null;
		/** Presenting hides everything that is about editing. */
		presenting?: boolean;
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

	/**
	 * What is on screen: the document minus whatever the collapsed nodes are
	 * holding back. Every hit test, route and drag works on this, so a folded
	 * branch is not merely invisible, it is not there to be clicked either.
	 */
	const doc = $derived(visibleDoc(full));
	const nodeById = $derived(new Map(doc.nodes.map((node) => [node.id, node])));
	const selectedNode = $derived(doc.nodes.find((node) => node.id === selected) ?? null);

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
				place(event, tool, point);
				tool = null;
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

	/**
	 * Every double click on the canvas, wherever it looks like it landed.
	 *
	 * It has to be handled here rather than on each shape, because the drag
	 * handling captures the pointer and a captured pointer retargets the click
	 * pair to the element that captured it. Putting `ondblclick` on the shape
	 * looks right and never fires, which is how double clicking a box to write
	 * in it silently did nothing.
	 */
	function onDoubleClick(event: MouseEvent) {
		const point = at(event);
		const node = nodeAt(point);
		if (node) {
			selected = node.id;
			onedit(node.id);
			return;
		}
		// The first click of this pair will have selected an arrow if there was
		// one under it, so that is how an arrow gets its label.
		if (selected && doc.edges.some((edge) => edge.id === selected)) {
			onedit(selected);
			return;
		}
		place(event as unknown as PointerEvent, 'process', point);
	}

	function place(event: PointerEvent, shape: NodeShape, point: { x: number; y: number }) {
		const { doc: next, id } = addNode(full, shape, round(point.x), round(point.y));
		commit(next);
		selected = id;
		// On release, not now: the rest of this click ends with focus back on the
		// canvas, which would blur the name box the moment it opened.
		if (event.pointerId !== undefined) track(event, () => {}, () => onedit(id));
		else queueMicrotask(() => onedit(id));
	}

	/**
	 * The four buds on a selected node.
	 *
	 * Clicking one adds the next step already joined on, which is how a flow
	 * chart gets drawn: one thing after another, not a pile of boxes wired up
	 * afterwards. Dragging one instead lands it wherever you let go, or joins an
	 * existing node if you let go on top of it. Shift-drag still works and is
	 * still not something anybody discovers on their own, which is why these
	 * exist.
	 */
	const BUD_OFFSET = 16;

	function buds(node: FlowNode): { dir: Direction; x: number; y: number }[] {
		return [
			{ dir: 'down', x: node.x, y: node.y + node.h / 2 + BUD_OFFSET },
			{ dir: 'up', x: node.x, y: node.y - node.h / 2 - BUD_OFFSET },
			{ dir: 'right', x: node.x + node.w / 2 + BUD_OFFSET, y: node.y },
			{ dir: 'left', x: node.x - node.w / 2 - BUD_OFFSET, y: node.y }
		];
	}

	function onBud(event: PointerEvent, node: FlowNode, dir: Direction) {
		event.stopPropagation();
		let dragged = false;
		track(
			event,
			(move) => {
				dragged = true;
				linking = { from: node.id, to: at(move) };
				hovered = nodeAt(at(move))?.id ?? null;
			},
			(end) => {
				const wasDragging = dragged;
				linking = null;
				hovered = null;
				if (!wasDragging) {
					// A click: the next step, in the direction of the bud.
					const added = addConnected(full, node.id, dir);
					if (!added) return;
					commit(added.doc);
					selected = added.id;
					queueMicrotask(() => onedit(added.id));
					return;
				}
				const point = at(end);
				const target = nodeAt(point);
				if (target && target.id !== node.id) {
					commit(connect(full, node.id, target.id));
					selected = target.id;
					return;
				}
				// Dropped on empty paper: a new step, there, joined on.
				const { doc: withNode, id } = addNode(full, 'process', round(point.x), round(point.y));
				commit(connect(withNode, node.id, id));
				selected = id;
				queueMicrotask(() => onedit(id));
			}
		);
	}

	function startPan(event: PointerEvent) {
		const start = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
		track(event, (move) => {
			view = { ...view, x: start.vx + (move.clientX - start.x), y: start.vy + (move.clientY - start.y) };
		});
	}

	/**
	 * Drawing and hit testing use the visible slice; every change below is made
	 * against the whole document. The ids are the same in both, so an edit needs
	 * no translation, and a folded branch cannot be quietly dropped by an
	 * operation that never saw it.
	 */
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
				commit(moveNode(full, node.id, round(point.x + offset.x), round(point.y + offset.y)), moved);
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
				if (target && target.id !== node.id) commit(connect(full, node.id, target.id));
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
		// Deliberately no preventDefault. It stops the browser building the pair
		// of clicks a double click is made of, which is how double clicking a
		// shape to write in it quietly stopped working. Text selection during a
		// drag is handled with user-select in the stylesheet instead.
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
		commit(remove(full, [selected]));
		selected = null;
	}

	const FONTS = {
		sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
		serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
		mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
	};

	/** Folds a branch away, or brings it back. */
	function toggleCollapse(node: FlowNode) {
		commit(updateNode(full, node.id, { collapsed: !node.collapsed }));
	}

	/** The little handle that says how many are folded away under a node. */
	function badge(node: FlowNode): { count: number; x: number; y: number } | null {
		if (!hasChildren(full, node.id)) return null;
		const count = node.collapsed ? hiddenUnder(full, node.id) : 0;
		if (!node.collapsed && !presenting) return { count: 0, x: node.x, y: node.y + node.h / 2 };
		if (!node.collapsed) return null;
		return { count, x: node.x, y: node.y + node.h / 2 };
	}

	/** The diamond, as the only shape that is not a rounded rectangle. */
	function outline(node: FlowNode): string {
		const { x, y, w, h } = node;
		return `${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}`;
	}
</script>

<svg
	bind:this={svg}
	class="canvas"
	class:placing={tool !== null}
	role="application"
	aria-label="Flow chart canvas. Click to place a shape, drag to move it, shift-drag from a shape to connect it."
	onpointerdown={onPointerDown}
	ondblclick={onDoubleClick}
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
			<!-- No ondblclick here: see onDoubleClick, which owns it for the canvas. -->
			{@const text = nodeText(node)}
			<g
				class="node {node.shape}"
				class:selected={selected === node.id}
				class:target={hovered === node.id && linking !== null && linking.from !== node.id}
				role="presentation"
			>
				{#if node.shape === 'decision'}
					<polygon points={outline(node)} style:fill={node.colour} />
				{:else}
					<rect
						style:fill={node.colour}
						x={node.x - node.w / 2}
						y={node.y - node.h / 2}
						width={node.w}
						height={node.h}
						rx={node.shape === 'terminator' ? node.h / 2 : 10}
					/>
				{/if}

				{#each text.lines as line, i (i)}
					<text
						class="node-label {line.kind}"
						x={node.x}
						y={node.y - text.textHeight / 2 + line.y}
						font-family={FONTS[node.font]}
						font-size={line.size}
						font-weight={line.kind === 'title' && node.bold ? 700 : 400}
						font-style={node.italic ? 'italic' : 'normal'}>{line.text}</text
					>
				{/each}
				{#if !node.title && !presenting}
					<text class="node-label hint" x={node.x} y={node.y + 5}>double click to write</text>
				{/if}
			</g>
		{/each}
		{#each doc.nodes as node (node.id)}
			{@const mark = badge(node)}
			{#if mark && (node.collapsed || selected === node.id)}
				<g
					class="fold"
					class:folded={node.collapsed}
					role="button"
					tabindex="-1"
					aria-label={node.collapsed
						? `Open the ${mark.count} steps under ${node.title || 'this'}`
						: `Fold away what is under ${node.title || 'this'}`}
					onpointerdown={(e) => {
						e.stopPropagation();
						toggleCollapse(node);
					}}
				>
					<rect x={mark.x - (node.collapsed ? 18 : 11)} y={mark.y - 9} width={node.collapsed ? 36 : 22} height="18" rx="9" />
					{#if node.collapsed}
						<text x={mark.x} y={mark.y + 4}>+{mark.count}</text>
					{:else}
						<path d="M {mark.x - 5} {mark.y - 2} L {mark.x} {mark.y + 3} L {mark.x + 5} {mark.y - 2}" />
					{/if}
				</g>
			{/if}
		{/each}

		{#if selectedNode && !presenting}
			{#each buds(selectedNode) as bud (bud.dir)}
				<g
					class="bud"
					role="button"
					tabindex="-1"
					aria-label="Add a step {bud.dir} from here"
					onpointerdown={(e) => onBud(e, selectedNode, bud.dir)}
				>
					<circle cx={bud.x} cy={bud.y} r="11" />
					<path
						d="M {bud.x - 5} {bud.y} H {bud.x + 5} M {bud.x} {bud.y - 5} V {bud.y + 5}"
					/>
				</g>
			{/each}
		{/if}
	</g>
</svg>

<style>
	.canvas {
		display: block;
		width: 100%;
		height: 100%;
		background: var(--paper);
		touch-action: none;
		user-select: none;
		cursor: grab;
	}

	.canvas.placing {
		cursor: copy;
	}

	.node rect,
	.node polygon {
		fill: var(--surface);
		stroke: var(--ink);
		stroke-width: 2;
		cursor: move;
	}

	.node.selected rect,
	.node.selected polygon {
		stroke: var(--accent);
		stroke-width: 2.5;
	}

	.node.target rect,
	.node.target polygon {
		fill: var(--accent-wash);
		stroke: var(--accent);
	}

	.node-label {
		text-anchor: middle;
		fill: var(--ink);
		pointer-events: none;
		user-select: none;
	}

	.node-label.subtitle,
	.node-label.body {
		fill: var(--muted);
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

	/* Drawn after every node, because SVG paints in source order and a bud
	   underneath the box next door is a button nobody can press. */
	.bud circle {
		fill: var(--surface);
		stroke: var(--accent);
		stroke-width: 1.5;
		cursor: crosshair;
	}

	.bud path {
		stroke: var(--accent);
		stroke-width: 1.75;
		stroke-linecap: round;
		pointer-events: none;
	}

	.bud:hover circle {
		fill: var(--accent);
	}

	.bud:hover path {
		stroke: #fff;
	}

	/*
	 * The fold handle sits on the bottom edge. A chevron while the branch is
	 * open, a count once it is closed, because "+3" is the only thing that says
	 * there is something there to bring back.
	 */
	.fold rect {
		fill: var(--surface);
		stroke: var(--line);
		stroke-width: 1;
		cursor: pointer;
	}

	.fold text {
		text-anchor: middle;
		font: 600 11px var(--font-mono);
		fill: var(--muted);
		pointer-events: none;
		user-select: none;
	}

	.fold path {
		fill: none;
		stroke: var(--muted);
		stroke-width: 1.75;
		stroke-linecap: round;
		pointer-events: none;
	}

	.fold.folded rect {
		fill: var(--accent-wash);
		stroke: var(--accent);
	}

	.fold.folded text {
		fill: var(--accent-deep);
	}

	.fold:hover rect {
		border-color: var(--muted);
		stroke: var(--muted);
	}

	.linking {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
</style>
