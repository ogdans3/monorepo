<script lang="ts">
	import { untrack } from 'svelte';
	import { download, toPng, toSvg } from '$lib/flow/export';
	import { tidy } from '$lib/flow/layout';
	import { fromMermaid, looksLikeMermaid, toMermaid } from '$lib/flow/mermaid';
	import {
		MAX_DEPTH,
		addNode,
		connect,
		parseDoc,
		setChart,
		setEdgeLabel,
		updateEdge,
		updateNode,
		visibleDoc,
		withRecent,
		type FlowNode,
		type NodeShape
	} from '$lib/flow/model';
	import { Editor, recentColours } from '$lib/flow/store.svelte';
	import Canvas from '$lib/ui/Canvas.svelte';
	import EdgePanel from '$lib/ui/EdgePanel.svelte';
	import Inspector from '$lib/ui/Inspector.svelte';
	import RichText from '$lib/ui/RichText.svelte';

	const editor = new Editor();
	let selected = $state<string | null>(null);
	let tool = $state<NodeShape | null>(null);
	let canvas = $state<ReturnType<typeof Canvas>>();
	let status = $state('');
	/** Only arrows use the little sheet now; a shape gets the panel at the side. */
	let editing = $state<{ id: string; text: string } | null>(null);
	let panel = $state<{ id: string; focusText: boolean } | null>(null);
	let presenting = $state(false);
	/** The box whose detail is being read, while presenting. */
	let reading = $state<string | null>(null);
	let showLibrary = $state(false);
	let renaming = $state<string | null>(null);
	let showText = $state(false);
	let textBuffer = $state('');
	let textNote = $state('');

	const doc = $derived(editor.doc);
	const selectedNode = $derived(doc.nodes.find((n) => n.id === selected) ?? null);
	const selectedEdge = $derived(doc.edges.find((e) => e.id === selected) ?? null);
	const panelNode = $derived(panel ? (doc.nodes.find((n) => n.id === panel!.id) ?? null) : null);
	const panelEdge = $derived(panel ? (doc.edges.find((e) => e.id === panel!.id) ?? null) : null);
	const readingNode = $derived(reading ? (doc.nodes.find((n) => n.id === reading) ?? null) : null);
	/** Collapsed nodes still holding something back, for stepping a presentation. */
	const foldedIds = $derived(
		visibleDoc(doc).nodes.filter((node) => node.collapsed).map((node) => node.id)
	);

	/**
	 * Opening the page, once.
	 *
	 * Everything in here is untracked on purpose. Read `editor.doc` normally and
	 * this becomes an effect that runs after every change, which quietly means
	 * restoring the saved copy over the top of the edit, resetting the history
	 * so Undo has nothing to go back to, and refitting the view while somebody
	 * is still dragging.
	 */
	$effect(() => {
		untrack(() => {
			editor.restore();
			if (editor.doc.nodes.length === 0) startingPoint();
			queueMicrotask(() => canvas?.fit());
		});
	});

	/**
	 * What happens when somebody opens a box.
	 *
	 * Two different things, because the question is different in the two modes.
	 * While presenting it is "what does this step say", and the answer is the
	 * paragraph that was deliberately left off the picture. While editing it is
	 * "let me draw what is inside this", and the answer is the nested diagram,
	 * made empty if it is not there yet so the button never does nothing.
	 */
	function openInside(id: string) {
		if (presenting) {
			reading = id;
			return;
		}
		const node = doc.nodes.find((item) => item.id === id);
		if (!node) return;
		if (editor.path.length >= MAX_DEPTH - 1 && !node.chart) {
			say(`That is as deep as a diagram goes (${MAX_DEPTH} levels).`);
			return;
		}
		if (!node.chart) editor.commit(setChart(doc, id, { nodes: [], edges: [] }));
		panel = null;
		selected = null;
		editor.enter(id);
		queueMicrotask(() => canvas?.fit());
	}

	/** Back out of a nested diagram to a given depth: 0 is the top. */
	function goTo(depth: number) {
		panel = null;
		selected = null;
		reading = null;
		editor.goTo(depth);
		queueMicrotask(() => canvas?.fit());
	}

	function newChart() {
		editor.create();
		startingPoint();
		showLibrary = false;
		queueMicrotask(() => canvas?.fit());
		say('New chart.');
	}

	function openChart(id: string) {
		editor.open(id);
		panel = null;
		selected = null;
		showLibrary = false;
		queueMicrotask(() => canvas?.fit());
	}

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
		selected = id;
		panel = { id, focusText: true };
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
		// The panel follows the selection, for an arrow as much as for a shape:
		// picking one is asking about it.
		const exists =
			selected &&
			(doc.nodes.some((node) => node.id === selected) ||
				doc.edges.some((edge) => edge.id === selected));
		if (exists) {
			if (panel?.id !== selected) panel = { id: selected!, focusText: false };
		} else if (panel) {
			panel = null;
		}
	});

	function onKey(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
		const meta = event.metaKey || event.ctrlKey;

		if (presenting) {
			// A presentation is a few keys: forward, back, and out. Escape closes
			// what is open before it leaves, so reading a step and pressing it
			// does not drop the audience back into the editor.
			if (event.key === 'Escape') {
				if (reading) reading = null;
				else presenting = false;
			}
			// Space steps the folds. Not while a step is open on top of the
			// diagram: the next thing to reveal is behind the panel being read.
			if (!reading && (event.key === ' ' || event.key === 'ArrowRight')) {
				event.preventDefault();
				revealNext();
			}
			if (!reading && event.key === 'ArrowLeft') {
				event.preventDefault();
				foldLast();
			}
			return;
		}

		if (event.key === 'Escape' && (showLibrary || renaming)) {
			showLibrary = false;
			renaming = null;
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

		<!--
			The name is the button. There is one diagram in front of you and a
			drawer of the others behind it, so the thing you press to see them is
			the thing that says which one you are in.
		-->
		<button class="btn name" onclick={() => (showLibrary = true)} title="All your charts">
			{editor.name}
		</button>

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
			onopen={openInside}
		/>

		<!--
			Where you are, once you have opened a box. Always a way back out: a
			diagram you can get into and not out of is a diagram people lose work
			in.
		-->
		{#if editor.path.length}
			<nav class="trail" aria-label="Which diagram you are in">
				<button class="crumb" onclick={() => goTo(0)}>{editor.name}</button>
				{#each editor.trail as title, i (i)}
					<span class="sep" aria-hidden="true">›</span>
					{#if i === editor.trail.length - 1}
						<span class="crumb here" aria-current="page">{title}</span>
					{:else}
						<button class="crumb" onclick={() => goTo(i + 1)}>{title}</button>
					{/if}
				{/each}
			</nav>
		{/if}

		{#if presenting}
			<div class="present-bar">
				<span>{foldedIds.length} folded</span>
				<button class="chip" onclick={foldLast} disabled={!opened.length}>Back</button>
				<button class="chip" onclick={revealNext} disabled={!foldedIds.length}>Reveal</button>
				<button
					class="chip"
					onclick={() => {
						presenting = false;
						reading = null;
					}}>Leave</button
				>
			</div>
		{/if}

		<p
			class="hint"
			role="status"
			class:hidden={presenting}
			class:beside={panelNode !== null || panelEdge !== null}
		>
			{#if status}
				{status}
			{:else if tool}
				Click anywhere on the paper to put it there.
			{:else if selectedNode}
				Press a <span class="key">+</span> for the next step, or drag one onto another shape to
				join them. Everything about it is in the panel.
			{:else if selectedEdge}
				The arrow's line, ends, colour and label are in the panel. Delete removes it.
			{:else}
				Double click the paper to add a step. Select a shape and press one of its
				<span class="key">+</span> buttons to carry on from there.
			{/if}
		</p>

		{#if panelEdge && !presenting}
			<EdgePanel
				edge={panelEdge}
				recent={recentColours.list}
				update={(change, coalesce) =>
					editor.commit(updateEdge(doc, panelEdge.id, change), coalesce)}
				oncolour={(colour) => recentColours.remember(colour)}
				remove={() => canvas?.deleteSelected()}
				close={() => {
					panel = null;
					selected = null;
				}}
			/>
		{/if}

		{#if panelNode && !presenting}
			<Inspector
				{doc}
				node={panelNode}
				recent={recentColours.list}
				focusText={panel?.focusText ?? false}
				update={(change, coalesce) => patch(panelNode, change, coalesce)}
				oncolour={(colour) => recentColours.remember(colour)}
				onopen={openInside}
				remove={() => canvas?.deleteSelected()}
				close={() => {
					panel = null;
					selected = null;
				}}
			/>
		{/if}
	</main>

	<!--
		What a box says, while presenting. The paragraph deliberately left off the
		picture is exactly what somebody wants to read out at the moment they are
		pointing at the step, and the diagram behind it is the next thing to show.
	-->
	{#if readingNode}
		<div class="backdrop" role="presentation" onclick={() => (reading = null)}></div>
		<div class="detail" role="dialog" aria-label={readingNode.title || 'Step'}>
			<header>
				<strong>{readingNode.title || 'Untitled step'}</strong>
				<button class="icon" onclick={() => (reading = null)} aria-label="Close">×</button>
			</header>
			{#if readingNode.subtitle.trim()}
				<div class="sub"><RichText text={readingNode.subtitle} /></div>
			{/if}
			{#if readingNode.body.trim()}
				<div class="body"><RichText text={readingNode.body} /></div>
			{:else if !readingNode.subtitle.trim()}
				<p class="empty">Nothing written behind this one.</p>
			{/if}
			{#if readingNode.chart?.nodes.length}
				<button
					class="btn primary"
					onclick={() => {
						const id = readingNode.id;
						reading = null;
						presenting = false;
						editor.enter(id);
						queueMicrotask(() => canvas?.fit());
					}}
				>
					Open the diagram inside ({readingNode.chart.nodes.length} steps)
				</button>
			{/if}
		</div>
	{/if}

	<!--
		Every diagram in this browser. A list rather than tabs: they are documents
		somebody comes back to, not views of one thing.
	-->
	{#if showLibrary}
		<div class="backdrop" role="presentation" onclick={() => (showLibrary = false)}></div>
		<div class="library" role="dialog" aria-label="Your charts">
			<header>
				<strong>Your charts</strong>
				<span class="meta">{editor.charts.length}</span>
				<button class="icon" onclick={() => (showLibrary = false)} aria-label="Close">×</button>
			</header>
			<ul>
				{#each editor.charts as chart (chart.id)}
					<li class:current={chart.id === editor.currentId}>
						{#if renaming === chart.id}
							<input
								class="rename"
								value={chart.name}
								{@attach (box: HTMLInputElement) => {
									box.focus();
									box.select();
								}}
								onblur={(e) => {
									editor.rename(chart.id, e.currentTarget.value);
									renaming = null;
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter') e.currentTarget.blur();
									if (e.key === 'Escape') renaming = null;
								}}
							/>
						{:else}
							<button class="open" onclick={() => openChart(chart.id)}>
								<span class="chart-name">{chart.name}</span>
								<span class="meta">{chart.doc.nodes.length} steps</span>
							</button>
						{/if}
						<div class="actions">
							<button class="chip" onclick={() => (renaming = chart.id)}>Rename</button>
							<button class="chip" onclick={() => editor.duplicate(chart.id)}>Copy</button>
							<button
								class="chip danger"
								onclick={() => {
									editor.remove(chart.id);
									queueMicrotask(() => canvas?.fit());
								}}>Delete</button
							>
						</div>
					</li>
				{/each}
			</ul>
			<button class="btn primary" onclick={newChart}>New chart</button>
		</div>
	{/if}

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

	/*
	 * Presenting: the diagram and nothing else. The child combinator matters —
	 * without it this hides the header of every panel over the paper too, which
	 * took the title and the close button off the step being read out.
	 */
	.app.presenting > header {
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

	/* The chart's name, doubling as the way into the drawer of the others. */
	.name {
		font-weight: 600;
		max-width: 14rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/*
	 * The trail sits over the paper at the top left, pinned like every other
	 * floating piece rather than taking height from the canvas.
	 */
	.trail {
		position: absolute;
		top: 0.6rem;
		left: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
		box-shadow: 0 6px 18px oklch(0.24 0.014 70 / 0.08);
		font-size: 0.8125rem;
		max-width: min(60vw, 40rem);
	}

	.crumb {
		border: 0;
		background: none;
		padding: 0.1rem 0.2rem;
		font: inherit;
		color: var(--muted);
		cursor: pointer;
		border-radius: var(--r-s, 4px);
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.crumb:hover {
		color: var(--ink);
		text-decoration: underline;
	}

	.crumb.here {
		color: var(--ink);
		font-weight: 600;
		cursor: default;
	}

	.sep {
		color: var(--line);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		background: oklch(0.24 0.014 70 / 0.18);
	}

	/* What a box says, read at the size of prose rather than at diagram size. */
	.detail,
	.library {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1rem 1.1rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
		box-shadow: 0 20px 50px oklch(0.24 0.014 70 / 0.18);
		width: min(92vw, 34rem);
		max-height: 80dvh;
		overflow: auto;
	}

	.detail header,
	.library header strong {
		margin-right: auto;
	}

	.library header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0;
		border: 0;
		background: none;
	}

	.detail .sub {
		color: var(--muted);
		font-size: 0.9375rem;
	}

	.detail .body {
		font-size: 0.9375rem;
		line-height: 1.6;
	}

	.detail .empty {
		margin: 0;
		color: var(--muted);
		font-size: 0.875rem;
	}

	.library ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.library li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
	}

	.library li.current {
		border-color: var(--accent);
		background: var(--accent-wash);
	}

	.library .open {
		flex: 1;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		border: 0;
		background: none;
		padding: 0;
		font: inherit;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}

	.library .chart-name {
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.library .meta {
		color: var(--muted);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.library .rename {
		flex: 1;
		font: inherit;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--accent);
		border-radius: var(--r-s, 4px);
	}

	.library .actions {
		display: flex;
		gap: 0.25rem;
	}

	.library .chip.danger {
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
