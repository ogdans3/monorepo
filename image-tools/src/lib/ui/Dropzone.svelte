<script lang="ts">
	import { acceptAttribute } from '$lib/engine';

	let {
		headline,
		onfiles,
		multiple = true
	}: {
		headline: string;
		onfiles: (files: File[]) => void;
		multiple?: boolean;
	} = $props();

	let input: HTMLInputElement | undefined = $state();
	let dragDepth = $state(0);
	const dragging = $derived(dragDepth > 0);

	function draggedFiles(e: DragEvent): boolean {
		return Array.from(e.dataTransfer?.types ?? []).includes('Files');
	}

	// The whole page is a drop target; the zone lights up to show where the
	// files are headed. Enter/leave are counted because they fire per element.
	function windowDragEnter(e: DragEvent) {
		if (!draggedFiles(e)) return;
		e.preventDefault();
		dragDepth++;
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
		if (files.length) onfiles(files);
	}

	function windowPaste(e: ClipboardEvent) {
		const files = Array.from(e.clipboardData?.files ?? []);
		if (files.length) onfiles(files);
	}

	function pick() {
		if (!input?.files) return;
		const files = Array.from(input.files);
		input.value = '';
		if (files.length) onfiles(files);
	}
</script>

<svelte:window
	ondragenter={windowDragEnter}
	ondragleave={windowDragLeave}
	ondragover={windowDragOver}
	ondrop={windowDrop}
	onpaste={windowPaste}
/>

<label class="zone" class:dragging>
	<input bind:this={input} type="file" {multiple} accept={acceptAttribute()} onchange={pick} />
	<span class="zone-headline">{dragging ? 'Drop to convert' : headline}</span>
	<span class="zone-hint">or click to browse. Paste works too</span>
</label>

<style>
	.zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 3.25rem 1.5rem;
		background: var(--surface);
		border: 1.5px dashed var(--line);
		border-radius: var(--r-m);
		cursor: pointer;
		text-align: center;
		transition:
			border-color 150ms var(--ease),
			background-color 150ms var(--ease);
	}

	.zone:hover {
		border-color: var(--muted);
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
		font-size: 1.125rem;
		font-weight: 650;
	}

	.zone.dragging .zone-headline {
		color: var(--primary-deep);
	}

	.zone-hint {
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
