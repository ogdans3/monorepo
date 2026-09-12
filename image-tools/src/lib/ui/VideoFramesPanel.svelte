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
	import { extractFrames, isLoaded, loadFfmpeg, type LoadProgress } from '$lib/video/ffmpeg';
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

	let { tool }: { tool: VideoTool } = $props();

	type Stage = 'idle' | 'loading' | 'working' | 'done' | 'error';

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

	const expected = $derived(
		frameCount({ rate, everyFrame }, media.duration || null, media.fps || null)
	);
	const tooMany = $derived(tooManyFrames(expected));

	const ready = $derived(Boolean(file) && expected > 0 && !tooMany && stage !== 'working');

	function onfiles(list: File[]) {
		const next = list[0];
		if (!next) return;
		startOver();
		file = next;
		previewUrl = URL.createObjectURL(next);
	}

	function onLoadedMetadata() {
		if (!video) return;
		media = {
			width: video.videoWidth,
			height: video.videoHeight,
			duration: Number.isFinite(video.duration) ? video.duration : 0,
			// The element will not say what the frame rate is, so the every-frame
			// count leans on the probe once a run starts. 25 is the stand-in
			// until then, and the readout says it is an estimate.
			fps: 0
		};
	}

	async function run() {
		if (!file || !ready) return;
		error = null;
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
		previewUrl = null;
		file = null;
		frames = [];
		error = null;
		stage = 'idle';
		workRatio = 0;
		readBack = 0;
	}

	/** A rough size, so nobody starts a run that will not fit. */
	const weight = $derived.by(() => {
		if (!media.width || !expected) return null;
		const pixels = media.width * media.height;
		// Measured rather than guessed at: a 1080p JPG at q4 lands near 300KB
		// and the same frame as PNG near six times that.
		const per = info.lossy ? pixels * 0.15 : pixels * 0.9;
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
				<!-- svelte-ignore a11y_media_has_caption -->
				<video bind:this={video} src={previewUrl} controls playsinline onloadedmetadata={onLoadedMetadata}
				></video>
				<p class="meta mono">
					{file.name}
					{#if media.width}· {media.width}×{media.height}{/if}
					{#if media.duration}· {media.duration.toFixed(1)}s{/if}
				</p>
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

				<p class="hint" class:warn={tooMany}>
					{#if !media.duration}
						Reading the clip…
					{:else if tooMany}
						That's about {expected.toLocaleString()} images, past the limit of
						{FRAME_MAX.toLocaleString()}. Lower the rate, or trim the clip first.
					{:else}
						About {expected.toLocaleString()}
						{expected === 1 ? 'image' : 'images'}{#if humanWeight}, roughly {humanWeight}{/if}.
						{#if everyFrame}
							Every frame is an estimate until the clip is read, since the browser won't say
							what its frame rate is.
						{/if}
						{#if expected > FRAME_MANY}
							That many takes a while and holds a lot of memory.
						{/if}
					{/if}
				</p>

				{#if stage === 'loading' || stage === 'working'}
					<p class="hint" role="status">
						{#if stage === 'loading'}
							Fetching the video engine{#if download.ratio !== null}, {Math.round(download.ratio * 100)}%{/if}…
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
					<button class="btn-ghost" onclick={startOver}>Start over</button>
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
							<img src={url} alt="Frame {i + 1}" loading="lazy" />
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

	video {
		width: 100%;
		border-radius: var(--r-s);
		background: var(--surface-deep);
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
