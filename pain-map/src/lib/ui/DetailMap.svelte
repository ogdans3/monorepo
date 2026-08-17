<script lang="ts">
	import { DETAIL_H, DETAIL_W, type DetailView } from '$lib/anatomy/detail';

	let {
		view,
		selected = $bindable()
	}: { view: DetailView; selected: string[] } = $props();

	const ZONE_LABEL = { above: 'Above', here: 'Here', below: 'Below' } as const;

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}
</script>

<div class="detail">
	<svg viewBox="0 0 {DETAIL_W} {DETAIL_H}" role="group" aria-label="{view.title} in detail">
		<!-- context first: the shape of the part, then bone, then the structures
		     over the top, which is the order an anatomical plate is built in -->
		<path class="outline" d={view.outline} />
		<g class="skeleton">
			{#each view.skeleton as d (d)}<path {d} />{/each}
		</g>
		<g>
			{#each view.structures as s (s.id)}
				<g
					role="checkbox"
					tabindex="0"
					aria-checked={selected.includes(s.id)}
					aria-label="{s.name}, {s.plain}"
					class="structure {s.kind} {s.zone}"
					class:on={selected.includes(s.id)}
					onclick={() => toggle(s.id)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							toggle(s.id);
						}
					}}
				>
					<path d={s.d} />
				</g>
			{/each}
		</g>
	</svg>

	<ol class="list" aria-label="Structures in this area">
		{#each ['above', 'here', 'below'] as const as zone (zone)}
			{@const inZone = view.structures.filter((s) => s.zone === zone)}
			{#if inZone.length}
				<li class="zone">
					<h3>{ZONE_LABEL[zone]}</h3>
					<ul>
						{#each inZone as s (s.id)}
							<li>
								<button
									class="pick"
									aria-pressed={selected.includes(s.id)}
									onclick={() => toggle(s.id)}
								>
									<span class="name mono">{s.name}</span>
									<span class="plain">{s.plain}</span>
								</button>
							</li>
						{/each}
					</ul>
				</li>
			{/if}
		{/each}
	</ol>
</div>

<style>
	.detail {
		display: grid;
		gap: 1.5rem;
	}

	@media (min-width: 46rem) {
		.detail {
			grid-template-columns: 1fr 1fr;
			align-items: start;
		}
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		background: var(--plate);
		border: 1px solid var(--line);
		border-radius: var(--r-l);
	}

	.outline {
		fill: var(--bg);
		stroke: var(--line);
		stroke-width: 1.4;
	}

	/* Bone reads as bone: a shade darker than the panel, with a real edge. The
	   first pass was so faint the diagram had nothing to hang on. */
	.skeleton path {
		fill: oklch(0.93 0.008 60);
		stroke: oklch(0.78 0.012 60);
		stroke-width: 1.2;
	}

	/* Muscles are solid enough to read as shapes rather than as a wash. */
	.structure path {
		fill: oklch(0.86 0.055 70);
		stroke: var(--anatomy);
		stroke-width: 1.2;
		transition: fill 120ms var(--ease);
	}

	.structure {
		cursor: pointer;
	}

	/* Nerves and tendons read as lines rather than as bodies. */
	.structure.nerve path,
	.structure.ligament path {
		fill: none;
		stroke: oklch(0.5 0.09 60);
		stroke-width: 3;
		stroke-linecap: round;
	}

	/* Above and below stay clearly secondary without disappearing. Nearly
	   invisible dashes were worse than not drawing them: they read as noise. */
	.structure.above path,
	.structure.below path {
		fill: oklch(0.955 0.012 60);
		stroke: oklch(0.72 0.014 60);
		stroke-width: 1;
	}

	.structure:hover path {
		fill: oklch(0.72 0.14 78 / 0.4);
	}

	.structure.on path {
		fill: oklch(0.72 0.14 78 / 0.72);
		stroke: var(--primary-deep);
		stroke-width: 2;
		stroke-dasharray: none;
	}

	.structure:focus-visible {
		outline: none;
	}

	.structure:focus-visible path {
		stroke: var(--primary-deep);
		stroke-width: 3;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.zone h3 {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--muted);
		margin: 0 0 0.4rem;
	}

	.zone ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.pick {
		width: 100%;
		text-align: left;
		background: none;
		border: 1px solid transparent;
		border-radius: var(--r-s);
		padding: 0.5rem 0.6rem;
		cursor: pointer;
		font: inherit;
		min-height: 2.75rem;
	}

	.pick:hover {
		background: var(--surface);
	}

	.pick[aria-pressed='true'] {
		background: oklch(0.72 0.14 78 / 0.2);
		border-color: var(--primary-deep);
	}

	.name {
		display: block;
		font-size: 0.8125rem;
	}

	.plain {
		display: block;
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
