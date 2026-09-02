import { describe, expect, it } from 'vitest';
import { VIDEO_FORMATS } from './formats';
import {
	escapeDrawText,
	evenSize,
	filterFor,
	needsFont,
	planEdit,
	tempoChain,
	type EditOp
} from './edit';
import type { ProbeResult } from './plan';

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
