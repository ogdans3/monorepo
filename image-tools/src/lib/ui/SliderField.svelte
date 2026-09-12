<script lang="ts">
	/**
	 * A slider with a box you can type the exact number into.
	 *
	 * Dragging is good for finding a value and useless for setting a known one.
	 * Somebody who already knows they want 1280 pixels, or exactly 0.25 times
	 * speed, should not have to fight a pixel grid for a number they could
	 * type. So every slider on this site is paired with a writable field, and
	 * this component is what makes that one decision rather than forty.
	 *
	 * The box holds **text**, not the bound number. A half typed "12" on its way
	 * to "1280" would otherwise yank the slider to the left on every keystroke
	 * and clamp the value out from under the person typing it. Only a value
	 * that parses is committed, and the committed value is echoed back, so an
	 * out of range or nonsense entry visibly snaps to what was accepted instead
	 * of silently doing nothing.
	 */
	interface Props {
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		/** Shown after the number, and stripped when parsing one back. */
		unit?: string;
		/** Decimal places in the box. Defaults to whatever `step` implies. */
		decimals?: number;
		/** Turn the number into what the box shows, for timecodes and the like. */
		format?: (value: number) => string;
		/** Read a number back out of typed text. Return null to reject it. */
		parse?: (text: string) => number | null;
		disabled?: boolean;
		/** Fired for every drag and every committed edit, like oninput. */
		oninput?: (value: number) => void;
	}

	let {
		label,
		value = $bindable(),
		min,
		max,
		step = 1,
		unit = '',
		decimals,
		format,
		parse,
		disabled = false,
		oninput
	}: Props = $props();

	const places = $derived(decimals ?? (String(step).split('.')[1]?.length ?? 0));
	const show = (n: number) => (format ? format(n) : `${n.toFixed(places)}${unit}`);

	let text = $state('');
	let editing = $state(false);

	// While the box has focus it is the person's to type in. Outside that it
	// follows the value, so dragging the slider updates the number and a
	// rejected entry snaps back to what was actually accepted.
	$effect(() => {
		if (!editing) text = show(value);
	});

	function clamp(n: number): number {
		const stepped = step > 0 ? Math.round((n - min) / step) * step + min : n;
		// Rounding to the step can land a hair outside on floats, so clamp last.
		return Math.min(max, Math.max(min, Number(stepped.toFixed(6))));
	}

	function set(next: number) {
		value = clamp(next);
		oninput?.(value);
	}

	function commit() {
		editing = false;
		const raw = text.trim();
		const parsed = parse ? parse(raw) : Number(raw.replace(unit, '').trim());
		if (parsed === null || parsed === undefined || !Number.isFinite(parsed)) {
			text = show(value);
			return;
		}
		set(parsed);
		text = show(value);
	}
</script>

<div class="field" class:off={disabled}>
	<label class="head">
		<span>{label}</span>
		<input
			class="box mono"
			type="text"
			inputmode="decimal"
			autocomplete="off"
			spellcheck="false"
			{disabled}
			bind:value={text}
			onfocus={() => (editing = true)}
			onblur={commit}
			onchange={commit}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					e.currentTarget.blur();
				}
			}}
		/>
	</label>
	<input
		type="range"
		{min}
		{max}
		{step}
		{disabled}
		value={value}
		aria-label="{label}, as a slider"
		oninput={(e) => set(Number(e.currentTarget.value))}
	/>
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8125rem;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		color: var(--muted);
	}

	.box {
		width: 6.5rem;
		flex: 0 0 auto;
		font: inherit;
		text-align: right;
		padding: 0.3rem 0.45rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--bg);
		color: var(--ink);
	}

	.box:focus-visible {
		border-color: var(--primary);
	}

	.mono {
		font-family: var(--font-mono);
	}

	.field input[type='range'] {
		width: 100%;
		accent-color: var(--primary);
	}

	.off {
		opacity: 0.5;
	}
</style>
