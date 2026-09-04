<script lang="ts">
	/**
	 * The mark field. The site's one visual idea.
	 *
	 * Each mark is one average annual salary. A budget line of 350 billion is
	 * about 470 000 of them, which is far too many to draw, so the field draws
	 * what fits and states its own scale in words. The scale is always a round
	 * power of ten, because "ett merke er 1 000 årslønner" is a sentence a
	 * reader can hold and "ett merke er 1 374 årslønner" is not.
	 *
	 * Canvas rather than SVG: a hundred thousand DOM nodes stops a phone dead.
	 * Squares rather than circles: squares tile without gaps, so the area of
	 * the field is proportional to the amount. That proportionality is the
	 * whole argument the picture is making, and circles would quietly lie
	 * about it by leaving 21% of the space empty.
	 *
	 * The canvas is aria-hidden. The figure it represents is always rendered
	 * as text beside it by the caller, never only here.
	 */
	let {
		antallLønninger,
		/**
		 * Salaries per mark. Required, and deliberately not computed per field.
		 *
		 * The first version let every field pick its own scale, which made a
		 * 350-billion line and a 45-billion line draw almost the same rectangle.
		 * That is the exact lie this picture exists to avoid: if two fields on
		 * one page are not on one scale, their areas mean nothing next to each
		 * other, and comparing them is the only thing a reader will do.
		 */
		skala,
		fyllfarge = 'var(--primary)',
		/** Draw progressively when scrolled into view. */
		animer = true
	}: {
		antallLønninger: number;
		skala: number;
		fyllfarge?: string;
		animer?: boolean;
	} = $props();

	let canvas = $state<HTMLCanvasElement>();
	let wrapper = $state<HTMLDivElement>();
	let bredde = $state(0);

	/** Marks are 3px with 1px of air, so the grid pitch is 4 CSS pixels. */
	const PITCH = 4;
	const MERKE = 3;

	const merker = $derived(Math.max(1, Math.round(antallLønninger / skala)));
	const kolonner = $derived(Math.max(1, Math.floor(bredde / PITCH)));
	const rader = $derived(Math.ceil(merker / kolonner));
	const høyde = $derived(Math.max(PITCH, rader * PITCH));

	/** Resolved once from the wrapper, since canvas cannot read a CSS variable. */
	function løsFarge(): string {
		if (!wrapper) return '#000';
		const probe = getComputedStyle(wrapper).getPropertyValue('color');
		return probe.trim() || '#000';
	}

	function tegn(andel: number) {
		if (!canvas || !bredde) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(bredde * dpr);
		canvas.height = Math.round(høyde * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, bredde, høyde);
		ctx.fillStyle = løsFarge();

		const tegnes = Math.round(merker * andel);
		for (let i = 0; i < tegnes; i++) {
			const x = (i % kolonner) * PITCH;
			const y = Math.floor(i / kolonner) * PITCH;
			ctx.fillRect(x, y, MERKE, MERKE);
		}
	}

	$effect(() => {
		if (!wrapper) return;

		const ro = new ResizeObserver(([entry]) => {
			bredde = entry.contentRect.width;
		});
		ro.observe(wrapper);
		return () => ro.disconnect();
	});

	$effect(() => {
		// Referenced so the effect re-runs when the geometry changes.
		void merker;
		void kolonner;
		void høyde;
		if (!canvas || !bredde) return;

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!animer || reduced) {
			tegn(1);
			return;
		}

		// The field is drawn complete unless and until the observer says it is
		// on screen. A reveal that never fires must not be able to leave a
		// blank rectangle behind.
		tegn(1);

		let frame = 0;
		let stopped = false;
		const io = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				io.disconnect();
				const start = performance.now();
				const varighet = 900;
				const steg = (now: number) => {
					if (stopped) return;
					const t = Math.min(1, (now - start) / varighet);
					// ease-out-quart, the curve named in DESIGN.md
					tegn(1 - (1 - t) ** 4);
					if (t < 1) frame = requestAnimationFrame(steg);
				};
				tegn(0);
				frame = requestAnimationFrame(steg);
			},
			{ threshold: 0.25 }
		);
		io.observe(canvas);

		return () => {
			stopped = true;
			io.disconnect();
			cancelAnimationFrame(frame);
		};
	});
</script>

<div class="felt" bind:this={wrapper} style:color={fyllfarge}>
	<canvas bind:this={canvas} style:height="{høyde}px" aria-hidden="true"></canvas>
</div>

<style>
	.felt {
		width: 100%;
	}

	canvas {
		display: block;
		width: 100%;
	}
</style>
