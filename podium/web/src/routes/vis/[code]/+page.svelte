<!--
	The display: the slide on screen and nothing else, filling the screen at
	16:9. Every vote is heard and its count rolls up where the presenter put
	it. The presenter, signed in, steps through it here with the arrow keys or
	a clicker.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/state';
	import { Volume2, VolumeX } from '@lucide/svelte';
	import Stage from '$lib/stage/Stage.svelte';
	import { api } from '$lib/api';
	import { chime } from '$lib/chime';
	import { follow, type Link } from '$lib/live';
	import type { LiveState, VoteEvent } from '$lib/types';

	const code = $derived((page.params.code ?? '').toUpperCase());

	let live = $state<LiveState | null>(null);
	let link = $state<Link>('connecting');
	let moving = $state<Record<string, boolean>>({});
	let admin = $state(false);
	let audible = $state(chime.ready);
	let muted = $state(false);
	let idle = $state(false);
	let hints = $state(true);
	/** A slide has been on screen while this page was open: no slide now means it is over. */
	let started = $state(false);

	const settle = new Map<string, ReturnType<typeof setTimeout>>();
	let idleTimer: ReturnType<typeof setTimeout> | undefined;

	function onState(s: LiveState) {
		if (s.slide?.id !== live?.slide?.id) {
			settle.forEach(clearTimeout);
			settle.clear();
			moving = {};
		}
		live = s;
		if (s.slide) started = true;
		chime.use(s.sound);
	}

	function onVote(v: VoteEvent) {
		const slide = live?.slide;
		if (!slide || slide.id !== v.slideId) return;
		for (const o of slide.options) o.count = v.counts[o.id] ?? 0;
		slide.total = v.total;
		chime.vote();
		// The change colour holds while the votes keep coming, and lets go
		// once they have stopped for a moment.
		moving[v.optionId] = true;
		clearTimeout(settle.get(v.optionId));
		settle.set(
			v.optionId,
			setTimeout(() => (moving[v.optionId] = false), 1400)
		);
	}

	onMount(() => {
		const stop = follow(code, { state: onState, vote: onVote, link: (l) => (link = l) });
		api<{ admin: boolean }>('GET', '/api/admin/me')
			.then((r) => (admin = r.admin))
			.catch(() => {});
		const off = chime.onchange(() => (audible = chime.ready));
		const hide = setTimeout(() => (hints = false), 6000);
		wake();
		return () => {
			stop();
			off();
			clearTimeout(hide);
			clearTimeout(idleTimer);
			settle.forEach(clearTimeout);
		};
	});

	async function step(n: number) {
		if (!admin || !live) return;
		await api('PUT', `/api/admin/presentations/${live.id}/live`, { step: n }).catch(() => {});
	}

	function fullscreen() {
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		else document.documentElement.requestFullscreen().catch(() => {});
	}

	function key(e: KeyboardEvent) {
		chime.unlock();
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowDown':
			case 'PageDown':
			case ' ':
			case 'Enter':
				e.preventDefault();
				step(1);
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
			case 'PageUp':
			case 'Backspace':
				e.preventDefault();
				step(-1);
				break;
			case 'f':
			case 'F':
				fullscreen();
				break;
			case 'm':
			case 'M':
				muted = !muted;
				chime.muted = muted;
				break;
		}
	}

	// The pointer hides when it is not being used: it is nobody's business on
	// a projector.
	function wake() {
		idle = false;
		clearTimeout(idleTimer);
		idleTimer = setTimeout(() => (idle = true), 2500);
	}

	function dblclick(e: MouseEvent) {
		if (!(e.target instanceof HTMLVideoElement)) fullscreen();
	}
</script>

<svelte:head>
	<title>{live?.title ? `${live.title} · visning` : 'Visning · Podium'}</title>
</svelte:head>

<svelte:window onkeydown={key} onpointerdown={() => chime.unlock()} onpointermove={wake} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<main class="room screen" class:idle ondblclick={dblclick}>
	<div class="fit">
		{#if live?.ended}
			<div class="notice">
				<p class="big">Presentasjonen finnes ikke lenger.</p>
				<p>Den er slettet.</p>
			</div>
		{:else if link === 'missing'}
			<div class="notice">
				<p class="big">Fant ingen presentasjon med koden {code}.</p>
				<p>Sjekk adressen, eller åpne visningen på nytt fra presentasjonen.</p>
			</div>
		{:else if live?.slide}
			{#key live.slide.id}
				<div class="layer" transition:fade={{ duration: 180 }}>
					<Stage slide={live.slide} code={live.code} {moving} />
				</div>
			{/key}
		{:else if live}
			<div class="notice">
				<p class="big">{live.title}</p>
				<p>{started ? 'Presentasjonen er over. Takk!' : 'Venter på at presentasjonen starter.'}</p>
			</div>
		{/if}
	</div>

	<div class="corner">
		{#if link === 'lost'}
			<p class="status">Mistet forbindelsen. Kobler til igjen …</p>
		{/if}
		{#if live?.slide && !audible}
			<p class="status sound"><VolumeX size={16} strokeWidth={1.75} /> Trykk en tast eller klikk for lyd</p>
		{:else if muted}
			<p class="status sound"><VolumeX size={16} strokeWidth={1.75} /> Lyden er av · M</p>
		{/if}
		{#if hints && admin && live}
			<p class="status" transition:fade={{ duration: 400 }}>
				→ neste · ← forrige · F fullskjerm · M lyd
			</p>
		{/if}
	</div>
</main>

<style>
	.screen {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: oklch(0.1 0.008 250);
		overflow: hidden;
		user-select: none;
	}

	.screen.idle {
		cursor: none;
	}

	.fit {
		position: relative;
		width: min(100vw, calc(100dvh * 16 / 9));
		aspect-ratio: 16 / 9;
		container-type: size;
	}

	.layer {
		position: absolute;
		inset: 0;
	}

	.notice {
		position: absolute;
		inset: 0;
		display: grid;
		align-content: center;
		gap: 2.2cqh;
		padding: 0 8cqw;
		background: var(--room);
		color: var(--quiet);
		font-size: 2.8cqh;
	}

	.notice .big {
		color: var(--text);
		font-size: 7cqh;
		font-weight: 700;
		line-height: 1.08;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}

	/* What the tool has to say on the projector, as flat captions in the
	   corner, solid so they read over any slide. */
	.corner {
		position: fixed;
		right: 0;
		bottom: 0;
		display: grid;
		justify-items: end;
		pointer-events: none;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.4rem 0.8rem;
		background: var(--room);
		color: var(--quiet);
		font-size: 0.8125rem;
		font-weight: 520;
	}

	.status + .status {
		border-top: 1px solid var(--rule);
	}

	.status.sound {
		color: var(--text);
	}
</style>
