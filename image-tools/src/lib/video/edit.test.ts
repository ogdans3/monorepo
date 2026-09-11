import { describe, expect, it } from 'vitest';
import { VIDEO_FORMATS } from './formats';
import {
	escapeDrawText,
	evenSize,
	filterFor,
	needsFont,
	planEdit,
	stretchLayout,
	stretchedTotal,
	tempoChain,
	type EditOp
} from './edit';
import type { ProbeResult } from './plan';
import { defaultRamp, FASTER, sampleRamp, SLOWER, type RampPoint } from './ramp';

const mp4 = VIDEO_FORMATS.mp4;
const webm = VIDEO_FORMATS.webm;

const probe = (over: Partial<ProbeResult> = {}): ProbeResult => ({
	videoCodec: 'h264',
	audioCodec: 'aac',
	durationSeconds: 10,
	width: 1280,
	height: 720,
	...over
});

const argsOf = (op: EditOp, target = mp4, p = probe()) => planEdit(op, target, p, 'out.mp4').args;

describe('evenSize', () => {
	it('rounds down to an even number, because H.264 refuses odd ones', () => {
		expect(evenSize(101)).toBe(100);
		expect(evenSize(100)).toBe(100);
	});

	it('never goes below two', () => {
		expect(evenSize(1)).toBe(2);
		expect(evenSize(0)).toBe(2);
	});
});

describe('tempoChain', () => {
	it('leaves a factor atempo accepts alone', () => {
		expect(tempoChain(1.5)).toEqual([1.5]);
		expect(tempoChain(0.5)).toEqual([0.5]);
	});

	it('chains for a factor outside its range', () => {
		expect(tempoChain(4)).toEqual([2, 2]);
		expect(tempoChain(0.25)).toEqual([0.5, 0.5]);
	});

	it('multiplies back out to what was asked for', () => {
		for (const factor of [0.25, 0.4, 0.5, 1, 1.75, 2, 3, 4]) {
			const product = tempoChain(factor).reduce((a, b) => a * b, 1);
			expect(product, String(factor)).toBeCloseTo(factor, 5);
		}
	});

	it('keeps every step inside what atempo accepts', () => {
		for (const factor of [0.25, 0.3, 3, 4]) {
			for (const step of tempoChain(factor)) {
				expect(step, String(factor)).toBeGreaterThanOrEqual(0.5);
				expect(step, String(factor)).toBeLessThanOrEqual(2);
			}
		}
	});
});

describe('filters', () => {
	it('crops to even numbers at a whole pixel', () => {
		expect(filterFor({ kind: 'crop', x: 10.6, y: 4.2, width: 101, height: 51 })).toBe(
			'crop=100:50:11:4'
		);
	});

	it('keeps the aspect ratio with -2 rather than -1', () => {
		expect(filterFor({ kind: 'resize', width: 640, height: null })).toBe('scale=640:-2');
	});

	it('inverts the factor for speed, because PTS is time not rate', () => {
		expect(filterFor({ kind: 'speed', factor: 2 })).toBe('setpts=0.500000*PTS');
	});

	it('turns a quarter at a time', () => {
		const at = (turns: number) =>
			filterFor({ kind: 'rotate', quarterTurns: turns, flipHorizontal: false, flipVertical: false });
		expect(at(1)).toBe('transpose=1');
		expect(at(2)).toBe('transpose=1,transpose=1');
		expect(at(0)).toBeNull();
	});

	it('flips without turning', () => {
		expect(
			filterFor({ kind: 'rotate', quarterTurns: 0, flipHorizontal: true, flipVertical: false })
		).toBe('hflip');
	});

	it('puts a caption where it was asked for', () => {
		const filter = filterFor({
			kind: 'text',
			text: 'Hello',
			size: 40,
			colour: '#ffffff',
			position: 'bottom',
			box: true
		})!;
		expect(filter).toContain("text='Hello'");
		expect(filter).toContain('fontcolor=0xffffff');
		expect(filter).toContain('box=1');
		expect(filter).toContain('h*0.94-text_h');
	});
});

describe('escapeDrawText', () => {
	it('escapes the colon, which ends the option list even inside quotes', () => {
		expect(escapeDrawText('9:30')).toBe('9\\:30');
	});

	it('escapes the quote and the backslash', () => {
		expect(escapeDrawText("it's")).toBe("it\\'s");
		expect(escapeDrawText('a\\b')).toBe('a\\\\b');
	});

	it('leaves the percent alone, because escaping it breaks the filter', () => {
		// Escaping the percent made drawtext draw nothing at all and report
		// nothing either. Escaping the colon is required. Both verified one
		// character at a time in a browser against the real ffmpeg build.
		expect(escapeDrawText('50%')).toBe('50%');
	});

	it('flattens a line break rather than breaking the argument', () => {
		expect(escapeDrawText('one\ntwo')).toBe('one two');
	});

	it('turns off expansion so a percent is not a substitution', () => {
		const filter = filterFor({
			kind: 'text',
			text: '50%',
			size: 40,
			colour: '#ffffff',
			position: 'top',
			box: false
		})!;
		expect(filter).toContain('expansion=none');
	});
});

describe('planEdit', () => {
	it('copies both streams for a trim on a keyframe', () => {
		const plan = planEdit(
			{ kind: 'trim', startSeconds: 2, endSeconds: 5, exact: false },
			mp4,
			probe(),
			'out.mp4'
		);
		expect(plan.copy).toBe('full');
		expect(plan.expectation).toBe('instant');
		expect(plan.framesIntact).toBe(true);
		expect(plan.args).toContain('copy');
	});

	it('seeks before the input, so the cost does not grow with the start time', () => {
		const args = argsOf({ kind: 'trim', startSeconds: 30, endSeconds: null, exact: false });
		expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
	});

	it('re-encodes for an exact trim', () => {
		const plan = planEdit(
			{ kind: 'trim', startSeconds: 2, endSeconds: 5, exact: true },
			mp4,
			probe(),
			'out.mp4'
		);
		expect(plan.copy).toBe('none');
		expect(plan.framesIntact).toBe(false);
	});

	it('leaves every frame alone when only the sound is dropped', () => {
		const plan = planEdit({ kind: 'mute' }, mp4, probe(), 'out.mp4');
		expect(plan.copy).toBe('video');
		expect(plan.expectation).toBe('instant');
		expect(plan.args).toContain('-an');
	});

	it('copies sound the container already accepts', () => {
		const args = argsOf({ kind: 'crop', x: 0, y: 0, width: 640, height: 480 });
		expect(args.join(' ')).toContain('-c:a copy');
	});

	it('re-encodes sound whose timing changed', () => {
		const args = argsOf({ kind: 'speed', factor: 2 });
		expect(args.join(' ')).not.toContain('-c:a copy');
		expect(args).toContain('-af');
	});

	it('re-encodes sound the target container will not take', () => {
		// WebM will not carry AAC, so a cropped MP4 going out as WebM needs a
		// new audio track even though the edit never touched the sound.
		const args = argsOf({ kind: 'crop', x: 0, y: 0, width: 640, height: 480 }, webm);
		expect(args.join(' ')).not.toContain('-c:a copy');
	});

	it('asks for no audio track when the source had none', () => {
		const args = argsOf({ kind: 'blur', strength: 8 }, mp4, probe({ audioCodec: null }));
		expect(args).toContain('-an');
	});

	it('does not add an audio filter to a silent clip', () => {
		const args = argsOf({ kind: 'speed', factor: 2 }, mp4, probe({ audioCodec: null }));
		expect(args).not.toContain('-af');
	});

	it('uses the VP8 settings that were measured, not the defaults', () => {
		const args = argsOf({ kind: 'blur', strength: 5 }, webm);
		expect(args).toContain('-deadline');
		expect(args).toContain('realtime');
		expect(args).not.toContain('-crf');
	});

	it('carries the quality through for compression', () => {
		const args = planEdit({ kind: 'compress', quality: 32 }, mp4, probe(), 'out.mp4').args;
		expect(args[args.indexOf('-crf') + 1]).toBe('32');
	});

	it('only wants the font for text', () => {
		expect(needsFont({ kind: 'text', text: 'a', size: 40, colour: '#fff', position: 'top', box: false })).toBe(true);
		expect(needsFont({ kind: 'blur', strength: 4 })).toBe(false);
	});
});

describe('stretchLayout', () => {
	const op = (over: Partial<Extract<EditOp, { kind: 'stretch' }>> = {}) =>
		({ kind: 'stretch', startSeconds: 2, endSeconds: 6, targetSeconds: 20, ...over }) as const;

	it('works out how much longer the section becomes', () => {
		expect(stretchLayout(op(), 10).stretch).toBe(5);
		// the case this page was built for: 2:32 to 3:42 stretched to 1000s
		const long = stretchLayout(op({ startSeconds: 152, endSeconds: 222, targetSeconds: 1000 }), 300);
		expect(long.stretch).toBeCloseTo(1000 / 70, 6);
	});

	it('knows when there is nothing either side of the section', () => {
		expect(stretchLayout(op({ startSeconds: 0 }), 10).head).toBe(false);
		expect(stretchLayout(op({ endSeconds: 10 }), 10).tail).toBe(false);
		expect(stretchLayout(op(), 10)).toMatchObject({ head: true, tail: true });
	});

	it('assumes there is a tail when the duration could not be read', () => {
		expect(stretchLayout(op({ endSeconds: 10 }), null).tail).toBe(true);
	});

	it('clamps a section and a target that would divide by nothing', () => {
		const layout = stretchLayout(op({ startSeconds: 4, endSeconds: 4, targetSeconds: 0 }), 10);
		expect(layout.endSeconds).toBeGreaterThan(layout.startSeconds);
		expect(layout.targetSeconds).toBeGreaterThan(0);
		expect(Number.isFinite(layout.stretch)).toBe(true);
	});

	it('refuses to produce more than an hour from one section', () => {
		expect(stretchLayout(op({ targetSeconds: 99999 }), 10).targetSeconds).toBe(3600);
	});

	it('adds up what the whole clip will run to', () => {
		expect(stretchedTotal(stretchLayout(op(), 10), 10)).toBe(26);
		const long = stretchLayout(op({ startSeconds: 152, endSeconds: 222, targetSeconds: 1000 }), 300);
		expect(stretchedTotal(long, 300)).toBeCloseTo(1230, 6);
	});
});

describe('planEdit for a slowed section', () => {
	const stretch = (over: Partial<Extract<EditOp, { kind: 'stretch' }>> = {}): EditOp => ({
		kind: 'stretch',
		startSeconds: 2,
		endSeconds: 6,
		targetSeconds: 20,
		...over
	});

	const graphOf = (op: EditOp, p = probe()) => {
		const args = argsOf(op, mp4, p);
		return args[args.indexOf('-filter_complex') + 1];
	};

	it('cuts the clip into three, retimes the middle and joins it back up', () => {
		const graph = graphOf(stretch());
		expect(graph).toContain('[0:v]trim=start=0.000:end=2.000,setpts=PTS-STARTPTS[v0]');
		expect(graph).toContain('[0:v]trim=start=2.000:end=6.000,setpts=5.000000*(PTS-STARTPTS)[v1]');
		// no end on the last one, so it runs to whatever the file has left
		expect(graph).toContain('[0:v]trim=start=6.000,setpts=PTS-STARTPTS[v2]');
		expect(graph).toContain('concat=n=3:v=1:a=1[v][a]');
	});

	it('leaves out a segment there is no footage for', () => {
		expect(graphOf(stretch({ startSeconds: 0 }))).toContain('concat=n=2');
		expect(graphOf(stretch({ endSeconds: 10 }))).toContain('concat=n=2');
	});

	it('takes the sound with it, chaining atempo the way the speed tool does', () => {
		const graph = graphOf(stretch());
		expect(graph).toContain('[0:a]atrim=start=2.000:end=6.000,asetpts=PTS-STARTPTS,');
		const chain = /atrim=start=2\.000:end=6\.000,asetpts=PTS-STARTPTS,([^[]+)\[a1\]/.exec(graph);
		const steps = chain![1].split(',').map((step) => Number(step.replace('atempo=', '')));
		expect(steps.reduce((a, b) => a * b, 1)).toBeCloseTo(0.2, 5);
		for (const step of steps) expect(step).toBeGreaterThanOrEqual(0.5);
	});

	it('never mentions audio for a file that has none', () => {
		const silent = probe({ audioCodec: null });
		const graph = graphOf(stretch(), silent);
		expect(graph).not.toContain('atrim');
		expect(graph).toContain('concat=n=3:v=1:a=0[v]');
		expect(argsOf(stretch(), mp4, silent)).toContain('-an');
	});

	it('maps the joined streams and re-encodes both, since a filter cannot be copied', () => {
		const args = argsOf(stretch());
		expect(args.join(' ')).toContain('-map [v] -map [a]');
		expect(args).toContain('libx264');
		expect(args).toContain('aac');
		expect(planEdit(stretch(), mp4, probe(), 'out.mp4').framesIntact).toBe(false);
	});

	it('passes the frames through rather than repeating them to fill the time', () => {
		// Without this ffmpeg makes the output constant rate, which for a five
		// times stretch is five times as many frames to encode for the same
		// picture. No fps filter in the graph for the same reason.
		expect(argsOf(stretch()).join(' ')).toContain('-fps_mode vfr');
		expect(graphOf(stretch())).not.toContain('fps=');
	});

	it('falls back to the plain speed filter when the section is the whole clip', () => {
		const args = argsOf(stretch({ startSeconds: 0, endSeconds: 10, targetSeconds: 20 }));
		expect(args).not.toContain('-filter_complex');
		expect(args).toContain('-vf');
		expect(args[args.indexOf('-vf') + 1]).toBe('setpts=2.000000*PTS');
	});

	it('builds the graph the page was asked for, 2:32 to 3:42 over 1000 seconds', () => {
		const graph = graphOf(
			stretch({ startSeconds: 152, endSeconds: 222, targetSeconds: 1000 }),
			probe({ durationSeconds: 300 })
		);
		expect(graph).toContain('[0:v]trim=start=152.000:end=222.000,setpts=14.285714*(PTS-STARTPTS)[v1]');
		expect(graph).toContain('concat=n=3:v=1:a=1[v][a]');
	});
});

describe('planEdit for a drawn speed curve', () => {
	const graphOf = (op: EditOp, p = probe()) => {
		const args = argsOf(op, mp4, p);
		return args[args.indexOf('-filter_complex') + 1];
	};
	const ramp = (points: RampPoint[], range = SLOWER): EditOp => ({ kind: 'ramp', points, range });

	it('builds one slice per constant-speed piece and joins them', () => {
		const points = defaultRamp(10);
		const graph = graphOf(ramp(points));
		const pieces = sampleRamp(points, 10, SLOWER).length;
		expect(graph).toContain(`concat=n=${pieces}:v=1:a=1[v][a]`);
		expect(graph.match(/\[0:v\]trim=/g)).toHaveLength(pieces);
	});

	it('leaves the untouched head and tail unretimed', () => {
		// Not cosmetic. A segment at exactly 1 gets no setpts multiplier and no
		// atempo at all, so the parts of the clip nobody asked to change keep
		// their own timing rather than being resampled to the same value.
		const graph = graphOf(ramp(defaultRamp(10)));
		expect(graph).toContain('[0:v]trim=start=0.000:end=');
		expect(graph).toMatch(/\[0:v\]trim=start=0\.000:end=[\d.]+,setpts=PTS-STARTPTS\[v0\]/);
		// and the last slice has no end, so it runs to whatever the file has left
		expect(graph).toMatch(/\[0:v\]trim=start=[\d.]+,setpts=PTS-STARTPTS\[v\d+\]/);
	});

	it('slows the picture down by multiplying timestamps up', () => {
		// Quarter speed is a four times multiplier, and that is the only
		// direction this mode goes.
		const graph = graphOf(ramp([{ t: 0, speed: 0.25 }, { t: 5, speed: 0.25 }, { t: 10, speed: 1 }]));
		expect(graph).toContain('setpts=4.000000*(PTS-STARTPTS)');
		expect(graph).not.toMatch(/setpts=0\.\d+\*/);
	});

	it('takes the sound with it, and drops the audio half when there is none', () => {
		const graph = graphOf(ramp(defaultRamp(10)));
		expect(graph).toContain('atempo=');
		const silent = probe({ audioCodec: null });
		expect(graphOf(ramp(defaultRamp(10)), silent)).not.toContain('[0:a]');
		expect(argsOf(ramp(defaultRamp(10)), mp4, silent)).toContain('-an');
	});

	it('keeps the frames it has rather than repeating them', () => {
		const args = argsOf(ramp(defaultRamp(10)));
		expect(args).toContain('-fps_mode');
		expect(args[args.indexOf('-fps_mode') + 1]).toBe('vfr');
		expect(args.join(' ')).not.toContain('fps=');
		expect(planEdit(ramp(defaultRamp(10)), mp4, probe(), 'out.mp4').framesIntact).toBe(false);
	});

	it('hands a curve that never changes to the plain speed path', () => {
		// A concat of one is a filter graph doing what a single -vf already
		// does, which is the same call the stretch mode makes when its section
		// turns out to be the whole clip.
		const flat = argsOf(ramp([{ t: 0, speed: 0.5 }, { t: 10, speed: 0.5 }]));
		expect(flat).not.toContain('-filter_complex');
		expect(flat.join(' ')).toContain('setpts=2');
	});

	it('does nothing surprising with a curve for a clip of no length', () => {
		// The panel gates on this, but a zero duration reaching here must come
		// out as a plain re-encode rather than a graph built from nothing.
		const args = argsOf(ramp(defaultRamp(10)), mp4, probe({ durationSeconds: 0 }));
		expect(args).not.toContain('-filter_complex');
	});
});

describe('planEdit for a curve that speeds a clip up', () => {
	const graphOf = (op: EditOp, p = probe()) => {
		const args = argsOf(op, mp4, p);
		return args[args.indexOf('-filter_complex') + 1];
	};
	const fast = (points: RampPoint[]): EditOp => ({ kind: 'ramp', points, range: FASTER });

	it('keeps the points above 1 instead of flattening them', () => {
		// The whole reason the op carries its range. Planned against the slow
		// range every point would be clamped back down to 1 and the graph would
		// encode a clip that does nothing, which looks exactly like success.
		const graph = graphOf(fast(defaultRamp(10, FASTER)));
		expect(graph).toMatch(/setpts=0\.\d+\*/);
		expect(graph).toContain('concat=');
	});

	it('multiplies timestamps down, which is what running faster is', () => {
		// Triple speed is a one third multiplier.
		const graph = graphOf(
			fast([
				{ t: 0, speed: 3 },
				{ t: 5, speed: 3 },
				{ t: 10, speed: 1 }
			])
		);
		expect(graph).toContain('setpts=0.333333*(PTS-STARTPTS)');
	});

	it('comes out shorter than it went in', () => {
		const segments = sampleRamp(defaultRamp(10, FASTER), 10, FASTER);
		const total = segments.reduce((sum, seg) => sum + (seg.to - seg.from) / seg.speed, 0);
		expect(total).toBeLessThan(10);
		expect(total).toBeGreaterThan(3);
	});

	it('takes the sound with it', () => {
		expect(graphOf(fast(defaultRamp(10, FASTER)))).toContain('atempo=');
	});
});
