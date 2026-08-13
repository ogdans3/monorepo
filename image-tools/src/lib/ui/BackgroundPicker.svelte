<script lang="ts">
	// Shown only for targets that cannot keep full transparency. Reused by the
	// converter, the tool export bar and image-to-PDF, so the wording and the
	// swatches are the same everywhere.
	let {
		value = $bindable('#ffffff'),
		label = 'Transparent areas',
		onchange
	}: {
		value?: string;
		label?: string;
		onchange?: () => void;
	} = $props();

	const PRESETS = [
		{ hex: '#ffffff', label: 'White' },
		{ hex: '#000000', label: 'Black' }
	];

	let customOpen = $state(false);
	const isPreset = $derived(PRESETS.some((p) => p.hex === value.toLowerCase()));

	function pick(hex: string) {
		value = hex;
		customOpen = false;
		onchange?.();
	}
</script>

<div class="bg-row" role="group" aria-label={label}>
	<span class="bg-label">{label}</span>
	{#each PRESETS as preset (preset.hex)}
		<button
			class="chip"
			class:active={value.toLowerCase() === preset.hex}
			aria-pressed={value.toLowerCase() === preset.hex}
			onclick={() => pick(preset.hex)}
		>
			{preset.label}
		</button>
	{/each}
	<button
		class="chip"
		class:active={!isPreset || customOpen}
		aria-pressed={!isPreset || customOpen}
		onclick={() => (customOpen = true)}
	>
		Colour
	</button>
	{#if !isPreset || customOpen}
		<input
			type="color"
			bind:value
			onchange={() => onchange?.()}
			aria-label="{label} colour"
		/>
		<span class="mono hex">{value}</span>
	{/if}
</div>

<style>
	.bg-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.bg-label {
		font-size: 0.875rem;
		color: var(--muted);
		margin-right: 0.2rem;
	}

	input[type='color'] {
		width: 2.2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		cursor: pointer;
	}

	.hex {
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
