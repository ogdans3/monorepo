import type { FlowNode } from './model';

/**
 * Where an arrow meets a shape, and how it gets there.
 *
 * The whole job is to stop lines from ending in the middle of a box. An arrow
 * is drawn between two centres and then trimmed back to each outline, which
 * means the outline has to be known per shape: a rectangle, a diamond and a
 * stadium all cut the same line at different points, and a diamond that is
 * trimmed as though it were its bounding box leaves a visible gap at the tip.
 */

export interface Point {
	x: number;
	y: number;
}

/**
 * The point where a line from the node's centre towards `towards` crosses the
 * node's outline. Returned in diagram coordinates.
 */
export function edgeAnchor(node: FlowNode, towards: Point): Point {
	const dx = towards.x - node.x;
	const dy = towards.y - node.y;
	if (dx === 0 && dy === 0) return { x: node.x, y: node.y };

	const hw = node.w / 2;
	const hh = node.h / 2;

	if (node.shape === 'decision') {
		// |x|/hw + |y|/hh = 1, the diamond. Scale the direction until it lands.
		const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
		return { x: node.x + dx * t, y: node.y + dy * t };
	}

	if (node.shape === 'terminator') {
		// A stadium: a rectangle with semicircular ends. Close enough to trim as
		// a rounded rectangle, which is what it is drawn as.
		return roundedRectAnchor(node, dx, dy, hh);
	}

	if (node.shape === 'io') {
		// A parallelogram leaning right. Its slanted sides mean the horizontal
		// crossing moves with y, so the box is narrowed by however far up or
		// down the line leaves.
		const skew = Math.min(hw * 0.35, 26);
		const scale = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
		const y = dy * scale;
		const lean = (y / hh) * skew * (dx >= 0 ? -1 : 1);
		const t = Math.min((hw - Math.abs(lean)) / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
		return { x: node.x + dx * t, y: node.y + dy * t };
	}

	return roundedRectAnchor(node, dx, dy, node.shape === 'note' ? 0 : 10);
}

/** Rectangle crossing, pulled in at the corners so a radius does not show. */
function roundedRectAnchor(node: FlowNode, dx: number, dy: number, radius: number): Point {
	const hw = node.w / 2;
	const hh = node.h / 2;
	const t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
	const x = dx * t;
	const y = dy * t;
	// Near a corner, step back along the line by the corner radius so the arrow
	// touches the curve rather than the corner it cut off.
	const overX = Math.abs(x) > hw - radius;
	const overY = Math.abs(y) > hh - radius;
	const pull = overX && overY ? radius * 0.3 : 0;
	const length = Math.hypot(x, y) || 1;
	return {
		x: node.x + x - (x / length) * pull,
		y: node.y + y - (y / length) * pull
	};
}

/**
 * The line between two nodes: from the edge of one to the edge of the other,
 * with a bend when they are neither in a column nor in a row.
 *
 * A flow chart reads as a flow because its lines are vertical and horizontal.
 * A single elbow keeps that while still connecting anything to anything, and it
 * is one bend rather than a router with opinions, which nobody has to predict.
 */
export function route(from: FlowNode, to: FlowNode, others: FlowNode[] = []): Point[] {
	const direct = simpleRoute(from, to);
	const blocked = others.filter(
		(node) => node.id !== from.id && node.id !== to.id && crosses(direct, node)
	);
	if (blocked.length === 0) return direct;

	// An arrow that skips ahead goes round the outside, the way it would be
	// drawn by hand. Anything else runs it through the boxes in between, which
	// reads as an arrow into each of them.
	return sideRoute(from, to, blocked);
}

function simpleRoute(from: FlowNode, to: FlowNode): Point[] {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const straight = Math.abs(dx) < 12 || Math.abs(dy) < 12;

	if (straight) {
		return [edgeAnchor(from, { x: to.x, y: to.y }), edgeAnchor(to, { x: from.x, y: from.y })];
	}

	// Leave along whichever axis has the most room, so a step down and across
	// leaves the bottom of one box and arrives at the side of the next.
	const vertical = Math.abs(dy) >= Math.abs(dx);
	const corner = vertical ? { x: from.x, y: to.y } : { x: to.x, y: from.y };
	return [edgeAnchor(from, corner), corner, edgeAnchor(to, corner)];
}

const LANE_GAP = 32;

/** Out of one side, down a clear lane, and back in the same side of the other. */
function sideRoute(from: FlowNode, to: FlowNode, blocked: FlowNode[]): Point[] {
	const involved = [from, to, ...blocked];
	const right = Math.max(...involved.map((n) => n.x + n.w / 2)) + LANE_GAP;
	const left = Math.min(...involved.map((n) => n.x - n.w / 2)) - LANE_GAP;
	const centre = (from.x + to.x) / 2;
	const lane = right - centre <= centre - left ? right : left;

	const exit = { x: lane > from.x ? from.x + from.w / 2 : from.x - from.w / 2, y: from.y };
	const enter = { x: lane > to.x ? to.x + to.w / 2 : to.x - to.w / 2, y: to.y };
	return [exit, { x: lane, y: from.y }, { x: lane, y: to.y }, enter];
}

/** Whether any leg of a path passes through a node's box. */
function crosses(points: Point[], node: FlowNode): boolean {
	const pad = 6;
	const box = {
		left: node.x - node.w / 2 - pad,
		right: node.x + node.w / 2 + pad,
		top: node.y - node.h / 2 - pad,
		bottom: node.y + node.h / 2 + pad
	};
	for (let i = 0; i < points.length - 1; i++) {
		if (segmentHitsBox(points[i], points[i + 1], box)) return true;
	}
	return false;
}

/** Slab clipping: the segment enters the box if it is inside both slabs at once. */
function segmentHitsBox(
	a: Point,
	b: Point,
	box: { left: number; right: number; top: number; bottom: number }
): boolean {
	let t0 = 0;
	let t1 = 1;
	const dx = b.x - a.x;
	const dy = b.y - a.y;

	for (const [p, q] of [
		[-dx, a.x - box.left],
		[dx, box.right - a.x],
		[-dy, a.y - box.top],
		[dy, box.bottom - a.y]
	]) {
		if (p === 0) {
			if (q < 0) return false; // parallel to this edge and outside it
			continue;
		}
		const r = q / p;
		if (p < 0) {
			if (r > t1) return false;
			if (r > t0) t0 = r;
		} else {
			if (r < t0) return false;
			if (r < t1) t1 = r;
		}
	}
	return t0 <= t1;
}

/** Halfway along a path, for putting a label where the line actually is. */
export function midpoint(points: Point[]): Point {
	if (points.length === 0) return { x: 0, y: 0 };
	if (points.length === 2) {
		return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
	}
	return points[Math.floor(points.length / 2)];
}

/** The two barbs of the arrow head at the end of a path. */
export function arrowHead(points: Point[], size = 9): [Point, Point] {
	const tip = points[points.length - 1];
	const before = points[points.length - 2] ?? tip;
	const angle = Math.atan2(tip.y - before.y, tip.x - before.x);
	const spread = Math.PI / 7;
	return [
		{ x: tip.x - size * Math.cos(angle - spread), y: tip.y - size * Math.sin(angle - spread) },
		{ x: tip.x - size * Math.cos(angle + spread), y: tip.y - size * Math.sin(angle + spread) }
	];
}

/** An SVG path with square corners rounded off, so the elbow is not a spike. */
export function pathOf(points: Point[], radius = 10): string {
	if (points.length < 2) return '';
	if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

	let d = `M ${points[0].x} ${points[0].y}`;
	for (let i = 1; i < points.length - 1; i++) {
		const previous = points[i - 1];
		const corner = points[i];
		const next = points[i + 1];
		const r = Math.min(
			radius,
			Math.hypot(corner.x - previous.x, corner.y - previous.y) / 2,
			Math.hypot(next.x - corner.x, next.y - corner.y) / 2
		);
		const inbound = towards(corner, previous, r);
		const outbound = towards(corner, next, r);
		d += ` L ${inbound.x} ${inbound.y} Q ${corner.x} ${corner.y} ${outbound.x} ${outbound.y}`;
	}
	const last = points[points.length - 1];
	return `${d} L ${last.x} ${last.y}`;
}

function towards(from: Point, to: Point, distance: number): Point {
	const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
	return {
		x: from.x + ((to.x - from.x) / length) * distance,
		y: from.y + ((to.y - from.y) / length) * distance
	};
}

/** Whether a point is inside a node, for hit testing a click on the canvas. */
export function hits(node: FlowNode, point: Point): boolean {
	const dx = Math.abs(point.x - node.x);
	const dy = Math.abs(point.y - node.y);
	if (node.shape === 'decision') return dx / (node.w / 2) + dy / (node.h / 2) <= 1;
	return dx <= node.w / 2 && dy <= node.h / 2;
}
