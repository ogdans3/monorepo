<script lang="ts">
	import {
		FONTS,
		FONT_LABELS,
		NO_COLOUR,
		QUICK_FONTS,
		SHAPE_LABELS,
		SIZE_MAX,
		SIZE_MIN,
		SWATCHES,
		hasChildren,
		hiddenUnder,
		type FlowDoc,
		type FlowNode,
		type FontKey,
		type NodeShape
	} from '$lib/flow/model';

	let {
		doc,
		node,
		recent,
		focusText = false,
		update,
		remove,
		close,
		oncolour,
		onopen
	}: {
		doc: FlowDoc;
		node: FlowNode;
		/** Colours used lately, newest first, kept by the page. */
		recent: string[];
		/** Opened by writing rather than by selecting, so put the caret in. */
		focusText?: boolean;
		update: (patch: Partial<FlowNode>, coalesce?: boolean) => void;
		remove: () => void;
		close: () => void;
		oncolour: (colour: string) => void;
		/** Opens the diagram behind this node, making an empty one if there is none. */
		onopen: (id: string) => void;
	} = $props();

	/** How many steps are already behind this box, for the button's own label. */
	const inside = $derived(node.chart?.nodes.length ?? 0);

	const SHAPES: NodeShape[] = ['process', 'decision', 'terminator'];
	const ALL_FONTS = Object.keys(FONTS) as FontKey[];

	const folded = $derived(node.collapsed ? hiddenUnder(doc, node.id) : 0);

	function pick(colour: string) {
		update({ colour });
		oncolour(colour);
	}
</script>

<!--
	Everything about a node, in one place at the side.

	It used to be a strip floating over the middle of the diagram, which was
	fine for three chips and hopeless for text, colour and type: the panel would
	have covered the thing being edited. At the side it can be as tall as it
	needs to be, the diagram stays visible next to it, and there is room for the
	body text to be read rather than guessed at.
-->
<aside class="panel" aria-label="Shape settings">
	<header>
		<strong>{SHAPE_LABELS[node.shape]}</strong>
		<button class="icon" onclick={close} aria-label="Close">×</button>
	</header>

	<div class="scroll">
		<label class="field">
			<span>Title</span>
			<textarea
				rows="2"
				value={node.title}
				{@attach (box: HTMLTextAreaElement) => {
					if (focusText) {
						box.focus();
						box.select();
					}
				}}
				oninput={(e) => update({ title: e.currentTarget.value }, true)}
			></textarea>
		</label>

		<label class="field">
			<span class="with-toggle">
				Subtitle
				<button
					class="toggle"
					class:on={node.showSubtitle}
					aria-pressed={node.showSubtitle}
					onclick={() => update({ showSubtitle: !node.showSubtitle })}
					title="Show it on the shape">{node.showSubtitle ? 'shown' : 'hidden'}</button
				>
			</span>
			<textarea
				rows="2"
				value={node.subtitle}
				oninput={(e) => update({ subtitle: e.currentTarget.value }, true)}
			></textarea>
		</label>

		<label class="field">
			<span class="with-toggle">
				More text
				<button
					class="toggle"
					class:on={node.showBody}
					aria-pressed={node.showBody}
					onclick={() => update({ showBody: !node.showBody })}
					title="Show it on the shape">{node.showBody ? 'shown' : 'hidden'}</button
				>
			</span>
			<textarea
				class="body"
				rows="7"
				value={node.body}
				oninput={(e) => update({ body: e.currentTarget.value }, true)}
			></textarea>
			<!--
				How much of it goes on the shape. All of it is often too much for a
				diagram and exactly right for the panel, so the shape gets the first
				few lines and an ellipsis, and the rest stays here.
			-->
			<div class="row slider">
				<span class="small">On the shape</span>
				<input
					type="range"
					min="0"
					max="8"
					step="1"
					value={node.bodyClamp}
					oninput={(e) => update({ bodyClamp: +e.currentTarget.value })}
				/>
				<output class="mono">{node.bodyClamp === 0 ? 'all' : `${node.bodyClamp}…`}</output>
			</div>
		</label>

		<!--
			How the two fields that hold sentences sit in the box. Centred reads
			well for the two or three words a subtitle usually is, and badly the
			moment somebody writes a paragraph: ragged on both sides, with a
			bullet list that has nothing to line up against.
		-->
		<div class="field">
			<span>Subtitle and text</span>
			<div class="row">
				<button
					class="chip"
					class:on={node.align === 'center'}
					aria-pressed={node.align === 'center'}
					onclick={() => update({ align: 'center' })}>Centred</button
				>
				<button
					class="chip"
					class:on={node.align === 'left'}
					aria-pressed={node.align === 'left'}
					onclick={() => update({ align: 'left' })}>Left</button
				>
			</div>
			<p class="hint">
				<code>**bold**</code>, <code>*italic*</code>, and a line starting
				<code>-</code> is a bullet.
			</p>
		</div>

		<!--
			The diagram behind this box. Offered on every shape rather than as a
			setting to turn on first: the moment somebody wants one is the moment
			they are looking at a step that needs explaining.
		-->
		<div class="field">
			<span>Inside this step</span>
			<div class="row">
				<button class="chip wide" onclick={() => onopen(node.id)}>
					{inside ? `Open the diagram (${inside} ${inside === 1 ? 'step' : 'steps'})` : 'Add a diagram inside'}
				</button>
			</div>
			{#if inside}
				<p class="hint">Shown as two pages in the corner of the box, and in the export.</p>
			{/if}
		</div>

		<div class="field">
			<span>Shape</span>
			<div class="row">
				{#each SHAPES as shape (shape)}
					<button
						class="chip"
						class:active={node.shape === shape}
						aria-pressed={node.shape === shape}
						onclick={() => update({ shape })}>{SHAPE_LABELS[shape]}</button
					>
				{/each}
			</div>
		</div>

		<div class="field">
			<span>Colour</span>
			<div class="swatches">
				{#each SWATCHES as colour (colour)}
					<button
						class="swatch"
						class:active={node.colour.toLowerCase() === colour}
						class:empty={colour === NO_COLOUR}
						style:background={colour}
						aria-label="Colour {colour}"
						aria-pressed={node.colour.toLowerCase() === colour}
						onclick={() => pick(colour)}
					></button>
				{/each}
				<label class="swatch custom" title="Any other colour">
					<input type="color" value={node.colour} oninput={(e) => pick(e.currentTarget.value)} />
				</label>
			</div>
			{#if recent.length}
				<div class="swatches recent">
					<span class="hint">Recent</span>
					{#each recent as colour (colour)}
						<button
							class="swatch"
							class:active={node.colour.toLowerCase() === colour}
							style:background={colour}
							aria-label="Colour {colour}"
							onclick={() => pick(colour)}
						></button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="field">
			<span>Type</span>
			<div class="row">
				{#each QUICK_FONTS as font (font)}
					<button
						class="chip"
						class:active={node.font === font}
						aria-pressed={node.font === font}
						onclick={() => update({ font })}>{FONT_LABELS[font]}</button
					>
				{/each}
				<!-- The three above are what nearly everybody picks. The rest are
				     here rather than on chips nobody reads. -->
				<select
					class="fonts"
					aria-label="Font"
					value={node.font}
					onchange={(e) => update({ font: e.currentTarget.value as FontKey })}
				>
					{#each ALL_FONTS as font (font)}
						<option value={font} style:font-family={FONTS[font].stack}>{FONT_LABELS[font]}</option>
					{/each}
				</select>
			</div>
			<div class="row">
				<button
					class="chip bold"
					class:active={node.bold}
					aria-pressed={node.bold}
					onclick={() => update({ bold: !node.bold })}>B</button
				>
				<button
					class="chip italic"
					class:active={node.italic}
					aria-pressed={node.italic}
					onclick={() => update({ italic: !node.italic })}>I</button
				>
			</div>
			<div class="row slider">
				<span class="small">Size</span>
				<input
					type="range"
					min={SIZE_MIN}
					max={SIZE_MAX}
					step="1"
					value={node.size}
					oninput={(e) => update({ size: +e.currentTarget.value }, true)}
				/>
				<output class="mono">{node.size}</output>
			</div>
		</div>

		<div class="field">
			<span>Size</span>
			<div class="row">
				<span class="small">{Math.round(node.w)} × {Math.round(node.h)}</span>
				<button class="chip" disabled={!node.sized} onclick={() => update({ sized: false })}>
					Fit to the text
				</button>
			</div>
			<span class="hint">Drag the corners of the shape to size it by hand.</span>
		</div>

		{#if hasChildren(doc, node.id)}
			<div class="field">
				<span class="with-toggle">
					Folding
					<button
						class="toggle"
						class:on={node.foldable}
						aria-pressed={node.foldable}
						onclick={() => update({ foldable: !node.foldable, collapsed: false })}
						title="Put a fold button on this shape">{node.foldable ? 'on' : 'off'}</button
					>
				</span>
				{#if node.foldable}
					<button
						class="chip wide"
						onclick={() => update({ collapsed: !node.collapsed })}
					>
						{node.collapsed ? `Show the ${folded} under this` : 'Fold away what is under this'}
					</button>
					<span class="hint">
						The button on the shape does this too, and stays there either way.
					</span>
				{:else}
					<span class="hint">Turn this on to get a fold button on the shape.</span>
				{/if}
			</div>
		{/if}
	</div>

	<footer>
		<button class="chip danger" onclick={remove}>Delete</button>
		<button class="btn primary" onclick={close}>Done</button>
	</footer>
</aside>

<style>
	.panel {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		bottom: 0.75rem;
		width: min(22rem, calc(100vw - 1.5rem));
		display: flex;
		flex-direction: column;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
		box-shadow: 0 10px 30px oklch(0.24 0.014 70 / 0.12);
		z-index: 2;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--line);
	}

	.icon {
		border: 0;
		background: none;
		font-size: 1.25rem;
		line-height: 1;
		color: var(--muted);
		cursor: pointer;
	}

	.scroll {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		padding: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.field > span {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.with-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.toggle {
		padding: 0.1rem 0.45rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		background: var(--bg);
		font: 500 0.6875rem/1.4 var(--font-ui);
		text-transform: none;
		letter-spacing: 0;
		color: var(--muted);
		cursor: pointer;
	}

	.toggle.on {
		background: var(--accent-wash);
		border-color: var(--accent);
		color: var(--accent-deep);
	}

	textarea {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: inherit;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--ink);
		resize: vertical;
	}

	textarea.body {
		font-size: 0.8125rem;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}

	.chip.wide {
		width: 100%;
		justify-content: center;
	}

	.chip.bold {
		font-weight: 800;
	}

	.chip.italic {
		font-style: italic;
	}

	.chip.danger {
		color: var(--danger);
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}

	.hint,
	.small {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.small {
		min-width: 4.4rem;
	}

	.hint code {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		background: var(--surface-deep);
		border: 1px solid var(--line);
		border-radius: 3px;
		padding: 0 0.2em;
	}

	.slider input {
		flex: 1;
		min-width: 5rem;
	}

	.mono {
		font: 0.75rem var(--font-mono);
		color: var(--muted);
		min-width: 2rem;
		text-align: right;
	}

	.fonts {
		flex: 1;
		min-width: 6rem;
		padding: 0.25rem 0.35rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--bg);
		font: inherit;
		font-size: 0.8125rem;
		color: var(--ink);
		cursor: pointer;
	}

	.recent {
		margin-top: 0.35rem;
	}

	.swatch {
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 8px;
		cursor: pointer;
	}

	/* White is not a colour here, it is the absence of one, so it is marked. */
	.swatch.empty {
		background:
			linear-gradient(to top right, transparent 46%, var(--line) 46%, var(--line) 54%, transparent 54%),
			var(--surface);
	}

	.swatch.active {
		box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink);
	}

	.swatch.custom {
		display: grid;
		place-items: center;
		overflow: hidden;
		background:
			conic-gradient(from 0deg, #e57373, #ffb74d, #fff176, #81c784, #64b5f6, #ba68c8, #e57373);
	}

	.swatch.custom input {
		width: 200%;
		height: 200%;
		opacity: 0;
		cursor: pointer;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.4rem;
		padding: 0.6rem 0.75rem;
		border-top: 1px solid var(--line);
	}
</style>
