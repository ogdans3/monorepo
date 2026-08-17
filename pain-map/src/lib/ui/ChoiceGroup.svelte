<script lang="ts">
	let {
		legend,
		hint,
		options,
		selected = $bindable(),
		single = false,
		onchange
	}: {
		legend: string;
		hint?: string;
		options: readonly { id: string; label: string }[];
		selected: string[];
		single?: boolean;
		/**
		 * For values that are not really a list. The onset is one answer, and
		 * bridging that through a bindable array needed a getter and setter pair
		 * that Svelte does not have, so the caller gets told instead.
		 */
		onchange?: (next: string[]) => void;
	} = $props();

	function toggle(id: string) {
		const next = single
			? selected.includes(id)
				? []
				: [id]
			: selected.includes(id)
				? selected.filter((s) => s !== id)
				: [...selected, id];
		if (onchange) onchange(next);
		else selected = next;
	}
</script>

<fieldset>
	<legend>{legend}</legend>
	{#if hint}<p class="hint">{hint}</p>{/if}
	<div class="opts">
		{#each options as opt (opt.id)}
			<button
				class="chip"
				aria-pressed={selected.includes(opt.id)}
				onclick={() => toggle(opt.id)}
			>
				{opt.label}
			</button>
		{/each}
	</div>
</fieldset>

<style>
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}

	legend {
		padding: 0;
		font-size: 1rem;
		font-weight: 640;
	}

	.hint {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0.3rem 0 0.7rem;
	}

	.opts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}
</style>
