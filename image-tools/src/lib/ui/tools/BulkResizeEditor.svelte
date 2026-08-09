<script lang="ts">
	import { FORMATS, editedFileName, encodeRaw, zipBlobs, type FormatId } from '$lib/engine';
	import { readImageFile, rawToCanvas, steppedScale } from './load';
	import { downloadBlob } from '../download';
	import Dropzone from '../Dropzone.svelte';

	interface Item {
		id: number;
		name: string;
		source: HTMLCanvasElement;
		w: number;
		h: number;
	}

	let nextId = 1;
	let items = $state<Item[]>([]);
	let mode = $state<'width' | 'percent'>('width');
	let targetWidth = $state(1200);
	let targetPercent = $state(50);
	let formatId = $state<FormatId>('jpg');
	let quality = $state(90);
	let working = $state(false);
	let loading = $state(false);
	let loadError = $state<string | null>(null);

	const format = $derived(FORMATS[formatId]);

	function targetFor(item: Item): { w: number; h: number } {
		const clamp = (v: number) => Math.min(10000, Math.max(1, Math.round(v)));
		if (mode === 'width') {
			const w = clamp(targetWidth);
			return { w, h: clamp((w * item.h) / item.w) };
		}
		return { w: clamp((item.w * targetPercent) / 100), h: clamp((item.h * targetPercent) / 100) };
	}

	async function onfiles(files: File[]) {
		loading = true;
		loadError = null;
		try {
			for (const file of files) {
				const { raw, name } = await readImageFile(file);
				items.push({ id: nextId++, name, source: rawToCanvas(raw), w: raw.width, h: raw.height });
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read a file';
		} finally {
			loading = false;
		}
	}

	async function downloadZip() {
		working = true;
		try {
			const entries = [];
			for (const item of items) {
				const t = targetFor(item);
				const canvas = steppedScale(item.source, t.w, t.h);
				const ctx = canvas.getContext('2d');
				if (!ctx) continue;
				const raw = ctx.getImageData(0, 0, t.w, t.h);
				const blob = await encodeRaw({ width: t.w, height: t.h, data: raw.data }, format, {
					quality
				});
				entries.push({
					name: editedFileName(item.name, '-resized', format.extensions[0]),
					data: new Uint8Array(await blob.arrayBuffer())
				});
			}
			downloadBlob(zipBlobs(entries), 'resized-images.zip');
		} finally {
			working = false;
		}
	}

	function remove(id: number) {
		items = items.filter((i) => i.id !== id);
	}

	function startOver() {
		items = [];
		loadError = null;
	}
</script>

{#if items.length === 0}
	<div class="editor-load">
		<Dropzone headline="Drop images here" {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading images…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<div class="toolbar-group" role="group" aria-label="Resize by">
				<button class="chip" class:active={mode === 'width'} aria-pressed={mode === 'width'} onclick={() => (mode = 'width')}>Width</button>
				<button class="chip" class:active={mode === 'percent'} aria-pressed={mode === 'percent'} onclick={() => (mode = 'percent')}>Percent</button>
			</div>
			{#if mode === 'width'}
				<label class="field">
					<span>Target width</span>
					<input
						type="number"
						min="1"
						max="10000"
						value={targetWidth}
						onchange={(e) => (targetWidth = Math.min(10000, Math.max(1, +e.currentTarget.value || 1)))}
					/>
				</label>
			{:else}
				<label class="field">
					<span>Percent</span>
					<input
						type="number"
						min="1"
						max="400"
						value={targetPercent}
						onchange={(e) => (targetPercent = Math.min(400, Math.max(1, +e.currentTarget.value || 1)))}
					/>
				</label>
			{/if}
			<div class="toolbar-group" role="group" aria-label="Output format">
				{#each ['jpg', 'png', 'webp'] as const as id (id)}
					<button class="chip" class:active={formatId === id} aria-pressed={formatId === id} onclick={() => (formatId = id)}>
						{FORMATS[id].name}
					</button>
				{/each}
			</div>
			<div class="toolbar-group">
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		{#if format.lossy}
			<div class="quality">
				<label for="bulk-quality">Quality</label>
				<input id="bulk-quality" type="range" min="1" max="100" bind:value={quality} />
				<output class="mono" for="bulk-quality">{quality}</output>
			</div>
		{/if}

		<ul class="rows">
			{#each items as item (item.id)}
				{@const t = targetFor(item)}
				<li class="row">
					<span class="row-name mono" title={item.name}>{item.name}</span>
					<span class="row-meta mono">
						{item.w} × {item.h}
						<span class="arrow" aria-hidden="true">→</span>
						{t.w} × {t.h} px
					</span>
					<button class="remove" onclick={() => remove(item.id)} aria-label="Remove {item.name}">×</button>
				</li>
			{/each}
		</ul>

		<div class="result-bar">
			<span class="result-text">{items.length} {items.length === 1 ? 'image' : 'images'} ready</span>
			<button class="btn" onclick={downloadZip} disabled={working}>
				{working ? 'Resizing…' : `Download ${items.length} as zip`}
			</button>
		</div>
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

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.6rem 1.25rem;
	}

	.toolbar-group {
		display: flex;
		gap: 0.4rem;
		padding-bottom: 0.15rem;
	}

	.toolbar-group:last-child {
		margin-left: auto;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.field input {
		width: 6.5rem;
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: 500 0.875rem var(--font-mono);
		color: var(--ink);
	}

	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 1rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--line);
	}

	.row-name {
		flex: 1 1 12rem;
		min-width: 0;
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-meta {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.remove {
		width: 1.75rem;
		height: 1.75rem;
		border: 0;
		background: none;
		border-radius: var(--r-s);
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
	}

	.remove:hover {
		background: var(--surface-deep);
		color: var(--ink);
	}

	.result-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
	}

	.result-text {
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
