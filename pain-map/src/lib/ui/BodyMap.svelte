<script lang="ts">
	import { VIEW_H, VIEW_W, type BodyKind } from '$lib/anatomy/proportions';
	import { backPaths, frontPaths, mirrorBody, sidePaths } from '$lib/anatomy/silhouette';
	import { solePaths } from '$lib/anatomy/soles';
	import { REGIONS, type Region, type View } from '$lib/anatomy/regions';

	let {
		body,
		view,
		selected = $bindable(),
		onpick
	}: {
		body: BodyKind;
		view: View;
		selected: string[];
		onpick?: (id: string) => void;
	} = $props();

	const paths = $derived.by(() => {
		if (view === 'front') return frontPaths(body);
		if (view === 'back') return backPaths(body);
		// The side views face inward, so a left side view faces right.
		if (view === 'left') return mirrorBody(sidePaths(body));
		if (view === 'right') return sidePaths(body);
		return null;
	});
	const soles = $derived(view === 'soles' ? solePaths() : null);
	const regions = $derived(REGIONS[view]);
	/** Unique per view and body, so two maps on one page cannot share a clip. */
	const clipId = $derived(`clip-${view}-${body}`);
	const armClipId = $derived(`clip-arm-${view}-${body}`);

	function toggle(region: Region) {
		if (selected.includes(region.id)) {
			selected = selected.filter((id) => id !== region.id);
		} else {
			selected = [...selected, region.id];
		}
		onpick?.(region.id);
	}
</script>

<svg
	viewBox="0 0 {VIEW_W} {VIEW_H}"
	class="map"
	role="group"
	aria-label="Body map, {view} view"
>
	<defs>
		<!--
			Every region is clipped to the body, so a plain rectangle over the
			thigh comes out thigh shaped. That is what keeps the overlays from
			ever spilling outside the outline, and it means changing a body
			measurement reshapes all of them at once.
		-->
		<clipPath id={clipId}>
			{#if paths}
				<path d={paths.body} />
				<path d={paths.headNeck} />
			{:else if soles}
				<path d={soles.soleLeft} />
				<path d={soles.soleRight} />
				{#each soles.toesLeft as d (d)}<path {d} />{/each}
				{#each soles.toesRight as d (d)}<path {d} />{/each}
			{/if}
		</clipPath>
		{#if paths}
			<clipPath id={armClipId}>
				<path d={paths.armLeft} />
				<path d={paths.armRight} />
			</clipPath>
		{/if}
	</defs>

	<!-- Filled with the plate colour and stacked, so each shape hides the lines
	     behind it. That is what makes the arms read as in front of the ribs. -->
	<g class="figure">
		{#if paths}
			<path d={paths.headNeck} />
			<path d={paths.body} />
			<path d={paths.armLeft} />
			<path d={paths.armRight} />
		{:else if soles}
			<path d={soles.soleLeft} />
			<path d={soles.soleRight} />
			{#each soles.toesLeft as d (d)}<path {d} />{/each}
			{#each soles.toesRight as d (d)}<path {d} />{/each}
			<g class="hint">
				<path d={soles.archLeft} />
				<path d={soles.archRight} />
			</g>
		{/if}
	</g>

	<!--
		The zone boundaries, drawn faintly whether or not anything is selected.
		Without them a selected region reads as a box stuck onto a body, because
		its edges line up with nothing visible. With them the body reads as a
		mapped body and selecting fills in a zone that was already there, which
		is how a clinical pain map looks.
	-->
	{#each [{ clip: clipId, limb: undefined }, { clip: armClipId, limb: 'arm' }] as layer (`z-${layer.clip}`)}
		<g clip-path="url(#{layer.clip})" class="zones" aria-hidden="true">
			{#each regions.filter((r) => r.limb === layer.limb) as region (region.id)}
				<rect x={region.x} y={region.y} width={region.w} height={region.h} />
			{/each}
		</g>
	{/each}

	{#each [{ clip: clipId, limb: undefined }, { clip: armClipId, limb: 'arm' }] as layer (layer.clip)}
		<g clip-path="url(#{layer.clip})">
			{#each regions.filter((r) => r.limb === layer.limb) as region (region.id)}
			<g
				role="checkbox"
				tabindex="0"
				aria-checked={selected.includes(region.id)}
				aria-label={region.label}
				class="region"
				class:on={selected.includes(region.id)}
				onclick={() => toggle(region)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						toggle(region);
					}
				}}
			>
					<rect x={region.x} y={region.y} width={region.w} height={region.h} />
				</g>
			{/each}
		</g>
	{/each}
</svg>

<style>
	/* The figure is the hero, so it takes the width it is given. Boxing it into
	   a small column inside a wide panel is what made the first draft look like
	   a diagram in a corner rather than a body. */
	.map {
		display: block;
		width: 100%;
		height: auto;
	}

	.figure path {
		fill: var(--plate);
		stroke: var(--anatomy);
		stroke-width: 1.6;
		stroke-linejoin: round;
	}

	.hint path {
		fill: none;
		stroke: var(--line);
		stroke-width: 1.2;
		stroke-dasharray: 3 4;
	}

	.zones rect {
		fill: none;
		stroke: var(--line);
		stroke-width: 0.8;
	}

	.region rect {
		fill: transparent;
		transition: fill 120ms var(--ease);
	}

	.region {
		cursor: pointer;
	}

	.region:hover rect {
		fill: oklch(0.72 0.14 78 / 0.22);
	}

	/* Selection is a fill and a stroke together, so it never depends on colour
	   alone. The stroke is what a greyscale or colour-blind reader sees. */
	.region.on rect {
		fill: oklch(0.72 0.14 78 / 0.45);
		stroke: var(--primary-deep);
		stroke-width: 1.4;
	}

	.region:focus-visible {
		outline: none;
	}

	.region:focus-visible rect {
		fill: oklch(0.72 0.14 78 / 0.3);
		stroke: var(--primary-deep);
		stroke-width: 2.5;
		stroke-dasharray: 5 3;
	}
</style>
