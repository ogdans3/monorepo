<!--
	A count that rolls: each figure is a reel of the ten digits, turned to the
	one it shows, so a count going up is seen going up, in place, at any speed.
-->
<script lang="ts">
	let { value }: { value: number } = $props();

	const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
	const digits = $derived(String(Math.max(0, Math.round(value))).split('').map(Number));
</script>

<span class="tally">
	<span class="visually-hidden">{value}</span>
	<span class="reels" aria-hidden="true">
		{#each digits as d, i (digits.length - i)}
			{#if i > 0 && (digits.length - i) % 3 === 0}<span class="gap"></span>{/if}
			<span class="column"><span class="reel" style:transform="translateY({-d * 10}%)">
					{#each DIGITS as n (n)}<span>{n}</span>{/each}
				</span></span>
		{/each}
	</span>
</span>

<style>
	.tally,
	.reels {
		display: inline-flex;
	}

	.column {
		display: inline-block;
		height: 1em;
		overflow: hidden;
	}

	.reel {
		display: flex;
		flex-direction: column;
		transition: transform 560ms var(--ease-out);
	}

	.reel span {
		height: 1em;
		line-height: 1;
	}

	.gap {
		width: 0.16em;
	}
</style>
