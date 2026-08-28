import type { FlowDoc, FlowNode } from './model';

/**
 * Tidy up: put the nodes in rows by how far they are from a start, and order
 * each row so the lines between rows cross as little as possible.
 *
 * This is the small, honest version of a layered layout. It ranks by longest
 * path so an arrow always points down a row, then sweeps back and forth
 * placing each node at the average position of the nodes it is joined to,
 * which is the cheap trick that removes most crossings without a real
 * crossing-minimisation pass. Nothing here is clever enough to surprise you,
 * which for a button labelled "Tidy up" is the point.
 *
 * It is also what makes an imported diagram usable: Mermaid text carries no
 * positions at all, so something has to decide where the boxes go.
 */

export interface LayoutOptions {
	/** Gap between rows, centre to centre of the row's tallest node. */
	rowGap?: number;
	/** Gap between neighbours in a row. */
	colGap?: number;
	/** Where the first row's centre sits. */
	originX?: number;
	originY?: number;
}

export function tidy(doc: FlowDoc, options: LayoutOptions = {}): FlowDoc {
	const { rowGap = 72, colGap = 48, originX = 0, originY = 0 } = options;
	if (doc.nodes.length === 0) return doc;

	const rank = rankNodes(doc);
	const rows = new Map<number, FlowNode[]>();
	for (const node of doc.nodes) {
		const r = rank.get(node.id) ?? 0;
		const row = rows.get(r) ?? [];
		row.push(node);
		rows.set(r, row);
	}

	const order = [...rows.keys()].sort((a, b) => a - b);
	const placed = new Map<string, { x: number; y: number }>();

	// Rows first, top to bottom, each at the height its tallest node needs.
	let y = originY;
	for (const r of order) {
		const row = rows.get(r)!;
		const tallest = row.reduce((most, node) => Math.max(most, node.h), 0);
		y += tallest / 2;
		for (const node of row) placed.set(node.id, { x: 0, y });
		y += tallest / 2 + rowGap;
	}

	// Then across. Two passes down and one back up is enough to settle a
	// diagram of the size a person draws by hand.
	const neighbours = neighbourMap(doc);
	for (const pass of [0, 1, 2]) {
		const sequence = pass === 2 ? [...order].reverse() : order;
		for (const r of sequence) {
			const row = rows.get(r)!;
			const scored = row.map((node) => ({
				node,
				score: averageOf(node, neighbours, placed, rank, r, pass === 2 ? 1 : -1)
			}));
			scored.sort((a, b) => a.score - b.score || a.node.id.localeCompare(b.node.id));

			const width = scored.reduce((sum, item) => sum + item.node.w, 0) + colGap * (row.length - 1);
			let x = originX - width / 2;
			for (const { node } of scored) {
				x += node.w / 2;
				placed.set(node.id, { x, y: placed.get(node.id)!.y });
				x += node.w / 2 + colGap;
			}
		}
	}

	return {
		...doc,
		nodes: doc.nodes.map((node) => ({ ...node, ...placed.get(node.id)! }))
	};
}

/**
 * Row per node: one below the deepest thing that points at it.
 *
 * Cycles are the interesting case, and a flow chart full of loops is normal.
 * The walk marks nodes it is currently visiting and refuses to follow an edge
 * back into one, so a loop settles instead of spinning.
 */
export function rankNodes(doc: FlowDoc): Map<string, number> {
	const incoming = new Map<string, string[]>();
	for (const node of doc.nodes) incoming.set(node.id, []);
	for (const edge of doc.edges) incoming.get(edge.to)?.push(edge.from);

	const rank = new Map<string, number>();
	const visiting = new Set<string>();

	const depth = (id: string): number => {
		const known = rank.get(id);
		if (known !== undefined) return known;
		if (visiting.has(id)) return 0;
		visiting.add(id);
		let best = 0;
		for (const from of incoming.get(id) ?? []) {
			if (visiting.has(from)) continue; // the edge that closes a loop
			best = Math.max(best, depth(from) + 1);
		}
		visiting.delete(id);
		rank.set(id, best);
		return best;
	};

	for (const node of doc.nodes) depth(node.id);
	return rank;
}

function neighbourMap(doc: FlowDoc): Map<string, { id: string; up: boolean }[]> {
	const map = new Map<string, { id: string; up: boolean }[]>();
	for (const node of doc.nodes) map.set(node.id, []);
	for (const edge of doc.edges) {
		map.get(edge.to)?.push({ id: edge.from, up: true });
		map.get(edge.from)?.push({ id: edge.to, up: false });
	}
	return map;
}

/**
 * Where a node wants to sit: the average x of its neighbours in the row the
 * sweep has already placed. A node with nothing placed yet keeps its position,
 * which is what stops a lone node from being flung to the left of everything.
 */
function averageOf(
	node: FlowNode,
	neighbours: Map<string, { id: string; up: boolean }[]>,
	placed: Map<string, { x: number; y: number }>,
	rank: Map<string, number>,
	row: number,
	direction: -1 | 1
): number {
	const relevant = (neighbours.get(node.id) ?? []).filter((n) => {
		const r = rank.get(n.id) ?? 0;
		return direction === -1 ? r < row : r > row;
	});
	if (relevant.length === 0) return placed.get(node.id)?.x ?? node.x;
	const sum = relevant.reduce((total, n) => total + (placed.get(n.id)?.x ?? 0), 0);
	return sum / relevant.length;
}
