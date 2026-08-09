<script lang="ts">
	import { formatBytes } from '$lib/engine';
	import Dropzone from '../Dropzone.svelte';

	let dataUrl = $state<string | null>(null);
	let fileName = $state('image');
	let fileBytes = $state(0);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let copied = $state<string | null>(null);

	const imgSnippet = $derived(dataUrl ? `<img src="${dataUrl}" alt="">` : '');
	const cssSnippet = $derived(dataUrl ? `background-image: url("${dataUrl}");` : '');

	function onfiles(files: File[]) {
		const file = files[0];
		if (!file) return;
		loading = true;
		loadError = null;
		const reader = new FileReader();
		reader.onload = () => {
			dataUrl = String(reader.result);
			fileName = file.name;
			fileBytes = file.size;
			loading = false;
		};
		reader.onerror = () => {
			loadError = 'Could not read that file';
			loading = false;
		};
		reader.readAsDataURL(file);
	}

	async function copy(what: 'raw' | 'img' | 'css') {
		if (!dataUrl) return;
		const text = what === 'raw' ? dataUrl : what === 'img' ? imgSnippet : cssSnippet;
		await navigator.clipboard.writeText(text);
		copied = what;
		setTimeout(() => (copied = null), 1600);
	}

	function startOver() {
		dataUrl = null;
		loadError = null;
	}
</script>

{#if !dataUrl}
	<div class="editor-load">
		<Dropzone headline="Drop an image here" multiple={false} {onfiles} />
		{#if loading}<p class="editor-status" role="status">Encoding…</p>{/if}
		{#if loadError}<p class="editor-error" role="alert">{loadError}</p>{/if}
	</div>
{:else}
	<div class="editor">
		<div class="stats">
			<span class="mono">{fileName}</span>
			<span class="mono dim">{formatBytes(fileBytes)}</span>
			<span class="arrow" aria-hidden="true">→</span>
			<span class="mono dim">{formatBytes(dataUrl.length)} as Base64</span>
			{#if fileBytes > 50 * 1024}
				<span class="warn">Large for inlining. Consider the compress tool first.</span>
			{/if}
			<button class="btn-ghost" onclick={startOver}>Start over</button>
		</div>

		<div class="block">
			<div class="block-head">
				<span class="block-title">Data URL</span>
				<button class="btn" onclick={() => copy('raw')}>{copied === 'raw' ? 'Copied' : 'Copy'}</button>
			</div>
			<textarea class="mono" readonly rows="6" value={dataUrl} aria-label="Base64 data URL"
			></textarea>
		</div>

		<div class="block">
			<div class="block-head">
				<span class="block-title">As an img tag</span>
				<button class="btn-ghost" onclick={() => copy('img')}>{copied === 'img' ? 'Copied' : 'Copy'}</button>
			</div>
			<pre class="mono">&lt;img src="data:…" alt=""&gt;</pre>
		</div>

		<div class="block">
			<div class="block-head">
				<span class="block-title">As a CSS background</span>
				<button class="btn-ghost" onclick={() => copy('css')}>{copied === 'css' ? 'Copied' : 'Copy'}</button>
			</div>
			<pre class="mono">background-image: url("data:…");</pre>
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

	.stats {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.875rem;
	}

	.stats .btn-ghost {
		margin-left: auto;
	}

	.dim {
		color: var(--muted);
	}

	.warn {
		color: var(--accent);
		font-size: 0.8125rem;
	}

	.block {
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		padding: 0.9rem 1rem;
		background: var(--surface);
	}

	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.6rem;
	}

	.block-title {
		font-weight: 650;
		font-size: 0.9375rem;
	}

	textarea {
		width: 100%;
		resize: vertical;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--surface-deep);
		padding: 0.6rem 0.7rem;
		font-size: 0.75rem;
		color: var(--ink);
		word-break: break-all;
	}

	pre {
		margin: 0;
		padding: 0.6rem 0.7rem;
		background: var(--surface-deep);
		border-radius: var(--r-s);
		font-size: 0.8125rem;
		overflow-x: auto;
	}
</style>
