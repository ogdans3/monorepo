import { describe, expect, it } from 'vitest';
import { rankNodes, tidy } from './layout';
import { addNode, connect, EMPTY, type FlowDoc } from './model';

/** A start, a decision, and two branches that meet again. */
function diamondGraph() {
	let doc: FlowDoc = EMPTY;
	const ids: Record<string, string> = {};
	for (const [key, shape] of [
		['start', 'terminator'],
		['check', 'decision'],
		['yes', 'process'],
		['no', 'process'],
		['end', 'terminator']
	] as const) {
		const added = addNode(doc, shape, 0, 0, key);
		doc = added.doc;
		ids[key] = added.id;
	}
	doc = connect(doc, ids.start, ids.check);
	doc = connect(doc, ids.check, ids.yes, 'yes');
	doc = connect(doc, ids.check, ids.no, 'no');
	doc = connect(doc, ids.yes, ids.end);
	doc = connect(doc, ids.no, ids.end);
	return { doc, ids };
}

describe('rankNodes', () => {
	it('puts every node below everything that points at it', () => {
		const { doc, ids } = diamondGraph();
		const rank = rankNodes(doc);
		expect(rank.get(ids.start)).toBe(0);
		expect(rank.get(ids.check)).toBe(1);
		expect(rank.get(ids.yes)).toBe(2);
		expect(rank.get(ids.no)).toBe(2);
		// The join waits for the longer of the two ways in.
		expect(rank.get(ids.end)).toBe(3);
	});

	it('settles a loop instead of spinning on it', () => {
		let doc: FlowDoc = EMPTY;
		const a = addNode(doc, 'process', 0, 0, 'a');
		const b = addNode(a.doc, 'process', 0, 0, 'b');
		doc = connect(connect(b.doc, a.id, b.id), b.id, a.id);
		const rank = rankNodes(doc);
		expect(rank.size).toBe(2);
		for (const value of rank.values()) expect(Number.isFinite(value)).toBe(true);
	});
});

describe('tidy', () => {
	it('lays the flow out downwards, one row per rank', () => {
		const { doc, ids } = diamondGraph();
		const laid = tidy(doc);
		const at = (id: string) => laid.nodes.find((n) => n.id === id)!;
		expect(at(ids.start).y).toBeLessThan(at(ids.check).y);
		expect(at(ids.check).y).toBeLessThan(at(ids.yes).y);
		expect(at(ids.yes).y).toBeLessThan(at(ids.end).y);
	});

	it('puts the two branches side by side, not on top of each other', () => {
		const { doc, ids } = diamondGraph();
		const laid = tidy(doc);
		const yes = laid.nodes.find((n) => n.id === ids.yes)!;
		const no = laid.nodes.find((n) => n.id === ids.no)!;
		expect(yes.y).toBeCloseTo(no.y, 5);
		expect(Math.abs(yes.x - no.x)).toBeGreaterThanOrEqual((yes.w + no.w) / 2);
	});

	it('centres the join under the branches it joins', () => {
		const { doc, ids } = diamondGraph();
		const laid = tidy(doc);
		const at = (id: string) => laid.nodes.find((n) => n.id === id)!;
		const middle = (at(ids.yes).x + at(ids.no).x) / 2;
		expect(Math.abs(at(ids.end).x - middle)).toBeLessThan(1);
	});

	it('never leaves two nodes overlapping in a row', () => {
		let doc: FlowDoc = EMPTY;
		const root = addNode(doc, 'terminator', 0, 0, 'start');
		doc = root.doc;
		for (let i = 0; i < 6; i++) {
			const child = addNode(doc, 'process', 0, 0, `branch ${i}`);
			doc = connect(child.doc, root.id, child.id);
		}
		const laid = tidy(doc);
		const row = laid.nodes.filter((n) => n.id !== root.id).sort((a, b) => a.x - b.x);
		for (let i = 1; i < row.length; i++) {
			const gap = row[i].x - row[i - 1].x - (row[i].w + row[i - 1].w) / 2;
			expect(gap).toBeGreaterThanOrEqual(0);
		}
	});

	it('has nothing to do with an empty diagram', () => {
		expect(tidy(EMPTY)).toEqual(EMPTY);
	});
});
