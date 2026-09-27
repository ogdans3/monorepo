<script lang="ts">
	import PhoneFrameControls from '$lib/ui/PhoneFrameControls.svelte';
	import type { RawImage } from '$lib/engine';
	import {
		paintPhoneFrame,
		phoneFrame,
		phoneFrameDefaults,
		phoneFrameLimits
	} from '$lib/tools/phoneframe';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let bezelOn = $state(true);
	let bezel = $state(39);
	let radius = $state(129);
	/**
	 * Whether the person has set a size themselves. Until they do, every new
	 * screenshot gets the phone's proportions for its own width. After that a
	 * value they chose is kept, because resetting it on the next file would be
	 * the tool overruling them.
	 */
	let bezelTouched = false;
	let radiusTouched = false;

	let canvasEl = $state<HTMLCanvasElement>();
	let base: HTMLCanvasElement | null = null;

	const frame = $derived(img ? phoneFrame(img.width, img.height, { bezelOn, bezel, radius }) : null);
	/**
	 * The same phone with its border on, whatever the switch says, for the
	 * preview's column to be sized by. The column is as wide as the phone, so
	 * turning the border off narrowed it and pulled the controls beside it
	 * 11 px to the left, the switch included, from under the pointer that had
	 * just clicked it.
	 */
	const bordered = $derived(img ? phoneFrame(img.width, img.height, { bezelOn: true, bezel, radius }) : null);
	/** Small enough to be shown bigger than it is. Decided on `bordered`, so the switch can't flip it. */
	const small = $derived(!!bordered && bordered.width < 240);
	const defaults = $derived(img ? phoneFrameDefaults(img.width, img.height) : null);
	const limits = $derived(img ? phoneFrameLimits(img.width, img.height) : null);
	/** Wider than tall: the preview gets the whole row instead of sharing it. */
	const wide = $derived(!!frame && frame.width > frame.height);

	function isVideo(file: File): boolean {
		return file.type.startsWith('video/') || /\.(mp4|m4v|mov|webm|mkv|avi)$/i.test(file.name);
	}

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loadError = null;
		// The link to the video page is the "Also for video" line straight
		// under the editor, so the error doesn't repeat it.
		if (isVideo(file)) {
			loadError = `${file.name} is a video. This page frames images.`;
			return;
		}
		loading = true;
		try {
			const { raw, name } = await readImageFile(file);
			const start = phoneFrameDefaults(raw.width, raw.height);
			const room = phoneFrameLimits(raw.width, raw.height);
			bezel = bezelTouched ? Math.min(bezel, room.bezelMax) : start.bezel;
			radius = radiusTouched ? Math.min(radius, room.radiusMax) : start.radius;
			baseName = name;
			base = rawToCanvas(raw);
			img = raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function resetSizes() {
		if (!defaults) return;
		bezel = defaults.bezel;
		radius = defaults.radius;
		bezelTouched = false;
		radiusTouched = false;
	}

	function draw(target: HTMLCanvasElement) {
		if (!frame || !base) return;
		target.width = frame.width;
		target.height = frame.height;
		const ctx = target.getContext('2d');
		if (!ctx) return;
		// No outside colour: the corners stay transparent, and ExportBar fills
		// them for JPG with the colour picked there, white unless changed.
		paintPhoneFrame(ctx, frame, { screen: base });
	}

	let queued = false;
	$effect(() => {
		if (!frame || !canvasEl) return;
		void frame;
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			if (canvasEl) draw(canvasEl);
		});
	});

	function renderResult(): RawImage {
		if (!frame) throw new Error('No image loaded');
		const out = document.createElement('canvas');
		draw(out);
		const ctx = out.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		const data = ctx.getImageData(0, 0, out.width, out.height);
		return { width: out.width, height: out.height, data: data.data };
	}

	function startOver() {
		img = null;
		base = null;
		loadError = null;
	}
</script>

{#if !img || !frame || !bordered || !defaults || !limits}
	<div class="editor-load">
		<Dropzone headline="Drop a screenshot here" multiple={false} {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading image…</p>{/if}
		{#if loadError}
			<p class="editor-error" role="alert">{loadError}</p>
		{/if}
	</div>
{:else}
	<div class="editor">
		<div class="work" class:wide>
			<div class="stage">
				<!-- Holds the column at the bordered phone's size. Never drawn on. -->
				<canvas class="room" class:small width={bordered.width} height={bordered.height} aria-hidden="true"></canvas>
				<div
					class="canvas-wrap checker"
					class:small
					role="img"
					aria-label="Preview of the screenshot in its phone frame"
				>
					<canvas bind:this={canvasEl}></canvas>
				</div>
			</div>

			<div class="controls">
				<PhoneFrameControls
					bind:bezelOn
					bind:bezel
					bind:radius
					{defaults}
					{limits}
					ontouch={(which) => (which === 'bezel' ? (bezelTouched = true) : (radiusTouched = true))}
					onreset={resetSizes}
				>
					{#snippet actions()}
						<button class="btn-ghost start-over" onclick={startOver}>Start over</button>
					{/snippet}
				</PhoneFrameControls>
			</div>
		</div>

		<p class="readout">
			<span class="mono">{img.width} × {img.height}</span>
			<span class="arrow" aria-hidden="true">→</span>
			<span class="mono strong">{frame.width} × {frame.height} px</span>
		</p>

		<ExportBar render={renderResult} {baseName} suffix="-phone" formats={['png', 'webp', 'jpg']} />
	</div>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.editor-load {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.editor-status,
	.readout {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.readout .strong {
		color: var(--ink);
		font-weight: 600;
	}

	.editor-error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}

	/*
	 * Screenshots are tall, so the preview and its settings sit side by side:
	 * the sliders stay next to the corners they change instead of below a
	 * picture that fills the screen. The preview's column is the phone's own
	 * width, since a share of the row left an empty band beside a narrow phone
	 * and squeezed the controls. A landscape capture gets the whole row.
	 */
	.work {
		display: grid;
		gap: 1rem;
		grid-template-columns: auto minmax(14rem, 1fr);
		grid-template-areas: 'stage controls';
		align-items: start;
	}

	.work.wide {
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: 'stage' 'controls';
	}

	.stage {
		grid-area: stage;
	}

	.controls {
		grid-area: controls;
	}

	.stage {
		/* One cell, so the preview sits over the space kept for it. */
		display: grid;
		place-items: center;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		padding: 1rem;
	}

	.stage > * {
		grid-area: 1 / 1;
	}

	.canvas-wrap {
		line-height: 0;
	}

	.room {
		visibility: hidden;
	}

	canvas {
		display: block;
		max-width: 100%;
		max-height: 62vh;
	}

	/* A length, not min(), so the auto sized column above has a width to take. */
	.canvas-wrap.small {
		width: 240px;
		max-width: 100%;
	}

	.canvas-wrap.small canvas,
	.room.small {
		width: 100%;
		height: auto;
		max-height: none;
		image-rendering: pixelated;
	}

	.room.small {
		width: 240px;
		max-width: 100%;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Across the page under a wide preview: the two sliders share a row. */
	.work.wide .controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.9rem 1.5rem;
	}

	.work.wide .controls > :global(.pf-check),
	.work.wide .controls > :global(.pf-hint),
	.work.wide .controls > :global(.pf-actions) {
		grid-column: 1 / -1;
	}

	.start-over {
		margin-left: auto;
	}

	/*
	 * One column on a phone, with the settings above a shorter preview. Under
	 * it they started 1,025 px down a 844 px screen, so nothing that could be
	 * changed was in view once a screenshot was loaded. Above it, the sliders
	 * are in view and the top corners they change are just below them. A wide
	 * capture's preview is short enough to keep first.
	 */
	@media (max-width: 40rem) {
		.work {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'controls' 'stage';
		}

		.work.wide {
			grid-template-areas: 'stage' 'controls';
		}

		.controls {
			gap: 0.75rem;
		}

		canvas {
			max-height: 52vh;
		}
	}
</style>
