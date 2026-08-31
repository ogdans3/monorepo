<script lang="ts">
	import {
		arrowHead,
		curveOf,
		edgeAnchor,
		hits,
		midpoint,
		pathOf,
		route,
		type Point
	} from '$lib/flow/geometry';
	import {
		FONTS,
		addConnected,
		addNode,
		connect,
		dashOf,
		hasChart,
		hiddenUnder,
		insertBetween,
		moveNode,
		moveSubtree,
		nodeText,
		remove,
		resizeNode,
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
		onedit,
		onopen
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
		/**
		 * Asks the page to open what is behind a node: the panel of everything it
		 * says while presenting, and the diagram nested in it if it has one.
		 */
		onopen: (id: string) => void;
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
				const points = route(from, to, doc.nodes, edge.route);
				const back = [...points].reverse();
				return {
					edge,
					points,
					d: edge.route === 'curve' ? curveOf(points) : pathOf(points),
					dash: dashOf(edge),
					head: arrowHead(points, edge.width * 4.5),
					tail: arrowHead(back, edge.width * 4.5),
					tip: points[points.length - 1],
					start: points[0],
					mid: midpoint(points)
				};
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
		// Reached the paper, so the press was not on a control over it. The
		// controls stop the press before it gets here.
		onChrome = false;
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
		// While presenting, a box is something to open rather than something to
		// move: the audience is looking at it, and the paragraph nobody wanted on
		// the picture is exactly what you want to read out at that moment.
		if (presenting) {
			onopen(node.id);
			return;
		}
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
		// Nothing on this canvas edits during a presentation, and a double click
		// is the easiest one to leave in by accident: it lands on the paper and
		// quietly adds a step to the diagram being presented.
		if (presenting) return;
		// A press the fold button or a bud already dealt with. It never reached
		// the canvas as a pointerdown, but a double click arrives here anyway,
		// either by bubbling or by the capture retarget, and it used to be read
		// as a double click on empty paper: press a fold button twice and get a
		// new step for it.
		if (onChrome) return;
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

	/**
	 * Whether the last press landed on a control drawn over the paper rather
	 * than on the paper. Set where those controls stop the press, cleared by
	 * the canvas' own handler, which only runs when nothing stopped it.
	 */
	let onChrome = false;

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
		onChrome = true;
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
		// Dragging a box is usually making room, not detaching it from what comes
		// after, so the branch under it comes along and keeps its shape. Alt is
		// the way to move the one box, decided when the drag starts so that
		// letting go of the key halfway through does not change what is moving.
		const alone = event.altKey;
		track(
			event,
			(move) => {
				const point = at(move);
				const x = round(point.x + offset.x);
				const y = round(point.y + offset.y);
				// Coalesced, so a drag is one step in the history rather than a
				// hundred, and the step before it is where the node started.
				commit(alone ? moveNode(full, node.id, x, y) : moveSubtree(full, node.id, x, y), moved);
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

	/**
	 * How much of a zoom one pixel of scroll is worth.
	 *
	 * A step per event rather than per pixel is what makes a trackpad
	 * unusable: it sends a stream of small deltas, and a fixed step turns each
	 * one into a full notch, so a light two-finger push crosses the whole zoom
	 * range. Going by the distance scrolled makes the trackpad proportional
	 * and leaves a mouse wheel, which is around 100px a notch, at about 8% a
	 * notch. Exponential so that in and out are exact opposites.
	 */
	const ZOOM_PER_PX = 0.0008;
	/** Wheels that report lines or pages, turned into something like pixels. */
	const DELTA_UNIT = [1, 16, 800];

	function onWheel(event: WheelEvent) {
		event.preventDefault();
		const box = svg?.getBoundingClientRect();
		if (!box) return;
		const delta = event.deltaY * (DELTA_UNIT[event.deltaMode] ?? 1);
		const scale = Math.min(2.5, Math.max(0.3, view.scale * Math.exp(-delta * ZOOM_PER_PX)));
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

	/** Folds a branch away, or brings it back. */
	function toggleCollapse(node: FlowNode) {
		commit(updateNode(full, node.id, { collapsed: !node.collapsed }));
	}

	/**
	 * The fold button, on every node set to fold, always: open or shut, selected
	 * or not, and in a presentation too. A control that only turns up once the
	 * branch is already hidden is one you can fold exactly once.
	 */
	function badge(node: FlowNode): { count: number; x: number; y: number } | null {
		if (!node.foldable) return null;
		return {
			count: node.collapsed ? hiddenUnder(full, node.id) : 0,
			x: node.x,
			y: node.y + node.h / 2
		};
	}

	/** The corners of a selected node, for dragging its size. */
	const CORNERS = [
		{ id: 'nw', sx: -1, sy: -1 },
		{ id: 'ne', sx: 1, sy: -1 },
		{ id: 'sw', sx: -1, sy: 1 },
		{ id: 'se', sx: 1, sy: 1 }
	] as const;

	function startResize(event: PointerEvent, node: FlowNode, sx: number, sy: number) {
		event.stopPropagation();
		onChrome = true;
		const start = at(event);
		const from = { w: node.w, h: node.h, x: node.x, y: node.y };
		let changed = false;
		track(event, (move) => {
			const point = at(move);
			// The opposite corner stays put, so the box grows the way the hand is
			// going rather than from the middle outwards.
			const w = Math.max(1, from.w + (point.x - start.x) * sx);
			const h = Math.max(1, from.h + (point.y - start.y) * sy);
			const sized = resizeNode(full, node.id, w, h);
			const made = sized.nodes.find((item) => item.id === node.id)!;
			commit(
				moveNode(
					sized,
					node.id,
					from.x + ((made.w - from.w) / 2) * sx,
					from.y + ((made.h - from.h) / 2) * sy
				),
				changed
			);
			changed = true;
		});
	}

	/**
	 * Puts a step in the middle of the selected arrow.
	 *
	 * On the arrow rather than in a menu because that is where the answer to
	 * "between which two?" already is, and because correcting a diagram by
	 * adding a step in the middle is the commonest correction there is.
	 */
	function insertStep(edgeId: string) {
		const result = insertBetween(full, edgeId);
		if (!result) return;
		commit(result.doc);
		selected = result.id;
		onedit(result.id);
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
				<path class="hit" d={wire.d} />
				<path
					class="line"
					d={wire.d}
					style:stroke={wire.edge.colour}
					stroke-width={wire.edge.width}
					stroke-dasharray={wire.dash}
				/>
				{#if wire.edge.head === 'dot'}
					<circle
						class="cap"
						style:fill={wire.edge.colour}
						cx={wire.tip.x}
						cy={wire.tip.y}
						r={wire.edge.width * 2}
					/>
				{:else if wire.edge.head !== 'none'}
					<polygon
						class="cap"
						class:hollow={wire.edge.head === 'hollow'}
						style:fill={wire.edge.head === 'hollow' ? 'var(--paper)' : wire.edge.colour}
						style:stroke={wire.edge.colour}
						stroke-width={wire.edge.width}
						points="{wire.tip.x},{wire.tip.y} {wire.head[0].x},{wire.head[0].y} {wire.head[1]
							.x},{wire.head[1].y}"
					/>
				{/if}
				{#if wire.edge.tail === 'dot'}
					<circle
						class="cap"
						style:fill={wire.edge.colour}
						cx={wire.start.x}
						cy={wire.start.y}
						r={wire.edge.width * 2}
					/>
				{:else if wire.edge.tail !== 'none'}
					<polygon
						class="cap"
						style:fill={wire.edge.tail === 'hollow' ? 'var(--paper)' : wire.edge.colour}
						style:stroke={wire.edge.colour}
						stroke-width={wire.edge.width}
						points="{wire.start.x},{wire.start.y} {wire.tail[0].x},{wire.tail[0].y} {wire.tail[1]
							.x},{wire.tail[1].y}"
					/>
				{/if}
				<!-- Only on the selected arrow: a target on every line would put a
				     button between the writer and the diagram they are reading. -->
				{#if selected === wire.edge.id && !presenting}
					<g
						class="insert"
						role="button"
						tabindex="-1"
						aria-label="Add a step here"
						onpointerdown={(e) => {
							e.stopPropagation();
							onChrome = true;
							insertStep(wire.edge.id);
						}}
					>
						<circle cx={wire.mid.x} cy={wire.mid.y} r="11" />
						<path
							d="M {wire.mid.x - 5} {wire.mid.y} L {wire.mid.x + 5} {wire.mid.y}
							   M {wire.mid.x} {wire.mid.y - 5} L {wire.mid.x} {wire.mid.y + 5}"
						/>
					</g>
				{/if}
				{#if wire.edge.label.trim() && !(selected === wire.edge.id && !presenting)}
					<rect
						class="label-plate"
						x={wire.mid.x - (wire.edge.label.length * 7 + 12) / 2}
						y={wire.mid.y - 11}
						width={wire.edge.label.length * 7 + 12}
						height="20"
						rx="4"
					/>
					<text class="edge-label" style:fill={wire.edge.colour} x={wire.mid.x} y={wire.mid.y + 4}
						>{wire.edge.label}</text
					>
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

				<!-- Runs rather than a string, and xml:space so the indent under a
				     wrapped bullet survives. Both match the exported SVG line for
				     line, because the model laid them out once for both. -->
				{#each text.lines as line, i (i)}
					<text
						class="node-label {line.kind}"
						xml:space="preserve"
						x={line.align === 'center' ? node.x : node.x - text.textWidth / 2}
						y={node.y - text.textHeight / 2 + line.y}
						text-anchor={line.align === 'center' ? 'middle' : 'start'}
						font-family={FONTS[node.font].stack}
						font-size={line.size}
						font-weight={line.kind === 'title' && node.bold ? 700 : 400}
						font-style={node.italic ? 'italic' : 'normal'}
						>{#each line.runs as run, r (r)}<tspan
								font-weight={run.bold ? 700 : null}
								font-style={run.italic ? 'italic' : null}>{run.text}</tspan
							>{/each}</text
					>
				{/each}
				{#if !node.title && !presenting}
					<text class="node-label hint" text-anchor="middle" x={node.x} y={node.y + 5}
						>double click to write</text
					>
				{/if}
				<!-- A box with a diagram behind it says so on the box. Without a
				     mark the nesting is invisible, and detail nobody can see they
				     can open is detail nobody opens. -->
				{#if hasChart(node)}
					<g
						class="has-chart"
						role="button"
						tabindex="-1"
						aria-label={`Open the diagram inside ${node.title || 'this step'}`}
						onpointerdown={(e) => {
							e.stopPropagation();
							onChrome = true;
							onopen(node.id);
						}}
					>
						<rect x={node.x + node.w / 2 - 26} y={node.y + node.h / 2 - 20} width="20" height="15" rx="3" />
						<rect x={node.x + node.w / 2 - 22} y={node.y + node.h / 2 - 24} width="20" height="15" rx="3" />
					</g>
				{/if}
			</g>
		{/each}
		{#each doc.nodes as node (node.id)}
			{@const mark = badge(node)}
			<!-- Always, once the node is set to fold. Gating it on the selection is
			     how you end up with a branch you can hide and not get back. -->
			{#if mark}
				{@const wide = node.collapsed ? 52 : 34}
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
						onChrome = true;
						toggleCollapse(node);
					}}
				>
					<rect x={mark.x - wide / 2} y={mark.y - 13} width={wide} height="26" rx="13" />
					{#if node.collapsed}
						<text x={mark.x + 5} y={mark.y + 5}>{mark.count}</text>
						<path
							d="M {mark.x - 15} {mark.y - 3} L {mark.x - 9} {mark.y + 4} L {mark.x - 3} {mark.y -
								3}"
						/>
					{:else}
						<path
							d="M {mark.x - 7} {mark.y + 3} L {mark.x} {mark.y - 4} L {mark.x + 7} {mark.y + 3}"
						/>
					{/if}
				</g>
			{/if}
		{/each}

		{#if selectedNode && !presenting}
			{#each CORNERS as corner (corner.id)}
				<rect
					class="grip"
					role="button"
					tabindex="-1"
					aria-label="Resize from the {corner.id} corner"
					x={selectedNode.x + (corner.sx * selectedNode.w) / 2 - 5}
					y={selectedNode.y + (corner.sy * selectedNode.h) / 2 - 5}
					width="10"
					height="10"
					rx="2"
					style:cursor={corner.sx === corner.sy ? 'nwse-resize' : 'nesw-resize'}
					onpointerdown={(e) => startResize(e, selectedNode, corner.sx, corner.sy)}
				/>
			{/each}
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

	/*
	 * No text-anchor here. It used to be `middle`, which is a CSS property in
	 * SVG and therefore beats the attribute the markup sets per line — so a
	 * left-aligned subtitle stayed centred and hung out of its own box. The
	 * anchor is decided per line by the model, and set as an attribute.
	 */
	.node-label {
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
		font: 600 13px var(--font-mono);
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

	/*
	 * The + that puts a step in the middle of an arrow. Round and accent, like
	 * the buds on a shape, because it is the same idea in the same visual
	 * language: the only round things on the canvas are the ones that add.
	 */
	.insert circle {
		fill: var(--accent);
		stroke: var(--paper);
		stroke-width: 2;
		cursor: pointer;
	}

	.insert path {
		stroke: var(--paper);
		stroke-width: 2;
		stroke-linecap: round;
		pointer-events: none;
	}

	.insert:hover circle {
		fill: var(--accent-deep);
	}

	/*
	 * Two offset pages in the corner of a box that has a diagram behind it.
	 * Drawn in the muted ink rather than the accent: it is part of the drawing,
	 * not part of the editor, and it has to survive into the exported picture.
	 */
	.has-chart rect {
		fill: var(--surface);
		stroke: var(--muted);
		stroke-width: 1.5;
		cursor: pointer;
	}

	.has-chart:hover rect {
		stroke: var(--accent);
	}

	.cap.hollow {
		stroke-linejoin: round;
	}

	.grip {
		fill: var(--surface);
		stroke: var(--accent);
		stroke-width: 1.5;
	}

	.linking {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-dasharray: 6 4;
	}
</style>
