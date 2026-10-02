import { expect, it } from 'vitest';
import { DARK, LIGHT, textOn } from './colour';

it('puts light text on a dark slide and dark text on a light one', () => {
	expect(textOn('#111418')).toBe(LIGHT);
	expect(textOn('#FFFFFF')).toBe(DARK);
	expect(textOn('#F4F5F6')).toBe(DARK);
	expect(textOn('#1D2B3A')).toBe(LIGHT);
	expect(textOn('#E9E2D3')).toBe(DARK);
	expect(textOn('nonsense')).toBe(LIGHT);
});
