/**
 * The document, and every change you can make to it.
 *
 * One shape, kept plain: a list of nodes and a list of edges, both serialisable
 * as they stand. That is what makes save, load, undo and export the same
 * problem rather than four. Every operation here returns a new document instead
 * of editing one, so the history is a list of documents and undo is an index
 * into it, with no journal of inverse operations to get wrong.
 */
import { plainText, wrapRich, type TextRun } from './richtext';

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
	/**
	 * How the subtitle and the body sit in the box. Centred is right for the
	 * two or three words those fields usually hold, and wrong the moment
	 * somebody writes a paragraph or a list: ragged-both-sides text is hard to
	 * read and a centred bullet list has nothing to line up against. The title
	 * is always centred, because it is a name.
	 */
	align: 'center' | 'left';
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
	/**
	 * A diagram of its own, behind this box.
	 *
	 * The detail somebody has to leave out to keep the picture readable, kept
	 * where it belongs instead of in a second file: the box says what happens,
	 * and opening it says how. Null rather than an empty document so "has one"
	 * is a question with an answer, and nesting is bounded by `MAX_DEPTH` so a
	 * corrupt file cannot recurse the reader to death.
	 */
	chart: FlowDoc | null;
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
		align: 'center',
		chart: null,
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
	// Nested charts share the counter, so a load has to look inside them too or
	// the next box added up here gets an id a box down there already has.
	for (const node of doc.nodes) if (node.chart) seedIds(node.chart);
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
	/** The line with its marks removed. What gets measured, and what a test reads. */
	text: string;
	/** The same line in pieces, each with the marks that apply to it. */
	runs: TextRun[];
	kind: 'title' | 'subtitle' | 'body';
	size: number;
	/** Baseline, measured down from the top of the whole block of text. */
	y: number;
	/**
	 * Where this line starts. Centred lines are drawn from the middle of the
	 * node; left-aligned ones from the left edge of the text block, which is
	 * why `textWidth` has to come back with them.
	 */
	align: 'center' | 'left';
}

export interface NodeText {
	lines: TextLine[];
	/** Height of the text itself, before the shape's padding. */
	textHeight: number;
	/** Width of the widest line, which is the block left-aligned text sits in. */
	textWidth: number;
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
	| 'align'
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
		// The title is a name and stays centred; only the two fields that hold
		// sentences follow the node's alignment.
		const align = block.kind === 'title' ? 'center' : node.align;
		const wrapped = clampedRuns(
			wrapRich(block.text, WRAP_AT[node.shape] ?? WRAP_AT.process),
			block.kind,
			node.bodyClamp
		);
		for (const runs of wrapped) {
			const height = block.size * LINE_HEIGHT;
			const text = runs.map((run) => run.text).join('');
			y += height;
			lines.push({
				text,
				runs,
				kind: block.kind,
				size: block.size,
				y: y - height * 0.28,
				align
			});
			widest = Math.max(widest, charWidth(block.size, node.bold) * text.length);
		}
	}

	const base = SIZES[node.shape];
	const padX = node.shape === 'decision' ? 96 : 44;
	const padY = node.shape === 'decision' ? 44 : 26;
	return {
		lines,
		textHeight: y,
		textWidth: widest,
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
function clampedRuns(lines: TextRun[][], kind: TextLine['kind'], limit: number): TextRun[][] {
	if (kind !== 'body' || limit <= 0 || lines.length <= limit) return lines;
	const kept = lines.slice(0, limit);
	const last = [...kept[kept.length - 1]];
	// The ellipsis goes on the end of the final run so it keeps that run's
	// marks, rather than arriving as a plain tail on a bold sentence.
	const tail = last[last.length - 1];
	if (tail) last[last.length - 1] = { ...tail, text: `${tail.text.replace(/[\s.,;:]+$/, '')}…` };
	else last.push({ text: '…', bold: false, italic: false });
	kept[kept.length - 1] = last;
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
 * The plain text of each wrapped line, for callers that do not care about marks.
 *
 * Delegates to `wrapRich` rather than wrapping again: two wrapping rules is how
 * a label fits on screen and overflows in the exported file. The rule itself —
 * greedy, keeps the writer's own line breaks, never breaks a word — lives there.
 */
export function wrapText(text: string, shape: NodeShape = 'process'): string[] {
	return wrapRich(text, WRAP_AT[shape] ?? WRAP_AT.process).map((runs) =>
		runs.map((run) => run.text).join('')
	);
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

/**
 * Puts a step in the middle of an existing arrow.
 *
 * Diagrams are drawn forwards and then corrected, and the correction is nearly
 * always "there is a step between these two". Doing that by hand is delete the
 * arrow, add a box, draw two arrows, and line it up; here it is one action that
 * keeps the line's own styling on both halves.
 *
 * The label stays on the first half, because a label on an arrow out of a
 * decision names the branch, and the branch is chosen where it leaves.
 */
export function insertBetween(
	doc: FlowDoc,
	edgeId: string,
	shape: NodeShape = 'process'
): { doc: FlowDoc; id: string } | null {
	const edge = doc.edges.find((item) => item.id === edgeId);
	if (!edge) return null;
	const from = doc.nodes.find((node) => node.id === edge.from);
	const to = doc.nodes.find((node) => node.id === edge.to);
	if (!from || !to) return null;

	const added = addNode(
		doc,
		shape,
		Math.round((from.x + to.x) / 2),
		Math.round((from.y + to.y) / 2)
	);

	// Both halves inherit how the original line was drawn, so splitting a
	// dashed branch does not leave one solid arrow next to one dashed one.
	const { id: _id, from: _from, to: _to, ...style } = edge;

	return {
		doc: {
			...added.doc,
			edges: [
				...added.doc.edges.filter((item) => item.id !== edgeId),
				{ ...style, id: nextId('e'), from: edge.from, to: added.id },
				{ ...style, id: nextId('e'), from: added.id, to: edge.to, label: '' }
			]
		},
		id: added.id
	};
}

/**
 * Everything that hangs off a node and nowhere else.
 *
 * The same rule folding uses: a node belongs to this branch only when *every*
 * way into it comes through the node being asked about. Where two branches meet
 * again, the step they meet at belongs to neither, so dragging one branch does
 * not drag the shared tail of the diagram along with it. A plain descendant
 * walk gets that wrong, and gets it wrong in the direction that moves the whole
 * chart when you nudge the first box.
 */
export function subtreeIds(doc: FlowDoc, id: string): Set<string> {
	const node = doc.nodes.find((item) => item.id === id);
	if (!node) return new Set();
	const openIds = visibleIds({
		...doc,
		nodes: doc.nodes.map((item) =>
			item.id === id ? { ...item, foldable: true, collapsed: true } : item
		)
	});
	const out = new Set<string>();
	for (const item of doc.nodes) if (!openIds.has(item.id)) out.add(item.id);
	out.delete(id);
	return out;
}

/**
 * Moves a node, and the branch under it with it.
 *
 * Dragging a box is usually making room, not detaching it from what follows,
 * so what follows comes along and the shape of the branch survives the drag.
 * Alt is the way out for the times it really is just the one box, and that is
 * `moveNode`.
 */
export function moveSubtree(doc: FlowDoc, id: string, x: number, y: number): FlowDoc {
	const node = doc.nodes.find((item) => item.id === id);
	if (!node) return doc;
	const dx = x - node.x;
	const dy = y - node.y;
	if (dx === 0 && dy === 0) return doc;
	const moving = subtreeIds(doc, id);
	return {
		...doc,
		nodes: doc.nodes.map((item) => {
			if (item.id === id) return { ...item, x, y };
			if (!moving.has(item.id)) return item;
			return { ...item, x: item.x + dx, y: item.y + dy };
		})
	};
}

/** How deep a nested chart is allowed to go, so a bad file cannot recurse forever. */
export const MAX_DEPTH = 5;

/** The document behind a node, or null when it has none. */
export function chartOf(doc: FlowDoc, id: string): FlowDoc | null {
	return doc.nodes.find((node) => node.id === id)?.chart ?? null;
}

/** True once a node has a diagram behind it with anything in it. */
export function hasChart(node: Pick<FlowNode, 'chart'>): boolean {
	return Boolean(node.chart && node.chart.nodes.length);
}

/**
 * Replaces the document behind a node.
 *
 * Kept as its own operation rather than a `updateNode` patch because it does
 * not touch the box: a nested chart changing size must not resize the shape
 * that holds it, and `updateNode` refits every time it is called.
 */
export function setChart(doc: FlowDoc, id: string, chart: FlowDoc | null): FlowDoc {
	return {
		...doc,
		nodes: doc.nodes.map((node) => (node.id === id ? { ...node, chart } : node))
	};
}

/**
 * Reads or writes the document at a path of node ids, so the editor can work
 * inside a nested chart with the history still covering the whole thing.
 *
 * Undo has to span the levels: drilling in, editing, and coming back out is one
 * session's work, and an undo stack per level would strand half of it behind a
 * box the moment you left.
 */
export function docAt(doc: FlowDoc, path: string[]): FlowDoc {
	let current = doc;
	for (const id of path) {
		const next = current.nodes.find((node) => node.id === id)?.chart;
		if (!next) return EMPTY;
		current = next;
	}
	return current;
}

export function setDocAt(doc: FlowDoc, path: string[], next: FlowDoc): FlowDoc {
	if (path.length === 0) return next;
	const [head, ...rest] = path;
	return {
		...doc,
		nodes: doc.nodes.map((node) =>
			node.id === head
				? { ...node, chart: setDocAt(node.chart ?? EMPTY, rest, next) }
				: node
		)
	};
}

/** The titles down a path, for the trail that says where you are. */
export function titlesAlong(doc: FlowDoc, path: string[]): string[] {
	const out: string[] = [];
	let current = doc;
	for (const id of path) {
		const node = current.nodes.find((item) => item.id === id);
		if (!node) break;
		out.push(node.title.trim() || 'Untitled');
		current = node.chart ?? EMPTY;
	}
	return out;
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

export function parseDoc(raw: unknown, depth = 0): FlowDoc {
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
			// A file from before alignment was a choice was centred, which is
			// still the default and still what those files look like.
			align: node.align === 'left' ? 'left' : 'center',
			// Nesting stops at MAX_DEPTH: a file that points a chart at itself,
			// by accident or otherwise, must not take the reader down with it.
			chart:
				depth < MAX_DEPTH && node.chart && typeof node.chart === 'object'
					? parseDoc(node.chart, depth + 1)
					: null,
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
