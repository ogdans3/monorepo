import {
	EMPTY,
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
	const parts = [node.title];
	if (node.showSubtitle && node.subtitle.trim()) parts.push(node.subtitle.trim());
	return parts.filter(Boolean).join('<br/>');
}

export function toMermaid(doc: FlowDoc): string {
	const taken = new Set<string>();
	const ids = new Map<string, string>();
	for (const node of doc.nodes) ids.set(node.id, safeId(node.id, taken));

	const lines = ['flowchart TD'];
	for (const node of doc.nodes) {
		const [open, close] = SHAPE_SYNTAX[node.shape];
		lines.push(`    ${ids.get(node.id)}${open}${quote(labelOf(node))}${close}`);
	}
	for (const edge of doc.edges) {
		const from = ids.get(edge.from);
		const to = ids.get(edge.to);
		if (!from || !to) continue;
		const label = edge.label.trim();
		lines.push(`    ${from} ${label ? `-- ${quote(label)} -->` : '-->'} ${to}`);
	}
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
		return id;
	};

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim().replace(/;$/, '');
		if (!line) continue;
		if (/^(flowchart|graph)\b/i.test(line)) continue;
		if (line.startsWith('%%')) continue;
		// Styling and grouping are not modelled, and pretending otherwise would
		// put boxes on the page that the file never asked for.
		if (/^(subgraph|end|classDef|class|style|linkStyle|click)\b/.test(line)) {
			skipped.push(line);
			continue;
		}

		const arrow = ARROW.exec(line);
		if (arrow && arrow.index > 0) {
			const label = (arrow[1] ?? arrow[2] ?? arrow[3] ?? arrow[4] ?? '').trim();
			const from = ensure(line.slice(0, arrow.index).trim());
			const to = ensure(line.slice(arrow.index + arrow[0].length).trim());
			if (from && to && from !== to && !doc.edges.some((e) => e.from === from && e.to === to)) {
				doc.edges.push({ id: nextId('e'), from, to, label });
			} else if (!from || !to) {
				skipped.push(line);
			}
			continue;
		}

		if (ensure(line)) continue;
		skipped.push(line);
	}

	return { doc: doc.nodes.length ? doc : EMPTY, skipped };
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
