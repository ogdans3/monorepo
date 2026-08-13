<script lang="ts">
	import { loadPdfjs, looksLikePdf } from '$lib/tools/pdf';
	import { downloadBlob } from '../../download';
	import Dropzone from '../../Dropzone.svelte';

	interface PageText {
		n: number;
		text: string;
	}

	let name = $state('document.pdf');
	let pages = $state<PageText[]>([]);
	let loaded = $state(false);
	let loading = $state(false);
	let copied = $state(false);
	let loadError = $state<string | null>(null);

	const full = $derived(
		pages.map((p) => `--- Page ${p.n} ---\n${p.text.trim()}`).join('\n\n').trim()
	);
	const charCount = $derived(pages.reduce((sum, p) => sum + p.text.trim().length, 0));
	const emptyPages = $derived(pages.filter((p) => !p.text.trim()).length);

	async function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			if (!looksLikePdf(bytes)) throw new Error(`${file.name} does not look like a PDF`);
			const pdfjs = await loadPdfjs();
			const doc = await pdfjs.getDocument({ data: bytes }).promise;
			const out: PageText[] = [];
			for (let n = 1; n <= doc.numPages; n++) {
				const page = await doc.getPage(n);
				const content = await page.getTextContent();
				// items carry their own spacing, and hasEOL marks a line break
				let text = '';
				for (const item of content.items) {
					if (!('str' in item)) continue;
					text += item.str;
					if (item.hasEOL) text += '\n';
					else if (item.str && !item.str.endsWith(' ')) text += ' ';
				}
				out.push({ n, text: text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n') });
			}
			name = file.name;
			pages = out;
			loaded = true;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Could not read that PDF';
		} finally {
			loading = false;
		}
	}

	async function copyAll() {
		await navigator.clipboard.writeText(full);
		copied = true;
		setTimeout(() => (copied = false), 1600);
	}

	function downloadTxt() {
		downloadBlob(
			new Blob([full], { type: 'text/plain;charset=utf-8' }),
			name.replace(/\.pdf$/i, '') + '.txt'
		);
	}

	function startOver() {
		pages = [];
		loaded = false;
		loadError = null;
	}
</script>

{#if !loaded}
	<div class="editor-load">
		<Dropzone headline="Drop a PDF here" multiple={false} accept=".pdf,application/pdf" {onfiles} />
		{#if loading}<p class="editor-status" role="status">Reading text…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="toolbar">
			<p class="hint" role="status">
				{#if charCount === 0}
					No text found. This looks like a scan, which is a picture of text rather than text.
				{:else}
					<span class="mono">{charCount.toLocaleString('en')}</span> characters from
					<span class="mono">{pages.length}</span>
					{pages.length === 1 ? 'page' : 'pages'}{emptyPages > 0
						? `, and ${emptyPages} ${emptyPages === 1 ? 'page has' : 'pages have'} no text`
						: ''}.
				{/if}
			</p>
			<div class="toolbar-group">
				<button class="btn" onclick={copyAll} disabled={charCount === 0}>
					{copied ? 'Copied' : 'Copy all'}
				</button>
				<button class="btn-ghost" onclick={downloadTxt} disabled={charCount === 0}>
					Download .txt
				</button>
				<button class="btn-ghost" onclick={startOver}>Start over</button>
			</div>
		</div>

		<div class="pages">
			{#each pages as page (page.n)}
				<section class="page">
					<h3 class="mono">Page {page.n}</h3>
					{#if page.text.trim()}
						<pre>{page.text.trim()}</pre>
					{:else}
						<p class="empty">No text on this page.</p>
					{/if}
				</section>
			{/each}
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

	.editor-status,
	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.hint .mono {
		color: var(--ink);
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
		justify-content: space-between;
		gap: 0.6rem 1rem;
	}

	.toolbar-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.pages {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		max-height: 70vh;
		overflow-y: auto;
		padding: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
	}

	.page h3 {
		margin: 0 0 0.35rem;
		font-size: 0.75rem;
		font-weight: 650;
		color: var(--muted);
	}

	.page pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: var(--font-ui);
		font-size: 0.875rem;
		line-height: 1.55;
	}

	.empty {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
