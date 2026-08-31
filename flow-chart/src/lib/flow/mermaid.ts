import { plainText } from './richtext';
import {
	EMPTY,
	edgeDefaults,
	fitSize,
	nextId,
	nodeDefaults,
	type FlowDoc,
	type FlowNode,
	type NodeShape
} from './model';

/**
 * Mermaid in and out.
 *
 * Worth having in both directions for the same reason: a flow chart is usually
 * on its way somewhere else. Out, because Mermaid is what a README, a wiki or
 * a chat with a model will render. In, because that is where a diagram often
 * already exists, and retyping one is the reason people give up on drawing it.
 *
 * A deliberate subset. `flowchart TD` with the five shapes this editor draws
 * and plain arrows, which is what people actually write by hand. Anything it
 * does not recognise is reported rather than guessed at, because a diagram
 * that silently loses a branch is worse than one that refuses to load.
 */

const SHAPE_SYNTAX: Record<NodeShape, [string, string]> = {
	process: ['[', ']'],
	decision: ['{', '}'],
	terminator: ['([', '])']
};

/** Mermaid ids have to be bare words, and they have to stay unique. */
function safeId(id: string, taken: Set<string>): string {
	let base = id.replace(/[^A-Za-z0-9_]/g, '') || 'n';
	if (/^[0-9]/.test(base)) base = `n${base}`;
	let candidate = base;
	let n = 2;
	while (taken.has(candidate)) candidate = `${base}${n++}`;
	taken.add(candidate);
	return candidate;
}

/** Quotes are the escape hatch Mermaid gives us for text with syntax in it. */
function quote(text: string): string {
	const clean = text.replace(/"/g, "'").replace(/\s*\n\s*/g, ' ').trim();
	return `"${clean || ' '}"`;
}

/**
 * What a node says in one string. Mermaid gives a node a single label, so a
 * shown subtitle rides along after a line break rather than being dropped: the
 * diagram means less without it, and `<br/>` is how Mermaid spells one.
 */
function labelOf(node: FlowNode): string {
	// Marks come off here. Mermaid has its own emphasis syntax and no agreement
	// with ours about what survives inside a quoted label, so the text goes out
	// as what it says rather than as markup that might render as literal stars.
	const parts = [plainText(node.title)];
	if (node.showSubtitle && node.subtitle.trim()) parts.push(plainText(node.subtitle).trim());
	return parts.filter(Boolean).join('<br/>');
}

/**
 * Writes one diagram's nodes and arrows, and any diagram nested behind a node
 * as a `subgraph` under it.
 *
 * A subgraph is the closest thing Mermaid has to a box you can open, and it is
 * the honest one: the detail is still in the file and still rendered, just laid
 * out beside its parent rather than behind it. Flattening it away would lose
 * work; leaving it out would lose it silently.
 */
function emit(
	doc: FlowDoc,
	lines: string[],
	ids: Map<string, string>,
	taken: Set<string>,
	indent: string
): void {
	for (const node of doc.nodes) ids.set(node.id, safeId(node.id, taken));

	for (const node of doc.nodes) {
		const [open, close] = SHAPE_SYNTAX[node.shape];
		lines.push(`${indent}${ids.get(node.id)}${open}${quote(labelOf(node))}${close}`);

		if (node.chart && node.chart.nodes.length) {
			const group = safeId(`${ids.get(node.id)}_inside`, taken);
			lines.push(`${indent}subgraph ${group}[${quote(plainText(node.title) || 'Inside')}]`);
			emit(node.chart, lines, ids, taken, `${indent}    `);
			lines.push(`${indent}end`);
		}
	}

	for (const edge of doc.edges) {
		const from = ids.get(edge.from);
		const to = ids.get(edge.to);
		if (!from || !to) continue;
		const label = plainText(edge.label).trim();
		lines.push(`${indent}${from} ${label ? `-- ${quote(label)} -->` : '-->'} ${to}`);
	}
}

export function toMermaid(doc: FlowDoc): string {
	const lines = ['flowchart TD'];
	emit(doc, lines, new Map(), new Set(), '    ');
	return lines.join('\n');
}

export interface ParseResult {
	doc: FlowDoc;
	/** Lines that meant nothing to us, so the page can say so rather than lie. */
	skipped: string[];
}

/**
 * Mermaid has more shapes than this editor draws, and a file using one of them
 * should still open. The ones with no equivalent here become a step, which is
 * what they read as anyway once the diagram is in front of somebody.
 */
const NODE_PATTERNS: [NodeShape, RegExp][] = [
	['terminator', /^([A-Za-z0-9_]+)\(\[(.*)\]\)$/],
	['process', /^([A-Za-z0-9_]+)\[\/(.*)\/\]$/],
	['decision', /^([A-Za-z0-9_]+)\{(.*)\}$/],
	['process', /^([A-Za-z0-9_]+)>(.*)\]$/],
	['process', /^([A-Za-z0-9_]+)\[(.*)\]$/],
	['terminator', /^([A-Za-z0-9_]+)\((.*)\)$/]
];

/**
 * Both ways of labelling an arrow, because both are written by hand:
 * `A -- yes --> B` puts the label in the middle, `A -->|yes| B` puts it after.
 * Quoted or bare, either side.
 */
const ARROW =
	/\s*(?:--\s*(?:"([^"]*)"|([^->|]*?))\s*-->|-->|---|==>)(?:\s*\|\s*(?:"([^"]*)"|([^|]*?))\s*\|)?\s*/;

export function fromMermaid(text: string): ParseResult {
	const doc: FlowDoc = { nodes: [], edges: [] };
	const skipped: string[] = [];
	const byName = new Map<string, string>();
	/**
	 * The subgraphs we are inside, innermost last. A `null` is one that does not
	 * correspond to a box here, so its contents stay where they are.
	 */
	const groups: (string | null)[] = [];
	/** Node id -> the node whose chart it belongs behind. */
	const nestedIn = new Map<string, string>();

	/** A name mentioned in an edge becomes a plain box if it has no shape yet. */
	const ensure = (token: string): string | null => {
		const declared = declare(token);
		if (!declared) return null;
		const existing = byName.get(declared.name);
		if (existing) {
			if (declared.explicit) {
				const node = doc.nodes.find((n) => n.id === existing)!;
				Object.assign(node, { shape: declared.shape, ...split(declared.text) });
				Object.assign(node, fitSize(node));
			}
			return existing;
		}
		const id = nextId();
		const made: FlowNode = {
			id,
			shape: declared.shape,
			x: 0,
			y: 0,
			w: 0,
			h: 0,
			...nodeDefaults(),
			...split(declared.text)
		};
		doc.nodes.push({ ...made, ...fitSize(made) });
		byName.set(declared.name, id);
		const owner = [...groups].reverse().find((group) => group);
		if (owner) nestedIn.set(id, owner);
		return id;
	};

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim().replace(/;$/, '');
		if (!line) continue;
		if (/^(flowchart|graph)\b/i.test(line)) continue;
		if (line.startsWith('%%')) continue;
		// Our own nesting comes back as nesting: the export names a subgraph
		// `<parent>_inside`, so a diagram that left as a box you could open
		// arrives as one again rather than as a flat pile of steps.
		const opened = /^subgraph\s+([A-Za-z0-9_]+)/.exec(line);
		if (opened) {
			const inside = /^(.*)_inside$/.exec(opened[1]);
			groups.push(inside ? (byName.get(inside[1]) ?? null) : null);
			// A subgraph somebody wrote by hand is a visual grouping, not a
			// diagram behind a box. Its steps are kept and the grouping is not,
			// which the page says rather than leaving it to be noticed.
			if (!inside) skipped.push(line);
			continue;
		}
		if (/^end\b/.test(line)) {
			groups.pop();
			continue;
		}
		if (/^(classDef|class|style|linkStyle|click)\b/.test(line)) {
			skipped.push(line);
			continue;
		}

		const arrow = ARROW.exec(line);
		if (arrow && arrow.index > 0) {
			const label = (arrow[1] ?? arrow[2] ?? arrow[3] ?? arrow[4] ?? '').trim();
			const from = ensure(line.slice(0, arrow.index).trim());
			const to = ensure(line.slice(arrow.index + arrow[0].length).trim());
			if (from && to && from !== to && !doc.edges.some((e) => e.from === from && e.to === to)) {
				doc.edges.push({ id: nextId('e'), from, to, ...edgeDefaults(), label });
			} else if (!from || !to) {
				skipped.push(line);
			}
			continue;
		}

		if (ensure(line)) continue;
		skipped.push(line);
	}

	if (nestedIn.size) nest(doc, nestedIn);
	return { doc: doc.nodes.length ? doc : EMPTY, skipped };
}

/**
 * Moves the nodes a subgraph held behind the box it belongs to, taking the
 * arrows between them along.
 *
 * An arrow that crosses the boundary cannot be drawn at either level, so it is
 * dropped rather than left pointing at a node that is no longer beside it.
 * Mermaid lets you draw one; a box you open is a different diagram, and this is
 * the one place the two models genuinely disagree.
 */
function nest(doc: FlowDoc, nestedIn: Map<string, string>): void {
	const byId = new Map(doc.nodes.map((node) => [node.id, node]));

	for (const [childId, parentId] of nestedIn) {
		const parent = byId.get(parentId);
		const child = byId.get(childId);
		if (!parent || !child) continue;
		parent.chart ??= { nodes: [], edges: [] };
		parent.chart.nodes.push(child);
	}

	for (const edge of doc.edges) {
		const from = nestedIn.get(edge.from);
		const to = nestedIn.get(edge.to);
		if (!from && !to) continue;
		if (from && from === to) byId.get(from)!.chart!.edges.push(edge);
	}

	doc.nodes = doc.nodes.filter((node) => !nestedIn.has(node.id));
	doc.edges = doc.edges.filter((edge) => !nestedIn.has(edge.from) && !nestedIn.has(edge.to));
}

/** A label with a line break in it comes back as a title and a subtitle. */
function split(label: string): { title: string; subtitle: string } {
	const parts = label
		.split(/<br\s*\/?>|\\n/i)
		.map((part) => part.trim())
		.filter(Boolean);
	return { title: parts[0] ?? '', subtitle: parts.slice(1).join(' ') };
}

function declare(
	token: string
): { name: string; shape: NodeShape; text: string; explicit: boolean } | null {
	const trimmed = token.trim();
	if (!trimmed) return null;
	for (const [shape, pattern] of NODE_PATTERNS) {
		const match = pattern.exec(trimmed);
		if (match) {
			const text = match[2].replace(/^"|"$/g, '').trim();
			return { name: match[1], shape, text: text || match[1], explicit: true };
		}
	}
	if (/^[A-Za-z0-9_]+$/.test(trimmed)) {
		return { name: trimmed, shape: 'process', text: trimmed, explicit: false };
	}
	return null;
}

/** True when a pasted blob looks like Mermaid rather than our own JSON. */
export function looksLikeMermaid(text: string): boolean {
	return /^\s*(flowchart|graph)\s/i.test(text) || /-->/.test(text);
}

export type { FlowNode };
