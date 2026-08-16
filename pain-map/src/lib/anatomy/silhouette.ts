import { MID, PROPORTIONS, SIDE_PROPORTIONS, Y, type BodyKind, type Proportions } from './proportions';
import { c, join, line, mirrorAndClose, outline, point, toPath, type Outline } from './path';

/**
 * The outlines, generated from the landmarks in proportions.ts.
 *
 * Front and back share a body, because from the outside they do. The side is
 * genuinely a different shape and gets its own. Arms are separate closed
 * shapes laid over the torso, which is how anatomical plates draw them and
 * which keeps the deltoid and the armpit readable instead of merging the arm
 * into the ribcage.
 */

/**
 * Half a body, walked from the base of the neck down to the midline between
 * the feet. Mirrored and reversed by mirrorAndClose, so the midline is never
 * stroked and the legs separate properly at the crotch.
 */
function halfBody(p: Proportions): Outline {
	const x = (half: number) => MID + half;
	// The arm hangs clear of the body, so the torso can be its real width
	// without the two outlines fighting over the same pixels.
	const shoulderTip = p.shoulder - 7;

	return outline(point(x(p.neck - 1), Y.neck - 2), [
		// trapezius: a long shallow slope, not a shelf. Getting this wrong is
		// what made the first drafts look like a coat hanger.
		c(x(p.neck + 8), Y.neck + 6, x(shoulderTip - 14), Y.shoulder - 7, x(shoulderTip), Y.shoulder - 1),
		// deltoid cap, round and full, then in under the arm
		c(x(shoulderTip + 7), Y.shoulder + 5, x(shoulderTip + 6), Y.armpit - 10, x(p.chest + 3), Y.armpit),
		// ribs falling in to the waist. The female waist is much deeper, which
		// is most of what separates the two bodies at a glance.
		c(x(p.chest), Y.armpit + 14, x(p.waist), Y.waist - 14, x(p.waist), Y.waist + 2),
		// waist out over the iliac crest to the widest point of the hip
		c(x(p.waist + 1), Y.waist + 26, x(p.hip - 1), Y.hip - 26, x(p.hip), Y.hip),
		// hip curving into the outer thigh, which is nearly as wide
		c(x(p.hip), Y.hip + 14, x(p.thigh + 6), Y.crotch + 6, x(p.thigh + 3), Y.thigh),
		// thigh narrowing to the knee
		c(x(p.thigh + 1), Y.thigh + 24, x(p.knee + 3), Y.knee - 20, x(p.knee), Y.knee + 2),
		// calf belly high on the shin, then a fine ankle
		c(x(p.calf + 2), Y.knee + 20, x(p.calf), Y.calf + 22, x(p.ankle + 1), Y.ankle),
		// the foot: a short wedge splaying slightly outward, not a flipper
		c(x(p.ankle + 1), Y.ankle + 8, x(p.ankle + 7), Y.sole - 6, x(p.ankle + 9), Y.sole - 1),
		line(point(x(p.ankle + 9), Y.sole - 1), point(x(2.5), Y.sole - 1)),
		// up the inside of the leg. The legs nearly touch at the thigh and
		// open below the knee, which is what a standing body actually does.
		line(point(x(2.5), Y.sole - 1), point(x(4), Y.ankle + 2)),
		c(x(5), Y.calf + 8, x(10), Y.knee + 16, x(9), Y.knee),
		c(x(8), Y.knee - 30, x(4), Y.crotch + 26, x(2), Y.crotch)
	]);
}

/** The neck and head, one shape, so no line crosses the throat. */
function headAndNeck(p: Proportions): string {
	const half = outline(point(MID + p.neck, Y.neck - 4), [
		// up the side of the neck to the jaw
		c(MID + p.neck, Y.neck - 12, MID + p.neck - 1, Y.chin + 4, MID + p.jaw - 5, Y.chin - 1),
		// jaw and cheek
		c(MID + p.jaw + 1, Y.chin - 10, MID + p.head, Y.eyes + 18, MID + p.head, Y.eyes),
		// cranium
		c(MID + p.head, Y.crown + 20, MID + p.head * 0.8, Y.crown, MID, Y.crown)
	]);
	return toPath(mirrorAndClose(half, MID));
}

/**
 * The arm, from the shoulder to the fingertips. Drawn as its own closed shape
 * laid over the torso, with the shoulder end tucked under the deltoid.
 */
function arm(p: Proportions): string {
	const x = (half: number) => MID + half;
	const outer = p.shoulder;

	const down = outline(point(x(outer - 11), Y.shoulder - 1), [
		// outer edge: deltoid, triceps, forearm
		c(x(outer), Y.shoulder + 6, x(outer + 1), Y.armpit + 16, x(outer), Y.elbow),
		c(x(outer - 1), Y.elbow + 26, x(outer - 3), Y.wrist - 20, x(outer - 4), Y.wrist),
		// the hand: a short paddle with a thumb side, since drawn fingers turn
		// to mush at this size and a mitten reads as a hand anyway
		c(x(outer - 2), Y.wrist + 12, x(outer - 3), Y.fingertip - 6, x(outer - 6), Y.fingertip),
		c(x(outer - 10), Y.fingertip + 2, x(outer - 12), Y.fingertip - 8, x(outer - 12), Y.wrist + 6),
		// inner edge back up to the armpit
		c(x(outer - 13), Y.wrist - 18, x(outer - 12), Y.elbow + 16, x(outer - 11), Y.elbow),
		c(x(outer - 11), Y.armpit + 12, x(outer - 12), Y.armpit - 2, x(outer - 13), Y.armpit - 3)
	]);
	return toPath(down);
}

export interface BodyPaths {
	headNeck: string;
	body: string;
	armLeft: string;
	armRight: string;
}

function mirrorPath(d: string): string {
	return d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, x, y) => {
		return `${Math.round((2 * MID - Number(x)) * 100) / 100},${y}`;
	});
}

export function frontPaths(kind: BodyKind): BodyPaths {
	const p = PROPORTIONS[kind];
	const right = arm(p);
	return {
		headNeck: headAndNeck(p),
		body: toPath(mirrorAndClose(halfBody(p), MID)),
		armRight: right,
		armLeft: mirrorPath(right)
	};
}

/** From behind, the outline is the same body. The detail lines differ. */
export function backPaths(kind: BodyKind): BodyPaths {
	return frontPaths(kind);
}

/**
 * The side. A different shape, not a squashed front: the chest sits forward of
 * the hip, the spine curves, the buttock projects behind and the foot points.
 * Drawn facing left, so the front of the body is at lower x.
 */
export function sidePaths(kind: BodyKind): BodyPaths {
	const p = SIDE_PROPORTIONS[kind];
	const f = (d: number) => MID - d;
	const b = (d: number) => MID + d;

	const front = outline(point(f(p.neck), Y.neck - 2), [
		// chest forward of the neck
		c(f(p.chest - 2), Y.shoulder + 2, f(p.chest), Y.armpit - 18, f(p.chest), Y.nipple),
		// belly, deeper on the male body
		c(f(p.chest - 1), Y.armpit + 28, f(p.waist), Y.waist - 16, f(p.waist), Y.navel),
		// lower belly into the front of the thigh
		c(f(p.waist + 2), Y.navel + 24, f(p.thigh + 3), Y.crotch - 4, f(p.thigh + 2), Y.crotch + 14),
		c(f(p.thigh), Y.thigh + 16, f(p.knee + 2), Y.knee - 20, f(p.knee - 3), Y.knee),
		// shin, straighter than the calf behind it
		c(f(p.knee - 4), Y.knee + 22, f(p.ankle + 1), Y.calf + 22, f(p.ankle - 1), Y.ankle),
		// the foot, pointing forward
		c(f(p.ankle + 3), Y.ankle + 12, f(p.ankle + 20), Y.sole - 6, f(p.ankle + 24), Y.sole - 1)
	]);

	const back = outline(point(f(p.ankle + 24), Y.sole - 1), [
		line(point(f(p.ankle + 24), Y.sole - 1), point(b(p.ankle + 7), Y.sole - 1)),
		// heel
		c(b(p.ankle + 10), Y.sole - 10, b(p.ankle + 4), Y.ankle + 8, b(p.ankle + 1), Y.ankle - 6),
		// calf, high and full
		c(b(p.calf + 7), Y.calf + 8, b(p.calf + 9), Y.knee + 16, b(p.knee + 1), Y.knee),
		// hamstring up to the buttock, which is the widest point behind
		c(b(p.knee + 6), Y.knee - 26, b(p.hip + 3), Y.thigh - 6, b(p.hip + 5), Y.crotch - 10),
		// the buttock into the lumbar hollow
		c(b(p.hip + 6), Y.hip - 10, b(p.waist + 1), Y.hip - 26, b(p.waist - 1), Y.navel - 6),
		// lumbar curve out to the thoracic spine
		c(b(p.waist - 2), Y.waist - 26, b(p.chest - 2), Y.armpit + 14, b(p.chest - 1), Y.armpit - 8),
		// upper back into the base of the neck
		c(b(p.chest - 2), Y.shoulder + 4, b(p.neck + 3), Y.shoulder - 6, b(p.neck), Y.neck - 2)
	]);

	// head turned to face the same way as the body, chin slightly forward
	const headHalf = outline(point(b(p.neck), Y.neck - 4), [
		c(b(p.neck + 2), Y.neck - 14, b(p.head - 4), Y.chin + 6, b(p.head - 3), Y.eyes + 8),
		c(b(p.head - 2), Y.crown + 26, b(p.head * 0.55), Y.crown, MID + 1, Y.crown)
	]);
	const headFace = outline(point(MID + 1, Y.crown), [
		c(f(p.head * 0.6), Y.crown, f(p.head - 1), Y.crown + 22, f(p.head - 2), Y.eyes),
		// brow, nose and chin as one soft front, not a profile with features
		c(f(p.head - 1), Y.eyes + 16, f(p.jaw - 3), Y.chin - 12, f(p.jaw - 8), Y.chin - 2),
		c(f(p.jaw - 14), Y.chin + 2, f(p.neck - 2), Y.chin + 2, f(p.neck), Y.neck - 4)
	]);

	const armPath = outline(point(f(p.neck - 4), Y.shoulder), [
		c(f(p.upperArm + 10), Y.shoulder + 12, f(p.upperArm + 7), Y.armpit + 26, f(p.upperArm + 3), Y.elbow),
		c(f(p.upperArm + 1), Y.elbow + 24, f(p.wrist + 3), Y.wrist - 20, f(p.wrist + 1), Y.wrist),
		c(f(p.wrist + 3), Y.wrist + 16, f(p.wrist + 1), Y.fingertip - 2, f(p.wrist - 3), Y.fingertip),
		c(b(p.wrist - 1), Y.fingertip - 1, b(p.wrist), Y.wrist + 12, b(p.wrist - 1), Y.wrist),
		c(b(p.elbow), Y.wrist - 24, b(p.elbow + 1), Y.elbow + 12, b(p.elbow + 2), Y.elbow),
		c(b(p.upperArm + 5), Y.armpit + 16, b(p.upperArm + 5), Y.shoulder + 10, b(p.neck - 3), Y.shoulder)
	]);

	return {
		headNeck: toPath(join(headHalf, headFace)),
		body: toPath(join(front, back)),
		armRight: toPath(armPath),
		armLeft: toPath(armPath)
	};
}

/** Turn a left-facing view into a right-facing one. */
export function mirrorBody(paths: BodyPaths): BodyPaths {
	return {
		headNeck: mirrorPath(paths.headNeck),
		body: mirrorPath(paths.body),
		armLeft: mirrorPath(paths.armRight),
		armRight: mirrorPath(paths.armLeft)
	};
}
