/**
 * The length of a video whose file doesn't say, learned by seeking past the
 * end.
 *
 * A WebM from MediaRecorder is written as it records, and the length is never
 * filled in afterwards, so `duration` is Infinity until the browser has read
 * the whole thing. Asking for a time far beyond any real length makes it do
 * exactly that: it seeks to the last frame and fires `durationchange` with
 * the real length. The element is then put back at the start.
 *
 * Resolves with the length in seconds, or null if the browser hasn't found it
 * within `waitMs` or the element was given another file first. A length the
 * element already knows comes straight back without a seek.
 */
export function learnDuration(video: HTMLVideoElement, waitMs = 5000): Promise<number | null> {
	const known = (value: number) => Number.isFinite(value) && value > 0;
	if (known(video.duration)) return Promise.resolve(video.duration);

	return new Promise((resolve) => {
		let timer: ReturnType<typeof setTimeout>;
		const finish = (length: number | null, rewind: boolean) => {
			clearTimeout(timer);
			video.removeEventListener('durationchange', check);
			video.removeEventListener('seeked', check);
			video.removeEventListener('emptied', replaced);
			if (rewind) video.currentTime = 0;
			resolve(length);
		};
		const check = () => {
			if (known(video.duration)) finish(video.duration, true);
		};
		// A new source: nothing here applies to it any more, least of all the rewind.
		const replaced = () => finish(null, false);
		video.addEventListener('durationchange', check);
		video.addEventListener('seeked', check);
		video.addEventListener('emptied', replaced);
		timer = setTimeout(() => finish(null, true), waitMs);
		video.currentTime = Number.MAX_SAFE_INTEGER;
	});
}
