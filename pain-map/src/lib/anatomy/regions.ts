import { MID, VIEW_H, VIEW_W, Y } from './proportions';

/**
 * The general regions, one set per view.
 *
 * Each region is a plain rectangle in body coordinates rather than a traced
 * outline, because every region is drawn clipped to the silhouette. The body
 * shape does the shaping, so a rectangle over the thigh comes out thigh
 * shaped. Two things follow: a region can never spill outside the body, and
 * changing a body measurement reshapes every region on it for free.
 *
 * This is the coarse pass. Being roughly right is the point here, since the
 * next step zooms in and asks again.
 */

export type View = 'front' | 'back' | 'left' | 'right' | 'soles';
export type Side = 'left' | 'right' | 'centre';

export interface Region {
	id: string;
	/** What the visitor reads. Plain words, no Latin at this level. */
	label: string;
	side: Side;
	/** Which detail diagram this opens. */
	detail: string;
	/**
	 * Which clip this region belongs to. Arm regions are clipped to the arms
	 * and everything else to the torso, because at hip height the arm and the
	 * body nearly touch and a torso region clipped to their union bleeds
	 * straight into the forearm.
	 */
	limb?: 'arm';
	x: number;
	y: number;
	w: number;
	h: number;
}

export const VIEWS: { id: View; label: string; hint: string }[] = [
	{ id: 'front', label: 'Front', hint: 'Chest, belly, front of the arms and legs' },
	{ id: 'back', label: 'Back', hint: 'Spine, shoulder blades, buttocks, calves' },
	{ id: 'left', label: 'Left side', hint: 'Left hip, ribs and outer leg' },
	{ id: 'right', label: 'Right side', hint: 'Right hip, ribs and outer leg' },
	{ id: 'soles', label: 'Soles', hint: 'Underneath both feet' }
];

/**
 * A band across the body, centred.
 *
 * Kept close to the body's real width rather than spanning the whole viewBox.
 * A region is clipped to the silhouette, so an over-wide rectangle still looks
 * right, but its centre lands outside the body and the thing stops being
 * clickable where a pointer naturally aims. That was a real bug, not a
 * cosmetic one.
 */
const REACH = 58;

/**
 * The arm hangs clear of the torso, so arm regions start where the arm is
 * drawn rather than at the midline. Before this they reached back across the
 * ribs and stole the clicks meant for the chest.
 */
const ARM_IN = 33;
const ARM_OUT = 54;

function band(id: string, label: string, detail: string, y1: number, y2: number): Region {
	return { id, label, side: 'centre', detail, x: MID - REACH, y: y1, w: REACH * 2, h: y2 - y1 };
}

/** A left and right pair, split at the midline. */
function pair(
	id: string,
	label: string,
	detail: string,
	y1: number,
	y2: number,
	opts: { from?: number; to?: number } = {}
): Region[] {
	const from = opts.from ?? 0;
	const to = opts.to ?? REACH;
	return [
		// The visitor's left is on the right of a front view, which is the
		// single easiest thing to get backwards in a body map.
		{ id: `${id}-left`, label: `Left ${label}`, side: 'left', detail, x: MID + from, y: y1, w: to - from, h: y2 - y1 },
		{ id: `${id}-right`, label: `Right ${label}`, side: 'right', detail, x: MID - to, y: y1, w: to - from, h: y2 - y1 }
	];
}

/** An arm pair, clipped to the arms rather than to the torso. */
function armPair(
	id: string,
	label: string,
	detail: string,
	y1: number,
	y2: number,
	opts: { from?: number; to?: number } = {}
): Region[] {
	return pair(id, label, detail, y1, y2, opts).map((r) => ({ ...r, limb: 'arm' as const }));
}

const FRONT: Region[] = [
	band('head', 'Head and face', 'head', 0, Y.chin - 2),
	band('neck-front', 'Neck, front', 'neck', Y.chin - 2, Y.shoulder - 2),
	...pair('shoulder', 'shoulder', 'shoulder', Y.shoulder - 2, Y.armpit + 6, { from: 22 }),
	band('chest', 'Chest', 'chest', Y.shoulder + 6, Y.waist - 6),
	band('abdomen', 'Belly', 'abdomen', Y.waist - 6, Y.hip - 4),
	...armPair('upper-arm', 'upper arm', 'upper-arm', Y.armpit + 6, Y.elbow - 8, { from: ARM_IN, to: ARM_OUT }),
	...armPair('elbow', 'elbow', 'elbow', Y.elbow - 8, Y.elbow + 14, { from: ARM_IN, to: ARM_OUT }),
	...armPair('forearm', 'forearm', 'forearm', Y.elbow + 14, Y.wrist - 4, { from: ARM_IN, to: ARM_OUT }),
	...armPair('hand', 'hand and wrist', 'hand', Y.wrist - 4, Y.fingertip + 4, { from: ARM_IN, to: ARM_OUT }),
	...pair('groin', 'hip and groin', 'hip', Y.hip - 4, Y.crotch + 14),
	...pair('thigh-front', 'thigh, front', 'thigh-front', Y.crotch + 14, Y.knee - 14),
	...pair('knee', 'knee', 'knee', Y.knee - 14, Y.knee + 16),
	...pair('shin', 'shin', 'shin', Y.knee + 16, Y.ankle - 6),
	...pair('foot-top', 'foot and ankle', 'foot', Y.ankle - 6, VIEW_H)
];

const BACK: Region[] = [
	band('head-back', 'Back of the head', 'head', 0, Y.chin - 2),
	band('neck-back', 'Neck, back', 'neck', Y.chin - 2, Y.shoulder + 2),
	...pair('shoulder-blade', 'shoulder blade', 'shoulder', Y.shoulder + 2, Y.armpit + 22, { from: 8 }),
	band('upper-back', 'Upper back', 'upper-back', Y.shoulder + 8, Y.waist - 14),
	band('lower-back', 'Lower back', 'lower-back', Y.waist - 14, Y.hip - 10),
	...armPair('upper-arm-back', 'upper arm, back', 'upper-arm', Y.armpit + 6, Y.elbow - 8, { from: ARM_IN, to: ARM_OUT }),
	...armPair('elbow-back', 'elbow, back', 'elbow', Y.elbow - 8, Y.elbow + 14, { from: ARM_IN, to: ARM_OUT }),
	...armPair('forearm-back', 'forearm, back', 'forearm', Y.elbow + 14, Y.wrist - 4, { from: ARM_IN, to: ARM_OUT }),
	...armPair('hand-back', 'hand, back', 'hand', Y.wrist - 4, Y.fingertip + 4, { from: ARM_IN, to: ARM_OUT }),
	...pair('buttock', 'buttock', 'buttock', Y.hip - 10, Y.crotch + 18),
	...pair('hamstring', 'back of the thigh', 'hamstring', Y.crotch + 18, Y.knee - 12),
	...pair('knee-back', 'back of the knee', 'knee', Y.knee - 12, Y.knee + 16),
	...pair('calf', 'calf', 'calf', Y.knee + 16, Y.ankle - 10),
	...pair('heel', 'heel and ankle', 'foot', Y.ankle - 10, VIEW_H)
];

/**
 * A side view has no left and right halves, so every region is the whole
 * width and the side comes from which view you are looking at.
 */
function sideRegions(side: 'left' | 'right'): Region[] {
	const s = (id: string, label: string, detail: string, y1: number, y2: number): Region => ({
		id: `${side}-${id}`,
		label,
		side,
		detail,
		x: MID - REACH,
		y: y1,
		w: REACH * 2,
		h: y2 - y1
	});
	const which = side === 'left' ? 'Left' : 'Right';
	return [
		s('head', 'Side of the head', 'head', 0, Y.chin - 2),
		s('neck', 'Side of the neck', 'neck', Y.chin - 2, Y.shoulder - 2),
		s('shoulder', `${which} shoulder`, 'shoulder', Y.shoulder - 2, Y.armpit + 8),
		s('ribs', `${which} ribs`, 'ribs', Y.armpit + 8, Y.waist),
		s('flank', `${which} side, waist`, 'flank', Y.waist, Y.hip - 6),
		s('hip-side', `${which} hip, outer`, 'hip', Y.hip - 6, Y.crotch + 16),
		s('thigh-outer', `${which} thigh, outer`, 'thigh-outer', Y.crotch + 16, Y.knee - 14),
		s('knee-side', `${which} knee, outer`, 'knee', Y.knee - 14, Y.knee + 16),
		s('lower-leg', `${which} lower leg`, 'calf', Y.knee + 16, Y.ankle - 8),
		s('ankle', `${which} ankle`, 'foot', Y.ankle - 8, VIEW_H)
	];
}

/**
 * The soles are their own drawing rather than a body view, so the coordinates
 * are laid out for two feet side by side. See soles.ts.
 */
const SOLES: Region[] = [
	{ id: 'heel-pad-left', label: 'Left heel', side: 'left', detail: 'sole', x: 104, y: 340, w: 62, h: 130 },
	{ id: 'arch-left', label: 'Left arch', side: 'left', detail: 'sole', x: 104, y: 200, w: 62, h: 140 },
	{ id: 'ball-left', label: 'Left ball of the foot', side: 'left', detail: 'sole', x: 104, y: 110, w: 62, h: 90 },
	{ id: 'toes-left', label: 'Left toes', side: 'left', detail: 'sole', x: 104, y: 40, w: 62, h: 70 },
	{ id: 'heel-pad-right', label: 'Right heel', side: 'right', detail: 'sole', x: 34, y: 340, w: 62, h: 130 },
	{ id: 'arch-right', label: 'Right arch', side: 'right', detail: 'sole', x: 34, y: 200, w: 62, h: 140 },
	{ id: 'ball-right', label: 'Right ball of the foot', side: 'right', detail: 'sole', x: 34, y: 110, w: 62, h: 90 },
	{ id: 'toes-right', label: 'Right toes', side: 'right', detail: 'sole', x: 34, y: 40, w: 62, h: 70 }
];

/**
 * Paint order, smallest last.
 *
 * Regions overlap: a hand sits over the thigh, a shoulder over the chest. SVG
 * gives the click to whatever is painted last, so without this the big regions
 * covered the small ones and several were simply unreachable. Sorting by area
 * means the small, specific region always wins where it exists, and the large
 * one is still clickable everywhere else.
 */
function byPaintOrder(regions: Region[]): Region[] {
	return [...regions].sort((a, b) => b.w * b.h - a.w * a.h);
}

export const REGIONS: Record<View, Region[]> = {
	front: byPaintOrder(FRONT),
	back: byPaintOrder(BACK),
	left: byPaintOrder(sideRegions('left')),
	right: byPaintOrder(sideRegions('right')),
	soles: byPaintOrder(SOLES)
};

export function allRegions(): Region[] {
	return Object.values(REGIONS).flat();
}

export function regionById(id: string): Region | undefined {
	return allRegions().find((r) => r.id === id);
}

/** Every distinct detail diagram the general regions can open. */
export function detailIds(): string[] {
	return [...new Set(allRegions().map((r) => r.detail))].sort();
}
