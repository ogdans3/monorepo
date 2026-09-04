<script lang="ts">
	import { editedFileName, formatBytes, resolveFormat } from '$lib/engine';
	import { resolveVideoFormat, videoAcceptAttribute, VIDEO_FORMATS } from '$lib/video/formats';
	import { isLoaded, lastFfmpegLines, loadFfmpeg, mergeVideos, type LoadProgress } from '$lib/video/ffmpeg';
	import type { VideoTool } from '$lib/video/tools';
	import { downloadBlob } from './download';
	import Dropzone from './Dropzone.svelte';

	/**
	 * The join, which needs a panel of its own.
	 *
	 * `VideoToolPanel` is built around one file: one preview element, one probe,
	 * one set of controls bound to it. Every assumption in it is singular, and
	 * threading a list through would leave nine tools carrying a shape only the
	 * tenth uses. This is the same split the PDF merge editor already makes on
	 * the image side.
	 *
	 * The one control here is order, so the list is the interface.
	 */
	let { tool }: { tool: VideoTool } = $props();

	type Stage = 'idle' | 'loading' | 'working' | 'done' | 'error';

	interface Item {
		id: number;
		file: File;
	}

	let nextId = 1;
	let items = $state<Item[]>([]);
	let stage = $state<Stage>('idle');
	let download = $state<LoadProgress>({ ratio: null, loadedBytes: 0, totalBytes: null });
	let workRatio = $state(0);
	let error = $state<string | null>(null);
	let elapsed = $state(0);
	let ticker: ReturnType<typeof setInterval> | null = null;
	let ffmpegSaid = $state<string[]>([]);

	let result = $state<{
		blob: Blob;
		name: string;
		framesIntact: boolean;
		silenceAdded: boolean;
	} | null>(null);

	const totalBytes = $derived(items.reduce((sum, item) => sum + item.file.size, 0));

	/** The first clip decides the container, the same way it decides the frame. */
	const target = $derived.by(() => {
		const first = items[0]?.file;
		if (!first) return VIDEO_FORMATS.mp4;
		const ext = first.name.slice(first.name.lastIndexOf('.'));
		return resolveVideoFormat(ext.replace('.', '')) ?? VIDEO_FORMATS.mp4;
	});

	const outName = $derived(
		items[0] ? editedFileName(items[0].file.name, tool.suffix, target.extensions[0]) : ''
	);

	const ready = $derived(items.length >= 2);

	function imageMistake(dropped: File): boolean {
		const ext = dropped.name.slice(dropped.name.lastIndexOf('.'));
		return Boolean(resolveFormat(ext)) || dropped.type.startsWith('image/');
	}

	function onfiles(files: File[]) {
		const pictures = files.filter(imageMistake);
		if (pictures.length) {
			error = 'Those look like pictures rather than videos. The image tools handle them.';
			stage = 'error';
			return;
		}
		error = null;
		result = null;
		for (const file of files) items.push({ id: nextId++, file });
		stage = 'idle';
	}

	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= items.length) return;
		[items[i], items[j]] = [items[j], items[i]];
	}

	function remove(i: number) {
		items.splice(i, 1);
		result = null;
	}

	function startClock() {
		elapsed = 0;
		ticker = setInterval(() => (elapsed += 1), 1000);
	}

	function stopClock() {
		if (ticker) clearInterval(ticker);
		ticker = null;
	}

	async function run() {
		if (!ready) return;
		error = null;
		stage = isLoaded() ? 'working' : 'loading';
		startClock();
		try {
			const ff = await loadFfmpeg((p) => (download = p));
			stage = 'working';
			const merged = await mergeVideos(
				ff,
				items.map((item) => item.file),
				target,
				{ onProgress: (r) => (workRatio = r) }
			);
			result = {
				blob: merged.blob,
				name: outName,
				framesIntact: merged.framesIntact,
				silenceAdded: merged.silenceAdded
			};
			ffmpegSaid = lastFfmpegLines(12);
			stage = 'done';
		} catch (thrown) {
			const detail = thrown instanceof Error ? thrown.message : '';
			error = detail || 'Those videos could not be joined';
			stage = 'error';
		} finally {
			stopClock();
		}
	}

	function startOver() {
		items = [];
		result = null;
		error = null;
		stage = 'idle';
		workRatio = 0;
	}

	$effect(() => () => stopClock());
</script>

<div class="panel">
	{#if stage !== 'done'}
		<Dropzone
			headline={items.length ? 'Add more videos' : 'Drop two or more videos here'}
			multiple={true}
			accept={videoAcceptAttribute()}
			{onfiles}
		/>
	{/if}

	{#if items.length && stage !== 'done'}
		<ol class="rows">
			{#each items as item, i (item.id)}
				<li class="row">
					<span class="pos mono">{i + 1}</span>
					<span class="name mono" title={item.file.name}>{item.file.name}</span>
					<span class="meta mono">{formatBytes(item.file.size)}</span>
					<span class="actions">
						<button
							class="cell-btn"
							aria-label="Move {item.file.name} earlier"
							disabled={i === 0}
							onclick={() => move(i, -1)}>↑</button
						>
						<button
							class="cell-btn"
							aria-label="Move {item.file.name} later"
							disabled={i === items.length - 1}
							onclick={() => move(i, 1)}>↓</button
						>
						<button class="cell-btn" aria-label="Remove {item.file.name}" onclick={() => remove(i)}
							>×</button
						>
					</span>
				</li>
			{/each}
		</ol>

		<p class="hint">
			{items.length}
			{items.length === 1 ? 'video' : 'videos'}, {formatBytes(totalBytes)} in total. They play in
			this order, and the first one decides the size and shape of the result.
		</p>

		{#if stage === 'idle' || stage === 'error'}
			<button class="btn" onclick={run} disabled={!ready}>
				{ready ? 'Merge' : 'Add one more video'}
			</button>
			<p class="hint">
				Clips that already match are copied and it's over in about a second. Clips that don't have
				to be rebuilt, which takes roughly as long as they run.
			</p>
		{/if}
	{/if}

	{#if !items.length && stage !== 'done'}
		<p class="note">
			Two or more files. They're joined on your own device, so nothing is uploaded and there's no
			size limit beyond what your browser can hold.
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
				· This is a one time download of about 7MB. Your browser keeps it, so the next video starts
				straight away.
			</p>
		</div>
	{/if}

	{#if stage === 'working'}
		<div class="working" role="status">
			<p class="working-title">Joining {items.length} videos</p>
			<div class="bar"><div class="fill" style:width="{workRatio * 100}%"></div></div>
			<p class="working-note">{Math.round(workRatio * 100)}% · {elapsed}s</p>
		</div>
	{/if}

	{#if stage === 'error' && error}
		<p class="error" role="alert">
			{error}
			{#if error.includes('pictures')}<a href="/tools">Use the image tools instead</a>.{/if}
		</p>
	{/if}

	{#if stage === 'done' && result}
		<div class="result">
			<div class="result-main">
				<span class="result-name mono">{result.name}</span>
				<span class="result-meta">
					{items.length} videos <span class="arrow">→</span>
					{formatBytes(result.blob.size)}
					<span class="dim">· {elapsed}s</span>
				</span>
				{#if result.framesIntact}
					<span class="result-note">
						The clips already matched, so they were copied without being decoded. Every frame is
						identical to the original.
					</span>
				{/if}
				{#if result.silenceAdded}
					<span class="result-note">
						One of the clips had no sound, so it was given a silent track of its own length rather
						than dropping the audio from the others.
					</span>
				{/if}
			</div>
			<p class="ffmpeg-log" data-testid="ffmpeg-log" hidden>{ffmpegSaid.join('\n')}</p>
			<div class="result-actions">
				<button class="btn" onclick={() => downloadBlob(result!.blob, result!.name)}>Download</button
				>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
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

	.note,
	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 60ch;
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	/*
	 * Rows separated by a rule rather than boxed as cards. A list of files in an
	 * order is a list, and eight bordered boxes would be eight things competing
	 * with the order, which is the only thing here that matters.
	 */
	.row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.2rem;
		border-bottom: 1px solid var(--line);
		font-size: 0.875rem;
	}

	.pos {
		color: var(--muted);
		min-width: 1.4rem;
		font-variant-numeric: tabular-nums;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		color: var(--muted);
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		gap: 0.15rem;
	}

	/* 44px of target, because a row of arrows is exactly what a thumb misses. */
	.cell-btn {
		font: inherit;
		min-width: 44px;
		min-height: 44px;
		border: 1px solid transparent;
		border-radius: var(--r-s);
		background: none;
		color: var(--ink);
		cursor: pointer;
		line-height: 1;
	}

	.cell-btn:hover:not(:disabled) {
		border-color: var(--line);
		background: var(--surface);
	}

	.cell-btn:disabled {
		color: var(--muted);
		opacity: 0.4;
		cursor: default;
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
