/**
 * The body, as numbers.
 *
 * Drawing ten separate silhouettes by hand would give ten slightly different
 * bodies and no way to keep the region overlays lined up with them. So the
 * outline is generated from named landmarks instead: male and female are the
 * same code with different measurements, and the clickable regions are built
 * from the same landmarks as the drawing, which means they cannot drift apart.
 *
 * Units are a 200 by 520 viewBox with the midline at x=100. The vertical
 * landmarks are a 7.5-head canon, which is the proportion anatomical plates
 * use rather than the 8-head one from fashion illustration. It reads as a
 * real person rather than a model.
 */

export type BodyKind = 'male' | 'female';

export interface Proportions {
	/** Half-widths at each landmark, measured from the midline. */
	head: number;
	jaw: number;
	neck: number;
	shoulder: number;
	chest: number;
	waist: number;
	hip: number;
	thigh: number;
	knee: number;
	calf: number;
	ankle: number;
	upperArm: number;
	elbow: number;
	forearm: number;
	wrist: number;
}

/** Vertical landmarks, shared by both bodies so the views stay comparable. */
/**
 * Vertical landmarks, shared by both bodies so the views stay comparable.
 *
 * Taken from the 7.5-head canon and checked as fractions of total height,
 * because eyeballing them put the crotch at 61% and gave the first draft a
 * long torso on stubby legs. The one that matters most: the crotch sits at
 * half the total height. Everything above it looked wrong until that moved.
 *
 *   crown 0.00   shoulder 0.20   nipple 0.25   navel 0.32
 *   crotch 0.50  knee 0.72       ankle 0.955   sole 1.00
 */
export const Y = {
	crown: 18,
	eyes: 46,
	chin: 83,
	neck: 96,
	shoulder: 116,
	nipple: 141,
	armpit: 148,
	waist: 165,
	elbow: 175,
	navel: 175,
	hip: 243,
	crotch: 263,
	wrist: 263,
	fingertip: 297,
	thigh: 310,
	knee: 371,
	calf: 410,
	ankle: 486,
	sole: 508
} as const;

export const MID = 100;
export const VIEW_W = 200;
export const VIEW_H = 520;

export const PROPORTIONS: Record<BodyKind, Proportions> = {
	male: {
		head: 18,
		jaw: 13,
		neck: 12,
		shoulder: 47,
		chest: 37,
		waist: 31,
		hip: 35,
		thigh: 27,
		knee: 17,
		calf: 18,
		ankle: 8.5,
		upperArm: 12,
		elbow: 9,
		forearm: 9,
		wrist: 6
	},
	female: {
		head: 17.5,
		jaw: 12.5,
		neck: 10,
		shoulder: 40,
		chest: 32,
		waist: 25,
		hip: 39,
		thigh: 26,
		knee: 16,
		calf: 17,
		ankle: 7.5,
		upperArm: 11,
		elbow: 8,
		forearm: 8,
		wrist: 5.5
	}
};

/** Side views are much narrower than they are wide, and differently shaped. */
export const SIDE_PROPORTIONS: Record<BodyKind, Proportions> = {
	male: {
		head: 23,
		jaw: 19,
		neck: 13,
		shoulder: 24,
		chest: 24,
		waist: 20,
		hip: 24,
		thigh: 18,
		knee: 14,
		calf: 15,
		ankle: 10,
		upperArm: 10,
		elbow: 8,
		forearm: 8,
		wrist: 6
	},
	female: {
		head: 22,
		jaw: 18,
		neck: 11,
		shoulder: 21,
		chest: 23,
		waist: 17,
		hip: 25,
		thigh: 18,
		knee: 13,
		calf: 14,
		ankle: 9,
		upperArm: 9,
		elbow: 7,
		forearm: 7,
		wrist: 5.5
	}
};
