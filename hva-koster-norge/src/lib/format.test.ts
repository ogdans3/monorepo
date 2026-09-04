import { describe, expect, it } from 'vitest';
import { andel, iLønninger, kroner, lønningerTekst, merkeskala, storBeløp } from './format';

/** Norwegian grouping is a non-breaking space, not a comma and not a period. */
const NBSP = '\u00A0';
const plain = (s: string) => s.replace(/\u00A0/g, ' ');

describe('kroner', () => {
	it('groups thousands the Norwegian way', () => {
		expect(plain(kroner(1823400000000))).toBe('1 823 400 000 000');
		expect(plain(kroner(1000))).toBe('1 000');
	});

	it('uses a non-breaking space, so a figure never wraps in half', () => {
		expect(kroner(1000)).toContain(NBSP);
		expect(kroner(1000)).not.toMatch(/ /);
	});

	it('rounds rather than showing øre nobody asked for', () => {
		expect(plain(kroner(1234.6))).toBe('1 235');
	});
});

describe('storBeløp', () => {
	it('says milliarder, not billions, which is the classic factor-of-1000 error', () => {
		expect(plain(storBeløp(1.8234e12))).toBe('1 823 milliarder');
	});

	it('keeps one decimal only while it still carries information', () => {
		expect(plain(storBeløp(42.5e9))).toBe('42,5 milliarder');
		// past a hundred, the decimal is precision the budget does not have
		expect(plain(storBeløp(123.4e9))).toBe('123 milliarder');
	});

	it('drops to millions and then to plain kroner', () => {
		expect(plain(storBeløp(980e6))).toBe('980 millioner');
		expect(plain(storBeløp(4.2e6))).toBe('4,2 millioner');
		expect(plain(storBeløp(50000))).toBe('50 000 kroner');
	});

	it('handles a negative amount, since a party can cut a post', () => {
		// nb-NO gives the typographic minus U+2212, not an ASCII hyphen, and
		// that is correct: it is the width of a digit, so it lines up in a
		// column of tabular figures where a hyphen would not.
		expect(plain(storBeløp(-42.5e9))).toBe('\u221242,5 milliarder');
	});
});

describe('iLønninger', () => {
	it('is the one division the whole site rests on', () => {
		expect(iLønninger(1_000_000, 500_000)).toBe(2);
	});

	it('worked by hand: 100 milliarder over a 650 000 salary', () => {
		expect(iLønninger(100e9, 650_000)).toBeCloseTo(153_846.15, 1);
	});

	it('refuses a salary of zero rather than returning Infinity', () => {
		expect(() => iLønninger(1000, 0)).toThrow();
		expect(() => iLønninger(1000, -5)).toThrow();
	});
});

describe('lønningerTekst', () => {
	it('never rounds a real amount down to zero', () => {
		expect(lønningerTekst(0.4)).toBe('under én årslønn');
		expect(lønningerTekst(0.001)).toBe('under én årslønn');
	});

	it('keeps a decimal only while the count is small enough to picture', () => {
		expect(plain(lønningerTekst(2.4))).toBe('2,4 årslønner');
		expect(plain(lønningerTekst(154))).toBe('154 årslønner');
		expect(plain(lønningerTekst(153846))).toBe('153 846 årslønner');
	});
});

describe('merkeskala', () => {
	it('is one mark per salary while that fits', () => {
		expect(merkeskala(500, 2000)).toBe(1);
		expect(merkeskala(2000, 2000)).toBe(1);
	});

	it('steps up in round powers of ten, so the legend is a sentence', () => {
		expect(merkeskala(20_000, 2000)).toBe(10);
		expect(merkeskala(2_000_000, 2000)).toBe(1000);
	});

	it('always picks a scale that actually fits the budget of marks', () => {
		for (const antall of [3000, 45_000, 999_999, 2_800_000]) {
			const skala = merkeskala(antall, 2000);
			expect(antall / skala, String(antall)).toBeLessThanOrEqual(2000);
			// and it is a power of ten, never 1374
			expect(Math.log10(skala) % 1, String(antall)).toBe(0);
		}
	});
});

describe('andel', () => {
	it('puts a space before the percent sign, which Norwegian does', () => {
		expect(plain(andel(12.4, 100))).toBe('12,4 %');
		expect(plain(andel(50, 100))).toBe('50,0 %');
	});

	it('does not divide by zero', () => {
		expect(andel(5, 0)).toBe('–');
	});
});
