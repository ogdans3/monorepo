<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { luma } from '$lib/tools/pixels';
	import { readImageFile, rawToCanvas } from './load';
	import Dropzone from '../Dropzone.svelte';

	type Channel = 'luma' | 'rgb' | 'r' | 'g' | 'b';

	const CHANNELS: { id: Channel; label: string }[] = [
		{ id: 'luma', label: 'Brightness' },
		{ id: 'rgb', label: 'All colours' },
		{ id: 'r', label: 'Red' },
		{ id: 'g', label: 'Green' },
		{ id: 'b', label: 'Blue' }
	];

	let img = $state<RawImage | null>(null);
	let name = $state('image');
	let channel = $state<Channel>('luma');
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let chartEl = $state<HTMLCanvasElement>();
	let previewEl = $state<HTMLCanvasElement>();

	/** 256 counts per channel plus luma, computed once per image. */
	const bins = $derived.by(() => {
		if (!img) return null;
		const r = new Uint32Array(256);
		const g = new Uint32Array(256);
		const b = new Uint32Array(256);
		const y = new Uint32Array(256);
		const d = img.data;
		for (let i = 0; i < d.length; i += 4) {
			if (d[i + 3] === 0) continue; // fully transparent pixels are not content
			r[d[i]]++;
			g[d[i + 1]]++;
			b[d[i + 2]]++;
			y[Math.round(luma(d[i], d[i + 1], d[i + 2]))]++;
		}
		return { r, g, b, y };
	});

	const stats = $derived.by(() => {
		if (!bins || !img) return null;
		const y = bins.y;
		const total = y.reduce((s, n) => s + n, 0) || 1;
		const clippedDark = y[0] / total;
		const clippedLight = y[255] / total;
		let sum = 0;
		let mean = 0;
		for (let i = 0; i < 256; i++) mean += (i * y[i]) / total;
		let median = 0;
		for (let i = 0; i < 256; i++) {
			sum += y[i];
			if (sum >= total / 2) {
				median = i;
				break;
			}
		}
		const used = y.reduce((count, n) => count + (n > 0 ? 1 : 0), 0);
		return {
			mean: Math.round(mean),
			median,
			usedRange: Math.round((used / 256) * 100),
			clippedDark: clippedDark * 100,
			clippedLight: clippedLight * 100
		};
	});

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readImageFile(file);
			name = loaded.name;
			img = loaded.raw;
			// small preview beside the chart
			if (previewEl) {
				const source = rawToCanvas(loaded.raw);
				const scale = Math.min(1, 220 / Math.max(loaded.raw.width, loaded.raw.height));
				previewEl.width = Math.max(1, Math.round(loaded.raw.width * scale));
				previewEl.height = Math.max(1, Math.round(loaded.raw.height * scale));
				previewEl.getContext('2d')?.drawImage(source, 0, 0, previewEl.width, previewEl.height);
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function drawSeries(
		ctx: CanvasRenderingContext2D,
		counts: Uint32Array,
		peak: number,
		w: number,
		h: number,
		stroke: string,
		fillStyle: string | null
	) {
		ctx.beginPath();
		ctx.moveTo(0, h);
		for (let i = 0; i < 256; i++) {
			const x = (i / 255) * w;
			// square root keeps small counts visible next to a big spike
			const y = h - Math.sqrt(counts[i] / peak) * h;
			ctx.lineTo(x, y);
		}
		ctx.lineTo(w, h);
		if (fillStyle) {
			ctx.fillStyle = fillStyle;
			ctx.fill();
		}
		ctx.strokeStyle = stroke;
		ctx.lineWidth = 1.25;
		ctx.stroke();
	}

	$effect(() => {
		if (!bins || !chartEl) return;
		void channel;
		const dpr = window.devicePixelRatio || 1;
		const cssW = chartEl.clientWidth || 600;
		const cssH = 220;
		chartEl.width = Math.round(cssW * dpr);
		chartEl.height = Math.round(cssH * dpr);
		const ctx = chartEl.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, cssW, cssH);

		// quarter gridlines, so the shape can be read against something
		ctx.strokeStyle = 'oklch(0.9 0.006 110)';
		ctx.lineWidth = 1;
		for (let q = 1; q < 4; q++) {
			const x = (cssW / 4) * q;
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, cssH);
			ctx.stroke();
		}

		const series =
			channel === 'luma'
				? [{ counts: bins.y, stroke: 'oklch(0.24 0.015 110)', fill: 'oklch(0.24 0.015 110 / 0.12)' }]
				: channel === 'rgb'
					? [
							{ counts: bins.r, stroke: 'oklch(0.6 0.2 25)', fill: 'oklch(0.6 0.2 25 / 0.16)' },
							{ counts: bins.g, stroke: 'oklch(0.62 0.18 145)', fill: 'oklch(0.62 0.18 145 / 0.16)' },
							{ counts: bins.b, stroke: 'oklch(0.55 0.2 265)', fill: 'oklch(0.55 0.2 265 / 0.16)' }
						]
					: channel === 'r'
						? [{ counts: bins.r, stroke: 'oklch(0.6 0.2 25)', fill: 'oklch(0.6 0.2 25 / 0.16)' }]
						: channel === 'g'
							? [{ counts: bins.g, stroke: 'oklch(0.62 0.18 145)', fill: 'oklch(0.62 0.18 145 / 0.16)' }]
							: [{ counts: bins.b, stroke: 'oklch(0.55 0.2 265)', fill: 'oklch(0.55 0.2 265 / 0.16)' }];

		const peak = Math.max(1, ...series.flatMap((s) => [Math.max(...s.counts)]));
		for (const s of series) drawSeries(ctx, s.counts, peak, cssW, cssH, s.stroke, s.fill);
	});

	function startOver() {
		img = null;
		loadError = null;
	}
</script>

{#if !img}
	<div class="editor-load">
		<Dropzone headline="Drop an image here" multiple={false} {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading image…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<div class="toolbar-group" role="group" aria-label="Channel">
				{#each CHANNELS as c (c.id)}
					<button class="chip" class:active={channel === c.id} aria-pressed={channel === c.id} onclick={() => (channel = c.id)}>
						{c.label}
					</button>
				{/each}
			</div>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="layout">
			<div class="chart-wrap">
				<canvas bind:this={chartEl} aria-label="Histogram of {name}"></canvas>
				<div class="axis mono">
					<span>black</span>
					<span>mid</span>
					<span>white</span>
				</div>
			</div>
			<div class="side">
				<canvas bind:this={previewEl} class="preview"></canvas>
				{#if stats}
					<dl class="stats">
						<dt>Average</dt>
						<dd class="mono">{stats.mean}</dd>
						<dt>Middle value</dt>
						<dd class="mono">{stats.median}</dd>
						<dt>Range used</dt>
						<dd class="mono">{stats.usedRange}%</dd>
						<dt>Crushed blacks</dt>
						<dd class="mono" class:warn={stats.clippedDark > 1}>{stats.clippedDark.toFixed(1)}%</dd>
						<dt>Blown whites</dt>
						<dd class="mono" class:warn={stats.clippedLight > 1}>{stats.clippedLight.toFixed(1)}%</dd>
					</dl>
				{/if}
			</div>
		</div>

		{#if stats && (stats.clippedDark > 1 || stats.clippedLight > 1)}
			<p class="hint">
				{#if stats.clippedDark > 1 && stats.clippedLight > 1}
					Detail is lost at both ends, so this photo is very high contrast.
				{:else if stats.clippedDark > 1}
					The darkest areas are solid black, so there is no shadow detail left to recover there.
				{:else}
					The brightest areas are pure white, so there is no highlight detail left to recover.
				{/if}
			</p>
		{/if}
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
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.editor-error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.toolbar > .btn-ghost {
		margin-left: auto;
	}

	.layout {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		padding: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
	}

	.chart-wrap {
		flex: 1 1 22rem;
		min-width: 0;
	}

	.chart-wrap canvas {
		display: block;
		width: 100%;
		height: 220px;
		background: #fff;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
	}

	.axis {
		display: flex;
		justify-content: space-between;
		margin-top: 0.3rem;
		font-size: 0.6875rem;
		color: var(--muted);
	}

	.side {
		flex: 0 1 14rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.preview {
		display: block;
		max-width: 100%;
		height: auto;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem 0.75rem;
		margin: 0;
		font-size: 0.8125rem;
	}

	.stats dt {
		color: var(--muted);
	}

	.stats dd {
		margin: 0;
		text-align: right;
	}

	.stats dd.warn {
		color: var(--danger);
		font-weight: 600;
	}
</style>
