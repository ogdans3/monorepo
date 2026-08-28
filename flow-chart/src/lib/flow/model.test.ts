import { describe, expect, it } from 'vitest';
import {
	addConnected,
	addNode,
	bounds,
	connect,
	EMPTY,
	fitSize,
	parseDoc,
	remove,
	placeNear,
	setShape,
	setText,
	wrapText
} from './model';

const twoNodes = () => {
	const a = addNode(EMPTY, 'terminator', 0, 0, 'Start');
	const b = addNode(a.doc, 'process', 0, 160, 'Do the thing');
	return { doc: connect(b.doc, a.id, b.id), a: a.id, b: b.id };
};

describe('editing a document', () => {
	it('joins two nodes, once', () => {
		const { doc, a, b } = twoNodes();
		expect(doc.edges).toHaveLength(1);
		// The same pair again is a slip of the hand, not a second arrow.
		expect(connect(doc, a, b).edges).toHaveLength(1);
	});

	it('refuses a loop back to the same node', () => {
		const { doc, a } = twoNodes();
		expect(connect(doc, a, a).edges).toHaveLength(1);
	});

	it('refuses an edge to a node that is not there', () => {
		const { doc, a } = twoNodes();
		expect(connect(doc, a, 'ghost').edges).toHaveLength(1);
	});

	it('takes a node out with its arrows', () => {
		const { doc, a } = twoNodes();
		const after = remove(doc, [a]);
		expect(after.nodes).toHaveLength(1);
		expect(after.edges).toHaveLength(0);
	});

	it('never changes the document it was given', () => {
		const { doc, a } = twoNodes();
		const before = JSON.stringify(doc);
		remove(doc, [a]);
		setText(doc, a, 'Something else');
		expect(JSON.stringify(doc)).toBe(before);
	});

	it('grows a node to fit what was typed into it', () => {
		const { doc, b } = twoNodes();
		const narrow = doc.nodes.find((n) => n.id === b)!.w;
		const wide = setText(doc, b, 'A much longer label than the one before it').nodes.find(
			(n) => n.id === b
		)!.w;
		expect(wide).toBeGreaterThan(narrow);
	});

	it('resizes when the shape changes, since a diamond needs the room', () => {
		const { doc, b } = twoNodes();
		const box = doc.nodes.find((n) => n.id === b)!;
		const diamond = setShape(doc, b, 'decision').nodes.find((n) => n.id === b)!;
		expect(diamond.h).toBeGreaterThan(box.h);
	});
});

describe('text fitting', () => {
	it('wraps on words, and narrower inside a diamond', () => {
		const text = 'check whether the order has already been paid for in full';
		expect(wrapText(text, 'process').length).toBeGreaterThan(1);
		expect(wrapText(text, 'decision').length).toBeGreaterThan(wrapText(text, 'process').length);
	});

	it('keeps one empty line for an empty label, so a box is still a box', () => {
		expect(wrapText('')).toEqual(['']);
		expect(fitSize('process', '').h).toBeGreaterThan(0);
	});

	it('keeps the line breaks somebody typed', () => {
		expect(wrapText('one\ntwo\nthree')).toEqual(['one', 'two', 'three']);
		// including a deliberate blank line in the middle of a paragraph
		expect(wrapText('one\n\ntwo')).toEqual(['one', '', 'two']);
	});

	it('drops a single trailing blank, which is just an empty last line', () => {
		expect(wrapText('one\n')).toEqual(['one']);
	});

	it('grows a long note downwards rather than sideways off the page', () => {
		const paragraph = 'the customer is told what went wrong and what to do next '.repeat(4);
		const small = fitSize('process', 'short');
		const big = fitSize('process', paragraph);
		// Height follows the lines it takes, whatever that turns out to be.
		expect(big.h).toBeGreaterThanOrEqual(wrapText(paragraph, 'process').length * 20);
		expect(big.h).toBeGreaterThan(small.h * 2.5);
		// Wide enough to read, nowhere near as wide as the text is long.
		expect(big.w).toBeLessThan(400);
	});

	it('leaves a word that is longer than the line alone', () => {
		const lines = wrapText('https://example.com/a/very/long/path/that/will/not/fit');
		expect(lines).toHaveLength(1);
	});
});

describe('adding a node onto another one', () => {
	it('places it clear of the one it came from, and joins them', () => {
		const { doc, a } = twoNodes();
		const added = addConnected(doc, a, 'down')!;
		const from = doc.nodes.find((n) => n.id === a)!;
		const made = added.doc.nodes.find((n) => n.id === added.id)!;
		expect(made.y - from.y).toBeGreaterThan((from.h + made.h) / 2);
		expect(added.doc.edges.some((e) => e.from === a && e.to === added.id)).toBe(true);
	});

	it('points the arrow back the way it came when going up or left', () => {
		const { doc, a } = twoNodes();
		for (const direction of ['up', 'left'] as const) {
			const added = addConnected(doc, a, direction)!;
			expect(added.doc.edges.some((e) => e.from === added.id && e.to === a)).toBe(true);
		}
	});

	it('puts each direction where its name says', () => {
		const node = twoNodes().doc.nodes[0];
		expect(placeNear(node, 'down', 'process').y).toBeGreaterThan(node.y);
		expect(placeNear(node, 'up', 'process').y).toBeLessThan(node.y);
		expect(placeNear(node, 'right', 'process').x).toBeGreaterThan(node.x);
		expect(placeNear(node, 'left', 'process').x).toBeLessThan(node.x);
	});

	it('has nothing to add onto a node that is not there', () => {
		expect(addConnected(twoNodes().doc, 'ghost', 'down')).toBeNull();
	});
});

describe('bounds', () => {
	it('covers every node, edges of the shapes included', () => {
		const { doc } = twoNodes();
		const box = bounds(doc);
		for (const node of doc.nodes) {
			expect(box.x).toBeLessThanOrEqual(node.x - node.w / 2);
			expect(box.y + box.h).toBeGreaterThanOrEqual(node.y + node.h / 2);
		}
	});

	it('is empty for an empty diagram rather than infinite', () => {
		expect(bounds(EMPTY)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
	});
});

describe('reading a file back', () => {
	it('round trips a document through JSON', () => {
		const { doc } = twoNodes();
		expect(parseDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
	});

	it('drops an edge whose node is missing rather than drawing from nowhere', () => {
		const { doc, a } = twoNodes();
		const broken = { ...doc, nodes: doc.nodes.filter((n) => n.id !== a) };
		expect(parseDoc(broken).edges).toHaveLength(0);
	});

	it('opens a file from when there were more shapes', () => {
		// Two shapes were retired. A diagram drawn with them still opens, with
		// those boxes becoming the nearest thing that stayed.
		const old = { nodes: [{ id: 'a', shape: 'io', text: 'Form', x: 0, y: 0 }], edges: [] };
		expect(parseDoc(old).nodes[0].shape).toBe('process');
		expect(parseDoc(old).nodes[0].text).toBe('Form');
	});

	it('survives a file that is not one of ours', () => {
		expect(parseDoc(null)).toEqual(EMPTY);
		expect(parseDoc({ nodes: 'no', edges: 7 })).toEqual(EMPTY);
		expect(parseDoc({ nodes: [{ id: 'a', x: 'over there' }] }).nodes[0].x).toBe(0);
	});
});
