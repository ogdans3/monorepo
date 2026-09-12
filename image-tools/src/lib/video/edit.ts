import type { VideoFormat } from './formats';
import type { ConvertPlan, ProbeResult } from './plan';
import { sampleRamp, SLOWER, type RampPoint, type RampRange, type RampSegment } from './ramp';

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
	| { kind: 'stretch'; startSeconds: number; endSeconds: number; targetSeconds: number }
	/**
	 * The same page's other mode: a drawn curve of how fast the clip runs at
	 * each moment, rather than one section given one length. `ramp.ts` owns the
	 * curve and the sampling, this file only turns the result into arguments.
	 */
	| {
			kind: 'ramp';
			points: RampPoint[];
			/**
			 * Which way the curve runs. Not optional in practice: the range is
			 * what the points are clamped against, so planning a speed up curve
			 * against the slow range would quietly flatten every point above 1
			 * back down to it and encode a clip that does nothing.
			 */
			range: RampRange;
	  }
	| { kind: 'fps'; fps: number }
	| { kind: 'rotate'; quarterTurns: number; flipHorizontal: boolean; flipVertical: boolean }
	| { kind: 'blur'; strength: number }
	| { kind: 'text'; text: string; size: number; colour: string; position: TextPosition; box: boolean }
	| { kind: 'mute' }
	| { kind: 'compress'; quality: number }
	/**
	 * Joining several clips. Listed here only so the tools registry can name it
	 * like every other page, since `op` is typed as `EditOp['kind']`. It never
	 * reaches `planEdit`: every function in this file takes one probe and one
	 * input, and a join is the one operation that is about several. `merge.ts`
	 * plans it and `mergeVideos` runs it.
	 */
	| { kind: 'merge' }
	/**
	 * Pulling stills out of a clip. Here for the same reason as `merge`: the
	 * registry types `op` as `EditOp['kind']`, so a page cannot be named
	 * without one. It never reaches `planEdit` either, because every function
	 * in this file produces exactly one output file and this one produces a
	 * pile. `frames.ts` plans it and `extractFrames` runs it.
	 */
	| { kind: 'frames' };

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

/** A section shorter than this is a mark, not a stretch of footage. */
export const STRETCH_MIN_SECONDS = 0.1;
/** An hour of output from one section is already well past useful. */
export const STRETCH_MAX_SECONDS = 3600;

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

/**
 * A stretch, worked out and clamped, before it becomes a filter graph.
 *
 * Kept apart from the graph itself so the panel can show what is about to
 * happen without building ffmpeg arguments to read them back, and so a test
 * can check the arithmetic without matching a string full of semicolons.
 */
export interface StretchLayout {
	startSeconds: number;
	endSeconds: number;
	targetSeconds: number;
	/** How many times longer the section becomes. 14.29 for 70s into 1000s. */
	stretch: number;
	/** Whether there is any clip before the section, and any after it. */
	head: boolean;
	tail: boolean;
}

export function stretchLayout(
	op: Extract<EditOp, { kind: 'stretch' }>,
	sourceSeconds: number | null
): StretchLayout {
	const startSeconds = Math.max(0, op.startSeconds);
	const endSeconds = Math.max(startSeconds + STRETCH_MIN_SECONDS, op.endSeconds);
	const targetSeconds = Math.min(
		STRETCH_MAX_SECONDS,
		Math.max(STRETCH_MIN_SECONDS, op.targetSeconds)
	);
	return {
		startSeconds,
		endSeconds,
		targetSeconds,
		stretch: targetSeconds / (endSeconds - startSeconds),
		// A duration we could not read is treated as having something after the
		// section. An empty segment fed to concat is the worse guess: it ends
		// the graph with nothing to join rather than joining nothing.
		head: startSeconds > 0.01,
		tail: sourceSeconds === null || endSeconds < sourceSeconds - 0.01
	};
}

/** How long the whole clip runs once the section has been stretched. */
export function stretchedTotal(layout: StretchLayout, sourceSeconds: number): number {
	const section = layout.endSeconds - layout.startSeconds;
	return Math.max(0, sourceSeconds - section) + layout.targetSeconds;
}

/**
 * The filter graph that slows one section and leaves the rest alone: head,
 * retimed section, tail. `concatFilter` below does the work and carries the
 * reasoning.
 */
export function stretchFilter(layout: StretchLayout, hasAudio: boolean): string {
	const pieces: ConcatPiece[] = [];
	if (layout.head) pieces.push({ from: 0, to: layout.startSeconds, scale: 1 });
	pieces.push({ from: layout.startSeconds, to: layout.endSeconds, scale: layout.stretch });
	// Open ended, so a duration that was a hundredth out does not clip the last
	// frames off the end of the clip.
	if (layout.tail) pieces.push({ from: layout.endSeconds, to: null, scale: 1 });
	return concatFilter(pieces, hasAudio);
}

/** One constant-speed slice of the input, before it becomes a filter chain. */
export interface ConcatPiece {
	from: number;
	/** Null runs to the end of the clip. */
	to: number | null;
	/** The setpts multiplier. Above 1 is slower, exactly 1 is untouched. */
	scale: number;
}

/**
 * Cut the input into slices, retime the ones that asked for it, and join them
 * back into one stream.
 *
 * Shared by both modes of the slow motion page, which is the only reason the
 * curve mode was cheap to add: a marked section is three slices and a drawn
 * curve is thirty, and past that they are the same operation. Keeping one
 * builder means the two cannot drift on the things that were expensive to get
 * right, all of which are here.
 *
 * Every slice needs `-STARTPTS`, because a trimmed piece still carries the
 * timestamps it had where it came from and concat would leave the gap in.
 *
 * The sound follows the picture through `atempo`, chained by `tempoChain`
 * because one instance refuses anything outside half to double speed. A big
 * change is several instances and it sounds like it, which is honest: the
 * alternative is a clip whose sound is silently out of step with its picture.
 *
 * There is no `fps` filter anywhere in here, and that is the expensive
 * decision on this page. Repeating frames to hold a constant rate would mean
 * encoding 14 times as many of them for a 14 times stretch, for a picture that
 * changes at exactly the same moments either way. So the frames that exist are
 * spread out, and `-fps_mode vfr` beside the filter keeps ffmpeg from filling
 * the gaps back in.
 */
export function concatFilter(pieces: ConcatPiece[], hasAudio: boolean): string {
	const parts: string[] = [];
	const labels: string[] = [];

	pieces.forEach((piece, i) => {
		const span = `start=${piece.from.toFixed(3)}${piece.to === null ? '' : `:end=${piece.to.toFixed(3)}`}`;
		const setpts = piece.scale === 1 ? 'PTS-STARTPTS' : `${piece.scale.toFixed(6)}*(PTS-STARTPTS)`;
		parts.push(`[0:v]trim=${span},setpts=${setpts}[v${i}]`);
		if (hasAudio) {
			const tempo =
				piece.scale === 1
					? ''
					: `,${tempoChain(1 / piece.scale)
							.map((step) => `atempo=${step}`)
							.join(',')}`;
			parts.push(`[0:a]atrim=${span},asetpts=PTS-STARTPTS${tempo}[a${i}]`);
		}
		labels.push(`[v${i}]${hasAudio ? `[a${i}]` : ''}`);
	});

	parts.push(
		`${labels.join('')}concat=n=${pieces.length}:v=1:a=${hasAudio ? 1 : 0}[v]${hasAudio ? '[a]' : ''}`
	);
	return parts.join(';');
}

/**
 * The filter graph for a drawn curve: one slice per constant-speed piece.
 *
 * A segment at exactly 1 comes back with no multiplier and no atempo, which is
 * how the untouched head and tail of a ramped clip stay untouched.
 */
export function rampFilter(segments: RampSegment[], hasAudio: boolean): string {
	return concatFilter(
		segments.map((segment, i) => ({
			from: segment.from,
			// Same reason as the stretch tail: the last piece runs to the end of
			// the clip rather than to a computed timestamp, so a duration read a
			// hundredth out does not lose the final frames.
			to: i === segments.length - 1 ? null : segment.to,
			scale: 1 / segment.speed
		})),
		hasAudio
	);
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

/**
 * Everything a concat of retimed slices needs past the graph itself.
 *
 * `-fps_mode vfr` is the load bearing part: left to itself ffmpeg makes the
 * output constant rate, which means repeating every frame of the slowed
 * section until it fills the new running time. The same picture, many times
 * the encode.
 */
function concatPlan(
	graph: string,
	hasAudio: boolean,
	target: VideoFormat,
	quality: number,
	outName: string
): ConvertPlan {
	return makePlan(
		[
			'-i',
			IN,
			'-filter_complex',
			graph,
			'-map',
			'[v]',
			...(hasAudio ? ['-map', '[a]'] : []),
			'-fps_mode',
			'vfr',
			...encodeVideoArgs(target, quality),
			// Filtered sound cannot be copied, so it is always re-encoded here.
			...(hasAudio ? ['-c:a', target.audioCodec ?? 'aac'] : ['-an']),
			'-y',
			outName
		],
		'none',
		'slow'
	);
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

	// Loud rather than quiet. A join routed through here would otherwise fall
	// past every branch and come out as a plain re-encode of one file, which
	// looks like it worked.
	if (op.kind === 'merge') {
		throw new Error('A merge has several inputs and is planned by merge.ts, not planEdit');
	}

	// Loud for the same reason: routed through here it would fall past every
	// branch and come back as a plain re-encode of the clip, which looks like
	// it worked right up until somebody opens the file expecting images.
	if (op.kind === 'frames') {
		throw new Error('Frame extraction has many outputs and is planned by frames.ts, not planEdit');
	}

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

	// Slowing one section down, with the rest of the clip left at its own pace.
	if (op.kind === 'stretch') {
		const layout = stretchLayout(op, probe.durationSeconds);
		// Nothing either side of the section means this is not a section at all,
		// it is the whole clip, and the plain speed path already does that with
		// one filter instead of a concat of one.
		if (!layout.head && !layout.tail) {
			return planEdit({ kind: 'speed', factor: 1 / layout.stretch }, target, probe, outName, opts);
		}
		const hasAudio = Boolean(probe.audioCodec);
		return concatPlan(stretchFilter(layout, hasAudio), hasAudio, target, quality, outName);
	}

	// The same page's curve mode. Both modes end up as a concat of retimed
	// slices, so they share everything below the graph itself.
	if (op.kind === 'ramp') {
		const segments = sampleRamp(op.points, probe.durationSeconds, op.range ?? SLOWER);
		// One piece is a constant speed across the whole clip, which the plain
		// speed path already does with one filter instead of a concat of one.
		// The same reasoning as a stretch with no head and no tail.
		if (segments.length <= 1) {
			const factor = segments[0]?.speed ?? 1;
			return planEdit({ kind: 'speed', factor }, target, probe, outName, opts);
		}
		const hasAudio = Boolean(probe.audioCodec);
		return concatPlan(rampFilter(segments, hasAudio), hasAudio, target, quality, outName);
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
