<!-- A colour: one of a few to start from, or any other. -->
<script lang="ts">
	let {
		value,
		colours,
		auto,
		label,
		onpick
	}: {
		value: string;
		colours: string[];
		/** The colour «automatic» stands for, when it is offered. */
		auto?: string;
		label: string;
		onpick: (colour: string) => void;
	} = $props();

	const custom = $derived(value && !colours.includes(value.toUpperCase()) ? value : '');
</script>

<div class="swatches" role="radiogroup" aria-label={label}>
	{#if auto !== undefined}
		<button
			class="swatch auto"
			role="radio"
			aria-checked={!value}
			title="Automatisk"
			aria-label="Automatisk"
			style:--c={auto}
			onclick={() => onpick('')}
		><span>A</span></button>
	{/if}
	{#each colours as c (c)}
		<button
			class="swatch"
			role="radio"
			aria-checked={value.toUpperCase() === c}
			aria-label={c}
			title={c}
			style:--c={c}
			onclick={() => onpick(c)}
		></button>
	{/each}
	<label class="swatch other" class:on={!!custom} title="Annen farge" style:--c={custom || 'transparent'}>
		<input
			type="color"
			value={custom || value || '#888888'}
			aria-label="Annen farge"
			oninput={(e) => onpick(e.currentTarget.value.toUpperCase())}
		/>
	</label>
</div>

<style>
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.swatch {
		position: relative;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--rule-strong);
		border-radius: 50%;
		background: var(--c);
	}

	.swatch[aria-checked='true'],
	.swatch.other.on {
		box-shadow:
			0 0 0 2px var(--ground),
			0 0 0 3.5px var(--text);
	}

	.swatch.auto {
		display: grid;
		place-items: center;
		background: linear-gradient(135deg, var(--desk-raised) 50%, var(--c) 50%);
	}

	.swatch.auto span {
		font-size: 0.6875rem;
		font-weight: 760;
		color: var(--desk-text);
		mix-blend-mode: difference;
		filter: invert(1);
	}

	.swatch.other {
		overflow: hidden;
		cursor: pointer;
		background:
			conic-gradient(from 90deg, #e88f8f, #f0d48a, #9bd3ae, #8fb8e8, #c4a3e8, #e88f8f);
	}

	.swatch.other.on {
		background: var(--c);
	}

	.swatch.other input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}
</style>
