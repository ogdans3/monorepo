import { describe, expect, it } from 'vitest';
import { labelMarkup, shapeMarkup, toSvg } from './export';
import { addNode, connect, EMPTY, updateNode, type FlowDoc } from './model';

function sample(): FlowDoc {
	const a = addNode(EMPTY, 'terminator', 100, 100, 'Start');
	const b = addNode(a.doc, 'decision', 100, 300, 'Ready?');
	return connect(b.doc, a.id, b.id, 'yes');
}

describe('toSvg', () => {
	it('is a standalone file with the namespace a viewer needs', () => {
		const svg = toSvg(sample());
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
		expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
	});

	it('is only as big as the diagram, plus a margin', () => {
		const svg = toSvg(sample());
		const [, w, h] = /width="(\d+)" height="(\d+)"/.exec(svg)!;
		// The two nodes span 200 vertically plus their own heights, nowhere near
		// the coordinates they happen to sit at.
		expect(Number(w)).toBeLessThan(400);
		expect(Number(h)).toBeGreaterThan(200);
		expect(Number(h)).toBeLessThan(500);
	});

	it('carries the text, the arrow and its label', () => {
		const svg = toSvg(sample());
		expect(svg).toContain('Start');
		expect(svg).toContain('Ready?');
		expect(svg).toContain('<polygon'); // the arrow head, and the diamond
		expect(svg).toContain('>yes<');
	});

	it('escapes text that would otherwise close a tag', () => {
		const { doc } = addNode(EMPTY, 'process', 0, 0, 'a < b & "c"');
		const svg = toSvg(doc);
		expect(svg).toContain('a &lt; b &amp; &quot;c&quot;');
		expect(svg).not.toContain('a < b &');
	});

	it('draws an empty diagram rather than throwing at it', () => {
		expect(() => toSvg(EMPTY)).not.toThrow();
	});
});

describe('shapes', () => {
	it('gives each kind its own outline', () => {
		const at = (shape: Parameters<typeof addNode>[1]) =>
			shapeMarkup(addNode(EMPTY, shape, 0, 0, 'x').doc.nodes[0]);
		expect(at('process')).toContain('<rect');
		expect(at('decision')).toContain('<polygon');
		// A terminator is a rectangle rounded until it is a stadium.
		expect(at('terminator')).toMatch(/rx="\d+"/);
	});

	it('keeps an empty label as a line, so the box does not collapse', () => {
		const node = addNode(EMPTY, 'process', 0, 0, '').doc.nodes[0];
		expect(labelMarkup(node)).toContain('&#8203;');
	});
});

describe('what the file carries of the styling', () => {
	it('paints the fill somebody chose, and writes the shown text', () => {
		const { doc, id } = addNode(EMPTY, 'process', 0, 0, 'Refund it');
		const styled = updateNode(doc, id, {
			colour: '#fde8e8',
			subtitle: 'within five days',
			body: 'Finance signs it off first.',
			showBody: true,
			font: 'serif',
			bold: true,
			size: 22
		});
		const svg = toSvg(styled);
		expect(svg).toContain('fill="#fde8e8"');
		expect(svg).toContain('Refund it');
		expect(svg).toContain('within five days');
		expect(svg).toContain('Finance signs it off first.');
		expect(svg).toContain('font-weight="700"');
		expect(svg).toContain('Georgia');
		expect(svg).toContain('font-size="22"');
	});

	it('leaves out text that is switched off, exactly as the screen does', () => {
		const { doc, id } = addNode(EMPTY, 'process', 0, 0, 'Refund it');
		const hidden = updateNode(doc, id, {
			subtitle: 'within five days',
			showSubtitle: false,
			body: 'Not for the diagram.'
		});
		const svg = toSvg(hidden);
		expect(svg).not.toContain('within five days');
		expect(svg).not.toContain('Not for the diagram.');
	});

	it('leaves a folded branch out of the picture', () => {
		const a = addNode(EMPTY, 'process', 0, 0, 'Ask');
		const b = addNode(a.doc, 'process', 0, 200, 'Hidden away');
		const doc = connect(b.doc, a.id, b.id);
		expect(toSvg(doc)).toContain('Hidden away');
		expect(toSvg(updateNode(doc, a.id, { collapsed: true }))).not.toContain('Hidden away');
	});
});
