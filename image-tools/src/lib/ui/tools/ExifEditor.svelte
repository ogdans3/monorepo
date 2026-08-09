<script lang="ts">
	import type { RawImage } from '$lib/engine';
	import { readImageFile } from './load';
	import Dropzone from '../Dropzone.svelte';
	import ExportBar from './ExportBar.svelte';

	interface Row {
		label: string;
		value: string;
		warn?: boolean;
	}

	let img = $state<RawImage | null>(null);
	let baseName = $state('image');
	let rows = $state<Row[] | null>(null);
	let extraCount = $state(0);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	let canvasEl = $state<HTMLCanvasElement>();

	const hasLocation = $derived(rows?.some((r) => r.warn) ?? false);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const [loaded, meta] = await Promise.all([readImageFile(file), parseMeta(file)]);
			baseName = loaded.name;
			rows = meta.rows;
			extraCount = meta.extra;
			img = loaded.raw;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	async function parseMeta(file: File): Promise<{ rows: Row[]; extra: number }> {
		const exifr = (await import('exifr')).default;
		const data: Record<string, unknown> | null | undefined = await exifr
			.parse(file)
			.catch(() => null);
		if (!data) return { rows: [], extra: 0 };

		const out: Row[] = [];
		const used = new Set<string>();
		const take = (keys: string[], label: string, format?: (v: unknown) => string) => {
			for (const key of keys) {
				const v = data[key];
				if (v === undefined || v === null || v === '') continue;
				keys.forEach((k) => used.add(k));
				out.push({ label, value: format ? format(v) : String(v) });
				return;
			}
		};

		if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
			['latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef', 'GPSAltitude'].forEach((k) => used.add(k));
			out.push({
				label: 'Location',
				value: `${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`,
				warn: true
			});
		}
		take(['Make'], 'Camera make');
		take(['Model'], 'Camera model');
		take(['LensModel'], 'Lens');
		take(['DateTimeOriginal', 'CreateDate', 'ModifyDate'], 'Taken', (v) =>
			v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : String(v)
		);
		take(['Software'], 'Software');
		take(['Orientation'], 'Orientation');
		take(['ISO'], 'ISO');
		take(['FNumber'], 'Aperture', (v) => `f/${v}`);
		take(['ExposureTime'], 'Shutter', (v) => {
			const n = Number(v);
			return n > 0 && n < 1 ? `1/${Math.round(1 / n)} s` : `${n} s`;
		});
		take(['FocalLength'], 'Focal length', (v) => `${v} mm`);

		const extra = Object.keys(data).filter(
			(k) => !used.has(k) && typeof data[k] !== 'object'
		).length;
		return { rows: out, extra };
	}

	$effect(() => {
		if (!img || !canvasEl) return;
		canvasEl.width = img.width;
		canvasEl.height = img.height;
		canvasEl.getContext('2d')?.putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
	});

	function renderResult(): RawImage {
		if (!img) throw new Error('No image loaded');
		return img;
	}

	function startOver() {
		img = null;
		rows = null;
		loadError = null;
	}
</script>

{#if !img}
	<div class="editor-load">
		<Dropzone headline="Drop a photo here" multiple={false} {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading image…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="layout">
			<div class="thumb-col">
				<div class="canvas-wrap">
					<canvas bind:this={canvasEl}></canvas>
				</div>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>

			<div class="meta-col">
				{#if rows && rows.length}
					<table class="meta">
						<caption class="visually-hidden">Metadata found in {baseName}</caption>
						<tbody>
							{#each rows as row (row.label)}
								<tr class:warn={row.warn}>
									<th scope="row">{row.label}</th>
									<td class="mono">{row.value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if extraCount > 0}
						<p class="extra">Plus {extraCount} more technical fields.</p>
					{/if}
					{#if hasLocation}
						<p class="warning" role="alert">
							This photo reveals where it was taken. Download the clean copy before sharing it.
						</p>
					{/if}
				{:else}
					<p class="clean" role="status">No metadata found in this file. Nothing to worry about.</p>
				{/if}
			</div>
		</div>

		<ExportBar
			render={renderResult}
			{baseName}
			suffix="-clean"
			formats={['jpg', 'png', 'webp']}
			defaultFormat="jpg"
		/>
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

	.editor-status {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.editor-error {
		margin: 0;
		color: var(--danger);
		font-size: 0.875rem;
	}

	.layout {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		padding: 1rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-m);
	}

	.thumb-col {
		flex: 0 1 200px;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		align-items: start;
	}

	.canvas-wrap {
		line-height: 0;
		border: 1px solid var(--line);
	}

	canvas {
		display: block;
		max-width: 200px;
		max-height: 200px;
		width: auto;
		height: auto;
	}

	.meta-col {
		flex: 1 1 18rem;
		min-width: 0;
	}

	.meta {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.meta th {
		text-align: left;
		font-weight: 600;
		color: var(--muted);
		padding: 0.3rem 1rem 0.3rem 0;
		white-space: nowrap;
		vertical-align: top;
		width: 1%;
	}

	.meta td {
		padding: 0.3rem 0;
		font-size: 0.8125rem;
		word-break: break-word;
	}

	.meta tr + tr {
		border-top: 1px solid var(--line);
	}

	.meta tr.warn th,
	.meta tr.warn td {
		color: var(--danger);
		font-weight: 600;
	}

	.extra {
		margin: 0.6rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.warning {
		margin: 0.75rem 0 0;
		font-size: 0.875rem;
		color: var(--danger);
	}

	.clean {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
