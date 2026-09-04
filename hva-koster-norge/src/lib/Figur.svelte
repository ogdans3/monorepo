<script lang="ts">
	import type { FigurNavn } from './data';

	/**
	 * A drawing beside each budget line.
	 *
	 * Deliberately low on detail: eight strokes, no faces, no shading. Two
	 * reasons, and neither is laziness. A drawing with a face invites the
	 * reader to judge the person in it, and this page is about a number, not
	 * about whether a pensioner deserves one. And low detail is the only way
	 * eight of these read as one hand rather than as eight clip-art downloads.
	 *
	 * Drawn on a 48-unit square grid so every figure occupies the same optical
	 * weight. Stroked in `currentColor`, never filled with a colour of its own,
	 * so a figure can never become a second accent competing with the field.
	 *
	 * Decorative: the line it illustrates is written out beside it, so these
	 * are `aria-hidden` and carry no title. A screen reader that announced
	 * "drawing of an elderly person" would be adding editorial the sighted
	 * reader does not get.
	 *
	 * Motion is one slow loop each, tied to what the figure is: the pensioner
	 * leans on the stick, the heart beats, the train moves off. It runs at
	 * eight to twelve seconds so it reads as alive rather than as a
	 * distraction beside text, and it stops entirely under reduced motion.
	 */
	let { navn, størrelse = 48 }: { navn: FigurNavn; størrelse?: number } = $props();
</script>

<svg
	class="figur {navn}"
	width={størrelse}
	height={størrelse}
	viewBox="0 0 48 48"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if navn === 'pensjonist'}
		<!-- Stooped back, stick planted. The lean is the whole character. -->
		<circle cx="21" cy="11" r="5" />
		<g class="lener">
			<path d="M21 16 L20 30" />
			<path d="M20 30 L17 42" />
			<path d="M20 30 L24 42" />
			<path d="M21 20 L28 26" />
		</g>
		<path class="stokk" d="M29 26 L31 43" />
		<path d="M14 43 L36 43" class="bakke" />
	{:else if navn === 'sykehus'}
		<!-- A bed and a pulse. Not a red cross, which reads as an emblem. -->
		<path class="puls" d="M6 11 L15 11 L18 5 L23 17 L26 11 L42 11" />
		<path d="M8 38 L8 29 L40 29 L40 38" />
		<path d="M5 38 L43 38" />
		<circle cx="15" cy="24" r="4" />
		<path d="M21 24 L40 24" />
	{:else if navn === 'kommune'}
		<!-- Three roofs of different heights: a place, not one building. -->
		<path d="M5 42 L5 28 L14 21 L23 28 L23 42" />
		<path d="M23 42 L23 32 L31 26 L39 32 L39 42" />
		<path d="M3 42 L45 42" />
		<path class="lys" d="M11 42 L11 34 L17 34 L17 42" />
		<path d="M29 36 L33 36" />
	{:else if navn === 'trygd'}
		<!-- A seated figure and a crutch. Rest, not illness. -->
		<circle cx="20" cy="10" r="5" />
		<path d="M20 15 L20 29" />
		<path d="M20 29 L15 42" />
		<path d="M20 29 L25 42" />
		<path d="M20 19 L29 22" />
		<g class="krykke">
			<path d="M30 15 L30 42" />
			<path d="M25 15 L35 15" />
			<path d="M30 22 L34 25" />
		</g>
		<path d="M11 42 L39 42" />
	{:else if navn === 'forsvar'}
		<!-- A shield. Defence as protection, not as a weapon. -->
		<path class="skjold" d="M24 5 L40 11 L40 25 C40 34 33 41 24 44 C15 41 8 34 8 25 L8 11 Z" />
		<path d="M8 18 L40 18" />
	{:else if navn === 'vei'}
		<!-- A road running to a horizon, dashes moving toward the reader. -->
		<path d="M6 43 L19 10" />
		<path d="M42 43 L29 10" />
		<path d="M17 8 L31 8" />
		<g class="striper">
			<path d="M24 12 L24 17" />
			<path d="M24 22 L24 29" />
			<path d="M24 34 L24 43" />
		</g>
	{:else if navn === 'utdanning'}
		<!-- An open book, pages lifting. -->
		<path d="M24 16 L24 40" />
		<path class="venstre" d="M24 16 C19 12 13 11 6 12 L6 36 C13 35 19 36 24 40" />
		<path class="høyre" d="M24 16 C29 12 35 11 42 12 L42 36 C35 35 29 36 24 40" />
	{:else if navn === 'bistand'}
		<!-- A globe with a hand under it. Support, not a gift. -->
		<circle class="klode" cx="24" cy="19" r="11" />
		<path d="M13 19 L35 19" />
		<path d="M24 8 C29 12 29 26 24 30 C19 26 19 12 24 8" />
		<path d="M10 36 C14 42 34 42 38 36" />
	{/if}
</svg>

<style>
	.figur {
		display: block;
		flex: none;
		color: var(--primary);
		overflow: visible;
	}

	/*
	 * One loop per figure, slow enough to sit beside prose. Transforms only,
	 * so nothing here triggers layout.
	 */
	.pensjonist .lener {
		transform-origin: 20px 30px;
		animation: lene 9s ease-in-out infinite;
	}

	@keyframes lene {
		0%,
		100% {
			transform: rotate(0deg);
		}
		50% {
			transform: rotate(3deg);
		}
	}

	/*
	 * A beat, not a redraw.
	 *
	 * Both this and the shield first animated stroke-dashoffset so the line
	 * drew itself, which meant the shape was partly missing for a third of
	 * every loop. A screenshot caught the pulse half-drawn and it read as a
	 * rendering bug. Motion has to improve something already fully visible,
	 * so these scale instead: the figure is complete at every frame.
	 */
	.sykehus .puls {
		transform-origin: 24px 11px;
		animation: puls 4s ease-in-out infinite;
	}

	@keyframes puls {
		0%,
		70%,
		100% {
			transform: scaleY(1);
		}
		12% {
			transform: scaleY(1.35);
		}
		24% {
			transform: scaleY(0.9);
		}
	}

	.kommune .lys {
		animation: lys 10s ease-in-out infinite;
	}

	@keyframes lys {
		0%,
		45%,
		100% {
			opacity: 1;
		}
		60%,
		85% {
			opacity: 0.25;
		}
	}

	.trygd .krykke {
		transform-origin: 36px 40px;
		animation: krykke 10s ease-in-out infinite;
	}

	@keyframes krykke {
		0%,
		100% {
			transform: rotate(0deg);
		}
		50% {
			transform: rotate(-4deg);
		}
	}

	.forsvar .skjold {
		transform-origin: 24px 24px;
		animation: verne 9s ease-in-out infinite;
	}

	@keyframes verne {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.05);
		}
	}

	/* The dashes move toward the reader, so the road reads as travelled. */
	.vei .striper {
		animation: kjøre 4s linear infinite;
	}

	@keyframes kjøre {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(11px);
		}
	}

	.utdanning .venstre,
	.utdanning .høyre {
		transform-origin: 24px 28px;
		animation: blad 11s ease-in-out infinite;
	}

	.utdanning .høyre {
		animation-delay: -5.5s;
	}

	@keyframes blad {
		0%,
		100% {
			transform: scaleX(1);
		}
		50% {
			transform: scaleX(0.92);
		}
	}

	.bistand .klode {
		transform-origin: 24px 19px;
		animation: vugge 9s ease-in-out infinite;
	}

	@keyframes vugge {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-2px);
		}
	}

	/*
	 * The global reduce rule in app.css shortens durations, which for an
	 * infinite loop leaves it running very fast rather than stopping it.
	 * These have to be turned off by name.
	 */
	@media (prefers-reduced-motion: reduce) {
		.figur :global(*) {
			animation: none !important;
		}
	}
</style>
