<script lang="ts">
	import { editedFileName, formatBytes, resolveFormat } from '$lib/engine';
	import { resolveVideoFormat, videoAcceptAttribute, VIDEO_FORMATS } from '$lib/video/formats';
	import { editVideo, isLoaded, lastFfmpegLines, loadFfmpeg, type LoadProgress } from '$lib/video/ffmpeg';
	import { BLUR_MAX, BLUR_MIN, evenSize, type EditOp, type TextPosition } from '$lib/video/edit';
	import type { VideoTool } from '$lib/video/tools';
	import { downloadBlob } from './download';
	import Dropzone from './Dropzone.svelte';

	let { tool }: { tool: VideoTool } = $props();

	type Stage = 'idle' | 'loading' | 'working' | 'done' | 'error';

	let stage = $state<Stage>('idle');
	let download = $state<LoadProgress>({ ratio: null, loadedBytes: 0, totalBytes: null });
	let workRatio = $state(0);
	let error = $state<string | null>(null);
	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let result = $state<{ blob: Blob; name: string; framesIntact: boolean } | null>(null);
	let elapsed = $state(0);
	let ticker: ReturnType<typeof setInterval> | null = null;
	/** The tail of ffmpeg's own log, rendered for screen readers only. */
	let ffmpegSaid = $state<string[]>([]);

	/** Read off the preview element, which knows before ffmpeg does. */
	let media = $state({ width: 0, height: 0, duration: 0 });
	let video = $state<HTMLVideoElement>();

	/* ---- the settings, one group per tool -------------------------------- */
	let startSeconds = $state(0);
	let endSeconds = $state(0);
	let exactTrim = $state(false);

	let cropBox = $state({ x: 0, y: 0, w: 1, h: 1 });
	/** Where the crop preview is paused, since it has no controls of its own. */
	let scrubAt = $state(0);

	let resizeWidth = $state(1280);
	let speedFactor = $state(2);
	let fps = $state(30);
	// Starts at zero, so the page opens showing the video the way it arrived.
	// A default of one turn meant the preview was already on its side before
	// anybody had asked for anything.
	let quarterTurns = $state(0);
	let flipHorizontal = $state(false);
	let flipVertical = $state(false);
	let blurStrength = $state(8);
	let quality = $state(28);

	let text = $state('');
	let textSize = $state(48);
	let textColour = $state('#ffffff');
	let textPosition = $state<TextPosition>('bottom');
	let textBox = $state(true);

	/** The container the file arrived in, so an edit gives back the same kind. */
	const target = $derived.by(() => {
		if (!file) return VIDEO_FORMATS.mp4;
		const ext = file.name.slice(file.name.lastIndexOf('.'));
		return resolveVideoFormat(ext.replace('.', '')) ?? VIDEO_FORMATS.mp4;
	});

	const outName = $derived(
		file ? editedFileName(file.name, tool.suffix, target.extensions[0]) : ''
	);

	const saving = $derived(
		result && file ? Math.round((1 - result.blob.size / file.size) * 100) : 0
	);

	/**
	 * The crop frame in real pixels, from the fractions the overlay works in.
	 * Rounded to even numbers here as well as in the plan, so the readout says
	 * what the file will actually be rather than a number one off it.
	 */
	const cropPixels = $derived({
		x: Math.round(cropBox.x * media.width),
		y: Math.round(cropBox.y * media.height),
		width: evenSize(cropBox.w * media.width),
		height: evenSize(cropBox.h * media.height)
	});

	const op = $derived.by((): EditOp => {
		switch (tool.op) {
			case 'trim':
				return {
					kind: 'trim',
					startSeconds,
					endSeconds: endSeconds > startSeconds ? endSeconds : null,
					exact: exactTrim
				};
			case 'crop':
				return { kind: 'crop', ...cropPixels };
			case 'resize':
				return { kind: 'resize', width: resizeWidth, height: null };
			case 'speed':
				return { kind: 'speed', factor: speedFactor };
			case 'fps':
				return { kind: 'fps', fps };
			case 'rotate':
				return { kind: 'rotate', quarterTurns, flipHorizontal, flipVertical };
			case 'blur':
				return { kind: 'blur', strength: blurStrength };
			case 'text':
				return { kind: 'text', text, size: textSize, colour: textColour, position: textPosition, box: textBox };
			case 'compress':
				return { kind: 'compress', quality };
			default:
				return { kind: 'mute' };
		}
	});

	/** Nothing to do yet, so the button says so rather than producing a copy. */
	const ready = $derived.by(() => {
		if (!file) return false;
		if (tool.op === 'text') return text.trim().length > 0;
		if (tool.op === 'trim') return startSeconds > 0 || (endSeconds > 0 && endSeconds < media.duration);
		if (tool.op === 'rotate') return quarterTurns % 4 !== 0 || flipHorizontal || flipVertical;
		if (tool.op === 'crop') return cropBox.w < 0.999 || cropBox.h < 0.999;
		return true;
	});

	function startClock() {
		elapsed = 0;
		ticker = setInterval(() => (elapsed += 1), 1000);
	}

	function stopClock() {
		if (ticker) clearInterval(ticker);
		ticker = null;
	}

	/**
	 * A still picture is the common mistake here, and ffmpeg doesn't consider it
	 * one: it reads a JPEG perfectly well and hands back a video one frame long.
	 * Better to notice than to spend a 7MB download on it.
	 */
	function imageMistake(dropped: File): boolean {
		const ext = dropped.name.slice(dropped.name.lastIndexOf('.'));
		return Boolean(resolveFormat(ext)) || dropped.type.startsWith('image/');
	}

	function onfiles(files: File[]) {
		const dropped = files[0];
		if (!dropped) return;
		if (imageMistake(dropped)) {
			error = 'That looks like a picture rather than a video. The image tools handle it.';
			stage = 'error';
			return;
		}
		error = null;
		result = null;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		file = dropped;
		previewUrl = URL.createObjectURL(dropped);
		stage = 'idle';
	}

	/** Defaults that need the file: the whole frame, the whole clip, its width. */
	function onLoadedMetadata() {
		if (!video) return;
		media = {
			width: video.videoWidth,
			height: video.videoHeight,
			duration: Number.isFinite(video.duration) ? video.duration : 0
		};
		cropBox = { x: 0, y: 0, w: 1, h: 1 };
		scrubAt = 0;
		startSeconds = 0;
		endSeconds = media.duration;
		resizeWidth = Math.min(1280, media.width || 1280);
		textSize = Math.max(16, Math.round((media.height || 720) * 0.06));
	}

	async function run() {
		if (!file || !ready) return;
		error = null;
		stage = isLoaded() ? 'working' : 'loading';
		startClock();
		try {
			const ff = await loadFfmpeg((p) => (download = p));
			stage = 'working';
			const edited = await editVideo(ff, file, op, target, {
				// Only the compress tool has a quality control, and its slider was
				// being handed to every other tool as well, so a crop encoded at
				// the compressor's setting rather than the sensible default.
				quality: tool.op === 'compress' ? quality : undefined,
				onProgress: (r) => (workRatio = r)
			});
			result = { blob: edited.blob, name: outName, framesIntact: edited.framesIntact };
			// What ffmpeg said about the run it just finished, so a check in a
			// real browser can see a filter that was refused without erroring.
			ffmpegSaid = lastFfmpegLines(12);
			stage = 'done';
		} catch (thrown) {
			const detail = thrown instanceof Error ? thrown.message : '';
			error = detail || 'That file could not be edited';
			stage = 'error';
		} finally {
			stopClock();
		}
	}

	function startOver() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		file = null;
		result = null;
		error = null;
		stage = 'idle';
		workRatio = 0;
	}

	/* ---- dragging the crop frame ----------------------------------------- */
	let frame = $state<HTMLDivElement>();

	function dragCrop(event: PointerEvent, edge: 'move' | 'nw' | 'ne' | 'sw' | 'se') {
		if (!frame) return;
		event.preventDefault();
		const rect = frame.getBoundingClientRect();
		const start = { ...cropBox };
		const from = { x: event.clientX, y: event.clientY };
		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);

		const move = (e: PointerEvent) => {
			const dx = (e.clientX - from.x) / rect.width;
			const dy = (e.clientY - from.y) / rect.height;
			const next = { ...start };
			if (edge === 'move') {
				next.x = Math.min(Math.max(0, start.x + dx), 1 - start.w);
				next.y = Math.min(Math.max(0, start.y + dy), 1 - start.h);
			} else {
				const west = edge === 'nw' || edge === 'sw';
				const north = edge === 'nw' || edge === 'ne';
				if (west) {
					const x = Math.min(Math.max(0, start.x + dx), start.x + start.w - 0.05);
					next.w = start.w + (start.x - x);
					next.x = x;
				} else {
					next.w = Math.min(Math.max(0.05, start.w + dx), 1 - start.x);
				}
				if (north) {
					const y = Math.min(Math.max(0, start.y + dy), start.y + start.h - 0.05);
					next.h = start.h + (start.y - y);
					next.y = y;
				} else {
					next.h = Math.min(Math.max(0.05, start.h + dy), 1 - start.y);
				}
			}
			cropBox = next;
		};

		const up = () => {
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', up);
		};
		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', up);
	}

	$effect(() => () => {
		stopClock();
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});
</script>

<div class="panel">
	{#if !file}
		<Dropzone headline="Drop a video here" multiple={false} accept={videoAcceptAttribute()} {onfiles} />
		<p class="note">
			One file at a time. The video is edited on your own device, so nothing is uploaded and
			there's no size limit beyond what your browser can hold.
		</p>
	{/if}

	{#if file && previewUrl && stage !== 'done'}
		<div class="stage">
			<div class="viewer">
			<!-- svelte-ignore a11y_media_has_caption -->
			<div class="preview" bind:this={frame}>
				<video
					bind:this={video}
					src={previewUrl}
					controls={tool.op !== 'crop'}
					playsinline
					onloadedmetadata={onLoadedMetadata}
					style:filter={tool.op === 'blur' ? `blur(${blurStrength * 0.6}px)` : undefined}
					style:transform={tool.op === 'rotate'
						? `rotate(${quarterTurns * 90}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`
						: undefined}
				></video>

				{#if tool.op === 'crop' && media.width}
					<div
						class="cropframe"
						role="application"
						aria-label="Crop frame. Drag to move, drag a corner to resize."
						style:left="{cropBox.x * 100}%"
						style:top="{cropBox.y * 100}%"
						style:width="{cropBox.w * 100}%"
						style:height="{cropBox.h * 100}%"
						onpointerdown={(e) => dragCrop(e, 'move')}
					>
						{#each ['nw', 'ne', 'sw', 'se'] as const as corner (corner)}
							<span
								class="handle {corner}"
								role="button"
								tabindex="-1"
								aria-label="Resize from the {corner} corner"
								onpointerdown={(e) => {
									e.stopPropagation();
									dragCrop(e, corner);
								}}
							></span>
						{/each}
					</div>
				{/if}

				{#if tool.op === 'text' && text.trim()}
					<span
						class="caption {textPosition}"
						class:boxed={textBox}
						style:color={textColour}
						style:font-size="{(textSize / (media.height || 720)) * 100}cqh"
					>{text}</span>
				{/if}
			</div>

			{#if tool.op === 'crop' && media.duration}
				<!--
					The native controls are hidden here because the bar sits exactly
					where the two bottom handles are. Picking a frame to judge the
					crop against is all this needs, so it gets a scrubber instead.
				-->
				<label class="scrub">
					<span class="mono">{scrubAt.toFixed(1)}s</span>
					<input
						type="range"
						min="0"
						max={media.duration}
						step="0.1"
						bind:value={scrubAt}
						aria-label="Move through the video"
						oninput={() => video && (video.currentTime = scrubAt)}
					/>
				</label>
			{/if}
			</div>

			<div class="controls">
				{#if tool.op === 'trim'}
					<label class="field">
						<span>Start <output class="mono">{startSeconds.toFixed(1)}s</output></span>
						<input type="range" min="0" max={media.duration} step="0.1" bind:value={startSeconds} />
					</label>
					<label class="field">
						<span>End <output class="mono">{endSeconds.toFixed(1)}s</output></span>
						<input type="range" min="0" max={media.duration} step="0.1" bind:value={endSeconds} />
					</label>
					<label class="check">
						<input type="checkbox" bind:checked={exactTrim} />
						<span>Cut exactly where I set it. Slower, because it re-encodes.</span>
					</label>
					<p class="hint">
						{#if exactTrim}
							The clip is re-encoded so it starts precisely on your mark.
						{:else}
							Cuts on the nearest keyframe, which copies both streams and takes about a second.
						{/if}
					</p>
				{/if}

				{#if tool.op === 'crop'}
					<p class="readout mono">
						{cropPixels.width} × {cropPixels.height} from {cropPixels.x}, {cropPixels.y}
					</p>
					<div class="row">
						{#each [{ label: 'Square', r: 1 }, { label: '16:9', r: 16 / 9 }, { label: '9:16', r: 9 / 16 }, { label: '4:5', r: 4 / 5 }] as preset (preset.label)}
							<button
								class="chip"
								onclick={() => {
									const aspect = (media.width || 1) / (media.height || 1);
									const w = Math.min(1, preset.r / aspect);
									const h = Math.min(1, aspect / preset.r);
									cropBox = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
								}}>{preset.label}</button
							>
						{/each}
						<button class="chip" onclick={() => (cropBox = { x: 0, y: 0, w: 1, h: 1 })}>Whole frame</button>
					</div>
				{/if}

				{#if tool.op === 'resize'}
					<label class="field">
						<span>Width <output class="mono">{resizeWidth}px</output></span>
						<input type="range" min="160" max={Math.max(1920, media.width || 1920)} step="2" bind:value={resizeWidth} />
					</label>
					<div class="row">
						{#each [426, 640, 854, 1280, 1920] as w (w)}
							<button class="chip" onclick={() => (resizeWidth = w)}>{w}</button>
						{/each}
					</div>
					<p class="hint">
						The height follows so nothing is stretched.
						{#if media.width}
							Result about {resizeWidth} × {Math.round((resizeWidth / media.width) * media.height / 2) * 2}.
						{/if}
					</p>
				{/if}

				{#if tool.op === 'speed'}
					<label class="field">
						<span>Speed <output class="mono">{speedFactor}×</output></span>
						<input type="range" min="0.25" max="4" step="0.25" bind:value={speedFactor} />
					</label>
					<p class="hint">
						{#if media.duration}
							{media.duration.toFixed(1)}s becomes about {(media.duration / speedFactor).toFixed(1)}s.
						{/if}
					</p>
				{/if}

				{#if tool.op === 'fps'}
					<div class="row">
						{#each [15, 24, 25, 30, 50, 60] as rate (rate)}
							<button class="chip" class:on={fps === rate} onclick={() => (fps = rate)}>{rate}</button>
						{/each}
					</div>
					<p class="hint">The clip stays the same length. Fewer frames a second means a smaller file.</p>
				{/if}

				{#if tool.op === 'rotate'}
					<div class="row">
						<button class="chip" onclick={() => (quarterTurns = (quarterTurns + 1) % 4)}>Turn right</button>
						<button class="chip" onclick={() => (quarterTurns = (quarterTurns + 3) % 4)}>Turn left</button>
						<button class="chip" class:on={flipHorizontal} onclick={() => (flipHorizontal = !flipHorizontal)}>Mirror</button>
						<button class="chip" class:on={flipVertical} onclick={() => (flipVertical = !flipVertical)}>Flip</button>
					</div>
				{/if}

				{#if tool.op === 'blur'}
					<label class="field">
						<span>Strength <output class="mono">{blurStrength}</output></span>
						<input type="range" min={BLUR_MIN} max={BLUR_MAX} step="1" bind:value={blurStrength} />
					</label>
					<p class="hint">The preview is close. The finished file is blurred by ffmpeg, not the browser.</p>
				{/if}

				{#if tool.op === 'text'}
					<label class="field">
						<span>Text</span>
						<input type="text" bind:value={text} placeholder="Your caption" maxlength="120" />
					</label>
					<label class="field">
						<span>Size <output class="mono">{textSize}px</output></span>
						<input type="range" min="12" max={Math.max(120, Math.round((media.height || 720) * 0.2))} step="1" bind:value={textSize} />
					</label>
					<div class="row">
						{#each ['top', 'centre', 'bottom'] as const as pos (pos)}
							<button class="chip" class:on={textPosition === pos} onclick={() => (textPosition = pos)}>{pos}</button>
						{/each}
						<label class="swatch">
							<input type="color" bind:value={textColour} aria-label="Text colour" />
						</label>
						<button class="chip" class:on={textBox} onclick={() => (textBox = !textBox)}>Backing box</button>
					</div>
				{/if}

				{#if tool.op === 'compress'}
					<label class="field">
						<span>Quality <output class="mono">{quality}</output></span>
						<input type="range" min="18" max="40" step="1" bind:value={quality} />
					</label>
					<p class="hint">Lower is better quality and a bigger file. 28 is a sensible middle.</p>
				{/if}

				{#if tool.op === 'mute'}
					<p class="hint">Nothing to set. The picture is copied untouched and the sound is left out.</p>
				{/if}

				{#if stage === 'idle' || stage === 'error'}
					<button class="btn" onclick={run} disabled={!ready}>
						{ready ? tool.name : 'Set something first'}
					</button>
					{#if !tool.keepsFrames}
						<p class="hint">
							This re-encodes every frame, so it takes seconds to minutes depending on the clip.
						</p>
					{/if}
				{/if}
			</div>
		</div>
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
			<p class="working-title">Working on {file?.name}</p>
			<div class="bar"><div class="fill" style:width="{workRatio * 100}%"></div></div>
			<p class="working-note">{Math.round(workRatio * 100)}% · {elapsed}s</p>
		</div>
	{/if}

	{#if stage === 'error' && error}
		<p class="error" role="alert">
			{error}
			{#if error.includes('picture')}<a href="/tools">Use the image tools instead</a>.{/if}
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
				{#if result.framesIntact}
					<span class="result-note">
						The picture was copied untouched, which is why it finished so quickly. Every frame
						is identical to the original.
					</span>
				{/if}
			</div>
			<p class="ffmpeg-log" data-testid="ffmpeg-log" hidden>{ffmpegSaid.join('\n')}</p>
			<div class="result-actions">
				<button class="btn" onclick={() => downloadBlob(result!.blob, result!.name)}>Download</button>
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

	/* The preview and its settings, side by side once there is room. */
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

	/*
	 * container-type so a caption can be sized in cqh, which is what keeps the
	 * preview honest: the text is set in pixels of the real frame, and the
	 * preview is some other size entirely.
	 */
	.viewer {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.preview {
		position: relative;
		background: var(--surface-deep);
		border-radius: var(--r-m);
		overflow: hidden;
		container-type: size;
		aspect-ratio: 16 / 9;
	}

	.preview video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	/*
	 * Everything outside the frame is dimmed by the frame's own shadow, spread
	 * far enough to cover the preview and clipped by its overflow. This was a
	 * clip-path polygon that traced the outside and then the hole, which does
	 * nothing: polygon fills by nonzero winding, so the second path does not
	 * cut anything out and the dimming never appeared at all.
	 */
	.cropframe {
		position: absolute;
		border: 2px solid var(--primary);
		box-shadow: 0 0 0 100vmax rgb(0 0 0 / 0.45);
		cursor: move;
		touch-action: none;
	}

	.handle {
		position: absolute;
		width: 14px;
		height: 14px;
		background: var(--primary);
		border-radius: 3px;
		touch-action: none;
	}

	.handle.nw { top: -8px; left: -8px; cursor: nwse-resize; }
	.handle.ne { top: -8px; right: -8px; cursor: nesw-resize; }
	.handle.sw { bottom: -8px; left: -8px; cursor: nesw-resize; }
	.handle.se { bottom: -8px; right: -8px; cursor: nwse-resize; }

	.caption {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		max-width: 92%;
		text-align: center;
		font-weight: 700;
		line-height: 1.2;
		pointer-events: none;
		white-space: pre-wrap;
	}

	.caption.top { top: 6%; }
	.caption.centre { top: 50%; transform: translate(-50%, -50%); }
	.caption.bottom { bottom: 6%; }

	.caption.boxed {
		background: rgb(0 0 0 / 0.5);
		padding: 0.15em 0.5em;
		border-radius: 4px;
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
	}

	.field > span {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		color: var(--muted);
	}

	.field input[type='range'] {
		width: 100%;
	}

	.field input[type='text'] {
		font: inherit;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--surface);
	}

	.check {
		display: flex;
		align-items: start;
		gap: 0.45rem;
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
		cursor: pointer;
	}

	.chip.on {
		border-color: var(--primary);
		color: var(--primary);
	}

	.swatch input {
		width: 2rem;
		height: 1.9rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
	}

	.scrub {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.scrub input {
		flex: 1;
	}

	.hint,
	.readout {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
