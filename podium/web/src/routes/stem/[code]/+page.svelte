<!--
	The ballot, behind the QR code: the question on screen and its answers,
	big enough for a thumb in the dark, and one tap to vote. It follows the
	presentation, so the next question comes by itself.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { api, ApiError, message } from '$lib/api';
	import { follow, type Link } from '$lib/live';
	import type { Ballot } from '$lib/types';

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

	onMount(() =>
		follow(
			code,
			{
				// Whatever changes on screen, the ballot asks again: the
				// question, and whether this phone has answered it.
				state: (s) => (s.ended ? (gone = true) : load()),
				link: (l) => {
					link = l;
					if (l === 'missing') missing = true;
				}
			},
			true
		)
	);

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
	<meta name="theme-color" content="#0d1014" />
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
		<section class="empty" aria-busy="true">
			<p class="quiet">{link === 'lost' ? 'Får ikke kontakt. Prøver igjen …' : 'Henter spørsmålet …'}</p>
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
				<ul class="options" role="list">
					{#each q.options as o, i (o.id)}
						{@const chosen = ballot.voted === o.id}
						<li>
							<button
								class="option"
								class:chosen
								class:sending={sending === o.id}
								disabled={!!ballot.voted || (sending !== null && sending !== o.id)}
								aria-pressed={chosen}
								onclick={() => vote(o.id)}
							>
								<span class="label">{o.label || `Svar ${i + 1}`}</span>
								{#if chosen}
									<span class="stamp figure">Stemt</span>
								{/if}
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
						Én stemme per telefon.
					{/if}
				</p>
			</section>
		{:else if ballot.live}
			<section class="empty">
				<h1>Ingen spørsmål akkurat nå.</h1>
				<p>Følg med på skjermen. Neste spørsmål dukker opp her av seg selv.</p>
				{#if note}<p class="note">{note}</p>{/if}
			</section>
		{:else if started}
			<section class="empty">
				<h1>Presentasjonen er over.</h1>
				<p>Takk for at du stemte.</p>
			</section>
		{:else}
			<section class="empty">
				<h1>Presentasjonen har ikke startet ennå.</h1>
				<p>La siden stå åpen. Spørsmålene dukker opp her når den er i gang.</p>
				{#if note}<p class="note">{note}</p>{/if}
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
		padding: max(1rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right))
			max(1.5rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
		font-size: 1rem;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding-bottom: 0.9rem;
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
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
		padding-top: 2rem;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.12;
		letter-spacing: -0.018em;
	}

	.options {
		margin: 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--rule);
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		min-height: 4rem;
		padding: 0.85rem 1rem;
		border: 0;
		border-bottom: 1px solid var(--rule);
		background: transparent;
		color: var(--text);
		font-size: 1.1875rem;
		font-weight: 600;
		line-height: 1.2;
		text-align: left;
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color 160ms,
			color 160ms,
			opacity 220ms;
	}

	.option:active:not(:disabled),
	.option.sending {
		background: var(--raised);
	}

	.option:disabled:not(.chosen) {
		opacity: 0.5;
	}

	.option.chosen {
		background: var(--room-text);
		color: var(--room);
		opacity: 1;
		animation: land 420ms var(--ease-out);
	}

	@keyframes land {
		from {
			background: var(--amber);
		}
	}

	.label {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	/* Stamped, and left a little off true, the way a stamp lands. */
	.stamp {
		flex: none;
		padding: 0.3rem 0.55rem 0.25rem;
		border: 2.5px solid currentColor;
		border-radius: 2px;
		font-size: 1.25rem;
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
		color: var(--quiet);
		font-size: 0.9375rem;
	}

	.link {
		margin-top: auto;
		padding-top: 1.5rem;
	}

	.empty {
		display: grid;
		gap: 0.75rem;
		align-content: start;
		padding-top: 2rem;
		color: var(--quiet);
	}

	.empty h1 {
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
