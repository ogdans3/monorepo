<!--
	The ballot, behind the QR code. It follows the presentation: while a
	question is on screen its answers are here, each a tile in the answer's
	colour with its mark, the same as on the slide, so a vote is matching a
	colour to a colour; otherwise the page waits, empty. A new question shows
	the moment the screen changes, from the push itself.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { inkOn, mark } from '$lib/answers';
	import { api, ApiError, message } from '$lib/api';
	import { follow, type Link } from '$lib/live';
	import type { Ballot, BallotQuestion, LiveState } from '$lib/types';

	const code = $derived((page.params.code ?? '').toUpperCase());

	let ballot = $state<Ballot | null>(null);
	let missing = $state(false);
	/** The presentation was deleted while this phone was on it. */
	let gone = $state(false);
	/** It has been running while this page was open, so not running now is over. */
	let started = $state(false);
	let link = $state<Link>('connecting');
	let sending = $state<string | null>(null);
	let note = $state('');
	let loading = 0;

	/** The ballot as the server has it, with whether this phone has answered. */
	async function load() {
		const mine = ++loading;
		try {
			const b = await api<Ballot>('GET', `/api/stem/${code}`);
			if (mine !== loading) return;
			if (b.question?.slideId !== ballot?.question?.slideId) note = '';
			if (b.live) started = true;
			ballot = b;
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) missing = true;
			else note = message(err);
		}
	}

	// What is on screen, at once, from the push: the question and its answers
	// are in it. Whether this phone answered it already comes a moment later,
	// from the ballot, and a vote in between is told so by the server.
	function onState(s: LiveState) {
		if (s.ended) {
			gone = true;
			return;
		}
		if (ballot) {
			const slide = s.slide;
			const question: BallotQuestion | null =
				slide && slide.options.length > 0
					? { slideId: slide.id, title: slide.title, options: slide.options.map(({ id, label, color }) => ({ id, label, color })) }
					: null;
			const same = question?.slideId === ballot.question?.slideId;
			if (!same) note = '';
			if (slide) started = true;
			ballot = {
				...ballot,
				title: s.title,
				marks: s.marks ?? ballot.marks,
				live: !!slide,
				question,
				voted: same ? ballot.voted : null
			};
		}
		load();
	}

	onMount(() => {
		const stop = follow(
			code,
			{
				state: onState,
				link: (l) => {
					link = l;
					if (l === 'missing') missing = true;
				}
			},
			true
		);
		// A phone put away and taken out again asks straight away, rather than
		// wait for its stream to notice it was asleep.
		const wake = () => document.visibilityState === 'visible' && load();
		document.addEventListener('visibilitychange', wake);
		window.addEventListener('pageshow', wake);
		return () => {
			stop();
			document.removeEventListener('visibilitychange', wake);
			window.removeEventListener('pageshow', wake);
		};
	});

	async function vote(id: string) {
		if (!ballot?.question || ballot.voted || sending) return;
		sending = id;
		note = '';
		try {
			await api('POST', `/api/stem/${code}`, { optionId: id });
			ballot.voted = id;
			navigator.vibrate?.(16);
		} catch (err) {
			if (err instanceof ApiError && err.code === 'not_open') {
				await load();
				note = 'Spørsmålet ble byttet akkurat nå. Her er det som er oppe.';
			} else if (err instanceof ApiError && err.code === 'already_voted') {
				await load();
			} else note = message(err);
		} finally {
			sending = null;
		}
	}
</script>

<svelte:head>
	<title>{ballot?.title ? `Stem · ${ballot.title}` : 'Stem · Podium'}</title>
	<meta name="theme-color" content="#080d11" />
</svelte:head>

<main class="room ballot">
	{#if gone}
		<section class="empty">
			<h1>Presentasjonen er over.</h1>
			<p>Takk for at du stemte.</p>
		</section>
	{:else if missing}
		<section class="empty">
			<h1>Fant ingen presentasjon med koden {code}.</h1>
			<p>Sjekk koden på skjermen og prøv igjen.</p>
			<a class="again" href="/">Skriv inn koden</a>
		</section>
	{:else if !ballot}
		<section class="waiting" aria-busy="true">
			<p>{link === 'lost' ? 'Får ikke kontakt. Prøver igjen …' : 'Kobler til …'}</p>
		</section>
	{:else}
		<header>
			<span class="title">{ballot.title}</span>
			<span class="code figure">{ballot.code}</span>
		</header>

		{#if ballot.question}
			{@const q = ballot.question}
			<section class="question" aria-labelledby="q">
				<h1 id="q">{q.title || 'Stem'}</h1>
				<ul class="tiles" class:pairs={q.options.length >= 4} role="list">
					{#each q.options as o, i (o.id)}
						{@const chosen = ballot.voted === o.id}
						{@const m = mark(i, ballot.marks)}
						<li>
							<button
								class="tile"
								class:chosen
								class:passed={!!ballot.voted && !chosen}
								class:sending={sending === o.id}
								style:--tile={o.color}
								style:--tile-ink={inkOn(o.color)}
								disabled={!!ballot.voted || (sending !== null && sending !== o.id)}
								aria-pressed={chosen}
								aria-label="{m}: {o.label || `Svar ${i + 1}`}"
								onclick={() => vote(o.id)}
							>
								<span class="mark figure" aria-hidden="true">{m}</span>
								{#if o.label}<span class="label" aria-hidden="true">{o.label}</span>{/if}
								{#if chosen}<span class="stamp figure" aria-hidden="true">Stemt</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
				<p class="after" aria-live="polite">
					{#if note}
						{note}
					{:else if ballot.voted}
						Stemmen din er telt. Se skjermen.
					{:else}
						Trykk på fargen du vil stemme på. Én stemme per telefon.
					{/if}
				</p>
			</section>
		{:else if ballot.live}
			<!-- Nothing to vote on: the page waits, empty, for the next question. -->
			<section class="waiting">
				<p>Venter på neste spørsmål</p>
				{#if note}<p class="note">{note}</p>{/if}
			</section>
		{:else if started}
			<section class="empty">
				<h1>Presentasjonen er over.</h1>
				<p>Takk for at du stemte.</p>
			</section>
		{:else}
			<section class="waiting">
				<p>Presentasjonen har ikke startet ennå.</p>
				<p class="quiet">La siden stå åpen. Spørsmålene kommer hit av seg selv.</p>
			</section>
		{/if}

		{#if link === 'lost'}
			<p class="link">Mistet forbindelsen. Kobler til igjen …</p>
		{/if}
	{/if}
</main>

<style>
	.ballot {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
			max(1.25rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
		font-size: 1rem;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 0.25rem 0.9rem;
		border-bottom: 1px solid var(--rule);
		color: var(--quiet);
		font-size: 0.875rem;
		font-weight: 520;
	}

	.title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.code {
		font-size: 1rem;
		letter-spacing: 0.06em;
	}

	.question {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-top: 1.25rem;
	}

	h1 {
		padding: 0 0.25rem;
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.018em;
	}

	/* The tiles take the rest of the screen: one column of big ones for a few
	   answers, two columns from four, each at least a thumb's height. */
	.tiles {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr;
		grid-auto-rows: minmax(5.5rem, 1fr);
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tiles.pairs {
		grid-template-columns: 1fr 1fr;
	}

	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		height: 100%;
		padding: 0.8rem 0.95rem 0.9rem;
		border: 0;
		border-radius: 3px;
		background: var(--tile);
		color: var(--tile-ink);
		text-align: left;
		-webkit-tap-highlight-color: transparent;
		transition:
			transform 120ms var(--ease-out),
			opacity 240ms,
			filter 240ms;
	}

	.tile:active:not(:disabled),
	.tile.sending {
		transform: scale(0.975);
	}

	.tile:focus-visible {
		outline: 3px solid var(--room-text);
		outline-offset: 2px;
	}

	.tile.passed {
		opacity: 0.36;
		filter: saturate(0.4);
	}

	.mark {
		font-size: clamp(2.5rem, 13vw, 3.75rem);
		font-weight: 800;
		line-height: 0.9;
	}

	.label {
		max-width: 100%;
		font-size: 1rem;
		font-weight: 600;
		line-height: 1.2;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Stamped on the tile, and left a little off true, the way a stamp lands. */
	.stamp {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		padding: 0.3rem 0.5rem 0.25rem;
		border: 2.5px solid currentColor;
		border-radius: 2px;
		font-size: 1.125rem;
		font-weight: 860;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		transform: rotate(-2.5deg);
		animation: stamp 380ms var(--ease-out);
	}

	@keyframes stamp {
		from {
			transform: scale(1.5) rotate(-9deg);
			opacity: 0;
		}
	}

	.after,
	.link {
		padding: 0 0.25rem;
		color: var(--quiet);
		font-size: 0.9375rem;
	}

	.link {
		margin-top: auto;
		padding-top: 1.5rem;
	}

	/* Between questions the page is empty, and says only that it is waiting. */
	.waiting {
		flex: 1;
		display: grid;
		align-content: center;
		justify-items: center;
		gap: 0.5rem;
		padding: 2rem 1rem;
		color: var(--quiet);
		text-align: center;
	}

	.waiting p:first-child {
		color: var(--text);
		font-size: 1.125rem;
		font-weight: 600;
	}

	.empty {
		display: grid;
		gap: 0.75rem;
		align-content: start;
		padding: 2rem 0.25rem 0;
		color: var(--quiet);
	}

	.empty h1 {
		padding: 0;
		color: var(--text);
	}

	.quiet {
		color: var(--quiet);
	}

	.note {
		color: var(--text);
	}

	.again {
		justify-self: start;
		margin-top: 0.75rem;
		color: var(--text);
		font-weight: 600;
	}
</style>
