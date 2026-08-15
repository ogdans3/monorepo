<script lang="ts">
	import {
		FORMATS,
		encodeRaw,
		editedFileName,
		needsBackground,
		type FormatId,
		type RawImage
	} from '$lib/engine';
	import { downloadBlob } from '../download';
	import BackgroundPicker from '../BackgroundPicker.svelte';

	let {
		render,
		baseName,
		suffix,
		formats = ['png', 'jpg', 'webp'],
		defaultFormat = 'png'
	}: {
		/** Produces the full-resolution result when Download is pressed. */
		render: () => RawImage | Promise<RawImage>;
		baseName: string;
		suffix: string;
		formats?: FormatId[];
		defaultFormat?: FormatId;
	} = $props();

	// the prop is only the starting value, the user picks from there
	// svelte-ignore state_referenced_locally
	let formatId = $state(defaultFormat);
	let quality = $state(90);
	let background = $state('#ffffff');
	let busy = $state(false);

	const format = $derived(FORMATS[formatId]);
	const outName = $derived(editedFileName(baseName, suffix, format.extensions[0]));

	async function download() {
		busy = true;
		try {
			const raw = await render();
			const blob = await encodeRaw(raw, format, { quality, background });
			downloadBlob(blob, outName);
		} finally {
			busy = false;
		}
	}
</script>

<div class="export">
	<div class="export-row">
		<div class="export-formats" role="group" aria-label="Output format">
			{#each formats as id (id)}
				<button
					class="chip"
					class:active={formatId === id}
					aria-pressed={formatId === id}
					onclick={() => (formatId = id)}
				>
					{FORMATS[id].name}
				</button>
			{/each}
		</div>
		<span class="export-name mono" title={outName}>{outName}</span>
		<button class="btn" onclick={download} disabled={busy}>
			{busy ? 'Rendering…' : 'Download'}
		</button>
	</div>
	{#if format.lossy}
		<div class="quality">
			<label for="export-quality">Quality</label>
			<input id="export-quality" type="range" min="1" max="100" bind:value={quality} />
			<output class="mono" for="export-quality">{quality}</output>
		</div>
	{/if}
	{#if needsBackground(format)}
		<BackgroundPicker bind:value={background} />
		<p class="export-note">
			{#if format.transparency === 'none'}
				{format.name} can't store transparency, so anything see-through gets this colour behind
				it.
			{:else}
				{format.name} transparency is on or off, so soft edges are blended onto this colour.
			{/if}
		</p>
	{/if}
</div>

<style>
	.export {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
	}

	.export-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	.export-formats {
		display: flex;
		gap: 0.4rem;
	}

	.export-name {
		flex: 1;
		min-width: 8rem;
		font-size: 0.8125rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: right;
	}

	.export-note {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
