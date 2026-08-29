<script lang="ts">
	import { download, toPng, toSvg } from '$lib/flow/export';
	import { tidy } from '$lib/flow/layout';
	import { fromMermaid, looksLikeMermaid, toMermaid } from '$lib/flow/mermaid';
	import {
		addNode,
		connect,
		parseDoc,
		setEdgeLabel,
		updateNode,
		visibleDoc,
		withRecent,
		type FlowNode,
		type NodeShape
	} from '$lib/flow/model';
	import { Editor, recentColours } from '$lib/flow/store.svelte';
	import Canvas from '$lib/ui/Canvas.svelte';
	import Inspector from '$lib/ui/Inspector.svelte';

	const editor = new Editor();
	let selected = $state<string | null>(null);
	let tool = $state<NodeShape | null>(null);
	let canvas = $state<ReturnType<typeof Canvas>>();
	let status = $state('');
	/** Only arrows use the little sheet now; a shape gets the panel at the side. */
	let editing = $state<{ id: string; text: string } | null>(null);
	let panel = $state<{ id: string; focusText: boolean } | null>(null);
	let presenting = $state(false);
	let showText = $state(false);
	let textBuffer = $state('');
	let textNote = $state('');

	const doc = $derived(editor.doc);
	const selectedNode = $derived(doc.nodes.find((n) => n.id === selected) ?? null);
	const selectedEdge = $derived(doc.edges.find((e) => e.id === selected) ?? null);
	const panelNode = $derived(panel ? (doc.nodes.find((n) => n.id === panel!.id) ?? null) : null);
	/** Collapsed nodes still holding something back, for stepping a presentation. */
	const foldedIds = $derived(
		visibleDoc(doc).nodes.filter((node) => node.collapsed).map((node) => node.id)
	);

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
		if (doc.nodes.some((node) => node.id === id)) {
			selected = id;
			panel = { id, focusText: true };
			return;
		}
		const edge = doc.edges.find((e) => e.id === id);
		if (edge) editing = { id, text: edge.label };
	}

	function applyEdit(text: string) {
		if (!editing) return;
		editor.commit(setEdgeLabel(doc, editing.id, text));
		editing = null;
	}

	/**
	 * A change from the panel. Typing coalesces so a sentence is one step in the
	 * history rather than forty, and everything else is a step of its own.
	 */
	function patch(node: FlowNode, change: Partial<FlowNode>, coalesce = false) {
		editor.commit(updateNode(doc, node.id, change), coalesce);
	}

	$effect(() => {
		// The panel follows the selection: picking a shape is asking about it.
		if (selected && doc.nodes.some((node) => node.id === selected)) {
			if (panel?.id !== selected) panel = { id: selected, focusText: false };
		} else if (panel) {
			panel = null;
		}
	});

	function onKey(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
		const meta = event.metaKey || event.ctrlKey;

		if (presenting) {
			// A presentation is a few keys: forward, back, and out.
			if (event.key === 'Escape') presenting = false;
			if (event.key === ' ' || event.key === 'ArrowRight') {
				event.preventDefault();
				revealNext();
			}
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				foldLast();
			}
			return;
		}

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

	/**
	 * Presenting is the diagram without the editor: no toolbar, no panel, no
	 * buds, fitted to the screen. Folded branches become the steps of the talk,
	 * so a chart drawn with them collapsed is already a deck.
	 */
	let opened = $state<string[]>([]);

	function present() {
		presenting = true;
		selected = null;
		panel = null;
		opened = [];
		queueMicrotask(() => canvas?.fit());
	}

	function revealNext() {
		const next = foldedIds[0];
		if (!next) return;
		editor.commit(updateNode(doc, next, { collapsed: false }));
		opened = [...opened, next];
		queueMicrotask(() => canvas?.fit());
	}

	function foldLast() {
		const last = opened.at(-1);
		if (!last) return;
		editor.commit(updateNode(doc, last, { collapsed: true }));
		opened = opened.slice(0, -1);
		queueMicrotask(() => canvas?.fit());
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

<div class="app" class:presenting>
	<header>
		<h1>Flow chart</h1>

		<div class="group">
			<button
				class="btn primary"
				title="Or double click the paper"
				onclick={() => (tool = tool === 'process' ? null : 'process')}
				aria-pressed={tool !== null}>Add a step</button
			>
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
			<button class="btn" onclick={present} title="Hide the editor and step through the folds"
				>Present</button
			>
		</div>

		<div class="group right">
			<label class="btn" title="Open a .json or .mmd file">
				Open<input type="file" accept=".json,.mmd,.txt,application/json,text/plain" onchange={onFile} />
			</label>
			<button class="btn" onclick={openText}>As text</button>
			<button class="btn" onclick={exportSvg}>SVG</button>
			<button class="btn" onclick={exportPng}>PNG</button>
			<button class="btn" onclick={exportJson}>Save</button>
		</div>
	</header>

	<main>
		<Canvas
			bind:this={canvas}
			{doc}
			bind:selected
			bind:tool
			{presenting}
			commit={(d, c) => editor.commit(d, c)}
			onedit={openEditor}
		/>

		{#if presenting}
			<div class="present-bar">
				<span>{foldedIds.length} folded</span>
				<button class="chip" onclick={foldLast} disabled={!opened.length}>Back</button>
				<button class="chip" onclick={revealNext} disabled={!foldedIds.length}>Reveal</button>
				<button class="chip" onclick={() => (presenting = false)}>Leave</button>
			</div>
		{/if}

		<p class="hint" role="status" class:hidden={presenting} class:beside={panelNode !== null}>
			{#if status}
				{status}
			{:else if tool}
				Click anywhere on the paper to put it there.
			{:else if selectedNode}
				Press a <span class="key">+</span> for the next step, or drag one onto another shape to
				join them. Everything about it is in the panel.
			{:else if selectedEdge}
				Double click the arrow to label the branch, Delete to remove it.
			{:else}
				Double click the paper to add a step. Select a shape and press one of its
				<span class="key">+</span> buttons to carry on from there.
			{/if}
		</p>

		{#if panelNode && !presenting}
			<Inspector
				{doc}
				node={panelNode}
				recent={recentColours.list}
				focusText={panel?.focusText ?? false}
				update={(change, coalesce) => patch(panelNode, change, coalesce)}
				oncolour={(colour) => recentColours.remember(colour)}
				remove={() => canvas?.deleteSelected()}
				close={() => {
					panel = null;
					selected = null;
				}}
			/>
		{/if}
	</main>

	{#if editing}
		<div class="sheet" role="dialog" aria-label="Label this arrow">
			<label for="node-text">Arrow label</label>
			<!--
				The one thing still edited in place: a branch label is a word, and
				sending somebody to the side panel for "yes" would be worse than
				typing it. Everything a shape holds lives in the panel instead.
			-->
			<textarea
				id="node-text"
				rows="1"
				bind:value={editing.text}
				{@attach (box: HTMLTextAreaElement) => {
					box.focus();
					box.select();
				}}
				onkeydown={(e) => {
					// Enter makes a new line, since that is what a box is for. The
					// two ways out are the ones a text box always has.
					if (e.key === 'Escape') editing = null;
					if (e.key === 'Enter') {
						e.preventDefault();
						applyEdit(e.currentTarget.value);
					}
				}}
				onblur={(e) => applyEdit(e.currentTarget.value)}
			></textarea>
			<div class="sheet-actions">
				<span class="sheet-hint">Enter to keep it, Escape to leave it</span>
				<button class="btn primary" onclick={() => applyEdit(editing!.text)}>OK</button>
			</div>
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

	/* Presenting: the diagram and nothing else. */
	.app.presenting header {
		display: none;
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

	.present-bar {
		position: absolute;
		left: 50%;
		bottom: 1rem;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		background: color-mix(in oklch, var(--surface) 94%, transparent);
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.hint.hidden {
		display: none;
	}

	/* Out from under the panel rather than beneath it. */
	.hint.beside {
		left: calc(50% - 11rem);
		max-width: min(70vw, 34rem);
	}

	.key {
		display: inline-block;
		min-width: 1.1em;
		padding: 0 0.25em;
		border: 1px solid var(--line);
		border-radius: 4px;
		background: var(--surface);
		font: 600 0.75rem/1.4 var(--font-mono);
		text-align: center;
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

	.sheet textarea {
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: inherit;
		line-height: 1.45;
		color: var(--ink);
		resize: vertical;
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
