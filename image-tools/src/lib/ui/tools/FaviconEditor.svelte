<script lang="ts">
	import { editedFileName, icoFromPngs, zipBlobs, type RawImage } from '$lib/engine';
	import { readImageFile, rawToCanvas, steppedScale } from './load';
	import { downloadBlob } from '../download';
	import Dropzone from '../Dropzone.svelte';

	interface Generated {
		name: string;
		blob: Blob;
		url: string;
	}

	const PNG_SIZES = [
		{ name: 'favicon-16x16.png', size: 16 },
		{ name: 'favicon-32x32.png', size: 32 },
		{ name: 'apple-touch-icon.png', size: 180 },
		{ name: 'icon-192.png', size: 192 },
		{ name: 'icon-512.png', size: 512 }
	];
	const PREVIEW_SIZES = [16, 32, 48, 180, 512];

	const SNIPPET = [
		'<link rel="icon" href="/favicon.ico" sizes="48x48">',
		'<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">',
		'<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
	].join('\n');

	let img = $state<RawImage | null>(null);
	let baseName = $state('logo');
	let wasPadded = $state(false);
	let files = $state<Generated[]>([]);
	let previews = $state<{ size: number; url: string }[]>([]);
	let generating = $state(false);
	let copied = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	async function onfiles(dropped: File[]) {
		const file = dropped[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const { raw, name } = await readImageFile(file);
			baseName = name;
			cleanup();
			img = raw;
			await generate(rawToCanvas(raw));
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that file';
		} finally {
			loading = false;
		}
	}

	function squarePad(source: HTMLCanvasElement): HTMLCanvasElement {
		wasPadded = source.width !== source.height;
		if (!wasPadded) return source;
		const size = Math.max(source.width, source.height);
		const square = document.createElement('canvas');
		square.width = size;
		square.height = size;
		square
			.getContext('2d')
			?.drawImage(source, (size - source.width) / 2, (size - source.height) / 2);
		return square;
	}

	function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
		return new Promise((resolve, reject) =>
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode PNG'))), 'image/png')
		);
	}

	async function generate(source: HTMLCanvasElement) {
		generating = true;
		try {
			const square = squarePad(source);
			const out: Generated[] = [];

			// favicon.ico with 16 + 32 + 48 embedded
			const icoEntries = [];
			for (const size of [16, 32, 48]) {
				const png = await toPngBlob(steppedScale(square, size, size));
				icoEntries.push({ png: new Uint8Array(await png.arrayBuffer()), width: size, height: size });
			}
			const ico = new Blob([icoFromPngs(icoEntries)], { type: 'image/x-icon' });
			out.push({ name: 'favicon.ico', blob: ico, url: URL.createObjectURL(ico) });

			for (const { name, size } of PNG_SIZES) {
				const blob = await toPngBlob(steppedScale(square, size, size));
				out.push({ name, blob, url: URL.createObjectURL(blob) });
			}

			previews = await Promise.all(
				PREVIEW_SIZES.map(async (size) => {
					const blob = await toPngBlob(steppedScale(square, size, size));
					return { size, url: URL.createObjectURL(blob) };
				})
			);
			files = out;
		} finally {
			generating = false;
		}
	}

	async function downloadZip() {
		const entries = await Promise.all(
			files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) }))
		);
		downloadBlob(zipBlobs(entries), editedFileName(baseName, '-favicons', '.zip'));
	}

	async function copySnippet() {
		await navigator.clipboard.writeText(SNIPPET);
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}

	function cleanup() {
		for (const f of files) URL.revokeObjectURL(f.url);
		for (const p of previews) URL.revokeObjectURL(p.url);
		files = [];
		previews = [];
	}

	function startOver() {
		cleanup();
		img = null;
		loadError = null;
	}

	$effect(() => () => cleanup());
</script>

{#if !img}
	<div class="editor-load">
		<Dropzone headline="Drop your logo here" multiple={false} {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading image…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<p class="hint">
				{#if generating}
					Rendering sizes…
				{:else}
					Check the 16 pixel one. If it turns to mush, simplify the logo.
					{#if wasPadded}The logo was not square, so it is padded with transparency.{/if}
				{/if}
			</p>
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		{#if previews.length}
			<div class="previews">
				{#each previews as p (p.size)}
					<figure class="preview">
						<span class="preview-box checker"><img src={p.url} alt="" width={Math.min(p.size, 96)} height={Math.min(p.size, 96)} /></span>
						<figcaption class="mono">{p.size}px</figcaption>
					</figure>
				{/each}
			</div>
		{/if}

		{#if files.length}
			<div class="pack">
				<div class="pack-head">
					<span class="pack-title">The pack</span>
					<button class="btn" onclick={downloadZip}>Download zip</button>
				</div>
				<ul class="pack-list">
					{#each files as f (f.name)}
						<li><a class="mono" href={f.url} download={f.name}>{f.name}</a></li>
					{/each}
				</ul>
			</div>

			<div class="snippet">
				<div class="pack-head">
					<span class="pack-title">Paste into your head</span>
					<button class="btn-ghost" onclick={copySnippet}>{copied ? 'Copied' : 'Copy'}</button>
				</div>
				<pre class="mono">{SNIPPET}</pre>
			</div>
		{/if}
	</div>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

	.toolbar {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 1rem;
	}

	.hint {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.previews {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 1.1rem;
		padding: 1rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-m);
	}

	.preview {
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	.preview-box {
		display: grid;
		place-items: center;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		padding: 4px;
	}

	.preview img {
		display: block;
		image-rendering: auto;
	}

	.preview figcaption {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.pack,
	.snippet {
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		padding: 0.9rem 1rem;
		background: var(--surface);
	}

	.pack-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.6rem;
	}

	.pack-title {
		font-weight: 650;
		font-size: 0.9375rem;
	}

	.pack-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 1.25rem;
		font-size: 0.8125rem;
	}

	.snippet pre {
		margin: 0;
		padding: 0.7rem 0.8rem;
		background: var(--surface-deep);
		border-radius: var(--r-s);
		font-size: 0.8125rem;
		overflow-x: auto;
	}
</style>
