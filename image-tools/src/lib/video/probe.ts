import type { ProbeResult } from './plan';

/**
 * Reading what is inside a video out of ffmpeg's own chatter.
 *
 * There is no ffprobe in the WebAssembly build, so the way to learn what a
 * file contains is to hand it to ffmpeg with no output file and read what it
 * complains about. It exits with an error every time, which is expected: the
 * error is "no output specified" and the useful part came first.
 *
 * Pure on purpose. Deciding whether a conversion can copy streams instead of
 * re-encoding rests entirely on getting the codec names right, and that is a
 * decision worth testing against real ffmpeg output rather than hoping.
 */

const DURATION = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/;
const VIDEO_STREAM = /Stream #\d+:\d+.*?:\s*Video:\s*([a-z0-9_]+)/i;
const AUDIO_STREAM = /Stream #\d+:\d+.*?:\s*Audio:\s*([a-z0-9_]+)/i;
/** Dimensions appear after the pixel format, e.g. "yuv420p, 1280x720 [SAR..." */
const SIZE = /,\s*(\d{2,5})x(\d{2,5})\b/;

export function parseProbe(lines: string[]): ProbeResult {
	const result: ProbeResult = {
		videoCodec: null,
		audioCodec: null,
		durationSeconds: null,
		width: null,
		height: null
	};

	for (const line of lines) {
		const duration = DURATION.exec(line);
		if (duration && result.durationSeconds === null) {
			result.durationSeconds =
				Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
		}

		const video = VIDEO_STREAM.exec(line);
		if (video && !result.videoCodec) {
			result.videoCodec = video[1].toLowerCase();
			const size = SIZE.exec(line);
			if (size) {
				result.width = Number(size[1]);
				result.height = Number(size[2]);
			}
		}

		const audio = AUDIO_STREAM.exec(line);
		if (audio && !result.audioCodec) result.audioCodec = audio[1].toLowerCase();
	}

	return result;
}

/** A duration of zero is not a duration, it is a file we could not read. */
export function looksReadable(probe: ProbeResult): boolean {
	return probe.videoCodec !== null || probe.audioCodec !== null;
}
