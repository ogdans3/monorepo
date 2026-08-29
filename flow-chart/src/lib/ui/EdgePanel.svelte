<script lang="ts">
	import {
		EDGE_ROUTE_LABELS,
		END_CAP_LABELS,
		LINE_STYLE_LABELS,
		SWATCHES,
		type EdgeRoute,
		type EndCap,
		type FlowEdge,
		type LineStyle
	} from '$lib/flow/model';

	let {
		edge,
		recent,
		update,
		remove,
		close,
		oncolour
	}: {
		edge: FlowEdge;
		recent: string[];
		update: (patch: Partial<FlowEdge>, coalesce?: boolean) => void;
		remove: () => void;
		close: () => void;
		oncolour: (colour: string) => void;
	} = $props();

	const STYLES: LineStyle[] = ['solid', 'dashed', 'dotted'];
	const CAPS: EndCap[] = ['none', 'arrow', 'hollow', 'dot'];
	const ROUTES: EdgeRoute[] = ['elbow', 'straight', 'curve'];
	/** Darker than the node swatches: a line has to hold its own at 2px. */
	const LINE_COLOURS = ['#6b6355', '#221f1a', '#b23b3b', '#2f6f43', '#2f5d9e', '#7a4fa3', '#a8641b'];

	function pick(colour: string) {
		update({ colour });
		oncolour(colour);
	}
</script>

<!--
	An arrow gets the same panel a shape does, in the same place, because an
	arrow in a flow chart carries as much meaning as a box: which branch this
	is, whether the step is optional, whether it goes both ways.
-->
<aside class="panel" aria-label="Arrow settings">
	<header>
		<strong>Arrow</strong>
		<button class="icon" onclick={close} aria-label="Close">×</button>
	</header>

	<div class="scroll">
		<label class="field">
			<span>Label</span>
			<textarea
				rows="2"
				value={edge.label}
				oninput={(e) => update({ label: e.currentTarget.value }, true)}
			></textarea>
		</label>

		<div class="field">
			<span>Line</span>
			<div class="row">
				{#each STYLES as style (style)}
					<button
						class="chip"
						class:active={edge.style === style}
						aria-pressed={edge.style === style}
						onclick={() => update({ style })}>{LINE_STYLE_LABELS[style]}</button
					>
				{/each}
			</div>
			<div class="row slider">
				<span class="small">Thickness</span>
				<input
					type="range"
					min="1"
					max="10"
					step="1"
					value={edge.width}
					oninput={(e) => update({ width: +e.currentTarget.value }, true)}
				/>
				<output class="mono">{edge.width}</output>
			</div>
		</div>

		<div class="field">
			<span>Path</span>
			<div class="row">
				{#each ROUTES as route (route)}
					<button
						class="chip"
						class:active={edge.route === route}
						aria-pressed={edge.route === route}
						onclick={() => update({ route })}>{EDGE_ROUTE_LABELS[route]}</button
					>
				{/each}
			</div>
		</div>

		<div class="field">
			<span>Ends</span>
			<div class="row">
				<span class="small">Start</span>
				{#each CAPS as cap (cap)}
					<button
						class="chip"
						class:active={edge.tail === cap}
						aria-pressed={edge.tail === cap}
						onclick={() => update({ tail: cap })}>{END_CAP_LABELS[cap]}</button
					>
				{/each}
			</div>
			<div class="row">
				<span class="small">End</span>
				{#each CAPS as cap (cap)}
					<button
						class="chip"
						class:active={edge.head === cap}
						aria-pressed={edge.head === cap}
						onclick={() => update({ head: cap })}>{END_CAP_LABELS[cap]}</button
					>
				{/each}
			</div>
		</div>

		<div class="field">
			<span>Colour</span>
			<div class="swatches">
				{#each LINE_COLOURS as colour (colour)}
					<button
						class="swatch"
						class:active={edge.colour.toLowerCase() === colour}
						style:background={colour}
						aria-label="Colour {colour}"
						onclick={() => pick(colour)}
					></button>
				{/each}
				<label class="swatch custom" title="Any other colour">
					<input type="color" value={edge.colour} oninput={(e) => pick(e.currentTarget.value)} />
				</label>
			</div>
			{#if recent.length}
				<div class="swatches recent">
					<span class="small">Recent</span>
					{#each recent as colour (colour)}
						<button
							class="swatch"
							class:active={edge.colour.toLowerCase() === colour}
							style:background={colour}
							aria-label="Colour {colour}"
							onclick={() => pick(colour)}
						></button>
					{/each}
				</div>
			{/if}
		</div>

		{#each [{ label: 'Preview', edge }] as sample (sample.label)}
			<div class="field">
				<span>{sample.label}</span>
				<svg class="preview" viewBox="0 0 260 40" role="img" aria-label="How the arrow looks">
					<line
						x1="18"
						y1="20"
						x2="242"
						y2="20"
						stroke={edge.colour}
						stroke-width={edge.width}
						stroke-dasharray={edge.style === 'dashed'
							? `${edge.width * 3} ${edge.width * 2.2}`
							: edge.style === 'dotted'
								? `${edge.width * 0.1} ${edge.width * 2}`
								: undefined}
						stroke-linecap="round"
					/>
					{#if edge.head !== 'none'}
						{#if edge.head === 'dot'}
							<circle cx="242" cy="20" r={edge.width * 2} fill={edge.colour} />
						{:else}
							<polygon
								points="242,20 {242 - edge.width * 4},{20 - edge.width * 2} {242 -
									edge.width * 4},{20 + edge.width * 2}"
								fill={edge.head === 'hollow' ? '#fff' : edge.colour}
								stroke={edge.colour}
								stroke-width={edge.width}
							/>
						{/if}
					{/if}
					{#if edge.tail !== 'none'}
						{#if edge.tail === 'dot'}
							<circle cx="18" cy="20" r={edge.width * 2} fill={edge.colour} />
						{:else}
							<polygon
								points="18,20 {18 + edge.width * 4},{20 - edge.width * 2} {18 + edge.width * 4},{20 +
									edge.width * 2}"
								fill={edge.tail === 'hollow' ? '#fff' : edge.colour}
								stroke={edge.colour}
								stroke-width={edge.width}
							/>
						{/if}
					{/if}
				</svg>
			</div>
		{/each}
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

	textarea {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: inherit;
		font-size: 0.875rem;
		color: var(--ink);
		resize: vertical;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}

	.small {
		font-size: 0.75rem;
		color: var(--muted);
		min-width: 2.6rem;
	}

	.slider input {
		flex: 1;
		min-width: 6rem;
	}

	.mono {
		font: 0.75rem var(--font-mono);
		color: var(--muted);
		min-width: 1.2rem;
		text-align: right;
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}

	.swatch {
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 8px;
		cursor: pointer;
	}

	.swatch.active {
		box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--ink);
	}

	.swatch.custom {
		display: grid;
		place-items: center;
		overflow: hidden;
		background: conic-gradient(
			from 0deg,
			#e57373,
			#ffb74d,
			#fff176,
			#81c784,
			#64b5f6,
			#ba68c8,
			#e57373
		);
	}

	.swatch.custom input {
		width: 200%;
		height: 200%;
		opacity: 0;
		cursor: pointer;
	}

	.preview {
		width: 100%;
		height: 44px;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--paper);
	}

	.chip.danger {
		color: var(--danger);
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
