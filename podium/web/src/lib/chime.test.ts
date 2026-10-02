import { expect, it } from 'vitest';
import { Cadence, pitch, SCALE } from './chime';

it('spaces votes that land together into a run', () => {
	const c = new Cadence(0.06, 0.9, 1.2);
	const a = c.take(10)!;
	const b = c.take(10)!;
	const d = c.take(10.01)!;
	expect(a.at).toBe(10);
	expect(b.at).toBeCloseTo(10.06, 5);
	expect(d.at).toBeCloseTo(10.12, 5);
});

it('climbs the scale through a run and starts again after a pause', () => {
	const c = new Cadence();
	expect([0, 0.1, 0.2].map((t) => c.take(t)!.step)).toEqual([0, 1, 2]);
	expect(c.take(5)!.step).toBe(0);
});

it('stays at the top of the scale however long the run', () => {
	const c = new Cadence(0.01, 100);
	let last = 0;
	for (let i = 0; i < 40; i++) last = c.take(i * 0.1)!.step;
	expect(last).toBe(SCALE.length - 1);
});

it('drops what would sound too late to mean anything', () => {
	const c = new Cadence(0.06, 0.3);
	const slots = Array.from({ length: 20 }, () => c.take(0));
	expect(slots.filter(Boolean).length).toBe(6);
	expect(slots.at(-1)).toBeNull();
});

it('starts on C6 and rises in pentatonic steps', () => {
	expect(pitch(0)).toBeCloseTo(1046.5, 1);
	expect(pitch(5)).toBeCloseTo(2093, 0);
	expect(pitch(99)).toBe(pitch(SCALE.length - 1));
});
