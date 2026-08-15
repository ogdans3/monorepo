import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { VideoFormat } from './formats';
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

/** Where the build puts the core. See the copy plugin in vite.config.ts. */
const CORE_JS = '/ffmpeg/ffmpeg-core.js';
const CORE_WASM = '/ffmpeg/ffmpeg-core.wasm';

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
	/** True when nothing was re-encoded, which is worth telling the visitor. */
	streamCopy: boolean;
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
		let streamCopy = plan.streamCopy;

		if (code !== 0 && plan.streamCopy) {
			// the container refused what was inside after all, so pay the price
			const retry = fallbackPlan(target, outName, opts);
			code = await ff.exec(retry.args);
			streamCopy = false;
		}
		if (code !== 0) throw new Error('ffmpeg could not convert that file');

		const data = await ff.readFile(outName);
		if (typeof data === 'string' || data.length === 0) {
			throw new Error('The conversion produced an empty file');
		}
		const bytes = new Uint8Array(data);
		return {
			blob: new Blob([bytes as unknown as ArrayBuffer], { type: target.mime }),
			streamCopy,
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
}
