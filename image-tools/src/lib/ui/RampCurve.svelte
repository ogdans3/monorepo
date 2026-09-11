<script lang="ts">
	import {
		defaultRamp,
		normaliseRamp,
		RAMP_MAX_POINTS,
		SLOWER,
		speedAt,
		type RampPoint,
		type RampRange
	} from '$lib/video/ramp';
	import { formatTimecode } from '$lib/video/timecode';

	interface Props {
		points: RampPoint[];
		duration: number;
		/** Which way the curve runs, and how far. One end is always 1. */
		range?: RampRange;
		/** Where the preview has got to, drawn as a playhead. */
		playhead?: number;
		onchange: (points: RampPoint[]) => void;
	}
	let { points, duration, range = SLOWER, playhead = 0, onchange }: Props = $props();

	/**
	 * Up is always faster, whichever direction the page runs in. The slow page
	 * puts 1 at the top and 0.1 at the floor, the speed up page puts 1 at the
	 * floor and 4 at the ceiling. Either way dragging a point up means the clip
	 * runs closer to, or past, its own pace, which is the one thing about the
	 * graph nobody should have to be told.
	 */
	const faster = $derived(range.min >= 1);

	const HEIGHT = 172;
	const PAD = { top: 12, right: 12, bottom: 22, left: 34 };



	let width = $state(0);
	/**
	 * Which point the sliders under the graph edit. Minus one means nobody has
	 * picked one yet, and the slowest point stands in until they do: the ends
	 * of the curve cannot move along the clip, so opening on point one would
	 * mean opening on a disabled slider and a disabled Remove button.
	 *
	 * Derived rather than seeded once, so it also recovers when the shape
	 * buttons replace the whole curve underneath it.
	 */
	let selected = $state(-1);
	let dragging = $state<number | null>(null);
	let plot = $state<SVGSVGElement>();

	const innerWidth = $derived(Math.max(1, width - PAD.left - PAD.right));
	const innerHeight = HEIGHT - PAD.top - PAD.bottom;
	const span = $derived(duration > 0 ? duration : 1);

	const x = (t: number) => PAD.left + (t / span) * innerWidth;
	const y = (speed: number) =>
		PAD.top + (1 - (speed - range.min) / (range.max - range.min)) * innerHeight;

	const timeAt = (px: number) =>
		Math.min(span, Math.max(0, ((px - PAD.left) / innerWidth) * span));
	const speedFor = (py: number) =>
		Math.min(
			range.max,
			Math.max(range.min, range.max - ((py - PAD.top) / innerHeight) * (range.max - range.min))
		);

	/**
	 * The curve itself, sampled at roughly a point per two pixels. Drawing the
	 * eased shape rather than joining the control points with straight lines is
	 * the whole reason the graph is worth having: what is on screen is what the
	 * clip will do.
	 */
	const linePath = $derived.by(() => {
		if (width <= 0) return '';
		const steps = Math.max(24, Math.round(innerWidth / 2));
		let d = '';
		for (let i = 0; i <= steps; i++) {
			const t = (span * i) / steps;
			d += `${i === 0 ? 'M' : 'L'}${x(t).toFixed(2)} ${y(speedAt(points, t)).toFixed(2)}`;
		}
		return d;
	});

	const areaPath = $derived(
		linePath
			? `${linePath}L${x(span).toFixed(2)} ${(PAD.top + innerHeight).toFixed(2)}L${PAD.left} ${(PAD.top + innerHeight).toFixed(2)}Z`
			: ''
	);

	const active = $derived(
		selected >= 0 && selected < points.length
			? selected
			: // The point furthest from the original pace, which is the one worth
				// landing on: the ends of the curve cannot move along the clip.
				points.reduce(
					(best, p, i) =>
						Math.abs(p.speed - 1) > Math.abs(points[best].speed - 1) ? i : best,
					0
				)
	);
	const current = $derived(points[active]);
	const isEnd = $derived(active === 0 || active === points.length - 1);

	/**
	 * Move one point and hand back where it ended up.
	 *
	 * The index is not stable across a move: normalising sorts, so dragging a
	 * point past its neighbour renumbers both. Returning the new index is what
	 * lets the drag keep hold of the point it grabbed rather than silently
	 * switching to whichever one now sits at that number.
	 */
	function movePoint(index: number, t: number, speed: number): number {
		const moved = points.map((p, i) => (i === index ? { t, speed } : p));
		// The two ends define the extent of the curve, so they move up and down
		// but never along. Letting them slide would leave the clip with a
		// stretch at either end that the curve says nothing about.
		if (index === 0) moved[0] = { t: 0, speed };
		if (index === points.length - 1) moved[index] = { t: span, speed };

		const target = moved[index];
		const cleaned = normaliseRamp(moved, duration, range);
		const at = cleaned.findIndex((p) => Math.abs(p.t - target.t) < 1e-6);
		const landed = at >= 0 ? at : Math.min(index, cleaned.length - 1);
		selected = landed;
		onchange(cleaned);
		return landed;
	}

	function pointerPosition(event: PointerEvent) {
		const rect = plot!.getBoundingClientRect();
		return { t: timeAt(event.clientX - rect.left), speed: speedFor(event.clientY - rect.top) };
	}

	function grab(event: PointerEvent, index: number) {
		event.preventDefault();
		event.stopPropagation();
		selected = index;
		dragging = index;
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
	}

	function drag(event: PointerEvent) {
		if (dragging === null) return;
		event.preventDefault();
		const { t, speed } = pointerPosition(event);
		dragging = movePoint(dragging, t, speed);
	}

	function release(event: PointerEvent) {
		if (dragging === null) return;
		// The capture may be held by a knob rather than by the surface this
		// handler is on, and releasing one that was never taken throws. It is
		// released implicitly on pointerup anyway.
		try {
			(event.currentTarget as Element).releasePointerCapture(event.pointerId);
		} catch {
			/* not ours to release */
		}
		dragging = null;
	}

	/** Tapping the empty plot puts a new point there and starts dragging it. */
	function addHere(event: PointerEvent) {
		if (points.length >= RAMP_MAX_POINTS || duration <= 0) return;
		const { t, speed } = pointerPosition(event);
		const next = normaliseRamp([...points, { t, speed }], duration, range);
		const at = next.findIndex((p) => Math.abs(p.t - t) < 1e-6);
		selected = at >= 0 ? at : selected;
		dragging = at >= 0 ? at : null;
		if (dragging !== null) (event.currentTarget as Element).setPointerCapture(event.pointerId);
		onchange(next);
	}

	function removePoint(index: number) {
		if (points.length <= 2 || index === 0 || index === points.length - 1) return;
		selected = Math.max(0, index - 1);
		onchange(normaliseRamp(points.filter((_, i) => i !== index), duration, range));
	}

	/**
	 * Arrow keys move the focused point. Coarse by default and fine with shift,
	 * which is the behaviour a range input already has, so this borrows it
	 * rather than inventing something for the same job.
	 */
	function onKey(event: KeyboardEvent, index: number) {
		const point = points[index];
		if (!point) return;
		// Steps scale with the range, so one arrow press feels the same on a
		// 0.1-to-1 axis as on a 1-to-4 one.
		const spread = range.max - range.min;
		const speedStep = (event.shiftKey ? 0.011 : 0.055) * spread;
		const timeStep = (event.shiftKey ? 0.01 : 0.05) * span;
		let handled = true;
		switch (event.key) {
			case 'ArrowUp':
				movePoint(index, point.t, point.speed + speedStep);
				break;
			case 'ArrowDown':
				movePoint(index, point.t, point.speed - speedStep);
				break;
			case 'ArrowLeft':
				movePoint(index, point.t - timeStep, point.speed);
				break;
			case 'ArrowRight':
				movePoint(index, point.t + timeStep, point.speed);
				break;
			case 'Home':
				movePoint(index, point.t, 1);
				break;
			case 'End':
				movePoint(index, point.t, range.peak);
				break;
			case 'Delete':
			case 'Backspace':
				removePoint(index);
				break;
			default:
				handled = false;
		}
		if (handled) event.preventDefault();
	}

	/**
	 * The shapes worth a button, so nobody has to draw the common ones. Named
	 * for what they do rather than which way the line goes, because "slow" and
	 * "fast" are the same three shapes pointing opposite ways.
	 */
	const SHAPES = $derived([
		{
			label: faster ? 'Fast in the middle' : 'Slow in the middle',
			build: (d: number) => defaultRamp(d, range)
		},
		{
			label: faster ? 'Build to the end' : 'Slow to the end',
			build: (d: number) => [
				{ t: 0, speed: 1 },
				{ t: d * 0.4, speed: 1 },
				{ t: d, speed: range.peak }
			]
		},
		{
			label: faster ? 'Start fast, settle' : 'Slow from the start',
			build: (d: number) => [
				{ t: 0, speed: range.peak },
				{ t: d * 0.6, speed: 1 },
				{ t: d, speed: 1 }
			]
		},
		{
			label: 'Flat',
			build: (d: number) => [
				{ t: 0, speed: 1 },
				{ t: d, speed: 1 }
			]
		}
	]);

	function applyShape(build: (d: number) => RampPoint[]) {
		// Back to "nobody has picked one", so the new shape gets the same
		// sensible default the first one did.
		selected = -1;
		onchange(normaliseRamp(build(span), duration, range));
	}

	const label = (p: RampPoint) => `${formatTimecode(p.t)}, ${p.speed.toFixed(2)} times speed`;
</script>

<div class="curve">
	<div class="plot" bind:clientWidth={width}>
		{#if width > 0}
			<!--
				The pointer handlers here are a pointer-only shortcut: dragging a
				point, and tapping the background to add one. Everything they do is
				also reachable from the sliders and the shape buttons below, and the
				points themselves are real sliders, so the surface is a group of
				controls rather than a control in its own right.
			-->
			<svg
				bind:this={plot}
				role="group"
				aria-label="Speed curve, {points.length} points"
				{width}
				height={HEIGHT}
				viewBox="0 0 {width} {HEIGHT}"
				onpointerdown={addHere}
				onpointermove={drag}
				onpointerup={release}
				onpointercancel={release}
			>
				<title>Speed curve. Higher is closer to the original pace.</title>

				{#each range.marks as mark (mark)}
					<line class="grid" x1={PAD.left} x2={width - PAD.right} y1={y(mark)} y2={y(mark)} />
					<text class="tick" x={PAD.left - 6} y={y(mark) + 3.5} text-anchor="end">
						{mark === 1 ? '1×' : `${mark}×`}
					</text>
				{/each}

				<path class="area" d={areaPath} />
				<path class="line" d={linePath} />

				{#if playhead > 0 && playhead <= span}
					<line class="playhead" x1={x(playhead)} x2={x(playhead)} y1={PAD.top} y2={PAD.top + innerHeight} />
				{/if}

				<text class="tick" x={PAD.left} y={HEIGHT - 6}>0:00</text>
				<text class="tick" x={width - PAD.right} y={HEIGHT - 6} text-anchor="end">
					{formatTimecode(span)}
				</text>

				{#each points as point, i (i)}
					<circle
						class="knob"
						class:on={i === active}
						cx={x(point.t)}
						cy={y(point.speed)}
						r={i === active ? 7 : 5.5}
						role="slider"
						tabindex="0"
						aria-label="Curve point {i + 1} of {points.length}"
						aria-valuemin={range.min}
						aria-valuemax={range.max}
						aria-valuenow={point.speed}
						aria-valuetext={label(point)}
						onpointerdown={(e) => grab(e, i)}
						onkeydown={(e) => onKey(e, i)}
						onfocus={() => (selected = i)}
					/>
				{/each}
			</svg>
		{/if}
	</div>

	<!--
		The graph is direct manipulation, which is no use on a phone where the
		points are smaller than a fingertip, and no use at all from a keyboard
		reading it aloud. These two sliders edit the same point the graph has
		selected, with the platform's own control doing the work.
	-->
	{#if current}
		<div class="edit">
			<p class="which mono">
				Point {active + 1} of {points.length}{#if isEnd}<span class="muted"
						>, an end of the clip</span
					>{/if}
			</p>
			<label class="pair">
				<span>at</span>
				<input
					type="range"
					min="0"
					max={span}
					step="0.05"
					value={current.t}
					disabled={isEnd}
					aria-label="When this point is, in seconds"
					oninput={(e) => movePoint(active, Number(e.currentTarget.value), current.speed)}
				/>
				<output class="mono">{formatTimecode(current.t)}</output>
			</label>
			<label class="pair">
				<span>runs at</span>
				<input
					type="range"
					min={range.min}
					max={range.max}
					step="0.01"
					value={current.speed}
					aria-label="How fast the clip runs at this point"
					oninput={(e) => movePoint(active, current.t, Number(e.currentTarget.value))}
				/>
				<output class="mono">{current.speed.toFixed(2)}×</output>
			</label>
			<button
				type="button"
				class="btn-ghost"
				disabled={isEnd || points.length <= 2}
				onclick={() => removePoint(active)}
			>
				Remove point
			</button>
		</div>
	{/if}

	<div class="shapes">
		{#each SHAPES as shape (shape.label)}
			<button type="button" class="chip" onclick={() => applyShape(shape.build)}>
				{shape.label}
			</button>
		{/each}
	</div>

	<p class="hint">
		Drag a point to change the pace where it sits, or tap the graph to add one. Up is faster and
		down is slower, and the flat line at {faster ? 'the bottom' : 'the top'} is the clip's own pace.
		Everything between two points eases, so the speed slides rather than snapping.
		{#if points.length >= RAMP_MAX_POINTS}
			<br />That's the most points one curve takes.
		{/if}
	</p>
</div>

<style>
	.curve {
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.plot {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		/* The SVG fills it, so the box must not add a baseline gap under it. */
		line-height: 0;
		touch-action: none;
	}

	svg {
		display: block;
		cursor: crosshair;
	}

	.grid {
		stroke: var(--line);
		stroke-width: 1;
	}

	.tick {
		fill: var(--muted);
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.area {
		fill: color-mix(in oklab, var(--primary) 10%, transparent);
	}

	.line {
		fill: none;
		stroke: var(--primary);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.playhead {
		stroke: var(--accent);
		stroke-width: 1.5;
	}

	.knob {
		fill: var(--bg);
		stroke: var(--primary);
		stroke-width: 2;
		cursor: grab;
		transition:
			r 160ms var(--ease),
			fill 160ms var(--ease);
	}

	.knob.on {
		fill: var(--primary);
	}

	.knob:active {
		cursor: grabbing;
	}

	.knob:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.edit {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.8rem;
	}

	.which {
		margin: 0;
		flex-basis: 100%;
		font-size: 0.8125rem;
		color: var(--ink);
	}

	.muted {
		color: var(--muted);
	}

	.pair {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.875rem;
		flex: 1 1 14rem;
	}

	.pair input[type='range'] {
		flex: 1;
		min-width: 6rem;
		accent-color: var(--primary);
	}

	.pair input[type='range']:disabled {
		opacity: 0.45;
	}

	.pair output {
		min-width: 3.6rem;
		text-align: right;
		font-size: 0.8125rem;
	}

	.shapes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.mono {
		font-family: var(--font-mono);
	}

	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
		max-width: 68ch;
		text-wrap: pretty;
	}

	@media (prefers-reduced-motion: reduce) {
		.knob {
			transition: none;
		}
	}
</style>
