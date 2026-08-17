<script lang="ts">
	import type { BodyKind } from '$lib/anatomy/proportions';
	import { VIEWS, type View } from '$lib/anatomy/regions';
	import BodyMap from '$lib/ui/BodyMap.svelte';

	let body = $state<BodyKind>('male');
	let view = $state<View>('front');
	let selected = $state<string[]>([]);
</script>

<main>
	<h1>Where does it hurt?</h1>
	<p class="lede">Pick the rough areas. You will say exactly where in a moment.</p>

	<div class="controls">
		<div class="group" role="group" aria-label="Body">
			{#each [{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }] as opt (opt.id)}
				<button
					class="chip"
					aria-pressed={body === opt.id}
					onclick={() => (body = opt.id as BodyKind)}>{opt.label}</button
				>
			{/each}
		</div>
		<div class="group" role="group" aria-label="View">
			{#each VIEWS as v (v.id)}
				<button class="chip" aria-pressed={view === v.id} onclick={() => (view = v.id)}>
					{v.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="plate stage">
		<BodyMap {body} {view} bind:selected />
	</div>

	<p class="count mono">{selected.length} selected: {selected.join(', ') || 'none'}</p>
</main>

<style>
	main { max-width: 44rem; margin: 0 auto; padding: 3rem 1.25rem 5rem; }
	.controls { display: flex; flex-direction: column; gap: 0.6rem; margin: 1.75rem 0; }
	.group { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	/* Sized to the figure rather than to the page: a 200 by 520 body wants a
	   tall narrow column, and letting it stretch wide leaves it stranded. */
	.stage { padding: 1.5rem; max-width: 24rem; margin: 0 auto; }
	.count { font-size: 0.8125rem; color: var(--muted); margin-top: 1rem; }
</style>
