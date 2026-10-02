<!--
	The way in: the code a phone scans, and under it, for anyone who would
	rather type, the address and the presentation's code. A paper tile, so the
	code reads on any slide and any scanner.
-->
<script lang="ts">
	import { ballotUrl, qrPath, shortHost } from '$lib/qr';

	let { code, origin }: { code: string; origin: string } = $props();

	const qr = $derived(qrPath(ballotUrl(origin, code)));
</script>

<div class="tile">
	<div class="inner">
		<svg viewBox="-1 -1 {qr.size + 2} {qr.size + 2}" role="img" aria-label="QR-kode til stemmesiden" shape-rendering="crispEdges">
			<path d={qr.path} />
		</svg>
		<div class="words">
			<span class="host">{shortHost(origin)}</span>
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
		background: #f4f5f6;
		color: #0d1014;
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
