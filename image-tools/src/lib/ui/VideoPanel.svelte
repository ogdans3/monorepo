<script lang="ts">
	import { formatBytes, outputFileName, resolveFormat } from '$lib/engine';
	import { videoAcceptAttribute, type VideoFormat } from '$lib/video/formats';
	import { convertVideo, isLoaded, loadFfmpeg, type LoadProgress } from '$lib/video/ffmpeg';
	import { downloadBlob } from './download';
	import Dropzone from './Dropzone.svelte';

	let {
		target,
		targetExt,
		sourceName
	}: {
		target: VideoFormat;
		targetExt?: string;
		/** The page's nominal source, for labels. Anything readable converts. */
		sourceName?: string;
	} = $props();

	type Stage = 'idle' | 'loading' | 'working' | 'done' | 'error';

	let stage = $state<Stage>('idle');
	let download = $state<LoadProgress>({ ratio: null, loadedBytes: 0, totalBytes: null });
	let workRatio = $state(0);
	let error = $state<string | null>(null);
	let file = $state<File | null>(null);
	let result = $state<{ blob: Blob; name: string; streamCopy: boolean } | null>(null);
	let elapsed = $state(0);
	let ticker: ReturnType<typeof setInterval> | null = null;

	const outName = $derived(
		file ? outputFileName(file.name, targetExt ?? target.extensions[0]) : ''
	);
	const saving = $derived(
		result && file ? Math.round((1 - result.blob.size / file.size) * 100) : 0
	);

	function startClock() {
		elapsed = 0;
		ticker = setInterval(() => (elapsed += 1), 1000);
	}

	function stopClock() {
		if (ticker) clearInterval(ticker);
		ticker = null;
	}

	/**
	 * A still picture dropped here is the common mistake, and ffmpeg does not
	 * consider it one: it reads a JPEG perfectly well and will hand back a
	 * video one frame long. Better to notice and point at the right page than
	 * to spend a 7MB download producing something nobody wanted.
	 */
	function imageMistake(dropped: File): boolean {
		const ext = dropped.name.slice(dropped.name.lastIndexOf('.'));
		const format = resolveFormat(ext);
		return Boolean(format) || dropped.type.startsWith('image/');
	}

	async function onfiles(files: File[]) {
		const dropped = files[0];
		if (!dropped) return;

		if (imageMistake(dropped)) {
			file = null;
			result = null;
			stage = 'error';
			error = `That looks like a picture rather than a video. The image converter handles it.`;
			return;
		}

		file = dropped;
		result = null;
		error = null;
		workRatio = 0;

		try {
			stage = isLoaded() ? 'working' : 'loading';
			const ff = await loadFfmpeg((p) => (download = p));
			stage = 'working';
			startClock();
			const converted = await convertVideo(ff, dropped, target, {
				onProgress: (r) => (workRatio = r)
			});
			result = {
				blob: converted.blob,
				name: outputFileName(dropped.name, targetExt ?? target.extensions[0]),
				streamCopy: converted.streamCopy
			};
			stage = 'done';
		} catch (e) {
			// ffmpeg rejects with plain strings and with numbers as well as with
			// Errors, and "something went wrong" helps nobody work out whether
			// their file is the problem or we are.
			const detail = e instanceof Error ? e.message : String(e);
			error = detail || 'That file could not be converted';
			console.error('video conversion failed', e);
			stage = 'error';
		} finally {
			stopClock();
		}
	}

	function startOver() {
		file = null;
		result = null;
		error = null;
		stage = 'idle';
		workRatio = 0;
	}

	$effect(() => () => stopClock());
</script>

<div class="panel">
	{#if stage === 'idle' || stage === 'error'}
		<Dropzone
			headline={sourceName ? `Drop a ${sourceName} file here` : 'Drop a video here'}
			multiple={false}
			accept={videoAcceptAttribute()}
			{onfiles}
		/>
		<p class="note">
			One file at a time. The video is converted on your own device, so nothing is uploaded and
			there is no size limit beyond what your browser can hold.
		</p>
	{/if}

	{#if stage === 'loading'}
		<div class="working" role="status">
			<p class="working-title">Getting the video engine</p>
			<div class="bar"><div class="fill" style:width="{(download.ratio ?? 0) * 100}%"></div></div>
			<p class="working-note">
				{#if download.totalBytes}
					{formatBytes(download.loadedBytes)} of {formatBytes(download.totalBytes)}
				{:else}
					{formatBytes(download.loadedBytes)} so far
				{/if}
				· This is a one time download of about 7MB. Your browser keeps it, so the next video
				starts straight away.
			</p>
		</div>
	{/if}

	{#if stage === 'working'}
		<div class="working" role="status">
			<p class="working-title">Converting {file?.name}</p>
			<div class="bar"><div class="fill" style:width="{workRatio * 100}%"></div></div>
			<p class="working-note">
				{Math.round(workRatio * 100)}% · {elapsed}s
			</p>
		</div>
	{/if}

	{#if stage === 'error' && error}
		<p class="error" role="alert">
			{error}
			{#if error.includes('picture')}
				<a href="/convert">Convert an image instead</a>.
			{/if}
		</p>
	{/if}

	{#if stage === 'done' && result && file}
		<div class="result">
			<div class="result-main">
				<span class="result-name mono">{result.name}</span>
				<span class="result-meta">
					{formatBytes(file.size)} <span class="arrow">→</span> {formatBytes(result.blob.size)}
					{#if saving > 0}<span class="pill">−{saving}%</span>{/if}
					<span class="dim">· {elapsed}s</span>
				</span>
				{#if result.streamCopy}
					<span class="result-note">
						Copied without re-encoding, so every frame is identical to the original.
					</span>
				{/if}
			</div>
			<div class="result-actions">
				<button class="btn" onclick={() => downloadBlob(result!.blob, result!.name)}>
					Download
				</button>
				<button class="btn-ghost" onclick={startOver}>Convert another</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.note {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 60ch;
	}

	.working {
		background: var(--surface);
		border-radius: var(--r-m);
		padding: 1.1rem 1.15rem;
	}

	.working-title {
		margin: 0 0 0.6rem;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.bar {
		height: 6px;
		border-radius: 99px;
		background: var(--surface-deep);
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--primary);
		border-radius: 99px;
		transition: width 200ms var(--ease);
	}

	.working-note {
		margin: 0.55rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 60ch;
	}

	.result {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		padding: 0.85rem 1rem;
		background: var(--surface);
		border-radius: var(--r-m);
	}

	.result-main {
		min-width: 0;
	}

	.result-name {
		display: block;
		font-size: 0.9375rem;
	}

	.result-meta,
	.result-note {
		display: block;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.result-note {
		margin-top: 0.2rem;
	}

	.pill {
		color: var(--accent);
		font-weight: 600;
	}

	.dim {
		color: var(--muted);
	}

	.result-actions {
		display: flex;
		gap: 0.5rem;
	}

	.error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}
</style>
