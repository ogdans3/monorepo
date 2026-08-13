<script lang="ts">
	import { loadPdfLib, pdfBlob, pdfName, readPdf, releasePdf, type LoadedPdf } from '$lib/tools/pdf';
	import { downloadBlob } from '../../download';
	import Dropzone from '../../Dropzone.svelte';
	import PdfPageGrid from './PdfPageGrid.svelte';

	let {
		mode
	}: {
		/** watermark: big diagonal text. numbers: a small page number. */
		mode: 'watermark' | 'numbers';
	} = $props();

	const POSITIONS = [
		{ id: 'bl', label: 'Bottom left' },
		{ id: 'bc', label: 'Bottom centre' },
		{ id: 'br', label: 'Bottom right' },
		{ id: 'tl', label: 'Top left' },
		{ id: 'tc', label: 'Top centre' },
		{ id: 'tr', label: 'Top right' }
	] as const;

	// mode is fixed per route, so these are starting values by design
	let pdf = $state<LoadedPdf | null>(null);
	let text = $state('DRAFT');
	// svelte-ignore state_referenced_locally
	let size = $state(mode === 'watermark' ? 60 : 11);
	// svelte-ignore state_referenced_locally
	let opacity = $state(mode === 'watermark' ? 20 : 100);
	let angle = $state(45);
	// svelte-ignore state_referenced_locally
	let colorMode = $state<'grey' | 'black' | 'custom'>(mode === 'watermark' ? 'grey' : 'black');
	let customColor = $state('#c62d6a');
	let position = $state<(typeof POSITIONS)[number]['id']>('bc');
	let startAt = $state(1);
	let showTotal = $state(false);
	let loading = $state(false);
	let working = $state(false);
	let loadError = $state<string | null>(null);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const loaded = await readPdf(file);
			releasePdf(pdf);
			pdf = loaded;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that PDF';
		} finally {
			loading = false;
		}
	}

	function rgbParts(): [number, number, number] {
		if (colorMode === 'grey') return [0.5, 0.5, 0.5];
		if (colorMode === 'black') return [0, 0, 0];
		const hex = customColor.replace('#', '');
		return [
			parseInt(hex.slice(0, 2), 16) / 255,
			parseInt(hex.slice(2, 4), 16) / 255,
			parseInt(hex.slice(4, 6), 16) / 255
		];
	}

	async function download() {
		if (!pdf) return;
		if (mode === 'watermark' && !text.trim()) return;
		working = true;
		try {
			const { PDFDocument, StandardFonts, rgb, degrees } = await loadPdfLib();
			const doc = await PDFDocument.load(pdf.bytes.slice());
			const font = await doc.embedFont(StandardFonts.HelveticaBold);
			const [r, g, b] = rgbParts();
			const colour = rgb(r, g, b);
			const pages = doc.getPages();

			pages.forEach((page, i) => {
				const { width, height } = page.getSize();
				if (mode === 'watermark') {
					const label = text.trim();
					const textWidth = font.widthOfTextAtSize(label, size);
					// centred, then turned about the middle of the page
					page.drawText(label, {
						x: width / 2 - textWidth / 2,
						y: height / 2 - size / 2,
						size,
						font,
						color: colour,
						opacity: opacity / 100,
						rotate: degrees(angle)
					});
					return;
				}

				const label = showTotal
					? `${startAt + i} / ${startAt + pages.length - 1}`
					: String(startAt + i);
				const textWidth = font.widthOfTextAtSize(label, size);
				const margin = 28;
				const x =
					position[1] === 'l' ? margin : position[1] === 'r' ? width - margin - textWidth : width / 2 - textWidth / 2;
				const y = position[0] === 't' ? height - margin - size : margin;
				page.drawText(label, { x, y, size, font, color: colour, opacity: opacity / 100 });
			});

			downloadBlob(
				pdfBlob(await doc.save()),
				pdfName(pdf.name, mode === 'watermark' ? '-watermarked' : '-numbered')
			);
		} finally {
			working = false;
		}
	}

	function startOver() {
		releasePdf(pdf);
		pdf = null;
		loadError = null;
	}

	$effect(() => () => releasePdf(pdf));
</script>

{#if !pdf}
	<div class="editor-load">
		<Dropzone headline="Drop a PDF here" multiple={false} accept=".pdf,application/pdf" {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading pages…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			{#if mode === 'watermark'}
				<label class="field grow">
					<span>Text</span>
					<input type="text" bind:value={text} placeholder="DRAFT" />
				</label>
			{:else}
				<label class="field">
					<span>Start at</span>
					<input
						class="mono"
						type="number"
						min="0"
						max="9999"
						value={startAt}
						onchange={(e) => (startAt = Math.max(0, Math.floor(+e.currentTarget.value) || 0))}
					/>
				</label>
				<label class="check">
					<input type="checkbox" bind:checked={showTotal} />
					Show total, like 3 / 12
				</label>
			{/if}
			<button class="btn-ghost start-over" onclick={startOver}>Start over</button>
		</div>

		<div class="controls">
			<div class="quality">
				<label for="stamp-size">Size</label>
				<input id="stamp-size" type="range" min={mode === 'watermark' ? 20 : 6} max={mode === 'watermark' ? 140 : 24} bind:value={size} />
				<output class="mono" for="stamp-size">{size}</output>
			</div>
			<div class="quality">
				<label for="stamp-opacity">Opacity</label>
				<input id="stamp-opacity" type="range" min="5" max="100" bind:value={opacity} />
				<output class="mono" for="stamp-opacity">{opacity}</output>
			</div>
			{#if mode === 'watermark'}
				<div class="quality">
					<label for="stamp-angle">Angle</label>
					<input id="stamp-angle" type="range" min="0" max="90" bind:value={angle} />
					<output class="mono" for="stamp-angle">{angle}°</output>
				</div>
			{/if}
		</div>

		<div class="rows">
			<div class="row" role="group" aria-label="Colour">
				<span class="row-label">Colour</span>
				<button class="chip" class:active={colorMode === 'grey'} aria-pressed={colorMode === 'grey'} onclick={() => (colorMode = 'grey')}>Grey</button>
				<button class="chip" class:active={colorMode === 'black'} aria-pressed={colorMode === 'black'} onclick={() => (colorMode = 'black')}>Black</button>
				<button class="chip" class:active={colorMode === 'custom'} aria-pressed={colorMode === 'custom'} onclick={() => (colorMode = 'custom')}>Colour</button>
				{#if colorMode === 'custom'}
					<input type="color" bind:value={customColor} aria-label="Stamp colour" />
				{/if}
			</div>

			{#if mode === 'numbers'}
				<div class="row" role="group" aria-label="Position">
					<span class="row-label">Position</span>
					{#each POSITIONS as p (p.id)}
						<button class="chip" class:active={position === p.id} aria-pressed={position === p.id} onclick={() => (position = p.id)}>
							{p.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<PdfPageGrid pages={pdf.pages} label="Pages in this document" />

		<div class="result-bar">
			<span class="result-text mono">
				{pdfName(pdf.name, mode === 'watermark' ? '-watermarked' : '-numbered')}
			</span>
			<button
				class="btn"
				onclick={download}
				disabled={working || (mode === 'watermark' && !text.trim())}
			>
				{working ? 'Building…' : 'Download PDF'}
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

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.field.grow {
		flex: 1;
		max-width: 18rem;
	}

	.field input {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font-size: 0.875rem;
		color: var(--ink);
		width: 100%;
	}

	.field.grow input {
		font-weight: 600;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.8125rem;
		color: var(--muted);
		padding-bottom: 0.4rem;
		cursor: pointer;
	}

	.check input {
		accent-color: var(--primary);
	}

	.start-over {
		margin-left: auto;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 2rem;
	}

	.controls .quality {
		flex: 1;
		min-width: 12rem;
		max-width: 18rem;
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.row-label {
		font-size: 0.875rem;
		color: var(--muted);
		min-width: 5rem;
	}

	.row input[type='color'] {
		width: 2.2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
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
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
