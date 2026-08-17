<script lang="ts">
	import { PAIN_STOPS, stopFor } from '$lib/pain/scale';

	let { level = $bindable() }: { level: number } = $props();
	const stop = $derived(stopFor(level));
</script>

<fieldset class="scale">
	<legend>How bad is it at its worst?</legend>
	<p class="explain">
		The numbers only mean something if we agree what they mean, so each one says what it looks
		like in a day rather than how it feels. Pick the one you recognise.
	</p>

	<div class="stops" role="radiogroup" aria-label="Pain level from 0 to 10">
		{#each PAIN_STOPS as s (s.level)}
			<button
				class="stop"
				role="radio"
				aria-checked={level === s.level}
				aria-label="{s.level}, {s.label}. {s.meaning}"
				style:--fill={s.colour}
				class:on={level === s.level}
				onclick={() => (level = s.level)}
			>
				<span class="num mono">{s.level}</span>
			</button>
		{/each}
	</div>

	<!-- The number, the colour and the position are all present at once, so the
	     level never depends on colour alone. -->
	<p class="chosen" aria-live="polite">
		<strong class="mono">{stop.level}</strong>
		<span class="label">{stop.label}</span>
		<span class="meaning">{stop.meaning}</span>
	</p>
</fieldset>

<style>
	.scale {
		border: 0;
		padding: 0;
		margin: 0;
	}

	legend {
		padding: 0;
		font-size: 1.125rem;
		font-weight: 640;
	}

	.explain {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0.4rem 0 1rem;
		max-width: 58ch;
	}

	.stops {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.stop {
		flex: 1 1 2.5rem;
		min-width: 2.5rem;
		min-height: 3rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--fill);
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: transform 120ms var(--ease);
	}

	.stop:hover {
		transform: translateY(-2px);
	}

	.stop.on {
		border-color: var(--ink);
		border-width: 2px;
		/* a notch, so the chosen stop is distinguishable without colour */
		box-shadow: inset 0 -5px 0 var(--ink);
	}

	.num {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--ink);
	}

	.chosen {
		margin: 1rem 0 0;
		display: grid;
		gap: 0.15rem;
	}

	.chosen strong {
		font-size: 1.75rem;
		line-height: 1;
	}

	.label {
		font-weight: 600;
	}

	.meaning {
		color: var(--muted);
		font-size: 0.9375rem;
	}
</style>
