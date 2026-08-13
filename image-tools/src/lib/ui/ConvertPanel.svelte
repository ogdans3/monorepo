<script lang="ts">
	import { TARGETS, resolveFormat, warmDecoder, type Format } from '$lib/engine';
	import { Converter } from './converter.svelte';
	import { downloadBlob } from './download';
	import Dropzone from './Dropzone.svelte';
	import FileRow from './FileRow.svelte';

	let {
		target,
		targetExt,
		sourceName,
		showTargetPicker = false,
		zipName = 'converted.zip'
	}: {
		target: Format;
		targetExt?: string;
		/** The page's nominal source, e.g. "HEIC" — labels only, anything converts. */
		sourceName?: string;
		showTargetPicker?: boolean;
		zipName?: string;
	} = $props();

	// Deliberately captures the mount-time target: pair pages remount the
	// panel via {#key page.slug}, and the landing picker mutates conv directly.
	// svelte-ignore state_referenced_locally
	const conv = new Converter(target, targetExt);

	$effect(() => () => conv.destroy());

	let zipping = $state(false);

	// On a HEIC or TIFF page the decoder is a megabyte of WASM. Fetch it as
	// soon as the visitor reaches for the dropzone, so the first conversion
	// does not start with a download.
	function warmSource() {
		const source = sourceName ? resolveFormat(sourceName) : undefined;
		if (source) warmDecoder(source);
	}

	async function downloadZip() {
		zipping = true;
		try {
			downloadBlob(await conv.zipAll(), zipName);
		} finally {
			zipping = false;
		}
	}
</script>

<section class="panel">
	<Dropzone
		headline={sourceName ? `Drop ${sourceName} files here` : 'Drop images here'}
		onfiles={(files) => conv.add(files)}
		onintent={warmSource}
	/>

	{#if showTargetPicker}
		<div class="picker" role="group" aria-label="Target format">
			<span class="picker-label mono">to</span>
			{#each TARGETS as t (t.id)}
				<button
					class="chip"
					class:active={conv.target.id === t.id}
					aria-pressed={conv.target.id === t.id}
					onclick={() => conv.setTarget(t)}
				>
					{t.name}
				</button>
			{/each}
		</div>
	{/if}

	{#if conv.target.lossy}
		<div class="quality">
			<label for="quality">Quality</label>
			<input
				id="quality"
				type="range"
				min="1"
				max="100"
				bind:value={conv.quality}
				onchange={() => conv.redoDone()}
			/>
			<output class="mono" for="quality">{conv.quality}</output>
		</div>
	{/if}

	{#if conv.jobs.length}
		<ul class="rows">
			{#each conv.jobs as job (job.id)}
				<FileRow {job} onremove={() => conv.remove(job.id)} onretry={() => conv.retry(job.id)} />
			{/each}
		</ul>
	{/if}

	{#if conv.doneCount >= 2}
		<div class="zip-bar">
			<button class="btn-ghost" onclick={downloadZip} disabled={zipping}>
				{zipping ? 'Zipping…' : `Download all ${conv.doneCount} as zip`}
			</button>
		</div>
	{/if}

	<p class="visually-hidden" role="status" aria-live="polite">
		{conv.busy
			? `Converting, ${conv.doneCount} of ${conv.jobs.length} done`
			: conv.jobs.length
				? `${conv.doneCount} of ${conv.jobs.length} files converted`
				: ''}
	</p>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.picker {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.picker-label {
		color: var(--muted);
		font-size: 0.8125rem;
		margin-right: 0.2rem;
	}

	.rows {
		list-style: none;
		margin: 0.25rem 0 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}

	.zip-bar {
		display: flex;
		justify-content: flex-end;
	}
</style>
