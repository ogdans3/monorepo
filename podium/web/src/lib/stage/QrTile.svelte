<!--
	The way in: the code a phone scans, and under it, for anyone who would
	rather type, the address and the presentation's code. A paper tile, so the
	code reads on any slide and any scanner. [compact] is the small one in a
	slide's corner, which keeps the presentation's code and drops the address.
-->
<script lang="ts">
	import { ballotUrl, qrPath, shortHost } from '$lib/qr';

	let { code, origin, compact = false }: { code: string; origin: string; compact?: boolean } = $props();

	const qr = $derived(qrPath(ballotUrl(origin, code)));
</script>

<div class="tile" class:compact>
	<div class="inner">
		<svg viewBox="-1 -1 {qr.size + 2} {qr.size + 2}" role="img" aria-label="QR-kode til stemmesiden" shape-rendering="crispEdges">
			<path d={qr.path} />
		</svg>
		<div class="words">
			{#if !compact}<span class="host">{shortHost(origin)}</span>{/if}
			<span class="code figure">{code}</span>
		</div>
	</div>
</div>

<style>
	/* The tile is the container its own layout asks about; the layout is on
	   the inner box, since a container query never asks the container itself. */
	.tile {
		position: absolute;
		inset: 0;
		container-type: size;
		/* The palette's paper and ink, fixed: a code reads on any slide only
		   dark on light. */
		background: #f4f5f6;
		color: #111418;
	}

	.inner {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		gap: 3cqmin;
		padding: 7cqmin;
	}

	svg {
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	path {
		fill: currentColor;
	}

	.words {
		display: grid;
		justify-items: center;
		text-align: center;
		min-width: 0;
	}

	.host {
		max-width: 100%;
		font-size: 7cqw;
		font-weight: 560;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.code {
		font-size: 22cqw;
		letter-spacing: 0.05em;
		margin-right: -0.05em;
	}

	.compact .inner {
		gap: 2cqmin;
		padding: 6cqmin;
	}

	.compact .code {
		font-size: 19cqw;
		letter-spacing: 0.04em;
	}

	/* Wider than it is tall: the code to the left, the words beside it. */
	@container (aspect-ratio > 1.3) {
		.inner {
			grid-template-rows: none;
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
			gap: 5cqmin;
		}

		svg {
			width: auto;
			aspect-ratio: 1;
		}

		.words {
			justify-items: start;
			text-align: left;
		}

		.host {
			font-size: 11cqh;
		}

		.code {
			font-size: 30cqh;
		}
	}
</style>
