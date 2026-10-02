<!--
	An answer as the room sees it: where the presenter put it, its mark in
	its colour (the same as the tile on the phones), its label, its count and
	its share. When a vote lands the count turns amber, and stays amber until
	the votes stop coming.
-->
<script lang="ts">
	import Tally from './Tally.svelte';
	import { ANSWER_COLOURS, inkOn } from '$lib/answers';
	import { share } from '$lib/format';
	import type { Option } from '$lib/types';

	let {
		option,
		total,
		mark,
		moving = false
	}: { option: Option; total: number; mark: string; moving?: boolean } = $props();

	const part = $derived(total > 0 ? option.count / total : 0);
	const colour = $derived(option.color || ANSWER_COLOURS[0]);
</script>

<div class="option" class:moving style:--answer={colour}>
	<div class="head">
		<span class="label"
			><span class="mark figure" style:color={inkOn(colour)}>{mark}</span>{option.label || 'Svar'}</span
		>
		<span class="share figure">{share(option.count, total)}</span>
	</div>
	<div class="count figure"><Tally value={option.count} /></div>
	<div class="bar"><span style:transform="scaleX({part})"></span></div>
</div>

<style>
	.option {
		position: absolute;
		inset: 0;
		container-type: size;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		padding: calc(var(--u) * 1.5) calc(var(--u) * 1.7) calc(var(--u) * 1.5);
		border-top: max(1px, calc(var(--u) * 0.16)) solid color-mix(in oklab, currentColor 62%, transparent);
		overflow: hidden;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: calc(var(--u) * 2);
	}

	.label {
		min-width: 0;
		font-size: min(calc(var(--u) * 4.2), 19cqh);
		font-weight: 600;
		line-height: 1.12;
		letter-spacing: -0.01em;
		overflow-wrap: anywhere;
	}

	/* The mark the phones show, in the answer's colour: a square the height
	   of the label's capitals and a little more, set before it. */
	.mark {
		display: inline-grid;
		place-items: center;
		min-width: 1.3em;
		height: 1.3em;
		margin-right: 0.45em;
		padding: 0 0.22em;
		border-radius: 2px;
		background: var(--answer);
		font-size: 0.92em;
		font-weight: 800;
		letter-spacing: 0.01em;
		vertical-align: -0.24em;
	}

	.share {
		flex: none;
		font-size: min(calc(var(--u) * 3.2), 15cqh);
		font-weight: 600;
		opacity: 0.72;
	}

	.count {
		align-self: end;
		font-size: min(54cqh, 36cqw);
		transition: color 700ms var(--ease-out);
	}

	/* A hairline the length of the box, and the share drawn on it a little
	   heavier: a rule that is measured, not a chart. */
	.bar {
		position: relative;
		height: max(2px, calc(var(--u) * 0.36));
		margin-top: calc(var(--u) * 1.1);
	}

	.bar::before {
		content: '';
		position: absolute;
		inset: auto 0 0;
		height: max(1px, calc(var(--u) * 0.16));
		background: color-mix(in oklab, currentColor 32%, transparent);
	}

	.bar span {
		position: relative;
		display: block;
		height: 100%;
		background: var(--answer);
		transform-origin: left;
		transition: transform 640ms var(--ease-out);
	}

	.moving .count {
		color: var(--change);
		transition-duration: 90ms;
	}


</style>
