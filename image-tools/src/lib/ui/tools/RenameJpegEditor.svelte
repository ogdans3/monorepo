<script lang="ts">
	import { FORMATS, convertFile, formatBytes, outputFileName, sniffFormat, zipBlobs } from '$lib/engine';
	import { downloadBlob } from '../download';
	import Dropzone from '../Dropzone.svelte';

	/**
	 * JPG and JPEG are one format with two spellings, so the honest answer to
	 * "convert jpeg to jpg" is to hand the same bytes back under the other
	 * extension. Re-encoding would throw away detail to achieve nothing, which
	 * is exactly what a converter that treats this as a real conversion does.
	 *
	 * Files that only claim to be JPEG are the interesting case. A PNG saved
	 * as photo.jpeg is common, and that one really does need converting, so
	 * the bytes decide and each row says which happened.
	 */
	let { targetExt }: { targetExt: '.jpg' | '.jpeg' } = $props();

	interface Row {
		id: number;
		name: string;
		outName: string;
		blob: Blob;
		originalSize: number;
		/** Renamed means byte for byte identical. Converted means re-encoded. */
		renamed: boolean;
		/** What the file turned out to be, when it was not a JPEG. */
		wasReally: string | null;
	}

	let nextId = 1;
	let rows = $state<Row[]>([]);
	let working = $state(false);
	let error = $state<string | null>(null);

	async function onfiles(files: File[]) {
		working = true;
		error = null;
		try {
			for (const file of files) {
				const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
				const source = sniffFormat(head, file.name);
				if (!source) {
					error = `${file.name} is not an image this site recognises`;
					continue;
				}
				if (source.id === 'jpg') {
					rows.push({
						id: nextId++,
						name: file.name,
						outName: outputFileName(file.name, targetExt),
						blob: file,
						originalSize: file.size,
						renamed: true,
						wasReally: null
					});
					continue;
				}
				const converted = await convertFile(file, FORMATS.jpg, { quality: 92, targetExt });
				rows.push({
					id: nextId++,
					name: file.name,
					outName: converted.name,
					blob: converted.blob,
					originalSize: file.size,
					renamed: false,
					wasReally: source.name
				});
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong reading that file';
		} finally {
			working = false;
		}
	}

	async function downloadAll() {
		const entries = await Promise.all(
			rows.map(async (row) => ({
				name: row.outName,
				data: new Uint8Array(await row.blob.arrayBuffer())
			}))
		);
		downloadBlob(zipBlobs(entries), `images${targetExt.replace('.', '-')}.zip`);
	}

	function clear() {
		rows = [];
		error = null;
	}
</script>

<Dropzone headline="Drop your files here" accept=".jpg,.jpeg,image/jpeg" {onfiles} />

{#if error}
	<p class="error">{error}</p>
{/if}

{#if working}
	<p class="status">Working…</p>
{/if}

{#if rows.length}
	<ul class="rows">
		{#each rows as row (row.id)}
			<li class="row">
				<div class="row-main">
					<span class="row-name mono">{row.outName}</span>
					<span class="row-meta">
						{#if row.renamed}
							Already a JPEG, so the file is untouched. {formatBytes(row.originalSize)}, byte for
							byte the same.
						{:else}
							Was really a {row.wasReally} file, so it has been converted properly.
							{formatBytes(row.originalSize)} <span class="arrow">→</span>
							{formatBytes(row.blob.size)}
						{/if}
					</span>
				</div>
				<button class="btn" onclick={() => downloadBlob(row.blob, row.outName)}>Download</button>
			</li>
		{/each}
	</ul>

	<div class="actions">
		{#if rows.length > 1}
			<button class="btn" onclick={downloadAll}>Download all as a zip</button>
		{/if}
		<button class="btn-ghost" onclick={clear}>Clear</button>
	</div>
{/if}

<style>
	.rows {
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.7rem 0.85rem;
		background: var(--surface);
		border-radius: var(--r-m);
	}

	.row-main {
		flex: 1;
		min-width: 0;
	}

	.row-name {
		display: block;
		font-size: 0.9375rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-meta {
		display: block;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 1rem;
	}

	.status {
		color: var(--muted);
		font-size: 0.875rem;
	}

	.error {
		color: var(--danger);
		font-size: 0.875rem;
	}
</style>
