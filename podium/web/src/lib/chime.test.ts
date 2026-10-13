import { expect, it } from 'vitest';
import { Cadence, CLICK_BACK, CLICK_GAP, MAJOR, pitch, SCALE, shepard, tallyStep } from './chime';

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

it('counts up a major scale, round and round, every step a step up', () => {
	expect(Array.from({ length: 9 }, (_, i) => tallyStep(i + 1))).toEqual([0, 2, 4, 5, 7, 9, 11, 0, 2]);
	expect(tallyStep(0)).toBe(tallyStep(1));
	// Up the circle of notes from every count to the next: never back down it.
	for (let n = 1; n < 30; n++) {
		const move = (((tallyStep(n + 1) - tallyStep(n)) % 12) + 12) % 12;
		expect([1, 2]).toContain(move);
	}
});

it('sounds every step with the same loudness over the same octaves', () => {
	const loudness = MAJOR.map((step) => shepard(step).reduce((sum, o) => sum + o.gain, 0));
	for (const l of loudness) expect(l / loudness[0]).toBeCloseTo(1, 2);
	for (const step of MAJOR) {
		const loudest = shepard(step).reduce((a, o) => (o.gain > a.gain ? o : a));
		expect(Math.abs(Math.log2(loudest.freq / 1100))).toBeLessThanOrEqual(0.5);
	}
	// Where the scale comes round, from F♯ to G, the top octave goes and a new
	// one comes in at the bottom. Both must be next to nothing, −46 dB or less,
	// or the round would be heard.
	const last = shepard(MAJOR.at(-1)!);
	const first = shepard(MAJOR[0]);
	expect(last.at(-1)!.gain).toBeLessThan(0.005);
	expect(first[0].gain).toBeLessThan(0.005);
	// And every other octave moves up a semitone, F♯ to G, at the loudness it had.
	for (let k = 1; k < first.length; k++) {
		expect(first[k].freq / last[k - 1].freq).toBeCloseTo(2 ** (1 / 12), 6);
		expect(Math.abs(first[k].gain - last[k - 1].gain)).toBeLessThan(0.05);
	}
});

it('spaces a run of clicks so no tick lands on another', () => {
	// The lever coming back must be well clear of the next click going down.
	expect(CLICK_GAP - CLICK_BACK).toBeGreaterThan(0.025);
	const c = new Cadence(CLICK_GAP);
	const at = Array.from({ length: 5 }, () => c.take(3)!.at);
	expect(at.every((t, i) => i === 0 || t - at[i - 1] >= CLICK_GAP - 1e-9)).toBe(true);
});
