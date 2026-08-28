import { describe, expect, it } from 'vitest';
import {
	addNode,
	bounds,
	connect,
	EMPTY,
	fitSize,
	parseDoc,
	remove,
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
		const text = 'check whether the order has already been paid for';
		expect(wrapText(text, 'process').length).toBeGreaterThan(1);
		expect(wrapText(text, 'decision').length).toBeGreaterThan(wrapText(text, 'process').length);
	});

	it('keeps one empty line for an empty label, so a box is still a box', () => {
		expect(wrapText('')).toEqual(['']);
		expect(fitSize('process', '').h).toBeGreaterThan(0);
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

	it('survives a file that is not one of ours', () => {
		expect(parseDoc(null)).toEqual(EMPTY);
		expect(parseDoc({ nodes: 'no', edges: 7 })).toEqual(EMPTY);
		expect(parseDoc({ nodes: [{ id: 'a', x: 'over there' }] }).nodes[0].x).toBe(0);
	});
});
