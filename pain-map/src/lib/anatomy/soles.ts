import { c, mirrorAndClose, outline, point, toPath } from './path';

/**
 * The soles of both feet, seen from underneath.
 *
 * Its own drawing rather than a body view, because there is no way to see the
 * underside of a foot on a standing figure. Laid out as two feet side by side
 * on a 200 by 520 grid so it shares a viewBox with the other views and the
 * layout does not have to special-case it.
 *
 * Plantar pain is common enough to deserve a view of its own: plantar
 * fasciitis alone accounts for a large share of foot complaints, and it has a
 * specific location, the inside of the heel, that a body outline cannot show.
 */

const FOOT_MID = 65;
const TOP = 40;
const BOTTOM = 470;

/** The right foot, drawn as the outline of a sole with the big toe inward. */
function soleHalf(): string {
	const half = outline(point(FOOT_MID, TOP + 6), [
		// outer edge of the big toe, then along the ball of the foot
		c(FOOT_MID + 14, TOP, FOOT_MID + 26, TOP + 12, FOOT_MID + 28, TOP + 38),
		c(FOOT_MID + 30, TOP + 62, FOOT_MID + 31, TOP + 96, FOOT_MID + 29, TOP + 132),
		// the outer border of the foot, hollowed slightly at the arch
		c(FOOT_MID + 27, TOP + 190, FOOT_MID + 26, TOP + 240, FOOT_MID + 27, TOP + 286),
		// heel
		c(FOOT_MID + 28, TOP + 350, FOOT_MID + 20, BOTTOM - TOP, FOOT_MID, BOTTOM - TOP)
	]);
	return toPath(mirrorAndClose(half, FOOT_MID));
}

/** The toes, as five separate shapes so a toe can be pointed at. */
function toes(): string[] {
	const widths = [13, 9, 8.5, 8, 7];
	const heights = [30, 26, 24, 21, 18];
	let x = FOOT_MID - 26;
	const out: string[] = [];
	for (let i = 0; i < 5; i++) {
		const w = widths[i];
		const h = heights[i];
		const cx = x + w / 2;
		const top = TOP + 4 + (i === 0 ? 0 : 6 + i * 2);
		out.push(
			toPath(
				outline(point(cx - w / 2, top + h), [
					c(cx - w / 2, top + h * 0.3, cx - w * 0.4, top, cx, top),
					c(cx + w * 0.4, top, cx + w / 2, top + h * 0.3, cx + w / 2, top + h)
				])
			)
		);
		x += w + 1.5;
	}
	return out;
}

export interface SolePaths {
	/** Outline of one sole, positioned for the right foot. */
	soleRight: string;
	soleLeft: string;
	toesRight: string[];
	toesLeft: string[];
	/** The arch, drawn as a hint line rather than a hard edge. */
	archRight: string;
	archLeft: string;
}

const SHIFT = 70;

function shift(d: string, dx: number): string {
	return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, x, y) => `${Number(x) + dx},${y}`);
}

function mirrorAt(d: string, axis: number): string {
	return d.replace(
		/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g,
		(_m, x, y) => `${Math.round((2 * axis - Number(x)) * 100) / 100},${y}`
	);
}

/** The medial arch, the line plantar fasciitis runs along. */
function arch(): string {
	return toPath(
		outline(point(FOOT_MID - 18, TOP + 130), [
			c(FOOT_MID - 24, TOP + 180, FOOT_MID - 24, TOP + 240, FOOT_MID - 16, TOP + 290)
		]),
		false
	);
}

export function solePaths(): SolePaths {
	const base = soleHalf();
	const baseToes = toes();
	const baseArch = arch();
	return {
		soleRight: shift(base, -SHIFT + 35),
		soleLeft: shift(mirrorAt(base, FOOT_MID), SHIFT + 35),
		toesRight: baseToes.map((d) => shift(d, -SHIFT + 35)),
		toesLeft: baseToes.map((d) => shift(mirrorAt(d, FOOT_MID), SHIFT + 35)),
		archRight: shift(baseArch, -SHIFT + 35),
		archLeft: shift(mirrorAt(baseArch, FOOT_MID), SHIFT + 35)
	};
}
