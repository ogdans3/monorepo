// What tells the answers apart: a colour each, and a mark besides, a letter
// or a number, for anyone who cannot tell two colours apart. The phone shows
// the same colour and mark as the slide, so the room matches one to the
// other at a glance.

import { DARK, textOn } from './colour';

export type Marks = 'letters' | 'numbers';

/**
 * The answers' colours, in order, the same list as the server's: white reads
 * on each of them, each reads on the ink and on the paper slide, and none of
 * them is the amber, which on the display means a count that has just moved.
 */
export const ANSWER_COLOURS = ['#D0273A', '#2A68CF', '#1D8452', '#7448C8', '#0C7F8E', '#BB2F82', '#8E5A35', '#56677D'];

/** The mark of the answer at [index]: A, B … Z, AA, AB …, or 1, 2, 3 … */
export function mark(index: number, marks: Marks | string | undefined): string {
	if (marks === 'numbers') return String(index + 1);
	let n = index;
	let out = '';
	do {
		out = String.fromCharCode(65 + (n % 26)) + out;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return out;
}

/** The first of the colours not yet used on a slide, or, once all are, the next round of them. */
export function nextColour(used: string[]): string {
	const taken = new Set(used.map((c) => c.toUpperCase()));
	return ANSWER_COLOURS.find((c) => !taken.has(c)) ?? ANSWER_COLOURS[used.length % ANSWER_COLOURS.length];
}

/** The text that reads on an answer's colour: white on the list's own, dark on a light one of the presenter's. */
export function inkOn(colour: string): string {
	return textOn(colour) === DARK ? DARK : '#FFFFFF';
}


