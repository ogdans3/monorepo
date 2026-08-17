<script lang="ts">
	import type { BodyKind } from '$lib/anatomy/proportions';
	import { VIEWS, regionById, type View } from '$lib/anatomy/regions';
	import { detailFor } from '$lib/anatomy/detail';
	import { ONSETS, QUALITIES, TIMINGS, emptyEntry, type PainEntry } from '$lib/pain/scale';
	import { flagsFor, sortByUrgency, URGENCY_LABEL } from '$lib/pain/redflags';
	import BodyMap from '$lib/ui/BodyMap.svelte';
	import DetailMap from '$lib/ui/DetailMap.svelte';
	import PainScale from '$lib/ui/PainScale.svelte';
	import ChoiceGroup from '$lib/ui/ChoiceGroup.svelte';
	import Profile from '$lib/ui/Profile.svelte';

	/**
	 * One linear interview, held in a single state machine rather than in
	 * routes. Everything is on the device and nothing is submitted anywhere, so
	 * there is no server round trip to hang a URL off, and a back button that
	 * loses your answers would be worse than no back button.
	 */
	type Step = 'start' | 'pick' | 'detail' | 'flags' | 'profile';

	let step = $state<Step>('start');
	let body = $state<BodyKind>('male');
	let view = $state<View>('front');
	let picked = $state<string[]>([]);
	let entries = $state<PainEntry[]>([]);
	let at = $state(0);
	let flagAnswers = $state<string[]>([]);

	const current = $derived(entries[at]);
	const currentRegion = $derived(current ? regionById(current.regionId) : undefined);
	const currentDetail = $derived(currentRegion ? detailFor(currentRegion.detail) : undefined);
	const flags = $derived(
		sortByUrgency(flagsFor(entries.map((e) => regionById(e.regionId)?.detail ?? '')))
	);

	function begin() {
		entries = picked.map((id) => emptyEntry(id));
		at = 0;
		step = 'detail';
	}

	function next() {
		if (at < entries.length - 1) {
			at += 1;
			// a new region starts at the top of its own page
			scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			step = 'flags';
		}
	}

	function back() {
		if (at > 0) at -= 1;
		else step = 'pick';
	}

	function restart() {
		picked = [];
		entries = [];
		flagAnswers = [];
		at = 0;
		// The view has to go back too. Leaving it on whichever side was last
		// looked at meant starting again put you on the back of the body with no
		// explanation for why.
		view = 'front';
		step = 'start';
	}
</script>

<svelte:head>
	<title>Pain map: work out what is hurting</title>
	<meta
		name="description"
		content="Map your pain on five views of the body, narrow it down on a muscle diagram, and see which patterns it matches. Runs on your device. Not medical advice."
	/>
</svelte:head>

<main>
	{#if step === 'start'}
		<h1>Work out what is hurting</h1>
		<p class="lede">
			You mark roughly where it hurts, then narrow it down on a diagram of the muscles under
			that spot, then rate it. At the end you get a picture of the pain and the patterns it
			matches.
		</p>
		<p class="note">
			This is not a diagnosis and it is not advice from anyone qualified to give it. It is a
			structured way of describing a pain, and a list of what commonly presents that way. It
			runs entirely on your device and nothing you enter is sent anywhere.
		</p>
		<div class="actions">
			<button class="btn" onclick={() => (step = 'pick')}>Start</button>
		</div>
	{/if}

	{#if step === 'pick'}
		<h1>Where does it hurt?</h1>
		<p class="lede">
			Mark the rough areas, as many as apply. You will say exactly where in a moment, one area
			at a time.
		</p>

		<div class="controls">
			<div class="group" role="group" aria-label="Body">
				{#each [{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }] as opt (opt.id)}
					<button
						class="chip"
						aria-pressed={body === opt.id}
						onclick={() => (body = opt.id as BodyKind)}>{opt.label}</button
					>
				{/each}
			</div>
			<div class="group" role="group" aria-label="View">
				{#each VIEWS as v (v.id)}
					<button class="chip" aria-pressed={view === v.id} onclick={() => (view = v.id)}>
						{v.label}
					</button>
				{/each}
			</div>
			<p class="hint">{VIEWS.find((v) => v.id === view)?.hint}</p>
		</div>

		<div class="stage plate">
			<BodyMap {body} {view} bind:selected={picked} />
		</div>

		{#if picked.length}
			<ul class="chosen" aria-label="Areas you marked">
				{#each picked as id (id)}
					<li>
						<span>{regionById(id)?.label}</span>
						<button
							class="drop"
							aria-label="Remove {regionById(id)?.label}"
							onclick={() => (picked = picked.filter((p) => p !== id))}>×</button
						>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="actions">
			<button class="btn" disabled={picked.length === 0} onclick={begin}>
				{picked.length === 0
					? 'Mark at least one area'
					: `Narrow down ${picked.length} ${picked.length === 1 ? 'area' : 'areas'}`}
			</button>
		</div>
	{/if}

	{#if step === 'detail' && current && currentRegion}
		<p class="progress mono">Area {at + 1} of {entries.length}</p>
		<h1>{currentRegion.label}</h1>

		{#if currentDetail}
			<p class="lede">{currentDetail.intro}</p>
			<p class="hint">
				What sits above and below is drawn faintly, because pain moves: a hip is felt in the
				groin and the knee, and a lower back is felt in the buttock. Mark anything that is
				sore, not only the worst spot.
			</p>
			<DetailMap view={currentDetail} bind:selected={current.structureIds} />
		{:else}
			<p class="lede">
				The close-up diagram for this area is not drawn yet, so mark it here and it will still
				appear in your profile with everything else.
			</p>
			<p class="note">
				Six areas have detailed diagrams so far: hip and groin, lower back, shoulder, knee,
				neck and the underside of the foot. Buttock, hamstring, upper back, thigh, calf and
				foot share the diagram of a neighbour, which is anatomically right rather than a
				shortcut.
			</p>
		{/if}

		<hr />

		<PainScale bind:level={current.level} />

		<div class="qs">
			<ChoiceGroup
				legend="What does it feel like?"
				hint="Pick as many as fit. These matter more than the number for telling patterns apart."
				options={QUALITIES}
				bind:selected={current.qualities}
			/>
			<ChoiceGroup
				legend="When is it worst?"
				hint="Pick as many as fit."
				options={TIMINGS}
				bind:selected={current.timings}
			/>
			<ChoiceGroup
				legend="How did it start?"
				hint="One answer."
				options={ONSETS}
				single
				selected={current.onset ? [current.onset] : []}
				onchange={(next) => (current.onset = (next[0] as PainEntry['onset']) ?? null)}
			/>
		</div>

		<div class="actions">
			<button class="btn-ghost" onclick={back}>Back</button>
			<button class="btn" onclick={next}>
				{at < entries.length - 1 ? 'Next area' : 'A few safety questions'}
			</button>
		</div>
	{/if}

	{#if step === 'flags'}
		<h1>A few questions before the result</h1>
		<p class="lede">
			These are the things that change what you should do today rather than in a few weeks. Most
			people answer no to all of them. They are asked separately because they are not part of
			the ranking, and they override it.
		</p>

		<ul class="flags" aria-label="Safety questions">
			{#each flags as flag (flag.id)}
				<li>
					<button
						class="flag"
						aria-pressed={flagAnswers.includes(flag.id)}
						onclick={() =>
							(flagAnswers = flagAnswers.includes(flag.id)
								? flagAnswers.filter((f) => f !== flag.id)
								: [...flagAnswers, flag.id])}
					>
						<span class="flag-q">{flag.question}</span>
						<span class="flag-why">{flag.why}</span>
						<span class="flag-state mono">{flagAnswers.includes(flag.id) ? 'Yes' : 'No'}</span>
					</button>
				</li>
			{/each}
		</ul>

		<div class="actions">
			<button class="btn-ghost" onclick={() => (step = 'detail')}>Back</button>
			<button class="btn" onclick={() => (step = 'profile')}>See the profile</button>
		</div>
	{/if}

	{#if step === 'profile'}
		<Profile {entries} {flagAnswers} onrestart={restart} />
	{/if}
</main>

<style>
	main {
		max-width: 44rem;
		margin: 0 auto;
		padding: 3.5rem 1.25rem 6rem;
	}

	.note {
		font-size: 0.875rem;
		color: var(--muted);
		background: var(--surface);
		border-radius: var(--r-m);
		padding: 0.9rem 1rem;
		max-width: 62ch;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin: 1.75rem 0 1rem;
	}

	.group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.hint {
		font-size: 0.875rem;
		color: var(--muted);
		margin: 0;
		max-width: 62ch;
	}

	.stage {
		padding: 1.25rem;
		max-width: 23rem;
		margin: 0 auto;
	}

	.chosen {
		list-style: none;
		padding: 0;
		margin: 1.25rem 0 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chosen li {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		background: var(--surface);
		border-radius: 99px;
		padding: 0.3rem 0.4rem 0.3rem 0.75rem;
		font-size: 0.875rem;
	}

	.drop {
		border: 0;
		background: none;
		cursor: pointer;
		font-size: 1.1rem;
		line-height: 1;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 99px;
		color: var(--muted);
	}

	.drop:hover {
		background: var(--surface-deep);
		color: var(--ink);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 2.25rem;
	}

	.progress {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0 0 0.4rem;
	}

	hr {
		border: 0;
		border-top: 1px solid var(--line);
		margin: 2.5rem 0;
	}

	.qs {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		margin-top: 2.5rem;
	}

	.flags {
		list-style: none;
		padding: 0;
		margin: 1.75rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.flag {
		width: 100%;
		text-align: left;
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		padding: 0.9rem 1rem;
		cursor: pointer;
		font: inherit;
		display: grid;
		gap: 0.2rem;
	}

	.flag:hover {
		border-color: var(--muted);
	}

	.flag[aria-pressed='true'] {
		border-color: var(--danger);
		background: var(--danger-wash);
	}

	.flag-q {
		font-weight: 600;
	}

	.flag-why {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.flag-state {
		font-size: 0.75rem;
		color: var(--muted);
		justify-self: end;
	}

	.flag[aria-pressed='true'] .flag-state {
		color: var(--danger);
		font-weight: 700;
	}
</style>
