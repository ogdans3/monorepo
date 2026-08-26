<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		FORMATS,
		encodeRaw,
		editedFileName,
		needsBackground,
		type FormatId,
		type RawImage
	} from '$lib/engine';
	import { toolBySlug } from '$lib/tools/registry';
	import { carry } from '../carry.svelte';
	import ContinueIn from '../ContinueIn.svelte';
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

	/**
	 * A file carried in from another tool keeps its format, so converting to JPG
	 * and then cropping saves a JPG rather than quietly going back to PNG. Only
	 * as a starting value, and only if this tool offers that format at all.
	 */
	function startingFormat(): FormatId {
		const carriedId = (Object.keys(FORMATS) as FormatId[]).find(
			(id) => FORMATS[id].mime === carry.openedType
		);
		return carriedId && formats.includes(carriedId) ? carriedId : defaultFormat;
	}

	// the prop is only the starting value, the user picks from there
	// svelte-ignore state_referenced_locally
	let formatId = $state(startingFormat());
	let quality = $state(90);
	let background = $state('#ffffff');
	let busy = $state(false);

	const format = $derived(FORMATS[formatId]);
	const outName = $derived(editedFileName(baseName, suffix, format.extensions[0]));

	/** Which tool this is, taken from the URL so no editor has to say. */
	const here = $derived(toolBySlug(page.url.pathname.split('/').filter(Boolean).pop() ?? ''));

	/** The finished result, encoded exactly as the Download button would. */
	async function result(): Promise<File> {
		const raw = await render();
		const blob = await encodeRaw(raw, format, { quality, background });
		return new File([blob], outName, { type: format.mime });
	}

	/** Where a picture is worth having with you when you arrive. */
	const CARRIES = ['/tools', '/pdf', '/convert'];

	let capturing = false;

	/**
	 * Whatever is on screen follows you, not whatever was handed over last.
	 *
	 * Without this, cropping an image and then reaching the next tool by any
	 * route other than the buttons below hands on the file you arrived with, so
	 * the crop quietly vanishes. The result cannot be rendered in advance, since
	 * that would mean encoding the full-size image after every edit, and it
	 * cannot be rendered during navigation either, because that is synchronous.
	 * So the navigation is stopped, the result is made, and then it carries on
	 * to exactly where it was going.
	 *
	 * Only for links and code-driven navigation. Cancelling a Back button and
	 * re-issuing it would push a new entry onto the history instead of going
	 * back, and pressing Back is not somebody saying "bring this with me".
	 */
	beforeNavigate((nav) => {
		if (capturing || carry.handing || busy) return;
		if (nav.type !== 'link' && nav.type !== 'goto') return;
		const to = nav.to?.url;
		if (!to || to.origin !== location.origin) return;
		if (!CARRIES.some((path) => to.pathname === path || to.pathname.startsWith(`${path}/`))) return;

		nav.cancel();
		capturing = true;
		busy = true;
		void (async () => {
			try {
				carry.hand(await result(), here?.name ?? 'the last step');
			} catch {
				// Nothing renderable, so travel with whatever was already held.
			} finally {
				busy = false;
				await goto(to);
				capturing = false;
			}
		})();
	});

	async function download() {
		busy = true;
		try {
			downloadBlob(await result(), outName);
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

	<ContinueIn
		produce={result}
		from={here?.name ?? 'the last step'}
		name={outName}
		type={format.mime}
		exclude={here?.slug}
		disabled={busy}
	/>
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
