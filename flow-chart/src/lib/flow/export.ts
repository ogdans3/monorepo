import { arrowHead, curveOf, midpoint, pathOf, route } from './geometry';
import {
	FONTS,
	bounds,
	dashOf,
	nodeText,
	visibleDoc,
	type EndCap,
	type FlowDoc,
	type FlowEdge,
	type FlowNode
} from './model';

/**
 * The diagram as a standalone SVG.
 *
 * Written out here rather than by copying the DOM of the editor, because the
 * editor's SVG is full of things that belong to editing: selection rings, the
 * grid, handles, the half-drawn arrow. Building the file from the document
 * means what gets saved is the diagram and only the diagram, and it means the
 * PNG (which is this SVG drawn onto a canvas) matches it exactly.
 *
 * Styles are attributes rather than a stylesheet so the file survives being
 * dropped into anything.
 */

const PAD = 24;
const INK = '#221f1a';
const LINE = '#6b6355';
const FILL = '#ffffff';
const FONT = FONTS.sans.stack;

function esc(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** The outline of one node, as an SVG element. */
export function shapeMarkup(node: FlowNode): string {
	const { x, y, w, h } = node;
	const left = x - w / 2;
	const top = y - h / 2;
	const common = `fill="${node.colour || FILL}" stroke="${INK}" stroke-width="2"`;

	switch (node.shape) {
		case 'decision':
			return `<polygon points="${x},${top} ${x + w / 2},${y} ${x},${top + h} ${left},${y}" ${common} />`;
		case 'terminator':
			return `<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="${h / 2}" ${common} />`;
		default:
			return `<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="10" ${common} />`;
	}
}

/**
 * The text inside a node, laid out by the model so the file and the screen
 * agree line for line.
 */
export function labelMarkup(node: FlowNode): string {
	const { lines, textHeight } = nodeText(node);
	const top = node.y - textHeight / 2;
	const weight = node.bold ? 700 : 400;
	const style = node.italic ? ' font-style="italic"' : '';
	return lines
		.map((line) => {
			const fill = line.kind === 'title' ? INK : LINE;
			const opacity = line.kind === 'body' ? ' opacity="0.9"' : '';
			return (
				`<text x="${node.x}" y="${top + line.y}" text-anchor="middle" ` +
				`font-family="${FONTS[node.font]?.stack ?? FONT}" font-size="${line.size}" ` +
				`font-weight="${line.kind === 'title' ? weight : 400}"${style}${opacity} ` +
				`fill="${fill}">${esc(line.text) || '&#8203;'}</text>`
			);
		})
		.join('');
}

/**
 * What sits on the end of a line. `tail` is the same shapes pointing the other
 * way, which is why this takes a flag rather than being written twice.
 */
function capMarkup(edge: FlowEdge, points: { x: number; y: number }[], atStart: boolean): string {
	const cap: EndCap = atStart ? edge.tail : edge.head;
	if (cap === 'none') return '';
	const line = atStart ? [...points].reverse() : points;
	const tip = line[line.length - 1];
	if (cap === 'dot') {
		return `<circle cx="${tip.x}" cy="${tip.y}" r="${edge.width * 2}" fill="${edge.colour}" />`;
	}
	const [a, b] = arrowHead(line, edge.width * 4.5);
	const points3 = `${tip.x},${tip.y} ${a.x},${a.y} ${b.x},${b.y}`;
	return cap === 'hollow'
		? `<polygon points="${points3}" fill="${FILL}" stroke="${edge.colour}" stroke-width="${edge.width}" />`
		: `<polygon points="${points3}" fill="${edge.colour}" />`;
}

export function toSvg(input: FlowDoc): string {
	// Collapsed branches are not in the picture, so they are not in the file.
	const doc = visibleDoc(input);
	const box = bounds(doc);
	const width = Math.max(1, Math.round(box.w + PAD * 2));
	const height = Math.max(1, Math.round(box.h + PAD * 2));
	const shift = `translate(${PAD - box.x} ${PAD - box.y})`;

	const nodeById = new Map(doc.nodes.map((node) => [node.id, node]));
	const edges: string[] = [];
	for (const edge of doc.edges) {
		const from = nodeById.get(edge.from);
		const to = nodeById.get(edge.to);
		if (!from || !to) continue;
		const points = route(from, to, doc.nodes, edge.route);
		const dash = dashOf(edge);
		const d = edge.route === 'curve' ? curveOf(points) : pathOf(points);
		edges.push(
			`<path d="${d}" fill="none" stroke="${edge.colour}" stroke-width="${edge.width}" ` +
				`stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''} />` +
				capMarkup(edge, points, false) +
				capMarkup(edge, points, true)
		);
		if (edge.label.trim()) {
			const mid = midpoint(points);
			const width = edge.label.length * 7 + 10;
			edges.push(
				`<rect x="${mid.x - width / 2}" y="${mid.y - 11}" width="${width}" height="20" rx="4" fill="${FILL}" />` +
					`<text x="${mid.x}" y="${mid.y + 4}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="${edge.colour}">${esc(edge.label)}</text>`
			);
		}
	}

	const nodes = doc.nodes.map((node) => shapeMarkup(node) + labelMarkup(node)).join('\n    ');

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${FILL}" />
  <g transform="${shift}">
    ${edges.join('\n    ')}
    ${nodes}
  </g>
</svg>`;
}

/**
 * The SVG drawn onto a canvas, at whatever scale is asked for. Two is a
 * sensible default: a flow chart usually ends up in a document or a slide,
 * where a one-to-one PNG of crisp vector lines looks soft.
 */
export async function toPng(doc: FlowDoc, scale = 2): Promise<Blob> {
	const svg = toSvg(doc);
	const size = /width="(\d+)" height="(\d+)"/.exec(svg);
	const width = Number(size?.[1] ?? 1);
	const height = Number(size?.[2] ?? 1);

	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	try {
		const image = new Image();
		image.decoding = 'sync';
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error('Could not render the diagram'));
			image.src = url;
		});
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		return await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not make a PNG'))), 'image/png')
		);
	} finally {
		URL.revokeObjectURL(url);
	}
}

export function download(blob: Blob, name: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
