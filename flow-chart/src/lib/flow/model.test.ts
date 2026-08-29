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
	hiddenUnder,
	nodeText,
	withRecent,
	placeNear,
	NO_COLOUR,
	updateNode,
	visibleDoc,
	visibleIds,
	wrapText
} from './model';

/** fitSize wants a whole node now, so this is the short way to ask about text. */
const sizeOf = (title: string, over: Partial<Parameters<typeof fitSize>[0]> = {}) =>
	fitSize({
		shape: 'process',
		title,
		subtitle: '',
		body: '',
		showSubtitle: true,
		showBody: false,
		font: 'sans',
		size: 15,
		bold: false,
		italic: false,
		...over
	});

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
		updateNode(doc, a, { title: 'Something else' });
		expect(JSON.stringify(doc)).toBe(before);
	});

	it('grows a node to fit what was typed into it', () => {
		const { doc, b } = twoNodes();
		const narrow = doc.nodes.find((n) => n.id === b)!.w;
		const wide = updateNode(doc, b, {
			title: 'A much longer label than the one before it'
		}).nodes.find((n) => n.id === b)!.w;
		expect(wide).toBeGreaterThan(narrow);
	});

	it('resizes when the shape changes, since a diamond needs the room', () => {
		const { doc, b } = twoNodes();
		const box = doc.nodes.find((n) => n.id === b)!;
		const diamond = updateNode(doc, b, { shape: 'decision' }).nodes.find((n) => n.id === b)!;
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
		expect(sizeOf('').h).toBeGreaterThan(0);
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
		const small = sizeOf('short');
		const big = sizeOf(paragraph);
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

describe('the three pieces of text', () => {
	const node = (over: Partial<Parameters<typeof nodeText>[0]> = {}) => ({
		shape: 'process' as const,
		title: 'Send the invoice',
		subtitle: 'within one working day',
		body: 'Finance needs the reference from the order, which is on the packing slip.',
		showSubtitle: true,
		showBody: false,
		font: 'sans' as const,
		size: 15,
		bold: false,
		italic: false,
		...over
	});

	it('shows the title and the subtitle, and keeps the body back', () => {
		const kinds = new Set(nodeText(node()).lines.map((line) => line.kind));
		expect(kinds).toEqual(new Set(['title', 'subtitle']));
	});

	it('adds the body when it is asked for, and grows the box for it', () => {
		const shut = nodeText(node());
		const open = nodeText(node({ showBody: true }));
		expect(open.lines.some((line) => line.kind === 'body')).toBe(true);
		expect(open.h).toBeGreaterThan(shut.h);
	});

	it('leaves out a subtitle that is switched off, and one that is empty', () => {
		expect(nodeText(node({ showSubtitle: false })).lines.every((l) => l.kind === 'title')).toBe(
			true
		);
		expect(nodeText(node({ subtitle: '   ' })).lines.every((l) => l.kind === 'title')).toBe(true);
	});

	it('writes the subtitle smaller than the title, and the body smaller again', () => {
		const lines = nodeText(node({ showBody: true })).lines;
		const size = (kind: string) => lines.find((line) => line.kind === kind)!.size;
		expect(size('subtitle')).toBeLessThan(size('title'));
		expect(size('body')).toBeLessThan(size('subtitle'));
	});

	it('stacks the lines down the box in the order they are read', () => {
		const lines = nodeText(node({ showBody: true })).lines;
		for (let i = 1; i < lines.length; i++) {
			expect(lines[i].y).toBeGreaterThan(lines[i - 1].y);
		}
	});

	it('grows the box when the type gets bigger', () => {
		expect(nodeText(node({ size: 28 })).h).toBeGreaterThan(nodeText(node({ size: 13 })).h);
	});
});

describe('collapsing a branch', () => {
	/** start -> check -> (yes | no), both branches meeting at done. */
	function branching() {
		let doc = EMPTY;
		const ids: Record<string, string> = {};
		for (const key of ['start', 'check', 'yes', 'no', 'done']) {
			const added = addNode(doc, 'process', 0, 0, key);
			doc = added.doc;
			ids[key] = added.id;
		}
		doc = connect(doc, ids.start, ids.check);
		doc = connect(doc, ids.check, ids.yes);
		doc = connect(doc, ids.check, ids.no);
		doc = connect(doc, ids.yes, ids.done);
		doc = connect(doc, ids.no, ids.done);
		return { doc, ids };
	}

	it('shows everything until something is collapsed', () => {
		const { doc } = branching();
		expect(visibleIds(doc).size).toBe(5);
	});

	it('folds away what hangs off the collapsed node', () => {
		const { doc, ids } = branching();
		const folded = updateNode(doc, ids.yes, { collapsed: true });
		// "yes" itself stays, and it is still the way back to what it is hiding.
		expect(visibleIds(folded).has(ids.yes)).toBe(true);
		// "done" is still reached through "no", so it stays as well.
		expect(visibleIds(folded).has(ids.done)).toBe(true);
	});

	it('only hides a node when every way in is through something collapsed', () => {
		const { doc, ids } = branching();
		const both = updateNode(updateNode(doc, ids.yes, { collapsed: true }), ids.no, {
			collapsed: true
		});
		expect(visibleIds(both).has(ids.done)).toBe(false);
		expect(visibleIds(both).size).toBe(4);
	});

	it('takes the arrows to hidden nodes out of the drawing too', () => {
		const { doc, ids } = branching();
		const folded = updateNode(doc, ids.check, { collapsed: true });
		const drawn = visibleDoc(folded);
		expect(drawn.nodes.map((n) => n.title).sort()).toEqual(['check', 'start']);
		expect(drawn.edges).toHaveLength(1);
	});

	it('says how many are folded away, for the badge on the node', () => {
		const { doc, ids } = branching();
		expect(hiddenUnder(updateNode(doc, ids.check, { collapsed: true }), ids.check)).toBe(3);
		expect(hiddenUnder(doc, ids.check)).toBe(0);
	});

	it('survives a loop rather than walking round it for ever', () => {
		let doc = EMPTY;
		const a = addNode(doc, 'process', 0, 0, 'a');
		const b = addNode(a.doc, 'process', 0, 0, 'b');
		doc = connect(connect(b.doc, a.id, b.id), b.id, a.id);
		expect(visibleIds(updateNode(doc, a.id, { collapsed: true })).size).toBeGreaterThan(0);
	});
});

describe('recent colours', () => {
	it('keeps the newest first, without repeating one', () => {
		let recent = withRecent([], '#fde8e8');
		recent = withRecent(recent, '#dcf1f4');
		recent = withRecent(recent, '#fde8e8');
		expect(recent).toEqual(['#fde8e8', '#dcf1f4']);
	});

	it('does not collect plain white, which is the absence of a colour', () => {
		expect(withRecent([], NO_COLOUR)).toEqual([]);
	});

	it('forgets the oldest past the limit', () => {
		let recent: string[] = [];
		for (const colour of ['#111111', '#222222', '#333333', '#444444']) {
			recent = withRecent(recent, colour, 3);
		}
		expect(recent).toEqual(['#444444', '#333333', '#222222']);
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
		// and the one string it used to hold becomes the title
		expect(parseDoc(old).nodes[0].title).toBe('Form');
	});

	it('survives a file that is not one of ours', () => {
		expect(parseDoc(null)).toEqual(EMPTY);
		expect(parseDoc({ nodes: 'no', edges: 7 })).toEqual(EMPTY);
		expect(parseDoc({ nodes: [{ id: 'a', x: 'over there' }] }).nodes[0].x).toBe(0);
	});
});
