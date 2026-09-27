<script lang="ts">
	/**
	 * The phone frame's settings, shared by the screenshot page and the screen
	 * recording page so the two offer exactly the same controls under the same
	 * words. The geometry itself is `src/lib/tools/phoneframe.ts`, and so are the
	 * defaults and limits handed in here.
	 *
	 * Renders a run of siblings rather than one wrapper, so it drops into
	 * whatever column or grid the page already lays its controls out in.
	 */
	import type { Snippet } from 'svelte';
	import SliderField from './SliderField.svelte';

	interface Props {
		bezelOn: boolean;
		bezel: number;
		radius: number;
		/** What "Phone size" goes back to, from `phoneFrameDefaults`. */
		defaults: { bezel: number; radius: number };
		/** From `phoneFrameLimits`. */
		limits: { bezelMax: number; radiusMax: number };
		/**
		 * 2 on the video page, where the border moves in pixel pairs so the
		 * number in the box is the number in the file. See `evenPhoneFrame`.
		 */
		bezelStep?: number;
		/** Called when a value is set by hand, so a new file can keep it. */
		ontouch?: (which: 'bezel' | 'radius') => void;
		/**
		 * Puts the sizes back. The border is switched back on first, here,
		 * because a phone has one and a reset that left it off wasn't one.
		 */
		onreset: () => void;
		/**
		 * Everything held still, for the video page while it encodes, so the
		 * preview can't be moved away from the file being made.
		 */
		disabled?: boolean;
		/** More buttons for the row that holds "Phone size". */
		actions?: Snippet;
	}

	let {
		bezelOn = $bindable(),
		bezel = $bindable(),
		radius = $bindable(),
		defaults,
		limits,
		bezelStep = 1,
		ontouch,
		onreset,
		disabled = false,
		actions
	}: Props = $props();

	// The border switch counts: with it off the result isn't phone sized, and
	// turning it off alone is a change "Phone size" should be there to undo.
	const atDefaults = $derived(
		bezelOn && bezel === defaults.bezel && radius === defaults.radius
	);

	function reset() {
		bezelOn = true;
		onreset();
	}
</script>

<label class="pf-check">
	<input type="checkbox" bind:checked={bezelOn} {disabled} />
	Black border
</label>
<SliderField
	label="Border thickness"
	bind:value={bezel}
	min={bezelStep}
	max={limits.bezelMax}
	step={bezelStep}
	unit="px"
	disabled={disabled || !bezelOn}
	oninput={() => ontouch?.('bezel')}
/>
<SliderField
	label="Corner radius"
	bind:value={radius}
	min={0}
	max={limits.radiusMax}
	unit="px"
	{disabled}
	oninput={() => ontouch?.('radius')}
/>
<p class="pf-hint">
	Like an iPhone this size: <span class="mono">{defaults.bezel}px</span> border,
	<span class="mono">{defaults.radius}px</span> corners.
</p>
{#if !atDefaults || actions}
	<div class="pf-actions">
		{#if !atDefaults}
			<button class="btn-ghost" onclick={reset} {disabled}>Phone size</button>
		{/if}
		{@render actions?.()}
	</div>
{/if}

<style>
	/* The site's checkbox, the same as round corners' Circle. */
	.pf-check {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.8125rem;
		color: var(--muted);
		cursor: pointer;
	}

	.pf-check input {
		margin: 0;
		accent-color: var(--primary);
	}

	.pf-check:has(input:disabled) {
		cursor: default;
	}

	.pf-hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.pf-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
</style>
