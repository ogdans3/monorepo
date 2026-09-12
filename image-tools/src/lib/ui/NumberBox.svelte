<script lang="ts">
	/**
	 * The typable half of a slider: a small box showing the current value that
	 * you can also put an exact number into.
	 *
	 * Built to drop straight in where an `<output>` used to sit, so a slider row
	 * gains a writable value without its layout being rebuilt. Dragging is good
	 * for finding a value and useless for setting a known one, and nobody should
	 * have to fight a pixel grid for a number they could type.
	 *
	 * The box holds **text**, not the bound number. A half typed "12" on its way
	 * to "1280" would otherwise yank the slider on every keystroke and clamp the
	 * value out from under the person typing it. Only a value that parses is
	 * committed, and the committed value is echoed back, so an out of range or
	 * nonsense entry visibly snaps to what was accepted rather than silently
	 * doing nothing.
	 */
	interface Props {
		value: number;
		min: number;
		max: number;
		step?: number;
		/** Shown after the number, and stripped when reading one back. */
		unit?: string;
		/** Decimal places. Defaults to whatever `step` implies. */
		decimals?: number;
		/** Turn the number into what the box shows, for timecodes and the like. */
		format?: (value: number) => string;
		/** Read a number back out of typed text. Return null to reject it. */
		parse?: (text: string) => number | null;
		disabled?: boolean;
		/** What the box is for, when the row's own label cannot be borrowed. */
		label?: string;
		/** Fired on every committed edit. */
		oninput?: (value: number) => void;
	}

	let {
		value = $bindable(),
		min,
		max,
		step = 1,
		unit = '',
		decimals,
		format,
		parse,
		disabled = false,
		label,
		oninput
	}: Props = $props();

	const places = $derived(decimals ?? (String(step).split('.')[1]?.length ?? 0));
	const show = (n: number) =>
		format ? format(n) : `${Number.isFinite(n) ? n.toFixed(places) : '0'}${unit}`;

	let text = $state('');
	let editing = $state(false);

	// While the box has focus it belongs to whoever is typing in it. Outside
	// that it follows the value, so dragging the slider updates the number and
	// a rejected entry snaps back to what was actually accepted.
	$effect(() => {
		if (!editing) text = show(value);
	});

	function clamp(n: number): number {
		const stepped = step > 0 ? Math.round((n - min) / step) * step + min : n;
		// Rounding to the step can land a hair outside on floats, so clamp last.
		return Math.min(max, Math.max(min, Number(stepped.toFixed(6))));
	}

	function commit() {
		editing = false;
		const raw = text.trim();
		const parsed = parse ? parse(raw) : Number(raw.replace(unit, '').replace(',', '.').trim());
		if (parsed === null || parsed === undefined || !Number.isFinite(parsed)) {
			text = show(value);
			return;
		}
		value = clamp(parsed);
		oninput?.(value);
		text = show(value);
	}
</script>

<input
	class="box mono"
	type="text"
	inputmode="decimal"
	autocomplete="off"
	spellcheck="false"
	aria-label={label}
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

<style>
	/* Sized to sit where an <output> did, so a slider row keeps its shape. */
	.box {
		width: 4.5rem;
		flex: 0 0 auto;
		font: inherit;
		font-size: 0.8125rem;
		text-align: right;
		padding: 0.25rem 0.4rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--bg);
		color: var(--ink);
	}

	.box:focus-visible {
		border-color: var(--primary);
	}

	.box:disabled {
		opacity: 0.5;
	}

	.mono {
		font-family: var(--font-mono);
	}
</style>
