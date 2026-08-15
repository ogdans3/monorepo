import type { VideoFormat } from './formats';

/**
 * Turning a conversion into ffmpeg arguments.
 *
 * This is the whole performance story of the video section, so it is pure and
 * tested rather than buried in a component. Measured in a browser on a five
 * second 720p clip:
 *
 *   copy into another container      15 to 60 ms
 *   audio out as MP3                     80 ms
 *   video out as GIF                    1.2 s
 *   re-encode to WebM (VP8)             4.0 s
 *   re-encode to H.264                  9.3 s
 *
 * The gap between the first line and the last is three orders of magnitude,
 * and it is entirely about whether the video stream has to be decoded and
 * encoded again or can simply be moved into a different box. So: copy
 * whenever the target container will accept what is already there.
 *
 * Two settings below are load bearing and were arrived at by measuring.
 * VP8 with a realtime deadline is eight times faster than the default for the
 * same file size, and VP9 is not offered at all because it reliably crashed
 * the tab. See CLAUDE.md before changing either.
 */

export interface ProbeResult {
	/** Codec name as ffmpeg reports it, e.g. "h264". */
	videoCodec: string | null;
	audioCodec: string | null;
	durationSeconds: number | null;
	width: number | null;
	height: number | null;
}

export interface ConvertPlan {
	args: string[];
	/** True when no stream is re-encoded, which is the fast path. */
	streamCopy: boolean;
	/** Shown to the visitor before they commit to waiting. */
	expectation: 'instant' | 'quick' | 'slow';
}

export interface PlanOptions {
	/** GIF width in pixels. Height follows the source. */
	gifWidth?: number;
	gifFps?: number;
	/** Constant rate factor for H.264, lower is better quality. */
	crf?: number;
}

const IN = 'input';

/** Can the target container take these streams as they are? */
export function canCopy(target: VideoFormat, probe: ProbeResult): boolean {
	if (target.kind !== 'video') return false;
	if (!probe.videoCodec) return false;
	if (!target.copyableVideoCodecs.includes(probe.videoCodec)) return false;
	// no audio at all is fine, it just means there is nothing to disqualify
	if (probe.audioCodec && !target.copyableAudioCodecs.includes(probe.audioCodec)) return false;
	return true;
}

function gifArgs(outName: string, opts: PlanOptions): string[] {
	const width = opts.gifWidth ?? 480;
	const fps = opts.gifFps ?? 12;
	// One pass with a generated palette looks far better than the default 216
	// colour web palette, and costs almost nothing at these sizes.
	return [
		'-i',
		IN,
		'-vf',
		`fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`,
		'-loop',
		'0',
		'-y',
		outName
	];
}

function audioArgs(target: VideoFormat, outName: string, probe: ProbeResult): string[] {
	// Audio already in the right codec is copied out untouched, which keeps
	// the original quality instead of putting it through MP3 a second time.
	if (probe.audioCodec && target.copyableAudioCodecs.includes(probe.audioCodec)) {
		return ['-i', IN, '-vn', '-c:a', 'copy', '-y', outName];
	}
	return ['-i', IN, '-vn', '-c:a', target.audioCodec ?? 'libmp3lame', '-q:a', '2', '-y', outName];
}

function encodeArgs(target: VideoFormat, outName: string, opts: PlanOptions): string[] {
	const args = ['-i', IN, '-c:v', target.videoCodec ?? 'libx264'];

	if (target.videoCodec === 'libvpx') {
		// Eight times faster than the default deadline for the same file size.
		// Without this a one minute clip takes six minutes.
		args.push('-b:v', '1M', '-deadline', 'realtime', '-cpu-used', '8');
	} else {
		// veryfast rather than ultrafast on purpose: ultrafast finished in a
		// third of the time and produced a file larger than the source, which
		// defeats the point of converting.
		args.push('-preset', 'veryfast', '-crf', String(opts.crf ?? 23), '-pix_fmt', 'yuv420p');
	}

	args.push('-c:a', target.audioCodec ?? 'aac', '-y', outName);
	return args;
}

/**
 * The arguments for one conversion, and an honest guess at how long it will
 * feel. `outName` is the name inside ffmpeg's own filesystem, not the
 * download name.
 */
export function planConversion(
	target: VideoFormat,
	probe: ProbeResult,
	outName: string,
	opts: PlanOptions = {}
): ConvertPlan {
	if (target.kind === 'audio') {
		return { args: audioArgs(target, outName, probe), streamCopy: false, expectation: 'instant' };
	}
	if (target.kind === 'animation') {
		return { args: gifArgs(outName, opts), streamCopy: false, expectation: 'quick' };
	}
	if (canCopy(target, probe)) {
		return {
			args: ['-i', IN, '-c', 'copy', '-y', outName],
			streamCopy: true,
			expectation: 'instant'
		};
	}
	return { args: encodeArgs(target, outName, opts), streamCopy: false, expectation: 'slow' };
}

/**
 * A second attempt for when a copy turned out not to work after all.
 *
 * Containers are not honest about what is inside them, and a probe can only
 * report what ffmpeg managed to parse. Rather than guess harder, the copy is
 * attempted and this is what runs if it fails.
 */
export function fallbackPlan(
	target: VideoFormat,
	outName: string,
	opts: PlanOptions = {}
): ConvertPlan {
	return { args: encodeArgs(target, outName, opts), streamCopy: false, expectation: 'slow' };
}

/** Rough seconds of work, for a progress estimate. Deliberately pessimistic. */
export function estimateSeconds(plan: ConvertPlan, probe: ProbeResult): number | null {
	if (!probe.durationSeconds) return null;
	const pixels = (probe.width ?? 1280) * (probe.height ?? 720);
	const scale = pixels / (1280 * 720);
	if (plan.expectation === 'instant') return 1;
	if (plan.expectation === 'quick') return Math.max(1, probe.durationSeconds * 0.25 * scale);
	// measured at roughly 0.8x realtime for VP8 and 1.9x for H.264 at 720p
	const rate = plan.args.includes('libvpx') ? 0.8 : 1.9;
	return Math.max(2, probe.durationSeconds * rate * scale);
}
