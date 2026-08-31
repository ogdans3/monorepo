import { describe, expect, it } from 'vitest';
import { fromMermaid, looksLikeMermaid, toMermaid } from './mermaid';
import { addNode, connect, EMPTY, setChart, updateNode, type FlowDoc } from './model';

describe('toMermaid', () => {
	it('writes the shapes Mermaid uses for each of ours', () => {
		let doc: FlowDoc = EMPTY;
		const start = addNode(doc, 'terminator', 0, 0, 'Start');
		const check = addNode(start.doc, 'decision', 0, 0, 'Paid?');
		const step = addNode(check.doc, 'process', 0, 0, 'Send a receipt');
		doc = connect(connect(step.doc, start.id, check.id), check.id, step.id, 'yes');

		const text = toMermaid(doc);
		expect(text.split('\n')[0]).toBe('flowchart TD');
		expect(text).toContain('(["Start"])');
		expect(text).toContain('{"Paid?"}');
		expect(text).toContain('["Send a receipt"]');
		expect(text).toMatch(/-- "yes" -->/);
	});

	it('opens a file using a shape this editor does not draw', () => {
		// Mermaid has more shapes than three. One of them should not stop a
		// diagram loading, so it becomes the nearest thing that is drawn.
		const { doc, skipped } = fromMermaid('flowchart TD\n A[/Fill the form/] --> B>Note]');
		expect(skipped).toEqual([]);
		expect(doc.nodes.map((n) => n.shape)).toEqual(['process', 'process']);
		expect(doc.nodes.map((n) => n.title)).toEqual(['Fill the form', 'Note']);
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
		expect(back.nodes.map((n) => [n.shape, n.title])).toEqual([
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
		expect(doc.nodes.find((n) => n.title === 'Raining?')?.shape).toBe('decision');
	});

	it('gives a bare name a box, and only shapes it once', () => {
		const { doc } = fromMermaid('flowchart TD\n A --> B\n B[Named later] --> C');
		expect(doc.nodes).toHaveLength(3);
		expect(doc.nodes.find((n) => n.title === 'Named later')).toBeTruthy();
		expect(doc.edges).toHaveLength(2);
	});

	it('says what it did not understand instead of quietly dropping it', () => {
		const { doc, skipped } = fromMermaid(
			'flowchart TD\n A --> B\n subgraph one\n end\n style A fill:#f00'
		);
		expect(doc.nodes).toHaveLength(2);
		// `end` is understood now that subgraphs are read, so it is not reported.
		// The grouping itself still is: its steps are kept and the grouping is not.
		expect(skipped).toEqual(['subgraph one', 'style A fill:#f00']);
	});

	it('keeps the steps a hand-written subgraph held', () => {
		const { doc } = fromMermaid('flowchart TD\n subgraph group\n A[One] --> B[Two]\n end');
		expect(doc.nodes.map((n) => n.title).sort()).toEqual(['One', 'Two']);
		expect(doc.nodes.every((n) => n.chart === null)).toBe(true);
	});

	it('brings a nested chart back through a round trip', () => {
		const outer = addNode(EMPTY, 'process', 0, 0, 'Deploy');
		const inner = addNode(EMPTY, 'process', 0, 0, 'Run tests');
		const withInner = addNode(inner.doc, 'process', 0, 100, 'Ship');
		const nested = connect(withInner.doc, inner.id, withInner.id);
		const doc = setChart(outer.doc, outer.id, nested);

		const text = toMermaid(doc);
		expect(text).toContain('subgraph');

		const back = fromMermaid(text).doc;
		expect(back.nodes).toHaveLength(1);
		expect(back.nodes[0].title).toBe('Deploy');
		expect(back.nodes[0].chart?.nodes.map((n) => n.title)).toEqual(['Run tests', 'Ship']);
		expect(back.nodes[0].chart?.edges).toHaveLength(1);
	});

	it('writes a label without its marks', () => {
		const { doc, id } = addNode(EMPTY, 'process', 0, 0, '**Bold** step');
		const text = toMermaid(updateNode(doc, id, { subtitle: '- *one*' }));
		expect(text).toContain('Bold step');
		expect(text).not.toContain('**');
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
