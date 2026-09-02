import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { VideoFormat } from './formats';
import { FONT_FILE, needsFont, planEdit, type EditOp, type EditOptions } from './edit';
import { fallbackPlan, planConversion, type PlanOptions, type ProbeResult } from './plan';
import { looksReadable, parseProbe } from './probe';

/**
 * The only part of the video section that touches a browser.
 *
 * ffmpeg is 32MB of WebAssembly, about 7MB over the wire once brotli has had
 * it. That is a hundred times the size of the rest of the site put together,
 * so it is never loaded until someone actually drops a video, and the download
 * is reported rather than hidden behind a spinner that looks broken.
 */

/**
 * Where the build puts the core. See the copy plugin in vite.config.ts, which
 * defines this and copies the files under the same version, so the URL changes
 * whenever the bytes do. That is what earns it a year in the browser's cache
 * instead of a 32MB download after every deploy.
 */
declare const __FFMPEG_CORE_VERSION__: string;
const CORE_JS = `/ffmpeg/${__FFMPEG_CORE_VERSION__}/ffmpeg-core.js`;
const CORE_WASM = `/ffmpeg/${__FFMPEG_CORE_VERSION__}/ffmpeg-core.wasm`;

/** The name the file has inside ffmpeg's own filesystem. */
const INPUT = 'input';

export interface LoadProgress {
	/** 0 to 1, or null while the size is still unknown. */
	ratio: number | null;
	loadedBytes: number;
	totalBytes: number | null;
}

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let logLines: string[] = [];

/**
 * The tail of what ffmpeg last said.
 *
 * ffmpeg reports a refused filter or an unreadable font on its log and then
 * exits, so "ffmpeg could not apply that edit" throws away the only sentence
 * that would tell anybody what went wrong. This is what puts it back, both in
 * the message a visitor sees and in a browser test.
 */
export function lastFfmpegLines(count = 6): string[] {
	return logLines.slice(-count);
}

/** True once the core is in memory, so the UI can stop warning about the wait. */
export function isLoaded(): boolean {
	return instance !== null;
}

/**
 * Fetch the core ourselves rather than letting ffmpeg do it, purely so the
 * download can be reported. Seven megabytes with no feedback reads as a hang.
 */
async function fetchWithProgress(url: string, onProgress: (p: LoadProgress) => void): Promise<Blob> {
	const response = await fetch(url);
	if (!response.ok || !response.body) throw new Error(`Could not load ${url}`);

	// Content-Length is the compressed size when the server is compressing, so
	// this is a progress bar, not an accountancy exercise.
	const header = response.headers.get('content-length');
	const totalBytes = header ? Number(header) : null;

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let loadedBytes = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		loadedBytes += value.length;
		onProgress({
			ratio: totalBytes ? Math.min(1, loadedBytes / totalBytes) : null,
			loadedBytes,
			totalBytes
		});
	}
	return new Blob(chunks as BlobPart[]);
}

export async function loadFfmpeg(onProgress: (p: LoadProgress) => void = () => {}): Promise<FFmpeg> {
	if (instance) return instance;
	if (loading) return loading;

	loading = (async () => {
		const { FFmpeg } = await import('@ffmpeg/ffmpeg');
		const ff = new FFmpeg();
		ff.on('log', ({ message }) => {
			logLines.push(message);
			// a conversion that ran long can leave thousands of lines behind
			if (logLines.length > 4000) logLines = logLines.slice(-2000);
		});

		// Fetch the wasm first purely so the download can be reported, then
		// hand ffmpeg the ordinary URLs and let it read them straight back out
		// of the browser cache.
		//
		// Not blob URLs, which is the obvious way to avoid fetching twice and
		// does not work: ffmpeg loads the core inside a worker with
		// importScripts, which refuses a blob and fails with "failed to import
		// ffmpeg-core.js". Serving both files from our own origin makes the
		// plain URLs the simpler answer anyway.
		await fetchWithProgress(CORE_WASM, onProgress);

		await ff.load({ coreURL: CORE_JS, wasmURL: CORE_WASM });
		instance = ff;
		return ff;
	})();

	try {
		return await loading;
	} catch (error) {
		loading = null;
		throw error;
	}
}

/** Ask ffmpeg what is in the file by giving it nowhere to put the result. */
export async function probe(ff: FFmpeg, file: File): Promise<ProbeResult> {
	await ff.writeFile(INPUT, new Uint8Array(await file.arrayBuffer()));
	logLines = [];
	// exits non-zero every time with "at least one output file must be
	// specified", which is exactly what we want. The useful part came first.
	await ff.exec(['-i', INPUT]);
	const result = parseProbe(logLines);
	if (!looksReadable(result)) {
		throw new Error('That file does not look like a video this tool can read');
	}
	return result;
}

export interface ConvertResult {
	blob: Blob;
	/** True when the picture was copied, so every frame is untouched. */
	framesIntact: boolean;
	/** True when nothing at all was re-encoded. */
	fullCopy: boolean;
	probe: ProbeResult;
}

/**
 * One conversion, copying streams where the container allows it.
 *
 * A copy is attempted first and a re-encode runs only if it fails, because a
 * container will happily claim to hold something it does not and no amount of
 * probing settles that as well as trying.
 */
export async function convertVideo(
	ff: FFmpeg,
	file: File,
	target: VideoFormat,
	opts: PlanOptions & { onProgress?: (ratio: number) => void } = {}
): Promise<ConvertResult> {
	const info = await probe(ff, file);
	const outName = `output${target.extensions[0]}`;

	const report = ({ progress }: { progress: number }) => {
		// ffmpeg reports progress beyond 1 on some inputs, so clamp it rather
		// than showing a bar that runs off the end
		opts.onProgress?.(Math.max(0, Math.min(1, progress)));
	};
	ff.on('progress', report);

	try {
		const plan = planConversion(target, info, outName, opts);
		let code = await ff.exec(plan.args);
		let copy = plan.copy;

		if (code !== 0 && plan.copy !== 'none') {
			// The container refused what was inside after all, so pay the price.
			// This is not theoretical: H.264 inside an AVI will not remux into
			// Matroska even though Matroska accepts H.264, because the stream
			// needs a bitstream filter first. Trying and falling back handles
			// that without having to encode a table of such exceptions.
			const retry = fallbackPlan(target, outName, opts);
			code = await ff.exec(retry.args);
			copy = 'none';
		}
		if (code !== 0) throw new Error('ffmpeg could not convert that file');

		const data = await ff.readFile(outName);
		if (typeof data === 'string' || data.length === 0) {
			throw new Error('The conversion produced an empty file');
		}
		const bytes = new Uint8Array(data);
		return {
			blob: new Blob([bytes as unknown as ArrayBuffer], { type: target.mime }),
			framesIntact: copy === 'full' || copy === 'video',
			fullCopy: copy === 'full',
			probe: info
		};
	} finally {
		ff.off('progress', report);
		await ff.deleteFile(outName).catch(() => {});
	}
}

/**
 * The face `drawtext` writes with.
 *
 * There is no system font inside the wasm filesystem, so one has to be put
 * there before a caption can be drawn. Roboto Bold, because a caption sits over
 * a moving picture and a regular weight disappears into it. Fetched only when
 * somebody actually adds text, and kept once fetched: 167KB is nothing beside
 * the 7MB core, but it is not worth downloading on a page that will not use it.
 */
const FONT_URL = '/fonts/caption.ttf';
let fontWritten = false;

async function ensureFont(ff: FFmpeg): Promise<void> {
	if (fontWritten) return;
	const response = await fetch(FONT_URL);
	if (!response.ok) throw new Error('Could not load the font for captions');
	await ff.writeFile(FONT_FILE, new Uint8Array(await response.arrayBuffer()));
	fontWritten = true;
}

/**
 * One edit, keeping the file in the container it arrived in.
 *
 * The shape is deliberately the same as `convertVideo`: probe, plan, run,
 * read back. What differs is that there is no fallback to try, because an edit
 * either has a filter or it does not, and a filter cannot be copied around.
 * The two operations that do copy (a keyframe trim, and dropping the sound)
 * fail loudly rather than silently re-encoding, since a visitor who was
 * promised "instant, every frame untouched" should not quietly get the other
 * thing.
 */
export async function editVideo(
	ff: FFmpeg,
	file: File,
	op: EditOp,
	target: VideoFormat,
	opts: EditOptions & { onProgress?: (ratio: number) => void } = {}
): Promise<ConvertResult> {
	const info = await probe(ff, file);
	const outName = `output${target.extensions[0]}`;

	if (needsFont(op)) await ensureFont(ff);

	const report = ({ progress }: { progress: number }) => {
		opts.onProgress?.(Math.max(0, Math.min(1, progress)));
	};
	ff.on('progress', report);

	try {
		const plan = planEdit(op, target, info, outName, opts);
		logLines = [];
		const code = await ff.exec(plan.args);
		if (code !== 0) {
			const said = lastFfmpegLines(3)
				.filter((line) => /error|invalid|no such|could not|unable/i.test(line))
				.join(' ');
			throw new Error(said || 'ffmpeg could not apply that edit');
		}

		const data = await ff.readFile(outName);
		if (typeof data === 'string' || data.length === 0) {
			throw new Error('The edit produced an empty file');
		}
		const bytes = new Uint8Array(data);
		return {
			blob: new Blob([bytes as unknown as ArrayBuffer], { type: target.mime }),
			framesIntact: plan.framesIntact,
			fullCopy: plan.copy === 'full',
			probe: info
		};
	} finally {
		ff.off('progress', report);
		await ff.deleteFile(outName).catch(() => {});
	}
}

/** For tests and for freeing 32MB when a page is done with it. */
export function resetFfmpeg(): void {
	instance?.terminate();
	instance = null;
	loading = null;
	logLines = [];
	fontWritten = false;
}
