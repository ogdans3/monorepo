<!--
	An answer as the room sees it: where the presenter put it, its label, its
	count and its share. When a vote lands the count and its bar turn amber,
	and stay amber until the votes stop coming.
-->
<script lang="ts">
	import Tally from './Tally.svelte';
	import { share } from '$lib/format';
	import type { Option } from '$lib/types';

	let { option, total, moving = false }: { option: Option; total: number; moving?: boolean } = $props();

	const part = $derived(total > 0 ? option.count / total : 0);
</script>

<div class="option" class:moving>
	<div class="head">
		<span class="label">{option.label || 'Svar'}</span>
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
		background: currentColor;
		transform-origin: left;
		transition:
			transform 640ms var(--ease-out),
			background-color 700ms var(--ease-out);
	}

	.moving .count {
		color: var(--change);
		transition-duration: 90ms;
	}

	.moving .bar span {
		background: var(--change);
		transition:
			transform 640ms var(--ease-out),
			background-color 90ms;
	}
</style>
