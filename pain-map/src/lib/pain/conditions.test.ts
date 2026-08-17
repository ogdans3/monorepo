import { describe, expect, it } from 'vitest';
import { CONDITIONS, confidence, matchEntry, scoreText } from './conditions';
import { emptyEntry, type PainEntry } from './scale';
import { RED_FLAGS, flagsFor, sortByUrgency } from './redflags';
import { allStructures } from '$lib/anatomy/detail';

const entry = (over: Partial<PainEntry>): PainEntry => ({ ...emptyEntry('test'), ...over });

describe('the condition list', () => {
	it('defines every condition by features, not by a stored score', () => {
		for (const c of CONDITIONS) {
			expect(c.features.length, c.id).toBeGreaterThanOrEqual(4);
			expect(c.what.length, c.id).toBeGreaterThan(80);
			expect(c.next.length, c.id).toBeGreaterThan(40);
			expect(c.plain, c.id).not.toBe(c.name);
		}
	});

	it('gives every condition at least one key feature', () => {
		// Without a key feature a condition can be surfaced by "worse with
		// activity" alone, which is true of nearly all musculoskeletal pain.
		for (const c of CONDITIONS) {
			expect(c.features.some((f) => f.key), c.id).toBe(true);
		}
	});

	it('only refers to structures that exist in a diagram', () => {
		const known = new Set(allStructures().map((s) => s.id));
		for (const c of CONDITIONS) {
			for (const f of c.features) {
				if (f.kind !== 'structure') continue;
				expect(known.has(f.value), `${c.id} refers to ${f.value}`).toBe(true);
			}
		}
	});

	it('has unique ids and names', () => {
		expect(new Set(CONDITIONS.map((c) => c.id)).size).toBe(CONDITIONS.length);
		expect(new Set(CONDITIONS.map((c) => c.name)).size).toBe(CONDITIONS.length);
	});
});

describe('matching', () => {
	it('finds the hip tendon problem from the outer hip picture', () => {
		const matches = matchEntry(
			entry({
				structureIds: ['glute-med', 'trochanter-bursa'],
				qualities: ['ache'],
				timings: ['worse-rest', 'worse-activity'],
				onset: 'gradual-weeks',
				level: 5
			})
		);
		expect(matches[0].condition.id).toBe('glute-tendinopathy');
		expect(scoreText(matches[0])).toBe('6 of 6');
		expect(matches[0].missed).toEqual([]);
	});

	it('separates the hip joint from the outer hip, which is the whole point', () => {
		// Groin pain and outer hip pain are different problems that people
		// describe with the same three words.
		const groin = matchEntry(
			entry({
				structureIds: ['hip-joint'],
				qualities: ['stiff'],
				timings: ['worse-morning', 'worse-activity'],
				onset: 'gradual-months',
				level: 4
			})
		);
		expect(groin[0].condition.id).toBe('hip-oa');
		expect(groin.map((m) => m.condition.id)).not.toContain('glute-tendinopathy');
	});

	it('finds sciatica when the pain travels, and not when it stays put', () => {
		const travelling = matchEntry(
			entry({
				structureIds: ['lumbar-disc', 'sciatic'],
				qualities: ['radiating', 'pins'],
				timings: ['worse-rest'],
				onset: 'sudden-no-cause',
				level: 7
			})
		);
		expect(travelling[0].condition.id).toBe('lumbar-radiculopathy');

		const local = matchEntry(
			entry({
				structureIds: ['facet-joint', 'erector-spinae'],
				qualities: ['stiff'],
				timings: ['worse-morning'],
				onset: 'gradual-weeks',
				level: 4
			})
		);
		expect(local[0].condition.id).toBe('facet-pain');
		expect(local.map((m) => m.condition.id)).not.toContain('lumbar-radiculopathy');
	});

	it('tells a frozen shoulder from a cuff problem by the stiffness', () => {
		const cuff = matchEntry(
			entry({
				structureIds: ['supraspinatus'],
				qualities: ['ache'],
				timings: ['worse-night', 'worse-activity'],
				onset: 'gradual-weeks',
				level: 5
			})
		);
		expect(cuff[0].condition.id).toBe('rotator-cuff');

		const frozen = matchEntry(
			entry({
				structureIds: ['glenohumeral'],
				qualities: ['stiff'],
				timings: ['worse-night'],
				onset: 'gradual-weeks',
				level: 6
			})
		);
		expect(frozen[0].condition.id).toBe('frozen-shoulder');
	});

	it('shows what it did not match, so the number can be argued with', () => {
		const matches = matchEntry(
			entry({ structureIds: ['glute-med'], onset: null, level: 5 })
		);
		const top = matches[0];
		expect(top.matched.length).toBeGreaterThan(0);
		expect(top.missed.length).toBeGreaterThan(0);
		expect(top.matched.length + top.missed.length).toBe(top.condition.features.length);
		for (const f of [...top.matched, ...top.missed]) {
			expect(f.text.length).toBeGreaterThan(8);
		}
	});

	it('stays quiet rather than listing everything weakly', () => {
		// nothing but a timing that is true of almost all pain
		const vague = matchEntry(entry({ structureIds: [], timings: ['worse-activity'], level: 5 }));
		expect(vague.length).toBe(0);
	});

	it('never returns a score outside 0 to 1', () => {
		const matches = matchEntry(
			entry({
				structureIds: allStructures().map((s) => s.id),
				qualities: ['sharp', 'ache', 'burning', 'pins', 'stiff', 'throb', 'catching', 'radiating'],
				timings: ['worse-morning', 'worse-evening', 'worse-night', 'worse-activity', 'worse-rest', 'constant'],
				onset: 'gradual-weeks',
				level: 10
			})
		);
		for (const m of matches) {
			expect(m.score).toBeGreaterThan(0);
			expect(m.score).toBeLessThanOrEqual(1);
		}
	});
});

describe('confidence', () => {
	it('is thin when the answers are thin', () => {
		expect(confidence([], entry({}))).toBe('thin');
		const some = entry({ structureIds: ['glute-med'], onset: null });
		expect(confidence(matchEntry(some), some)).toBe('thin');
	});

	it('is narrow when one condition is clearly ahead', () => {
		const clear = entry({
			structureIds: ['heel-insertion', 'plantar-fascia'],
			qualities: ['sharp'],
			timings: ['worse-morning'],
			onset: 'gradual-weeks',
			level: 6
		});
		expect(confidence(matchEntry(clear), clear)).toBe('narrow');
	});
});

describe('red flags', () => {
	it('never mixes with the ranking', () => {
		// A red flag is a different kind of statement, so it must not be
		// reachable through the condition list at all.
		const ids = new Set(CONDITIONS.map((c) => c.id));
		for (const flag of RED_FLAGS) expect(ids.has(flag.id)).toBe(false);
	});

	it('asks the cauda equina question for back and buttock pain only', () => {
		expect(flagsFor(['lower-back']).map((f) => f.id)).toContain('cauda-equina');
		expect(flagsFor(['knee']).map((f) => f.id)).not.toContain('cauda-equina');
	});

	it('always asks the ones that apply anywhere', () => {
		const always = RED_FLAGS.filter((f) => f.regions.length === 0).map((f) => f.id);
		for (const region of ['knee', 'sole', 'shoulder', 'hip']) {
			const asked = flagsFor([region]).map((f) => f.id);
			for (const id of always) expect(asked, region).toContain(id);
		}
	});

	it('puts the emergencies first', () => {
		const sorted = sortByUrgency(RED_FLAGS);
		expect(sorted[0].urgency).toBe('emergency');
		const urgencies = sorted.map((f) => f.urgency);
		expect(urgencies.lastIndexOf('emergency')).toBeLessThan(urgencies.indexOf('soon'));
	});

	it('says where to go rather than to seek attention', () => {
		for (const flag of RED_FLAGS) {
			expect(flag.action.length, flag.id).toBeGreaterThan(30);
			expect(flag.action.toLowerCase(), flag.id).not.toContain('seek medical attention');
			expect(flag.question.endsWith('?'), flag.id).toBe(true);
		}
	});
});
