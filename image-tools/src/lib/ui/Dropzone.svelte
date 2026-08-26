<script lang="ts">
	import { page } from '$app/state';
	import { acceptAttribute } from '$lib/engine';
	import { acceptsFile } from '$lib/tools/handoff';
	import { carry } from './carry.svelte';

	let {
		headline,
		onfiles,
		onintent,
		multiple = true,
		accept = acceptAttribute()
	}: {
		headline: string;
		onfiles: (files: File[]) => void;
		/** Fires once when a drag starts, to warm up heavy decoders early. */
		onintent?: () => void;
		multiple?: boolean;
		/** Override for non-image tools, e.g. the PDF pages. */
		accept?: string;
	} = $props();

	let intentFired = false;

	function signalIntent() {
		if (intentFired) return;
		intentFired = true;
		onintent?.();
	}

	let input: HTMLInputElement | undefined = $state();
	let dragDepth = $state(0);
	const dragging = $derived(dragDepth > 0);

	/**
	 * A result carried out of another tool, if this one can read it. Every tool
	 * and every conversion page takes its files through this component, so
	 * offering it here is what makes the chain work in any order without each
	 * tool knowing anything about it.
	 */
	let used = $state(false);
	const waiting = $derived(
		carry.current && !used && acceptsFile(carry.current.file, accept) ? carry.current : null
	);

	function useCarried() {
		const held = carry.current;
		if (!held) return;
		used = true;
		carry.markOpened(held.file);
		onfiles([held.file]);
	}

	/** A file of their own replaces whatever was being carried on from before. */
	function fresh(files: File[]) {
		carry.markOpened(null);
		onfiles(files);
	}

	// A destination the visitor chose opens straight away. Anywhere else asks
	// first, because finding an image already loaded is only welcome if you
	// asked for it.
	$effect(() => {
		const held = carry.current;
		if (!held?.to || used) return;
		if (held.to !== page.url.pathname) return;
		if (!acceptsFile(held.file, accept)) return;
		carry.arrived();
		useCarried();
	});

	function draggedFiles(e: DragEvent): boolean {
		return Array.from(e.dataTransfer?.types ?? []).includes('Files');
	}

	// The whole page is a drop target; the zone lights up to show where the
	// files are headed. Enter/leave are counted because they fire per element.
	function windowDragEnter(e: DragEvent) {
		if (!draggedFiles(e)) return;
		e.preventDefault();
		dragDepth++;
		// a file is on its way in, so start fetching the decoder now
		signalIntent();
	}

	function windowDragLeave(e: DragEvent) {
		if (draggedFiles(e)) dragDepth = Math.max(0, dragDepth - 1);
	}

	function windowDragOver(e: DragEvent) {
		if (draggedFiles(e)) e.preventDefault();
	}

	function windowDrop(e: DragEvent) {
		if (!draggedFiles(e)) return;
		e.preventDefault();
		dragDepth = 0;
		const files = Array.from(e.dataTransfer?.files ?? []);
		if (files.length) fresh(files);
	}

	function windowPaste(e: ClipboardEvent) {
		const files = Array.from(e.clipboardData?.files ?? []);
		if (files.length) fresh(files);
	}

	function pick() {
		if (!input?.files) return;
		const files = Array.from(input.files);
		input.value = '';
		if (files.length) fresh(files);
	}
</script>

<svelte:window
	ondragenter={windowDragEnter}
	ondragleave={windowDragLeave}
	ondragover={windowDragOver}
	ondrop={windowDrop}
	onpaste={windowPaste}
/>

<label class="zone" class:dragging onpointerenter={signalIntent}>
	<input bind:this={input} type="file" {multiple} {accept} onchange={pick} />
	<span class="zone-headline">{dragging ? 'Drop to convert' : headline}</span>
	<span class="zone-hint">or click to browse. Paste works too</span>
</label>

{#if waiting}
	<p class="carried">
		<button class="btn-ghost" onclick={useCarried}>
			Continue with {waiting.file.name}
		</button>
		<span class="carried-note">from {waiting.from}, still open in this tab</span>
		<button class="carried-drop" onclick={() => carry.forget()} title="Forget it">Forget</button>
	</p>
{/if}

<style>
	.zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		padding: 3.5rem 1.5rem;
		background: var(--surface);
		border: 1.5px dashed var(--line);
		border-radius: var(--r-l);
		cursor: pointer;
		text-align: center;
		transition:
			border-color 150ms var(--ease),
			background-color 150ms var(--ease);
	}

	.zone:hover {
		border-color: var(--muted);
		background: var(--surface-deep);
	}

	.zone.dragging {
		border-color: var(--primary);
		border-style: solid;
		background: var(--surface-deep);
	}

	.zone:focus-within {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.zone input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}

	.zone-headline {
		font-size: 1.25rem;
		font-weight: 650;
		letter-spacing: -0.01em;
	}

	.zone.dragging .zone-headline {
		color: var(--primary-deep);
	}

	.zone-hint {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.carried {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.6rem 0 0;
		font-size: 0.875rem;
	}

	.carried-note {
		flex: 1;
		min-width: 10rem;
		color: var(--muted);
	}

	.carried-drop {
		padding: 0.2rem 0.4rem;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: 0.8125rem;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
