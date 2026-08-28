import { describe, expect, it } from 'vitest';
import { fromMermaid, looksLikeMermaid, toMermaid } from './mermaid';
import { addNode, connect, EMPTY, type FlowDoc } from './model';

describe('toMermaid', () => {
	it('writes the shapes Mermaid uses for each of ours', () => {
		let doc: FlowDoc = EMPTY;
		const start = addNode(doc, 'terminator', 0, 0, 'Start');
		const check = addNode(start.doc, 'decision', 0, 0, 'Paid?');
		const io = addNode(check.doc, 'io', 0, 0, 'Receipt');
		doc = connect(connect(io.doc, start.id, check.id), check.id, io.id, 'yes');

		const text = toMermaid(doc);
		expect(text.split('\n')[0]).toBe('flowchart TD');
		expect(text).toContain('(["Start"])');
		expect(text).toContain('{"Paid?"}');
		expect(text).toContain('[/"Receipt"/]');
		expect(text).toMatch(/-- "yes" -->/);
	});

	it('does not let a label break the syntax it sits in', () => {
		const one = addNode(EMPTY, 'process', 0, 0, 'He said "go" [maybe]');
		expect(toMermaid(one.doc)).toContain(`["He said 'go' [maybe]"]`);
	});
});

describe('fromMermaid', () => {
	it('reads back what we wrote', () => {
		let doc: FlowDoc = EMPTY;
		const a = addNode(doc, 'terminator', 0, 0, 'Start');
		const b = addNode(a.doc, 'decision', 0, 0, 'Ready?');
		doc = connect(b.doc, a.id, b.id, 'always');

		const { doc: back, skipped } = fromMermaid(toMermaid(doc));
		expect(skipped).toEqual([]);
		expect(back.nodes.map((n) => [n.shape, n.text])).toEqual([
			['terminator', 'Start'],
			['decision', 'Ready?']
		]);
		expect(back.edges[0].label).toBe('always');
	});

	it('takes the plain kind a person types by hand', () => {
		const { doc } = fromMermaid(`
			flowchart TD
			  A[Get up] --> B{Raining?}
			  B -->|yes| C[Take a coat]
			  B -- no --> D[Leave]
		`);
		expect(doc.nodes).toHaveLength(4);
		expect(doc.edges).toHaveLength(3);
		expect(doc.edges.map((e) => e.label)).toEqual(['', 'yes', 'no']);
		expect(doc.nodes.find((n) => n.text === 'Raining?')?.shape).toBe('decision');
	});

	it('gives a bare name a box, and only shapes it once', () => {
		const { doc } = fromMermaid('flowchart TD\n A --> B\n B[Named later] --> C');
		expect(doc.nodes).toHaveLength(3);
		expect(doc.nodes.find((n) => n.text === 'Named later')).toBeTruthy();
		expect(doc.edges).toHaveLength(2);
	});

	it('says what it did not understand instead of quietly dropping it', () => {
		const { doc, skipped } = fromMermaid(
			'flowchart TD\n A --> B\n subgraph one\n end\n style A fill:#f00'
		);
		expect(doc.nodes).toHaveLength(2);
		expect(skipped).toEqual(['subgraph one', 'end', 'style A fill:#f00']);
	});

	it('comes back empty from something that is not a diagram', () => {
		expect(fromMermaid('the quick brown fox').doc).toEqual(EMPTY);
	});
});

describe('looksLikeMermaid', () => {
	it('tells a pasted diagram from a pasted file', () => {
		expect(looksLikeMermaid('flowchart TD\n A --> B')).toBe(true);
		expect(looksLikeMermaid('graph LR; A-->B')).toBe(true);
		expect(looksLikeMermaid('{"nodes":[],"edges":[]}')).toBe(false);
	});
});
