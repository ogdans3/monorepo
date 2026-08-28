<script lang="ts">
	import { download, toPng, toSvg } from '$lib/flow/export';
	import { tidy } from '$lib/flow/layout';
	import { fromMermaid, looksLikeMermaid, toMermaid } from '$lib/flow/mermaid';
	import {
		addNode,
		connect,
		parseDoc,
		setShape,
		setText,
		SHAPE_LABELS,
		type NodeShape
	} from '$lib/flow/model';
	import { Editor } from '$lib/flow/store.svelte';
	import Canvas from '$lib/ui/Canvas.svelte';

	const editor = new Editor();
	let selected = $state<string | null>(null);
	let tool = $state<NodeShape | null>(null);
	let canvas = $state<ReturnType<typeof Canvas>>();
	let status = $state('');
	let editing = $state<{ id: string; text: string; isEdge: boolean } | null>(null);
	let showText = $state(false);
	let textBuffer = $state('');
	let textNote = $state('');

	const doc = $derived(editor.doc);
	const selectedNode = $derived(doc.nodes.find((n) => n.id === selected) ?? null);
	const selectedEdge = $derived(doc.edges.find((e) => e.id === selected) ?? null);

	const SHAPES: NodeShape[] = ['terminator', 'process', 'decision', 'io', 'note'];

	$effect(() => {
		editor.restore();
		if (editor.doc.nodes.length === 0) startingPoint();
		queueMicrotask(() => canvas?.fit());
	});

	/** An empty canvas teaches nothing, so it opens with the first two boxes. */
	function startingPoint() {
		const start = addNode(editor.doc, 'terminator', 360, 140, 'Start');
		const step = addNode(start.doc, 'process', 360, 300, 'First step');
		editor.replace(connect(step.doc, start.id, step.id));
	}

	function say(message: string) {
		status = message;
		setTimeout(() => (status === message ? (status = '') : null), 4000);
	}

	function openEditor(id: string) {
		const node = doc.nodes.find((n) => n.id === id);
		const edge = doc.edges.find((e) => e.id === id);
		if (node) editing = { id, text: node.text, isEdge: false };
		else if (edge) editing = { id, text: edge.label, isEdge: true };
	}

	function applyEdit(text: string) {
		if (!editing) return;
		editor.commit(setText(doc, editing.id, text));
		editing = null;
	}

	function onKey(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
		const meta = event.metaKey || event.ctrlKey;

		if (meta && event.key.toLowerCase() === 'z') {
			if (typing) return;
			event.preventDefault();
			if (event.shiftKey) editor.redo();
			else editor.undo();
			return;
		}
		if (typing) return;

		if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
			event.preventDefault();
			canvas?.deleteSelected();
		} else if (event.key === 'Enter' && selected) {
			event.preventDefault();
			openEditor(selected);
		} else if (event.key === 'Escape') {
			selected = null;
			tool = null;
			editing = null;
			showText = false;
		}
	}

	function exportSvg() {
		download(new Blob([toSvg(doc)], { type: 'image/svg+xml' }), 'flow-chart.svg');
	}

	async function exportPng() {
		try {
			download(await toPng(doc), 'flow-chart.png');
		} catch (error) {
			say(error instanceof Error ? error.message : 'Could not make a PNG');
		}
	}

	function exportJson() {
		download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), 'flow-chart.json');
	}

	/**
	 * One box for text in and text out. Mermaid and our own JSON are told apart
	 * by looking at what was pasted, because being asked which one it is, is a
	 * question the paste already answers.
	 */
	function openText() {
		textBuffer = toMermaid(doc);
		textNote = '';
		showText = true;
	}

	function loadText() {
		const text = textBuffer.trim();
		if (!text) return;
		if (looksLikeMermaid(text)) {
			const { doc: parsed, skipped } = fromMermaid(text);
			if (!parsed.nodes.length) return say('Nothing in that looked like a flow chart.');
			editor.replace(tidy(parsed, { originX: 400, originY: 80 }));
			textNote = skipped.length
				? `Loaded. ${skipped.length} line${skipped.length === 1 ? '' : 's'} skipped: ${skipped[0]}`
				: '';
			showText = skipped.length > 0;
			say(`Loaded ${parsed.nodes.length} shapes.`);
		} else {
			try {
				const parsed = parseDoc(JSON.parse(text));
				if (!parsed.nodes.length) return say('That file had no shapes in it.');
				editor.replace(parsed);
				showText = false;
				say(`Loaded ${parsed.nodes.length} shapes.`);
			} catch {
				return say('That is neither Mermaid nor a file from here.');
			}
		}
		queueMicrotask(() => canvas?.fit());
	}

	async function copyText() {
		try {
			await navigator.clipboard.writeText(textBuffer);
			say('Copied.');
		} catch {
			say('Could not reach the clipboard. Select the text and copy it.');
		}
	}

	function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		void file.text().then((text) => {
			textBuffer = text;
			loadText();
		});
	}

	function clearAll() {
		editor.replace({ nodes: [], edges: [] });
		editor.forget();
		selected = null;
		say('Cleared. Undo brings it back.');
	}
</script>

<svelte:head>
	<title>Flow chart — draw one in the browser</title>
	<meta
		name="description"
		content="Draw a flow chart in your browser. Boxes, decisions and arrows, tidied up on demand, out as SVG, PNG or Mermaid. Nothing is uploaded."
	/>
</svelte:head>

<svelte:window onkeydown={onKey} />

<div class="app">
	<header>
		<h1>Flow chart</h1>

		<div class="group" role="group" aria-label="Add a shape">
			{#each SHAPES as shape (shape)}
				<button
					class="chip"
					class:active={tool === shape}
					aria-pressed={tool === shape}
					title="{SHAPE_LABELS[shape]} — then click the paper"
					onclick={() => (tool = tool === shape ? null : shape)}
				>
					{SHAPE_LABELS[shape]}
				</button>
			{/each}
		</div>

		<div class="group">
			<button class="btn" onclick={() => editor.undo()} disabled={!editor.canUndo}>Undo</button>
			<button class="btn" onclick={() => editor.redo()} disabled={!editor.canRedo}>Redo</button>
			<button
				class="btn"
				title="Arrange the shapes in rows, following the arrows"
				onclick={() => {
					editor.commit(tidy(doc, { originX: 400, originY: 80 }));
					queueMicrotask(() => canvas?.fit());
				}}>Tidy up</button
			>
			<button class="btn" onclick={() => canvas?.fit()}>Fit</button>
		</div>

		<div class="group right">
			<button class="btn" onclick={openText}>Text</button>
			<label class="btn" title="Open a .json or .mmd file">
				Open<input type="file" accept=".json,.mmd,.txt,application/json,text/plain" onchange={onFile} />
			</label>
			<button class="btn" onclick={exportSvg}>SVG</button>
			<button class="btn" onclick={exportPng}>PNG</button>
			<button class="btn primary" onclick={exportJson}>Save</button>
		</div>
	</header>

	<main>
		<Canvas bind:this={canvas} {doc} bind:selected bind:tool commit={(d, c) => editor.commit(d, c)} onedit={openEditor} />

		<p class="hint" role="status">
			{#if status}
				{status}
			{:else if tool}
				Click the paper to place a {SHAPE_LABELS[tool].toLowerCase()}.
			{:else if selectedNode}
				{selectedNode.text || 'Unnamed'} — double click to rename, shift-drag to connect it,
				Delete to remove.
			{:else if selectedEdge}
				Arrow selected. Double click it to label the branch, Delete to remove.
			{:else}
				Pick a shape and click the paper. Shift-drag from one shape to another to connect them.
				Drag the paper to move around, scroll to zoom.
			{/if}
		</p>

		{#if selectedNode}
			<div class="inspector">
				<span class="inspector-label">Shape</span>
				{#each SHAPES as shape (shape)}
					<button
						class="chip"
						class:active={selectedNode.shape === shape}
						aria-pressed={selectedNode.shape === shape}
						onclick={() => editor.commit(setShape(doc, selectedNode.id, shape))}
					>
						{SHAPE_LABELS[shape]}
					</button>
				{/each}
				<button class="chip danger" onclick={() => canvas?.deleteSelected()}>Delete</button>
			</div>
		{/if}
	</main>

	{#if editing}
		<div class="sheet" role="dialog" aria-label="Rename">
			<label for="node-text">{editing.isEdge ? 'Arrow label' : 'What happens here'}</label>
			<input
				id="node-text"
				value={editing.text}
				{@attach (input: HTMLInputElement) => {
					// Focused on open, because the sheet exists to be typed into.
					input.focus();
					input.select();
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter') applyEdit(e.currentTarget.value);
					if (e.key === 'Escape') editing = null;
				}}
				onblur={(e) => applyEdit(e.currentTarget.value)}
			/>
			<span class="sheet-hint">Enter to keep it, Escape to leave it</span>
		</div>
	{/if}

	{#if showText}
		<div class="sheet text-sheet" role="dialog" aria-label="Diagram as text">
			<div class="sheet-head">
				<strong>As Mermaid</strong>
				<span class="sheet-hint">Paste Mermaid or a saved file here and load it back.</span>
				<button class="chip" onclick={() => (showText = false)}>Close</button>
			</div>
			<textarea bind:value={textBuffer} spellcheck="false" aria-label="Mermaid text"></textarea>
			{#if textNote}<p class="note">{textNote}</p>{/if}
			<div class="sheet-actions">
				<button class="btn" onclick={copyText}>Copy</button>
				<button class="btn primary" onclick={loadText}>Load this</button>
				<button class="btn" onclick={clearAll}>Clear the canvas</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.9rem;
		padding: 0.6rem 0.9rem;
		border-bottom: 1px solid var(--line);
		background: var(--surface-deep);
	}

	h1 {
		margin: 0 0.4rem 0 0;
		font-size: 0.95rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.group.right {
		margin-left: auto;
	}

	.group label.btn input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}

	main {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	.hint {
		position: absolute;
		left: 50%;
		bottom: 0.9rem;
		transform: translateX(-50%);
		margin: 0;
		padding: 0.35rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		background: color-mix(in oklch, var(--surface) 92%, transparent);
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: min(90vw, 46rem);
		text-align: center;
		pointer-events: none;
	}

	.inspector {
		position: absolute;
		top: 0.9rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		background: var(--surface);
		box-shadow: 0 6px 20px oklch(0.24 0.014 70 / 0.08);
	}

	.inspector-label {
		font-size: 0.8125rem;
		color: var(--muted);
		padding: 0 0.25rem;
	}

	.chip.danger {
		color: var(--danger);
	}

	.sheet {
		position: absolute;
		left: 50%;
		bottom: 3.5rem;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
		box-shadow: 0 10px 30px oklch(0.24 0.014 70 / 0.12);
		width: min(92vw, 32rem);
	}

	.sheet label {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.sheet input {
		padding: 0.45rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: inherit;
		color: var(--ink);
	}

	.sheet-hint {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.text-sheet {
		width: min(92vw, 44rem);
	}

	.sheet-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.sheet-head .sheet-hint {
		flex: 1;
	}

	.text-sheet textarea {
		height: min(40vh, 18rem);
		padding: 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: 0.8125rem/1.5 var(--font-mono);
		color: var(--ink);
		resize: vertical;
	}

	.sheet-actions {
		display: flex;
		gap: 0.4rem;
	}

	.note {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
