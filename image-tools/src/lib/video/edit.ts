import type { VideoFormat } from './formats';
import type { ConvertPlan, ProbeResult } from './plan';

/**
 * Turning an edit into ffmpeg arguments.
 *
 * The companion to `plan.ts`, which handles conversion. Kept apart because the
 * two answer different questions: conversion asks "will this container take
 * what is already here", and an edit asks "what has to be done to the picture".
 * Both are pure and tested for the same reason, since this is where the whole
 * cost of the video section is decided.
 *
 * The cost is worth stating plainly. A filter forces a decode and an encode, so
 * almost everything here is in the seconds-to-minutes range where a conversion
 * is often instant. Two operations escape it, and both are worth having for
 * exactly that reason:
 *
 *   trim on a keyframe    copies both streams      instant
 *   remove the sound      copies the picture       instant
 *
 * Everything else re-encodes. `-preset veryfast` and the VP8 settings are
 * inherited from `plan.ts`, where they were measured. See CLAUDE.md before
 * changing them.
 */

const IN = 'input';

/** What the visitor asked for, before it becomes arguments. */
export type EditOp =
	| { kind: 'trim'; startSeconds: number; endSeconds: number | null; exact: boolean }
	| { kind: 'crop'; x: number; y: number; width: number; height: number }
	| { kind: 'resize'; width: number; height: number | null }
	| { kind: 'speed'; factor: number }
	| { kind: 'fps'; fps: number }
	| { kind: 'rotate'; quarterTurns: number; flipHorizontal: boolean; flipVertical: boolean }
	| { kind: 'blur'; strength: number }
	| { kind: 'text'; text: string; size: number; colour: string; position: TextPosition; box: boolean }
	| { kind: 'mute' }
	| { kind: 'compress'; quality: number };

export type TextPosition = 'top' | 'centre' | 'bottom';

/** Where a caption sits, as a drawtext expression. Padded off the edge. */
const TEXT_Y: Record<TextPosition, string> = {
	top: 'h*0.06',
	centre: '(h-text_h)/2',
	bottom: 'h*0.94-text_h'
};

/** The font written into ffmpeg's filesystem before a text edit runs. */
export const FONT_FILE = 'font.ttf';

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;
/** atempo only accepts 0.5 to 2, so anything outside is reached by chaining. */
const ATEMPO_MIN = 0.5;
const ATEMPO_MAX = 2;

export const BLUR_MIN = 1;
export const BLUR_MAX = 20;

/**
 * atempo as many times as it takes.
 *
 * The filter refuses a factor outside 0.5 to 2, so quarter speed is two halves
 * and quadruple is two doubles. Without this the slider silently produced a
 * file with the wrong pitch or no sound at all.
 */
export function tempoChain(factor: number): number[] {
	const steps: number[] = [];
	let remaining = factor;
	while (remaining < ATEMPO_MIN - 1e-9) {
		steps.push(ATEMPO_MIN);
		remaining /= ATEMPO_MIN;
	}
	while (remaining > ATEMPO_MAX + 1e-9) {
		steps.push(ATEMPO_MAX);
		remaining /= ATEMPO_MAX;
	}
	steps.push(Number(remaining.toFixed(6)));
	return steps;
}

/** Even numbers only: H.264 will not encode an odd width or height. */
export function evenSize(value: number): number {
	return Math.max(2, Math.floor(value / 2) * 2);
}

/**
 * What has to be escaped inside drawtext's value, established by testing each
 * character against the real thing rather than by reading the parser.
 *
 * The colon has to be escaped even inside quotes, or it ends the option list
 * and drawtext fails with "Error while processing the decoded data". The
 * percent must NOT be: escaping it makes the value unparseable and drawtext
 * then draws nothing at all without reporting anything, which is worse than
 * failing. Doing both was the original bug, and it shipped because the obvious
 * test case had no punctuation in it. `expansion=none` in the filter covers
 * the percent instead.
 */
export function escapeDrawText(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'")
		.replace(/:/g, '\\:')
		.replace(/\r?\n/g, ' ');
}

/**
 * The video filter chain for an edit, or null when it needs none.
 *
 * Separated from the arguments so a test can read the chain rather than hunt
 * through an argv, and so the panel can show what it is about to run.
 */
export function filterFor(op: EditOp): string | null {
	switch (op.kind) {
		case 'crop':
			return `crop=${evenSize(op.width)}:${evenSize(op.height)}:${Math.max(0, Math.round(op.x))}:${Math.max(0, Math.round(op.y))}`;
		case 'resize': {
			const width = evenSize(op.width);
			// -2 rather than -1: it keeps the aspect ratio and rounds to an even
			// number, which is what H.264 insists on.
			return `scale=${width}:${op.height ? evenSize(op.height) : -2}`;
		}
		case 'speed':
			return `setpts=${(1 / op.factor).toFixed(6)}*PTS`;
		case 'fps':
			return `fps=${op.fps}`;
		case 'rotate': {
			const parts: string[] = [];
			// transpose turns a quarter at a time, so three of them is the other
			// way round. Two is a 180, which needs no flip of its own.
			for (let i = 0; i < (((op.quarterTurns % 4) + 4) % 4); i++) parts.push('transpose=1');
			if (op.flipHorizontal) parts.push('hflip');
			if (op.flipVertical) parts.push('vflip');
			return parts.length ? parts.join(',') : null;
		}
		case 'blur':
			return `boxblur=${Math.round(op.strength)}:1`;
		case 'text': {
			const bits = [
				`fontfile=${FONT_FILE}`,
				// Literal text, so a percent sign is a percent sign rather than
				// the start of a substitution drawtext would try to evaluate.
				'expansion=none',
				`text='${escapeDrawText(op.text)}'`,
				`fontsize=${Math.round(op.size)}`,
				`fontcolor=${op.colour.replace('#', '0x')}`,
				'x=(w-text_w)/2',
				`y=${TEXT_Y[op.position]}`
			];
			// A caption over a bright frame is unreadable without something
			// behind it, and a box costs nothing.
			if (op.box) bits.push('box=1', 'boxcolor=0x000000@0.5', 'boxborderw=12');
			return `drawtext=${bits.join(':')}`;
		}
		default:
			return null;
	}
}

/** True when the sound has to be re-encoded because its timing changed. */
function touchesAudio(op: EditOp): boolean {
	return op.kind === 'speed';
}

function encodeVideoArgs(target: VideoFormat, quality: number): string[] {
	const codec = target.videoCodec ?? 'libx264';
	if (codec === 'libvpx') {
		return ['-c:v', codec, '-b:v', '1M', '-deadline', 'realtime', '-cpu-used', '8'];
	}
	return ['-c:v', codec, '-preset', 'veryfast', '-crf', String(quality), '-pix_fmt', 'yuv420p'];
}

function makePlan(
	args: string[],
	copy: ConvertPlan['copy'],
	expectation: ConvertPlan['expectation']
): ConvertPlan {
	return {
		args,
		copy,
		expectation,
		get framesIntact() {
			return copy === 'full' || copy === 'video';
		}
	};
}

export interface EditOptions {
	/** Constant rate factor for H.264, lower is better quality. */
	quality?: number;
}

/**
 * The arguments for one edit, keeping the file in the container it arrived in.
 *
 * Staying in the same container is the point: somebody cropping an MP4 wants an
 * MP4 back, and changing the format as a side effect of an edit is the tool
 * making a decision that was not asked of it.
 */
export function planEdit(
	op: EditOp,
	target: VideoFormat,
	probe: ProbeResult,
	outName: string,
	opts: EditOptions = {}
): ConvertPlan {
	const quality = opts.quality ?? 23;

	// Trimming on a keyframe copies both streams, which is the difference
	// between instant and a full re-encode. `-ss` before `-i` seeks rather than
	// decoding up to the mark, so the cost does not grow with the start time.
	if (op.kind === 'trim') {
		const seek = ['-ss', op.startSeconds.toFixed(3)];
		const until = op.endSeconds === null ? [] : ['-to', op.endSeconds.toFixed(3)];
		if (!op.exact) {
			return makePlan([...seek, '-i', IN, ...until, '-c', 'copy', '-y', outName], 'full', 'instant');
		}
		return makePlan(
			[...seek, '-i', IN, ...until, ...encodeVideoArgs(target, quality), '-c:a', target.audioCodec ?? 'aac', '-y', outName],
			'none',
			'slow'
		);
	}

	// Dropping the sound leaves every frame of the picture untouched.
	if (op.kind === 'mute') {
		return makePlan(['-i', IN, '-an', '-c:v', 'copy', '-y', outName], 'video', 'instant');
	}

	if (op.kind === 'compress') {
		return makePlan(
			['-i', IN, ...encodeVideoArgs(target, op.quality), '-c:a', target.audioCodec ?? 'aac', '-y', outName],
			'none',
			'slow'
		);
	}

	const filter = filterFor(op);
	const args = ['-i', IN];
	if (filter) args.push('-vf', filter);

	if (op.kind === 'speed') {
		const chain = tempoChain(op.factor).map((step) => `atempo=${step}`);
		if (probe.audioCodec) args.push('-af', chain.join(','));
	}

	args.push(...encodeVideoArgs(target, quality));

	// Sound that was not touched is copied rather than put through a second
	// encode, which costs nothing and keeps the original quality.
	if (!probe.audioCodec) {
		args.push('-an');
	} else if (touchesAudio(op) || !target.copyableAudioCodecs.includes(probe.audioCodec)) {
		args.push('-c:a', target.audioCodec ?? 'aac');
	} else {
		args.push('-c:a', 'copy');
	}

	args.push('-y', outName);
	return makePlan(args, 'none', 'slow');
}

/** True when this edit needs the font written into ffmpeg's filesystem first. */
export function needsFont(op: EditOp): boolean {
	return op.kind === 'text';
}
