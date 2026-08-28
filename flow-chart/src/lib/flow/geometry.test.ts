import { describe, expect, it } from 'vitest';
import { arrowHead, edgeAnchor, hits, midpoint, pathOf, route } from './geometry';
import type { FlowNode } from './model';

const node = (over: Partial<FlowNode> = {}): FlowNode => ({
	id: 'n1',
	shape: 'process',
	text: '',
	x: 0,
	y: 0,
	w: 160,
	h: 64,
	...over
});

describe('edgeAnchor', () => {
	it('lands on the side of a box, not in the middle of it', () => {
		const point = edgeAnchor(node(), { x: 400, y: 0 });
		expect(point.x).toBeCloseTo(80, 5);
		expect(point.y).toBeCloseTo(0, 5);
	});

	it('lands on the top when the line comes from above', () => {
		const point = edgeAnchor(node(), { x: 0, y: -400 });
		expect(point.y).toBeCloseTo(-32, 5);
	});

	it('follows the slope of a diamond instead of its bounding box', () => {
		const diamond = node({ shape: 'decision', w: 160, h: 100 });
		const corner = edgeAnchor(diamond, { x: 400, y: 400 });
		// On the diamond: |x|/hw + |y|/hh = 1. A box would have put it outside.
		expect(Math.abs(corner.x) / 80 + Math.abs(corner.y) / 50).toBeCloseTo(1, 5);
		expect(Math.abs(corner.x)).toBeLessThan(80);
	});

	it('has an answer for a node pointing at itself', () => {
		expect(edgeAnchor(node(), { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
	});
});

describe('route', () => {
	it('goes straight down when one node is under the other', () => {
		const from = node();
		const to = node({ id: 'n2', y: 200 });
		const points = route(from, to);
		expect(points).toHaveLength(2);
		expect(points[0].x).toBeCloseTo(points[1].x, 5);
	});

	it('bends once when the next node is down and across', () => {
		const points = route(node(), node({ id: 'n2', x: 300, y: 200 }));
		expect(points).toHaveLength(3);
		// What makes it an elbow: the corner is level with one end and in line
		// with the other, so both legs run along an axis. Which way round it
		// goes depends on where the room is, and either is right.
		const level = (a: { y: number }, b: { y: number }) => Math.abs(a.y - b.y) < 1e-6;
		const inLine = (a: { x: number }, b: { x: number }) => Math.abs(a.x - b.x) < 1e-6;
		const first = level(points[1], points[0]) || inLine(points[1], points[0]);
		const second = level(points[1], points[2]) || inLine(points[1], points[2]);
		expect(first && second).toBe(true);
		// and not the same axis twice, which would be a straight line with a dent
		expect(level(points[1], points[0])).not.toBe(level(points[1], points[2]));
	});

	it('leaves along the axis with the most room', () => {
		// Mostly downwards: out of the bottom, then across.
		const down = route(node(), node({ id: 'n2', x: 120, y: 400 }));
		expect(down[1].x).toBeCloseTo(down[0].x, 5);
		// Mostly sideways: out of the side, then down.
		const across = route(node(), node({ id: 'n2', x: 400, y: 120 }));
		expect(across[1].y).toBeCloseTo(across[0].y, 5);
	});

	it('starts and ends outside both shapes', () => {
		const from = node();
		const to = node({ id: 'n2', x: 300, y: 200 });
		const points = route(from, to);
		expect(hits(from, points[0])).toBe(true); // on the boundary
		expect(hits(to, points[points.length - 1])).toBe(true);
		expect(hits(to, points[0])).toBe(false);
	});
});

describe('routing around what is in the way', () => {
	const between = node({ id: 'mid', y: 200, w: 200, h: 80 });

	it('goes straight through nothing when nothing is there', () => {
		const points = route(node(), node({ id: 'n2', y: 400 }), [node(), node({ id: 'n2', y: 400 })]);
		expect(points).toHaveLength(2);
	});

	it('steps out and around a node in the way', () => {
		const from = node();
		const to = node({ id: 'n2', y: 400 });
		const points = route(from, to, [from, between, to]);
		expect(points.length).toBeGreaterThan(2);
		// Every leg clears the box it was going through.
		const lane = Math.max(...points.map((p) => Math.abs(p.x)));
		expect(lane).toBeGreaterThan(between.w / 2);
	});

	it('leaves the sides, not the top and bottom, when it detours', () => {
		const from = node();
		const to = node({ id: 'n2', y: 400 });
		const points = route(from, to, [from, between, to]);
		expect(points[0].y).toBeCloseTo(from.y, 5);
		expect(points[points.length - 1].y).toBeCloseTo(to.y, 5);
	});

	it('picks the nearer side to go round', () => {
		const from = node();
		const to = node({ id: 'n2', y: 400 });
		// In the way, and stretching far to the right, so the near side is left.
		const wide = node({ id: 'mid', x: 200, y: 200, w: 560, h: 80 });
		const points = route(from, to, [from, wide, to]);
		expect(points[1].x).toBeLessThan(0);
	});

	it('ignores the two nodes it is joining', () => {
		// The line touches both by definition, and detouring around them would
		// be a loop out of one and back into the other.
		const from = node();
		const to = node({ id: 'n2', y: 400 });
		expect(route(from, to, [from, to])).toHaveLength(2);
	});
});

describe('arrowHead', () => {
	it('points the way the line is going', () => {
		const [a, b] = arrowHead([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
		expect(a.x).toBeLessThan(100);
		expect(b.x).toBeLessThan(100);
		expect(Math.sign(a.y)).toBe(-Math.sign(b.y));
	});

	it('turns with an elbow, following the last leg only', () => {
		const [a] = arrowHead([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }]);
		expect(a.x).toBeLessThan(100);
		expect(Math.abs(a.y - 100)).toBeLessThan(10);
	});
});

describe('pathOf', () => {
	it('is a straight line for two points', () => {
		expect(pathOf([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M 0 0 L 10 0');
	});

	it('rounds the corner of an elbow', () => {
		const d = pathOf([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }]);
		expect(d).toContain('Q 0 100');
	});

	it('has nothing to draw for a single point', () => {
		expect(pathOf([{ x: 0, y: 0 }])).toBe('');
	});
});

describe('hits', () => {
	it('knows the corner of a diamond is outside it', () => {
		const diamond = node({ shape: 'decision', w: 160, h: 100 });
		expect(hits(diamond, { x: 0, y: 0 })).toBe(true);
		expect(hits(diamond, { x: 78, y: 48 })).toBe(false); // inside the box, past the slope
	});
});

describe('midpoint', () => {
	it('is the corner of an elbow, where the line really is', () => {
		expect(midpoint([{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 80, y: 100 }])).toEqual({ x: 0, y: 100 });
	});
});
