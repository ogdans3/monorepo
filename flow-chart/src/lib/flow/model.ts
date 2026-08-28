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

export interface FlowNode {
	id: string;
	shape: NodeShape;
	text: string;
	/** Centre of the node, in diagram coordinates. */
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface FlowEdge {
	id: string;
	from: string;
	to: string;
	/** Shown on the line. A decision's branches are the reason this exists. */
	label: string;
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
export function fitSize(shape: NodeShape, text: string): { w: number; h: number } {
	const base = SIZES[shape];
	const lines = wrapText(text, shape);
	const longest = lines.reduce((most, line) => Math.max(most, line.length), 0);
	const padding = shape === 'decision' ? 100 : 44;
	return {
		w: Math.max(base.w, Math.round(Math.min(longest, WRAP_AT[shape]) * 8.3 + padding)),
		h: Math.max(base.h, 26 + lines.length * 20 + (shape === 'decision' ? 36 : 0))
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
	text = ''
): { doc: FlowDoc; id: string } {
	const id = nextId();
	const size = fitSize(shape, text);
	return {
		doc: { ...doc, nodes: [...doc.nodes, { id, shape, text, x, y, ...size }] },
		id
	};
}

export function moveNode(doc: FlowDoc, id: string, x: number, y: number): FlowDoc {
	return {
		...doc,
		nodes: doc.nodes.map((node) => (node.id === id ? { ...node, x, y } : node))
	};
}

export function setText(doc: FlowDoc, id: string, text: string): FlowDoc {
	return {
		...doc,
		nodes: doc.nodes.map((node) =>
			node.id === id ? { ...node, text, ...fitSize(node.shape, text) } : node
		),
		edges: doc.edges.map((edge) => (edge.id === id ? { ...edge, label: text } : edge))
	};
}

export function setShape(doc: FlowDoc, id: string, shape: NodeShape): FlowDoc {
	return {
		...doc,
		nodes: doc.nodes.map((node) =>
			node.id === id ? { ...node, shape, ...fitSize(shape, node.text) } : node
		)
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
	return { ...doc, edges: [...doc.edges, { id: nextId('e'), from, to, label }] };
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
		const text = typeof node.text === 'string' ? node.text : '';
		const size = fitSize(shape, text);
		nodes.push({
			id: node.id,
			shape,
			text,
			x: Number.isFinite(node.x) ? Number(node.x) : 0,
			y: Number.isFinite(node.y) ? Number(node.y) : 0,
			w: Number.isFinite(node.w) ? Number(node.w) : size.w,
			h: Number.isFinite(node.h) ? Number(node.h) : size.h
		});
	}

	const ids = new Set(nodes.map((n) => n.id));
	const edges: FlowEdge[] = [];
	for (const item of Array.isArray(source.edges) ? source.edges : []) {
		const edge = item as Partial<FlowEdge>;
		if (typeof edge?.from !== 'string' || typeof edge?.to !== 'string') continue;
		// An edge to a node that is not in the file would draw from nowhere.
		if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
		edges.push({
			id: typeof edge.id === 'string' ? edge.id : nextId('e'),
			from: edge.from,
			to: edge.to,
			label: typeof edge.label === 'string' ? edge.label : ''
		});
	}

	const doc = { nodes, edges };
	seedIds(doc);
	return doc;
}
