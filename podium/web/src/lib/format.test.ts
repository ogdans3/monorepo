import { expect, it } from 'vitest';
import { bytes, changed, count, share, votes } from './format';

it('writes counts and shares the Norwegian way', () => {
	expect(count(1248).replace(/\s/g, ' ')).toBe('1 248');
	expect(share(59, 100)).toBe('59 %');
	expect(share(0, 0)).toBe('0 %');
	expect(share(1, 3)).toBe('33 %');
	expect(votes(1)).toBe('1 stemme');
	expect(votes(2)).toBe('2 stemmer');
});

it('writes sizes', () => {
	expect(bytes(2048)).toBe('2 kB');
	expect(bytes(5.5 * 1024 * 1024)).toBe('5,5 MB');
	expect(bytes(120 * 1024 * 1024)).toBe('120 MB');
});

it('says when, as near as is useful', () => {
	const now = new Date(2026, 9, 2, 15, 0);
	expect(changed(new Date(2026, 9, 2, 14, 5).toISOString(), now)).toBe('i dag 14:05');
	expect(changed(new Date(2026, 9, 1, 9, 30).toISOString(), now)).toBe('i går 09:30');
	expect(changed(new Date(2026, 8, 20).toISOString(), now)).toBe('20. sep.');
	expect(changed(new Date(2025, 8, 20).toISOString(), now)).toBe('20. sep. 2025');
});
