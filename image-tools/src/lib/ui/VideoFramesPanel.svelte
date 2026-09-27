<script lang="ts">
	/**
	 * Stills out of a clip.
	 *
	 * A panel of its own, like the merge one and for the mirror-image reason:
	 * `VideoToolPanel` is singular throughout, with one result and one download
	 * button bound to it. This produces a pile of files, a grid to look at them
	 * in and a zip to take them away, and threading that shape through the
	 * shared panel would leave eleven other tools carrying a list only this one
	 * ever fills.
	 */
	import { zipBlobs } from '$lib/engine';
	import { editedFileName } from '$lib/engine';
	import { videoAcceptAttribute } from '$lib/video/formats';
	import {
		extractFrames,
		isLoaded,
		loadFfmpeg,
		readStill,
		resetFfmpeg,
		type LoadProgress
	} from '$lib/video/ffmpeg';
	import {
		FRAME_FORMATS,
		FRAME_MANY,
		FRAME_MAX,
		FRAME_QUALITY_MAX,
		FRAME_QUALITY_MIN,
		FRAME_RATE_MIN,
		frameCount,
		frameName,
		tooManyFrames,
		type FrameFormat
	} from '$lib/video/frames';
	import type { VideoTool } from '$lib/video/tools';
	import Dropzone from './Dropzone.svelte';
	import NumberBox from './NumberBox.svelte';
	import SliderField from './SliderField.svelte';
	import { downloadBlob } from './download';
	import { learnDuration } from './videolength';

	let { tool }: { tool: VideoTool } = $props();

	/** `reading` is ffmpeg reading a clip the browser couldn't play. */
	type Stage = 'idle' | 'loading' | 'reading' | 'working' | 'done' | 'error';

	let stage = $state<Stage>('idle');
	let download = $state<LoadProgress>({ ratio: null, loadedBytes: 0, totalBytes: null });
	let workRatio = $state(0);
	let readBack = $state(0);
	let error = $state<string | null>(null);
	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let media = $state({ width: 0, height: 0, duration: 0, fps: 0 });
	let video = $state<HTMLVideoElement>();
	let zipping = $state(false);
	/** The browser couldn't play the clip, so the preview has nothing to show. */
	let previewFailed = $state(false);
	/** The clip's first frame, read by ffmpeg, shown in place of the video. */
	let still = $state<string | null>(null);
	/** ffmpeg couldn't read it either, or the engine never arrived. */
	let unreadable = $state<string | null>(null);
	/** The engine is downloading for that fallback, which nobody pressed a button for. */
	let fetching = $state(false);

	let format = $state<FrameFormat>('jpg');
	let rate = $state(1);
	let everyFrame = $state(false);
	let quality = $state(4);

	let frames = $state<{ name: string; data: Uint8Array; blob: Blob }[]>([]);
	let thumbs = $state<string[]>([]);

	/**
	 * The grid shows the first of them and nothing more. A thousand object URLs
	 * is a thousand decoded images held in the tab at once, which is the same
	 * cliff the frame cap exists to keep away from, and nobody inspects the
	 * nine hundredth thumbnail anyway.
	 */
	const THUMB_LIMIT = 60;

	const baseName = $derived(file ? file.name.replace(/\.[^.]+$/, '') : 'video');
	const info = $derived(FRAME_FORMATS[format]);
	/**
	 * Thumbnails in the clip's own shape. A fixed 16:9 with `cover` cut a phone
	 * recording down to a strip across its middle.
	 */
	const thumbRatio = $derived(
		media.width && media.height ? `${media.width} / ${media.height}` : undefined
	);

	const expected = $derived(
		frameCount({ rate, everyFrame }, media.duration || null, media.fps || null)
	);
	const tooMany = $derived(tooManyFrames(expected));

	/**
	 * Off for the whole run, not only the encode. It used to come back on while
	 * the engine downloaded, so a second press started a second run.
	 */
	const busy = $derived(stage === 'loading' || stage === 'reading' || stage === 'working');
	const ready = $derived(Boolean(file) && expected > 0 && !tooMany && !busy);

	function onfiles(list: File[]) {
		const next = list[0];
		if (!next) return;
		startOver();
		file = next;
		previewUrl = URL.createObjectURL(next);
	}

	function onLoadedMetadata() {
		if (!video) return;
		// A browser that can decode the sound but not the picture drops the
		// picture without an error, so the clip loads with no size at all. That
		// is the same dead end as a clip it can't play, with the same way out.
		if (!(video.videoWidth > 0 && video.videoHeight > 0)) {
			void onPreviewFailed();
			return;
		}
		media = {
			width: video.videoWidth,
			height: video.videoHeight,
			duration: Number.isFinite(video.duration) ? video.duration : 0,
			// The element will not say what the frame rate is, so the every-frame
			// count leans on the probe once a run starts. 25 is the stand-in
			// until then, and the readout says it is an estimate.
			fps: 0
		};
		// A WebM from MediaRecorder has no length in its header, so the element
		// says Infinity and this sat on "Reading the clip" for ever, the same
		// dead end with a different cause.
		if (!media.duration) void findLength(video);
	}

	/** Seeking past the end makes the browser read to the last frame and say. */
	async function findLength(el: HTMLVideoElement) {
		const forUrl = previewUrl;
		const found = await learnDuration(el);
		if (found && previewUrl === forUrl) media.duration = found;
	}

	/** A length the browser only finds later, by playing to the end. */
	function onDurationChange() {
		if (!video || !media.width) return;
		const length = video.duration;
		if (Number.isFinite(length) && length > 0 && length !== media.duration) media.duration = length;
	}

	function forgetStill() {
		if (still) URL.revokeObjectURL(still);
		still = null;
		unreadable = null;
	}

	/**
	 * The browser can't play the clip. The length and size came from the
	 * preview alone, so this used to be a dead end: "Reading the clip" for
	 * ever and the button off, for the HEVC an iPhone records in any browser
	 * without HEVC, and for AVI everywhere. ffmpeg reads both, so it is asked
	 * for the first frame and the clip's numbers instead, the way the phone
	 * frame does it. The engine is the one the run needs anyway, so its
	 * download is only brought forward, and the probe gives the real frame
	 * rate, so "every frame" stops being an estimate as well.
	 *
	 * Every await is followed by a check that the file is still the one this
	 * started for, since Start over or a new file can land in between.
	 */
	async function onPreviewFailed() {
		if (previewFailed || !file) return;
		previewFailed = true;
		const forFile = file;
		error = null;
		// One stage for the whole of it, download included. `loading` belongs to
		// a run, and would label the button "Working" before anyone pressed it.
		stage = 'reading';
		fetching = !isLoaded();
		let ff: Awaited<ReturnType<typeof loadFfmpeg>>;
		try {
			ff = await loadFfmpeg((p) => (download = p));
		} catch {
			if (file !== forFile) return;
			fetching = false;
			unreadable =
				"The video engine didn't load, so this clip can't be read. Check the connection and try again.";
			stage = 'idle';
			return;
		}
		if (file !== forFile) return;
		fetching = false;
		try {
			const { blob, probe } = await readStill(ff, forFile);
			const url = URL.createObjectURL(blob);
			const image = new Image();
			image.src = url;
			await image.decode();
			if (file !== forFile) {
				URL.revokeObjectURL(url);
				return;
			}
			still = url;
			// The still's own size, since it went through the same decoder and
			// rotation as the frames will.
			media = {
				width: image.naturalWidth,
				height: image.naturalHeight,
				duration: probe.durationSeconds ?? 0,
				fps: probe.fps ?? 0
			};
		} catch {
			if (file !== forFile) return;
			unreadable =
				"Neither this browser nor the video engine can read that file, so there are no frames to take.";
		}
		stage = 'idle';
	}

	/** Set by the cancel button, so the run that throws next isn't an error. */
	let cancelled = false;

	/**
	 * Stop a run. ffmpeg.wasm can't interrupt one, so this ends the worker it
	 * runs in, and the next run starts a new one out of the browser's cache.
	 */
	function cancelRun() {
		if (stage !== 'working') return;
		cancelled = true;
		resetFfmpeg();
	}

	async function run() {
		if (!file || !ready) return;
		error = null;
		cancelled = false;
		readBack = 0;
		workRatio = 0;
		stage = isLoaded() ? 'working' : 'loading';
		try {
			const ff = await loadFfmpeg((p) => (download = p));
			stage = 'working';
			const result = await extractFrames(
				ff,
				file,
				{ format, rate, everyFrame, quality },
				{ onProgress: (r) => (workRatio = r), onFrame: (n) => (readBack = n) }
			);
			releaseThumbs();
			frames = result.frames;
			thumbs = frames.slice(0, THUMB_LIMIT).map((f) => URL.createObjectURL(f.blob));
			media = { ...media, fps: result.probe.fps ?? media.fps };
			stage = 'done';
		} catch (thrown) {
			if (cancelled) {
				// Not an error, and the settings are all still there to change.
				stage = 'idle';
				workRatio = 0;
				readBack = 0;
				return;
			}
			error = thrown instanceof Error ? thrown.message : 'Those frames could not be read';
			stage = 'error';
		}
	}

	async function downloadZip() {
		if (!frames.length) return;
		zipping = true;
		try {
			const entries = frames.map((f, i) => ({
				name: frameName(baseName, i, info.extension),
				data: f.data
			}));
			downloadBlob(zipBlobs(entries), editedFileName(baseName, tool.suffix, '.zip'));
		} finally {
			zipping = false;
		}
	}

	function releaseThumbs() {
		for (const url of thumbs) URL.revokeObjectURL(url);
		thumbs = [];
	}

	function startOver() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		releaseThumbs();
		forgetStill();
		previewUrl = null;
		previewFailed = false;
		fetching = false;
		file = null;
		frames = [];
		error = null;
		stage = 'idle';
		workRatio = 0;
		readBack = 0;
		// The last clip's numbers must not outlive it. A new clip the browser
		// can't play used to inherit them, and the button offered a count for
		// a file nobody had measured.
		media = { width: 0, height: 0, duration: 0, fps: 0 };
	}

	/** A rough size, so nobody starts a run that will not fit. */
	const weight = $derived.by(() => {
		if (!media.width || !expected) return null;
		const pixels = media.width * media.height;
		// Measured rather than guessed at: a 1080p JPG at q4 landed near 300KB
		// and the same frame as PNG near six times that. The standard Huffman
		// tables `planFrames` asks for add 14 to 19% to the JPG.
		const per = info.lossy ? pixels * 0.17 : pixels * 0.9;
		return expected * per;
	});

	const humanWeight = $derived.by(() => {
		if (!weight) return null;
		if (weight > 1024 ** 3) return `${(weight / 1024 ** 3).toFixed(1)} GB`;
		// Under a megabyte it has to say KB rather than round down to "0 MB",
		// which reads as "this will produce nothing".
		if (weight < 1024 ** 2) return `${Math.max(1, Math.round(weight / 1024))} KB`;
		return `${Math.round(weight / 1024 ** 2)} MB`;
	});

	$effect(() => () => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		if (still) URL.revokeObjectURL(still);
		releaseThumbs();
	});
</script>

<div class="panel">
	{#if !file}
		<Dropzone headline="Drop a video here" multiple={false} accept={videoAcceptAttribute()} {onfiles} />
		<p class="note">
			One file at a time. The frames are pulled out on your own device, so nothing is uploaded
			and there's no size limit beyond what your browser can hold.
		</p>
	{/if}

	{#if file && previewUrl}
		<div class="stage">
			<div class="viewer">
				{#if still}
					<!-- What ffmpeg read, since the browser couldn't play the clip. -->
					<img class="preview" src={still} alt="First frame of {file.name}" />
				{:else if previewFailed}
					<!-- A dead player with a 0:00 on it would promise a video that won't play. -->
					<div class="preview blank" aria-hidden="true"></div>
				{:else}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						class="preview"
						bind:this={video}
						src={previewUrl}
						controls
						playsinline
						onloadedmetadata={onLoadedMetadata}
						ondurationchange={onDurationChange}
						onerror={() => void onPreviewFailed()}
					></video>
				{/if}
				<p class="meta mono">
					{file.name}
					{#if media.width}· {media.width}×{media.height}{/if}
					{#if media.duration}· {media.duration.toFixed(1)}s{/if}
					{#if media.fps}· {media.fps} fps{/if}
				</p>
				{#if still}
					<p class="note">
						This browser can't play the clip, so here's its first frame instead. The frames come
						from the video engine, so they're not affected.
					</p>
				{/if}
			</div>

			<div class="controls">
				<div class="field">
					<span>Save frames as</span>
					<div class="row">
						{#each Object.values(FRAME_FORMATS) as f (f.id)}
							<button class="chip" class:on={format === f.id} onclick={() => (format = f.id)}>
								{f.label}
							</button>
						{/each}
					</div>
				</div>

				<label class="check">
					<input type="checkbox" bind:checked={everyFrame} />
					<span>Every frame in the clip</span>
				</label>

				{#if !everyFrame}
					<SliderField
						label="Frames a second"
						bind:value={rate}
						min={FRAME_RATE_MIN}
						max={30}
						step={0.05}
						decimals={2}
					/>
					<div class="row">
						{#each [0.2, 0.5, 1, 2, 5] as preset (preset)}
							<button class="chip" class:on={rate === preset} onclick={() => (rate = preset)}>
								{preset < 1 ? `1 every ${Math.round(1 / preset)}s` : `${preset}/s`}
							</button>
						{/each}
					</div>
				{/if}

				{#if info.lossy}
					<!-- ffmpeg's own scale, where lower is better, so the label says
					     which way is up rather than leaving it to be discovered. -->
					<SliderField
						label="JPG quality (2 is best)"
						bind:value={quality}
						min={FRAME_QUALITY_MIN}
						max={FRAME_QUALITY_MAX}
					/>
				{/if}

				{#if unreadable}
					<p class="err" role="alert">{unreadable}</p>
				{:else}
					<p class="hint" class:warn={tooMany}>
						{#if !media.duration}
							{#if still}
								The video engine can't tell how long this clip is, so there's no count of frames
								to take.
							{:else if previewFailed}
								This browser can't play the clip, so the video engine is reading it instead.
							{:else}
								Reading the clip…
							{/if}
						{:else if tooMany}
							That's about {expected.toLocaleString()} images, past the limit of
							{FRAME_MAX.toLocaleString()}. Lower the rate, or trim the clip first.
						{:else}
							About {expected.toLocaleString()}
							{expected === 1 ? 'image' : 'images'}{#if humanWeight}, roughly {humanWeight}{/if}.
							{#if everyFrame && !media.fps}
								Every frame is an estimate until the clip is read, since the browser won't say
								what its frame rate is.
							{/if}
							{#if expected > FRAME_MANY}
								That many takes a while and holds a lot of memory.
							{/if}
						{/if}
					</p>
				{/if}

				{#if busy}
					<p class="hint" role="status">
						{#if stage === 'loading' || fetching}
							Fetching the video engine{#if download.ratio !== null}, {Math.round(download.ratio * 100)}%{/if}…
						{:else if stage === 'reading'}
							Reading the first frame…
						{:else if readBack}
							Read {readBack} of about {expected}…
						{:else}
							Pulling frames, {Math.round(workRatio * 100)}%…
						{/if}
					</p>
				{/if}

				{#if error}
					<p class="err" role="alert">{error}</p>
				{/if}

				<div class="row">
					<button class="btn" onclick={run} disabled={!ready}>
						{stage === 'working' || stage === 'loading' ? 'Working…' : 'Extract frames'}
					</button>
					{#if stage === 'working'}
						<button class="btn-ghost" onclick={cancelRun}>Cancel</button>
					{:else}
						<button class="btn-ghost" onclick={startOver}>Start over</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if stage === 'done' && frames.length}
		<div class="result">
			<div class="result-head">
				<p class="mono">
					{frames.length}
					{frames.length === 1 ? 'frame' : 'frames'} · {info.label}
					{#if media.width}· {media.width}×{media.height}{/if}
				</p>
				<button class="btn" onclick={downloadZip} disabled={zipping}>
					{zipping ? 'Zipping…' : `Download all ${frames.length} as zip`}
				</button>
			</div>

			<ul class="grid">
				{#each thumbs as url, i (url)}
					<li>
						<button
							type="button"
							onclick={() => downloadBlob(frames[i].blob, frameName(baseName, i, info.extension))}
							title="Save {frameName(baseName, i, info.extension)}"
						>
							<img
								src={url}
								alt="Frame {i + 1}"
								loading="lazy"
								style:aspect-ratio={thumbRatio}
							/>
							<span class="mono">{i + 1}</span>
						</button>
					</li>
				{/each}
			</ul>

			{#if frames.length > thumbs.length}
				<p class="hint">
					Showing the first {thumbs.length}. The zip has all {frames.length}.
				</p>
			{:else}
				<p class="hint">Click any frame to save it on its own.</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.note,
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 68ch;
		text-wrap: pretty;
	}

	.warn {
		color: var(--danger);
	}

	.err {
		margin: 0;
		font-size: 0.875rem;
		color: var(--danger);
	}

	.stage {
		display: grid;
		gap: 1rem;
		grid-template-columns: minmax(0, 1.4fr) minmax(16rem, 1fr);
		align-items: start;
	}

	@media (max-width: 46rem) {
		.stage {
			grid-template-columns: 1fr;
		}
	}

	.viewer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	/*
	 * Held to a height the screen can take. A phone recording is twice as tall
	 * as it is wide, and at the column's full width it pushed the controls
	 * under it, on a narrow screen, more than a screen away from the clip.
	 */
	.preview {
		display: block;
		width: 100%;
		max-height: min(70vh, 40rem);
		object-fit: contain;
		border-radius: var(--r-s);
		background: var(--surface-deep);
	}

	/* One column puts the controls under the clip, where it only has to be recognisable. */
	@media (max-width: 46rem) {
		.preview {
			max-height: 45vh;
		}
	}

	.blank {
		aspect-ratio: 16 / 9;
	}

	.meta {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}

	.chip {
		font: inherit;
		font-size: 0.8125rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		background: var(--surface);
		color: var(--ink);
		cursor: pointer;
	}

	.chip.on {
		border-color: var(--primary);
		color: var(--primary);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.8125rem;
	}

	.result {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border-top: 1px solid var(--line);
		padding-top: 1rem;
	}

	.result-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.result-head p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 0.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.grid button {
		position: relative;
		display: block;
		width: 100%;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--surface);
		cursor: pointer;
		overflow: hidden;
	}

	.grid button:hover {
		border-color: var(--primary);
	}

	.grid img {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
	}

	.grid span {
		position: absolute;
		left: 0.25rem;
		bottom: 0.25rem;
		padding: 0.05rem 0.3rem;
		border-radius: 3px;
		font-size: 0.6875rem;
		/* Over a photograph, so the chip carries its own contrast rather than
		   hoping the frame underneath is dark. */
		background: rgb(0 0 0 / 0.65);
		color: #fff;
	}

	.mono {
		font-family: var(--font-mono);
	}
</style>
