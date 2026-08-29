/**
 * The document, and every change you can make to it.
 *
 * One shape, kept plain: a list of nodes and a list of edges, both serialisable
 * as they stand. That is what makes save, load, undo and export the same
 * problem rather than four. Every operation here returns a new document instead
 * of editing one, so the history is a list of documents and undo is an index
 * into it, with no journal of inverse operations to get wrong.
 */

/**
 * Three shapes, which is what a flow chart is made of: something happens,
 * something is decided, and the thing starts or stops. Every other shape in the
 * old stencils is a distinction the reader has to be taught, and a menu the
 * writer has to think about, in exchange for nothing the words in the box do
 * not already say.
 */
export type NodeShape = 'process' | 'decision' | 'terminator';

/**
 * Faces to write in. Three are on chips because they are what nearly everybody
 * picks; the rest are in the dropdown beside them, because the day you want a
 * condensed grotesque for a wall poster you really do want it, and a list of
 * ten is not a menu anybody has to read.
 */
export const FONTS = {
	sans: { label: 'Plain', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
	serif: { label: 'Serif', stack: "Georgia, 'Iowan Old Style', 'Times New Roman', serif" },
	mono: { label: 'Mono', stack: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
	humanist: { label: 'Humanist', stack: "'Segoe UI', Tahoma, Verdana, sans-serif" },
	grotesque: { label: 'Grotesque', stack: "Helvetica, 'Helvetica Neue', Arial, sans-serif" },
	rounded: { label: 'Rounded', stack: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif" },
	slab: { label: 'Slab', stack: "Rockwell, 'Courier Bold', Georgia, serif" },
	book: { label: 'Book', stack: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif" },
	narrow: { label: 'Narrow', stack: "'Arial Narrow', 'Helvetica Neue Condensed', Impact, sans-serif" },
	hand: { label: 'Hand', stack: "'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive" }
} as const;

export type FontKey = keyof typeof FONTS;

/** The three that sit on chips. The rest are one click further away. */
export const QUICK_FONTS: FontKey[] = ['sans', 'serif', 'mono'];

export const FONT_LABELS = Object.fromEntries(
	Object.entries(FONTS).map(([key, font]) => [key, font.label])
) as Record<FontKey, string>;

export interface FlowNode {
	id: string;
	shape: NodeShape;
	/**
	 * Three pieces of text, because a box in a flow chart is usually a name with
	 * something behind it. The title is always on the shape. The subtitle is the
	 * qualifier that makes the name exact, shown by default because it is
	 * usually short and usually needed. The body is the paragraph nobody wants
	 * on the diagram but everybody wants somewhere, so it is hidden by default
	 * and always readable in the panel.
	 */
	title: string;
	subtitle: string;
	body: string;
	showSubtitle: boolean;
	showBody: boolean;
	/** Fill. The outline and the text are derived from it, never set apart. */
	colour: string;
	font: FontKey;
	/** Title size in diagram units. The other two follow from it. */
	size: number;
	bold: boolean;
	italic: boolean;
	/**
	 * How many lines of the body to show on the shape before cutting it off with
	 * an ellipsis. Zero shows all of it. The rest is always in the panel: this
	 * decides how much of it is on the picture, which is a different question.
	 */
	bodyClamp: number;
	/**
	 * Whether this node can be folded at all. A setting rather than a state, so
	 * the button that folds and unfolds it is always there to press: a fold you
	 * cannot undo without hunting through a panel is a fold nobody uses twice.
	 */
	foldable: boolean;
	/** Hides everything that hangs off this node until it is opened again. */
	collapsed: boolean;
	/**
	 * True once somebody has dragged the corners. After that the box is the size
	 * they made it and text stops pushing it around, which is the whole point of
	 * having dragged it.
	 */
	sized: boolean;
	/** Centre of the node, in diagram coordinates. */
	x: number;
	y: number;
	w: number;
	h: number;
}

/** How the line is drawn: solid unless it means something else. */
export type LineStyle = 'solid' | 'dashed' | 'dotted';
/** What sits at each end. */
export type EndCap = 'none' | 'arrow' | 'hollow' | 'dot';
/** The path it takes between two shapes. */
export type EdgeRoute = 'elbow' | 'straight' | 'curve';

export interface FlowEdge {
	id: string;
	from: string;
	to: string;
	/** Shown on the line. A decision's branches are the reason this exists. */
	label: string;
	style: LineStyle;
	/** Stroke width in diagram units. */
	width: number;
	colour: string;
	/** An arrow at the far end by default, and nothing at the near end. */
	head: EndCap;
	tail: EndCap;
	route: EdgeRoute;
}

export const EDGE_COLOUR = '#6b6355';

export function edgeDefaults(): Omit<FlowEdge, 'id' | 'from' | 'to'> {
	return {
		label: '',
		style: 'solid',
		width: 2,
		colour: EDGE_COLOUR,
		head: 'arrow',
		tail: 'none',
		route: 'elbow'
	};
}

export const LINE_STYLE_LABELS: Record<LineStyle, string> = {
	solid: 'Solid',
	dashed: 'Dashed',
	dotted: 'Dotted'
};

export const END_CAP_LABELS: Record<EndCap, string> = {
	none: 'None',
	arrow: 'Arrow',
	hollow: 'Hollow',
	dot: 'Dot'
};

export const EDGE_ROUTE_LABELS: Record<EdgeRoute, string> = {
	elbow: 'Elbow',
	straight: 'Straight',
	curve: 'Curved'
};

/** The dash pattern for a style, scaled so it still reads on a thick line. */
export function dashOf(edge: Pick<FlowEdge, 'style' | 'width'>): string | undefined {
	if (edge.style === 'dashed') return `${edge.width * 3} ${edge.width * 2.2}`;
	if (edge.style === 'dotted') return `${edge.width * 0.1} ${edge.width * 2}`;
	return undefined;
}

export function updateEdge(doc: FlowDoc, id: string, patch: Partial<FlowEdge>): FlowDoc {
	return {
		...doc,
		edges: doc.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge))
	};
}

export interface FlowDoc {
	nodes: FlowNode[];
	edges: FlowEdge[];
}

export interface Point {
	x: number;
	y: number;
}

export const EMPTY: FlowDoc = { nodes: [], edges: [] };

/** Default size per shape, in diagram units. Text can push the width out. */
export const SIZES: Record<NodeShape, { w: number; h: number }> = {
	process: { w: 168, h: 64 },
	decision: { w: 176, h: 100 },
	terminator: { w: 148, h: 56 }
};

export const SHAPE_LABELS: Record<NodeShape, string> = {
	process: 'Step',
	decision: 'Decision',
	terminator: 'Start or end'
};

/** The white a box is unless somebody chooses otherwise. */
export const NO_COLOUR = '#ffffff';

/**
 * Colours to start from: pale enough that black text still reads on them, and
 * far enough apart to mean different things at a glance. A custom colour can be
 * anything, and the recent ones sit beside these in the panel.
 */
export const SWATCHES = [
	NO_COLOUR,
	'#fde8e8',
	'#fdf0d5',
	'#fbf8cc',
	'#e4f5e4',
	'#dcf1f4',
	'#e5e6fb',
	'#f6e4f6',
	'#eceff1'
];

export const SIZE_STEPS = [13, 15, 18, 22, 28];
export const DEFAULT_SIZE = 15;

/** The most recently chosen colours, newest first and without repeats. */
export function withRecent(recent: string[], colour: string, limit = 8): string[] {
	const clean = colour.trim().toLowerCase();
	if (!clean || clean === NO_COLOUR) return recent;
	return [clean, ...recent.filter((item) => item.toLowerCase() !== clean)].slice(0, limit);
}

/** Everything a node needs that a caller has not said anything about. */
export function nodeDefaults(): Omit<FlowNode, 'id' | 'shape' | 'x' | 'y' | 'w' | 'h'> {
	return {
		title: '',
		subtitle: '',
		body: '',
		showSubtitle: true,
		showBody: false,
		colour: NO_COLOUR,
		font: 'sans',
		size: DEFAULT_SIZE,
		bold: false,
		italic: false,
		bodyClamp: 0,
		foldable: false,
		collapsed: false,
		sized: false
	};
}

export const SIZE_MIN = 10;
export const SIZE_MAX = 48;
export const MIN_NODE = { w: 72, h: 44 };

/** Shapes that were offered once and now fold into the nearest one that stayed. */
const RETIRED: Record<string, NodeShape> = { io: 'process', note: 'process' };

/**
 * How wide a line of text is allowed to get before it wraps, per shape. A
 * diamond holds less because its corners are empty, and a step holds a real
 * paragraph: a box people can only fit four words into is a box they work
 * around by writing somewhere else.
 */
const WRAP_AT: Record<NodeShape, number> = {
	process: 30,
	decision: 20,
	terminator: 24
};

let counter = 0;

/**
 * Ids are only ever compared, never parsed, so a counter is enough and keeps
 * a saved file readable. `seed` exists so a load can carry on past whatever
 * the file already used rather than colliding with it.
 */
export function nextId(prefix = 'n'): string {
	counter += 1;
	return `${prefix}${counter}`;
}

export function seedIds(doc: FlowDoc): void {
	for (const item of [...doc.nodes, ...doc.edges]) {
		const n = Number(String(item.id).replace(/^[a-z]+/i, ''));
		if (Number.isFinite(n)) counter = Math.max(counter, n);
	}
}

/**
 * How big a node has to be to hold its text. Measured in characters rather than
 * pixels because this file never touches a DOM, and the canvas wraps to the
 * same rule.
 *
 * Width stops at what the wrap allows, so a long note grows downwards instead
 * of sideways into a box the width of the page. Height has no ceiling: a step
 * that needs a paragraph gets a paragraph, because the alternative is somebody
 * abbreviating their own diagram to fit a box.
 */
export interface TextLine {
	text: string;
	kind: 'title' | 'subtitle' | 'body';
	size: number;
	/** Baseline, measured down from the top of the whole block of text. */
	y: number;
}

export interface NodeText {
	lines: TextLine[];
	/** Height of the text itself, before the shape's padding. */
	textHeight: number;
	w: number;
	h: number;
}

/** Roughly how wide a character is. Enough to size a box around it. */
const charWidth = (size: number, bold: boolean) => size * (bold ? 0.6 : 0.56);

const LINE_HEIGHT = 1.35;
const SUB_RATIO = 0.82;
const BODY_RATIO = 0.76;
const BLOCK_GAP = 0.45;

type TextOf = Pick<
	FlowNode,
	| 'shape'
	| 'title'
	| 'subtitle'
	| 'body'
	| 'showSubtitle'
	| 'showBody'
	| 'bodyClamp'
	| 'font'
	| 'size'
	| 'bold'
	| 'italic'
>;

/**
 * The lines a node shows, where each one sits, and how big the box has to be
 * to hold them.
 *
 * One function for both, because the canvas and the exported SVG have to agree
 * about it exactly: two wrapping rules means a label that fits on screen and
 * overflows in the file. Everything downstream draws what this returns.
 */
export function nodeText(node: TextOf): NodeText {
	const blocks: { text: string; kind: TextLine['kind']; size: number }[] = [
		{ text: node.title, kind: 'title', size: node.size }
	];
	if (node.showSubtitle && node.subtitle.trim()) {
		blocks.push({
			text: node.subtitle,
			kind: 'subtitle',
			size: Math.round(node.size * SUB_RATIO)
		});
	}
	if (node.showBody && node.body.trim()) {
		blocks.push({ text: node.body, kind: 'body', size: Math.round(node.size * BODY_RATIO) });
	}

	const lines: TextLine[] = [];
	let y = 0;
	let widest = 0;
	for (const [index, block] of blocks.entries()) {
		if (index > 0) y += block.size * BLOCK_GAP;
		for (const line of clamped(wrapText(block.text, node.shape), block.kind, node.bodyClamp)) {
			const height = block.size * LINE_HEIGHT;
			y += height;
			lines.push({ text: line, kind: block.kind, size: block.size, y: y - height * 0.28 });
			widest = Math.max(widest, charWidth(block.size, node.bold) * line.length);
		}
	}

	const base = SIZES[node.shape];
	const padX = node.shape === 'decision' ? 96 : 44;
	const padY = node.shape === 'decision' ? 44 : 26;
	return {
		lines,
		textHeight: y,
		w: Math.max(base.w, Math.round(widest + padX)),
		h: Math.max(base.h, Math.round(y + padY))
	};
}

/**
 * Cuts a block off after so many lines and marks the cut with an ellipsis.
 *
 * The ellipsis replaces the tail of the last line it keeps rather than sitting
 * on a line of its own, because a box that ends "...\n..." looks broken, and
 * the point of clamping is that the shape stays the size of a shape.
 */
function clamped(lines: string[], kind: TextLine['kind'], limit: number): string[] {
	if (kind !== 'body' || limit <= 0 || lines.length <= limit) return lines;
	const kept = lines.slice(0, limit);
	const last = kept[kept.length - 1].replace(/[\s.,;:]+$/, '');
	kept[kept.length - 1] = `${last}…`;
	return kept;
}

/**
 * Just the size. A box somebody has dragged keeps the size they made it: after
 * that, text moving the walls around is the tool undoing their work.
 */
export function fitSize(node: TextOf & Partial<Pick<FlowNode, 'sized' | 'w' | 'h'>>): {
	w: number;
	h: number;
} {
	if (node.sized && node.w && node.h) return { w: node.w, h: node.h };
	const { w, h } = nodeText(node);
	return { w, h };
}

/** A box dragged by its corner, never smaller than something you can grab. */
export function resizeNode(doc: FlowDoc, id: string, w: number, h: number): FlowDoc {
	return {
		...doc,
		nodes: doc.nodes.map((node) =>
			node.id === id
				? {
						...node,
						sized: true,
						w: Math.max(MIN_NODE.w, Math.round(w)),
						h: Math.max(MIN_NODE.h, Math.round(h))
					}
				: node
		)
	};
}

/**
 * Greedy wrap, and line breaks the writer typed are kept. Someone who presses
 * Enter in the middle of a label means it, and reflowing it is the editor
 * arguing with them. A word longer than the line is left alone rather than
 * broken, since it is usually a name or a URL that is worse in two pieces.
 */
export function wrapText(text: string, shape: NodeShape = 'process'): string[] {
	const limit = WRAP_AT[shape] ?? WRAP_AT.process;
	const lines: string[] = [];
	for (const paragraph of text.split(/\r?\n/)) {
		let line = '';
		for (const word of paragraph.split(/\s+/).filter(Boolean)) {
			if (!line) line = word;
			else if (line.length + 1 + word.length <= limit) line += ` ${word}`;
			else {
				lines.push(line);
				line = word;
			}
		}
		lines.push(line);
	}
	// A trailing blank from a final newline is a line the writer is about to
	// use, but one on its own is just an empty box.
	while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
	return lines.length ? lines : [''];
}

/** Where a node added off another one goes, and which way the arrow points. */
export type Direction = 'down' | 'up' | 'left' | 'right';

const STEP = { x: 96, y: 84 };

export function placeNear(node: FlowNode, direction: Direction, shape: NodeShape): Point {
	const size = SIZES[shape];
	const gapX = node.w / 2 + size.w / 2 + STEP.x;
	const gapY = node.h / 2 + size.h / 2 + STEP.y;
	switch (direction) {
		case 'up':
			return { x: node.x, y: node.y - gapY };
		case 'left':
			return { x: node.x - gapX, y: node.y };
		case 'right':
			return { x: node.x + gapX, y: node.y };
		default:
			return { x: node.x, y: node.y + gapY };
	}
}

/**
 * Adds a node joined to an existing one, which is how a flow chart is actually
 * drawn: not as a pile of boxes that are wired up afterwards, but one step
 * after another. Going up or left points the arrow back the way it came.
 */
export function addConnected(
	doc: FlowDoc,
	fromId: string,
	direction: Direction,
	shape: NodeShape = 'process'
): { doc: FlowDoc; id: string } | null {
	const from = doc.nodes.find((node) => node.id === fromId);
	if (!from) return null;
	const at = placeNear(from, direction, shape);
	const added = addNode(doc, shape, at.x, at.y);
	const backwards = direction === 'up' || direction === 'left';
	return {
		doc: backwards
			? connect(added.doc, added.id, fromId)
			: connect(added.doc, fromId, added.id),
		id: added.id
	};
}

export function addNode(
	doc: FlowDoc,
	shape: NodeShape,
	x: number,
	y: number,
	title = '',
	extra: Partial<FlowNode> = {}
): { doc: FlowDoc; id: string } {
	const id = nextId();
	const node: FlowNode = {
		id,
		shape,
		x,
		y,
		w: 0,
		h: 0,
		...nodeDefaults(),
		title,
		...extra
	};
	return {
		doc: { ...doc, nodes: [...doc.nodes, { ...node, ...fitSize(node) }] },
		id
	};
}

/**
 * Changes anything about a node and resizes it to suit.
 *
 * One way in for every setting, because they all affect the box: a longer
 * title, a bigger font, a subtitle switched on and a shape swapped for a
 * diamond are the same problem, and four functions that each remembered to
 * resize would eventually be three that did.
 */
export function updateNode(doc: FlowDoc, id: string, patch: Partial<FlowNode>): FlowDoc {
	return {
		...doc,
		nodes: doc.nodes.map((node) => {
			if (node.id !== id) return node;
			const next = { ...node, ...patch };
			return { ...next, ...fitSize(next) };
		})
	};
}

export function setEdgeLabel(doc: FlowDoc, id: string, label: string): FlowDoc {
	return {
		...doc,
		edges: doc.edges.map((edge) => (edge.id === id ? { ...edge, label } : edge))
	};
}

export function moveNode(doc: FlowDoc, id: string, x: number, y: number): FlowDoc {
	return {
		...doc,
		nodes: doc.nodes.map((node) => (node.id === id ? { ...node, x, y } : node))
	};
}

/**
 * Connects two nodes. Refuses a self-loop and a duplicate, because both are
 * almost always a slip of the hand: the drag started and finished on the same
 * node, or on a pair that is already joined.
 */
export function connect(doc: FlowDoc, from: string, to: string, label = ''): FlowDoc {
	if (from === to) return doc;
	if (!doc.nodes.some((n) => n.id === from) || !doc.nodes.some((n) => n.id === to)) return doc;
	if (doc.edges.some((e) => e.from === from && e.to === to)) return doc;
	return { ...doc, edges: [...doc.edges, { id: nextId('e'), from, to, ...edgeDefaults(), label }] };
}

/** Removes nodes and edges by id. A node takes its edges with it. */
export function remove(doc: FlowDoc, ids: string[]): FlowDoc {
	const gone = new Set(ids);
	return {
		nodes: doc.nodes.filter((node) => !gone.has(node.id)),
		edges: doc.edges.filter(
			(edge) => !gone.has(edge.id) && !gone.has(edge.from) && !gone.has(edge.to)
		)
	};
}

/**
 * Which nodes are on screen once the collapsed ones have folded away.
 *
 * The rule that makes joins behave: a node disappears only when *every* way in
 * goes through something collapsed. Collapse the "no" branch of a decision and
 * the step both branches meet at stays, because the "yes" branch still reaches
 * it, which is what anybody would expect and what a plain descendant walk gets
 * wrong.
 */
export function visibleIds(doc: FlowDoc): Set<string> {
	const collapsed = new Set(
		doc.nodes.filter((node) => node.foldable && node.collapsed).map((node) => node.id)
	);
	if (collapsed.size === 0) return new Set(doc.nodes.map((node) => node.id));

	const children = new Map<string, string[]>();
	for (const node of doc.nodes) children.set(node.id, []);
	for (const edge of doc.edges) children.get(edge.from)?.push(edge.to);

	// Everything hanging off something collapsed, however far down. Walked once
	// per collapsed node, and never back onto that node itself: a loop that
	// returns to it would otherwise file it as hidden under itself, and the
	// whole diagram would disappear behind a box that had gone with it.
	const below = new Set<string>();
	for (const root of collapsed) {
		const seen = new Set<string>([root]);
		const queue = [...(children.get(root) ?? [])];
		while (queue.length) {
			const id = queue.shift()!;
			if (seen.has(id)) continue;
			seen.add(id);
			below.add(id);
			queue.push(...(children.get(id) ?? []));
		}
	}

	// Then walk from everything that is not down there, stopping at each
	// collapsed node. Anything reached this way has a way in of its own.
	const visible = new Set<string>();
	const open = doc.nodes.filter((node) => !below.has(node.id)).map((node) => node.id);
	while (open.length) {
		const id = open.shift()!;
		if (visible.has(id)) continue;
		visible.add(id);
		if (collapsed.has(id)) continue;
		open.push(...(children.get(id) ?? []));
	}
	return visible;
}

/** The document as it is drawn: without what the collapsed nodes are hiding. */
export function visibleDoc(doc: FlowDoc): FlowDoc {
	const visible = visibleIds(doc);
	if (visible.size === doc.nodes.length) return doc;
	return {
		nodes: doc.nodes.filter((node) => visible.has(node.id)),
		edges: doc.edges.filter((edge) => visible.has(edge.from) && visible.has(edge.to))
	};
}

/** How many nodes a collapsed node is holding out of sight. */
export function hiddenUnder(doc: FlowDoc, id: string): number {
	const node = doc.nodes.find((item) => item.id === id);
	if (!node?.collapsed || !node.foldable) return 0;
	const open = visibleIds({
		...doc,
		nodes: doc.nodes.map((item) => (item.id === id ? { ...item, collapsed: false } : item))
	});
	const now = visibleIds(doc);
	return open.size - now.size;
}

/** Nodes with something under them, which are the ones worth a collapse control. */
export function hasChildren(doc: FlowDoc, id: string): boolean {
	return doc.edges.some((edge) => edge.from === id);
}

/** The rectangle every node sits inside, for fitting the view to the diagram. */
export function bounds(doc: FlowDoc): { x: number; y: number; w: number; h: number } {
	if (doc.nodes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	for (const node of doc.nodes) {
		left = Math.min(left, node.x - node.w / 2);
		top = Math.min(top, node.y - node.h / 2);
		right = Math.max(right, node.x + node.w / 2);
		bottom = Math.max(bottom, node.y + node.h / 2);
	}
	return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * Reads a document back from a file. Anything missing or the wrong type is
 * dropped rather than trusted: this is the one place where something that did
 * not come from us gets in, and half a diagram beats a page that will not load.
 */
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function parseDoc(raw: unknown): FlowDoc {
	const source = raw as Partial<FlowDoc> | null;
	if (!source || typeof source !== 'object') return EMPTY;

	const nodes: FlowNode[] = [];
	for (const item of Array.isArray(source.nodes) ? source.nodes : []) {
		const node = item as Partial<FlowNode>;
		if (typeof node?.id !== 'string') continue;
		// A file from when there were five shapes still opens: the two that went
		// away become the nearest thing that stayed.
		const named = String(node.shape ?? '');
		const shape: NodeShape = (
			named in SIZES ? named : (RETIRED[named] ?? 'process')
		) as NodeShape;
		const legacy = item as { text?: unknown };
		const built: FlowNode = {
			id: node.id,
			shape,
			x: Number.isFinite(node.x) ? Number(node.x) : 0,
			y: Number.isFinite(node.y) ? Number(node.y) : 0,
			w: 0,
			h: 0,
			...nodeDefaults(),
			// A file written when a node held one string still opens, with that
			// string as the title, which is where it was being read anyway.
			title: text(node.title) || text(legacy.text),
			subtitle: text(node.subtitle),
			body: text(node.body),
			showSubtitle: node.showSubtitle !== false,
			showBody: node.showBody === true,
			colour: text(node.colour) || NO_COLOUR,
			font: (typeof node.font === 'string' && node.font in FONTS ? node.font : 'sans') as FontKey,
			size: Number.isFinite(node.size) ? Number(node.size) : DEFAULT_SIZE,
			bold: node.bold === true,
			italic: node.italic === true,
			bodyClamp: Number.isFinite(node.bodyClamp) ? Math.max(0, Number(node.bodyClamp)) : 0,
			// A file from before folding was a setting: something already folded
			// was foldable by definition.
			foldable: node.foldable === true || node.collapsed === true,
			collapsed: node.collapsed === true,
			sized: node.sized === true
		};
		nodes.push({ ...built, ...fitSize(built) });
	}

	const ids = new Set(nodes.map((n) => n.id));
	const edges: FlowEdge[] = [];
	for (const item of Array.isArray(source.edges) ? source.edges : []) {
		const edge = item as Partial<FlowEdge>;
		if (typeof edge?.from !== 'string' || typeof edge?.to !== 'string') continue;
		// An edge to a node that is not in the file would draw from nowhere.
		if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
		const caps: EndCap[] = ['none', 'arrow', 'hollow', 'dot'];
		edges.push({
			id: typeof edge.id === 'string' ? edge.id : nextId('e'),
			from: edge.from,
			to: edge.to,
			...edgeDefaults(),
			label: text(edge.label),
			style: (['solid', 'dashed', 'dotted'] as LineStyle[]).includes(edge.style as LineStyle)
				? (edge.style as LineStyle)
				: 'solid',
			width: Number.isFinite(edge.width) ? Math.max(1, Number(edge.width)) : 2,
			colour: text(edge.colour) || EDGE_COLOUR,
			head: caps.includes(edge.head as EndCap) ? (edge.head as EndCap) : 'arrow',
			tail: caps.includes(edge.tail as EndCap) ? (edge.tail as EndCap) : 'none',
			route: (['elbow', 'straight', 'curve'] as EdgeRoute[]).includes(edge.route as EdgeRoute)
				? (edge.route as EdgeRoute)
				: 'elbow'
		});
	}

	const doc = { nodes, edges };
	seedIds(doc);
	return doc;
}
