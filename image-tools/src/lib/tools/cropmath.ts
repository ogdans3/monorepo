/** Crop-frame geometry: resizing, moving, aspect locking, clamping. */

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const MIN_CROP = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

const round = (r: Rect): Rect => ({
	x: Math.round(r.x),
	y: Math.round(r.y),
	w: Math.round(r.w),
	h: Math.round(r.h)
});

/** Largest rect with the given aspect that fits iw × ih, centred. */
export function fullRect(iw: number, ih: number, aspect: number | null): Rect {
	if (!aspect) return { x: 0, y: 0, w: iw, h: ih };
	let w = iw;
	let h = w / aspect;
	if (h > ih) {
		h = ih;
		w = h * aspect;
	}
	return round({ x: (iw - w) / 2, y: (ih - h) / 2, w, h });
}

/** Re-shape a rect to an aspect, keeping its centre and roughly its area. */
export function applyAspect(r: Rect, aspect: number | null, iw: number, ih: number): Rect {
	if (!aspect) return r;
	let w = Math.sqrt(r.w * r.h * aspect);
	let h = w / aspect;
	if (w > iw) {
		w = iw;
		h = w / aspect;
	}
	if (h > ih) {
		h = ih;
		w = h * aspect;
	}
	if (w < MIN_CROP) {
		w = MIN_CROP;
		h = w / aspect;
	}
	if (h < MIN_CROP) {
		h = MIN_CROP;
		w = h * aspect;
	}
	const x = clamp(r.x + r.w / 2 - w / 2, 0, iw - w);
	const y = clamp(r.y + r.h / 2 - h / 2, 0, ih - h);
	return round({ x, y, w, h });
}

export function moveRect(r: Rect, dx: number, dy: number, iw: number, ih: number): Rect {
	return {
		...r,
		x: Math.round(clamp(r.x + dx, 0, iw - r.w)),
		y: Math.round(clamp(r.y + dy, 0, ih - r.h))
	};
}

/**
 * Resize from a drag: `start` is the rect when the drag began, dx/dy the total
 * pointer delta in image pixels. Free resizing moves only the dragged edges.
 * With an aspect, corners anchor the opposite corner and edges keep the other
 * axis centred, shrinking toward the anchor when the image edge is hit.
 */
export function resizeRect(
	start: Rect,
	handle: Handle,
	dx: number,
	dy: number,
	iw: number,
	ih: number,
	aspect: number | null
): Rect {
	const west = handle.includes('w');
	const east = handle.includes('e');
	const north = handle.includes('n');
	const south = handle.includes('s');

	let left = start.x;
	let right = start.x + start.w;
	let top = start.y;
	let bottom = start.y + start.h;

	if (west) left = clamp(left + dx, 0, right - MIN_CROP);
	if (east) right = clamp(right + dx, left + MIN_CROP, iw);
	if (north) top = clamp(top + dy, 0, bottom - MIN_CROP);
	if (south) bottom = clamp(bottom + dy, top + MIN_CROP, ih);

	if (!aspect) return round({ x: left, y: top, w: right - left, h: bottom - top });

	let w = right - left;
	let h = bottom - top;
	const horiz = west || east;
	const vert = north || south;

	// which axis drives the other
	if (horiz && vert) {
		if (Math.abs(dx) >= Math.abs(dy)) h = w / aspect;
		else w = h * aspect;
	} else if (horiz) {
		h = w / aspect;
	} else {
		w = h * aspect;
	}

	// anchor and available space
	const cx = start.x + start.w / 2;
	const cy = start.y + start.h / 2;
	let maxW: number;
	let maxH: number;
	if (horiz && vert) {
		maxW = west ? right : iw - left;
		maxH = north ? bottom : ih - top;
	} else if (horiz) {
		maxW = west ? right : iw - left;
		maxH = 2 * Math.min(cy, ih - cy);
	} else {
		maxW = 2 * Math.min(cx, iw - cx);
		maxH = north ? bottom : ih - top;
	}

	// fit within bounds, keep the aspect
	if (w > maxW) {
		w = maxW;
		h = w / aspect;
	}
	if (h > maxH) {
		h = maxH;
		w = h * aspect;
	}
	if (w < MIN_CROP) {
		w = MIN_CROP;
		h = w / aspect;
	}
	if (h < MIN_CROP) {
		h = MIN_CROP;
		w = h * aspect;
	}

	let x: number;
	let y: number;
	if (horiz && vert) {
		x = west ? right - w : left;
		y = north ? bottom - h : top;
	} else if (horiz) {
		x = west ? right - w : left;
		y = clamp(cy - h / 2, 0, ih - h);
	} else {
		x = clamp(cx - w / 2, 0, iw - w);
		y = north ? bottom - h : top;
	}
	return round({ x: clamp(x, 0, iw - w), y: clamp(y, 0, ih - h), w, h });
}

/** Resize to exact pixel sizes from the inputs, anchored top-left, clamped. */
export function setSize(r: Rect, w: number, h: number, iw: number, ih: number, aspect: number | null): Rect {
	let nw = clamp(Math.round(w) || MIN_CROP, MIN_CROP, iw);
	let nh = clamp(Math.round(h) || MIN_CROP, MIN_CROP, ih);
	if (aspect) {
		nh = clamp(Math.round(nw / aspect), MIN_CROP, ih);
		nw = clamp(Math.round(nh * aspect), MIN_CROP, iw);
	}
	return {
		x: clamp(r.x, 0, iw - nw),
		y: clamp(r.y, 0, ih - nh),
		w: nw,
		h: nh
	};
}
