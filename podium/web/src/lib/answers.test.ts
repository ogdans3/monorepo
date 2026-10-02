import { expect, it } from 'vitest';
import { ANSWER_COLOURS, inkOn, mark, nextColour } from './answers';

it('marks answers with letters, past Z too, or with numbers', () => {
	expect([0, 1, 2, 25, 26, 27].map((i) => mark(i, 'letters'))).toEqual(['A', 'B', 'C', 'Z', 'AA', 'AB']);
	expect([0, 9].map((i) => mark(i, 'numbers'))).toEqual(['1', '10']);
	expect(mark(0, undefined)).toBe('A');
});

it('gives a new answer the first colour not on the slide', () => {
	expect(nextColour([])).toBe(ANSWER_COLOURS[0]);
	expect(nextColour([ANSWER_COLOURS[0], ANSWER_COLOURS[2].toLowerCase()])).toBe(ANSWER_COLOURS[1]);
	expect(nextColour(ANSWER_COLOURS)).toBe(ANSWER_COLOURS[0]);
});

it('writes white on the answer colours, and dark on a light one', () => {
	for (const c of ANSWER_COLOURS) expect(inkOn(c)).toBe('#FFFFFF');
	expect(inkOn('#F0E68C')).toBe('#111418');
});
