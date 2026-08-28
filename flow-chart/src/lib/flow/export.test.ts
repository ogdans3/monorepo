import { describe, expect, it } from 'vitest';
import { labelMarkup, shapeMarkup, toSvg } from './export';
import { addNode, connect, EMPTY, type FlowDoc } from './model';

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
		expect(at('io')).toContain('<polygon');
		expect(at('note')).toContain('<path');
		// A terminator is a rectangle rounded until it is a stadium.
		expect(at('terminator')).toMatch(/rx="\d+"/);
	});

	it('keeps an empty label as a line, so the box does not collapse', () => {
		const node = addNode(EMPTY, 'process', 0, 0, '').doc.nodes[0];
		expect(labelMarkup(node)).toContain('&#8203;');
	});
});
