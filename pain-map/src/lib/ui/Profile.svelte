<script lang="ts">
	import { regionById } from '$lib/anatomy/regions';
	import { structureById } from '$lib/anatomy/detail';
	import { confidence, matchEntry, scoreText, type Match } from '$lib/pain/conditions';
	import { RED_FLAGS, URGENCY_LABEL, severeEntries } from '$lib/pain/redflags';
	import { stopFor, type PainEntry } from '$lib/pain/scale';

	let {
		entries,
		flagAnswers,
		onrestart
	}: { entries: PainEntry[]; flagAnswers: string[]; onrestart: () => void } = $props();

	const raised = $derived(RED_FLAGS.filter((f) => flagAnswers.includes(f.id)));
	const severe = $derived(severeEntries(entries));

	/** Per region, the ranked matches. Three is enough to be useful. */
	const results = $derived(
		entries.map((entry) => ({
			entry,
			region: regionById(entry.regionId),
			matches: matchEntry(entry).slice(0, 3),
			confidence: confidence(matchEntry(entry), entry)
		}))
	);

	const CONFIDENCE_TEXT = {
		narrow: 'One pattern fits noticeably better than the others.',
		broad: 'Several patterns fit about as well, which usually means the answers could be more specific.',
		thin: 'Too little to go on. Marking a structure on the diagram and saying how it started would change this a lot.'
	} as const;

	function summary(entry: PainEntry): string {
		const stop = stopFor(entry.level);
		const names = entry.structureIds
			.map((id) => structureById(id)?.name)
			.filter(Boolean)
			.join(', ');
		return names ? `${names}. ${stop.level} of 10, ${stop.label.toLowerCase()}.` : `${stop.level} of 10.`;
	}
</script>

<!--
	Red flags come first and are not dismissible. A raised flag is not a
	better-scoring result, it is a different kind of statement, and putting it
	below the ranking is how someone reads about a tendon instead of going in.
-->
{#if raised.length}
	<section class="flags" aria-label="Things to act on">
		<h2>Deal with this first</h2>
		<p>
			You answered yes to something that changes what you should do now. This sits above
			everything else on this page because it does not compete with it.
		</p>
		{#each raised as flag (flag.id)}
			<article class="flag">
				<p class="when mono">{URGENCY_LABEL[flag.urgency]}</p>
				<p class="q">{flag.question}</p>
				<p class="do">{flag.action}</p>
			</article>
		{/each}
	</section>
{/if}

<h1>Your pain profile</h1>
<p class="lede">
	{entries.length}
	{entries.length === 1 ? 'area' : 'areas'}, and what each one matches. The numbers are counts of
	features, not probabilities.
</p>

{#if severe.length && !raised.length}
	<p class="severe">
		You rated something at {severe[0].level} out of 10. That is worth seeing someone about
		regardless of what matches below.
	</p>
{/if}

{#each results as result (result.entry.regionId)}
	<section class="area">
		<header>
			<h2>{result.region?.label}</h2>
			<p class="what mono">{summary(result.entry)}</p>
		</header>

		{#if result.matches.length === 0}
			<p class="muted">
				Nothing matched closely enough to name. That is a real answer rather than a failure:
				it usually means the pain is not following one of the common patterns, or that the
				answers were too general to separate them.
			</p>
		{:else}
			<p class="conf">{CONFIDENCE_TEXT[result.confidence]}</p>
			<ol class="matches">
				{#each result.matches as match (match.condition.id)}
					<li class="match">
						<div class="head">
							<h3>{match.condition.name}</h3>
							<span class="score mono">{scoreText(match)}</span>
						</div>
						<p class="plain">{match.condition.plain}</p>
						<p class="what-is">{match.condition.what}</p>

						<!-- Both lists, always. A count nobody can check is a count
						     nobody should trust, and the misses are often the more
						     useful half. -->
						<div class="features">
							<ul class="hit" aria-label="What matched">
								{#each match.matched as f (f.text)}
									<li>{f.text}</li>
								{/each}
							</ul>
							{#if match.missed.length}
								<ul class="miss" aria-label="What did not match">
									{#each match.missed as f (f.text)}
										<li>{f.text}</li>
									{/each}
								</ul>
							{/if}
						</div>

						<p class="next"><strong>Usually:</strong> {match.condition.next}</p>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
{/each}

<section class="limits" aria-labelledby="limits-heading">
	<h2 id="limits-heading">What this is not</h2>
	<p>
		This is not a diagnosis, and nobody qualified to give one has looked at it. It is a list of
		patterns that commonly present the way you described, ranked by how many of their features
		your answers matched.
	</p>
	<p>
		The count is honest about what it is. It is not a probability, because there is no way to
		calculate one from a pain map without research this tool does not have behind it. A
		condition matching six of six features does not mean it is what you have. It means your
		description looks like the textbook description, which is a much weaker claim.
	</p>
	<p>
		Pain that is getting worse, not improving over weeks, or stopping you doing things is worth
		a real appointment whatever this page says. Take the summary above with you if it helps.
	</p>
</section>

<div class="actions">
	<button class="btn" onclick={() => window.print()}>Print or save as PDF</button>
	<button class="btn-ghost" onclick={onrestart}>Start again</button>
</div>

<style>
	.flags {
		border: 1px solid var(--danger);
		border-radius: var(--r-l);
		padding: 1.25rem 1.4rem;
		margin-bottom: 2.5rem;
		background: var(--danger-wash);
	}

	.flags h2 {
		color: var(--danger);
	}

	.flag {
		border-top: 1px solid oklch(0.48 0.19 25 / 0.25);
		padding-top: 0.9rem;
		margin-top: 0.9rem;
	}

	.when {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--danger);
		margin: 0 0 0.3rem;
		font-weight: 700;
	}

	.q {
		margin: 0 0 0.35rem;
		font-weight: 600;
	}

	.do {
		margin: 0;
	}

	.severe {
		border-left: 1px solid var(--line);
		padding-left: 0.9rem;
		color: var(--muted);
	}

	.area {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: 1px solid var(--line);
	}

	.area header h2 {
		margin-bottom: 0.2rem;
	}

	.what {
		font-size: 0.8125rem;
		color: var(--muted);
		margin: 0 0 1.25rem;
	}

	.conf {
		font-size: 0.9375rem;
		color: var(--muted);
		margin: 0 0 1.25rem;
	}

	.matches {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.match {
		background: var(--plate);
		border: 1px solid var(--line);
		border-radius: var(--r-l);
		padding: 1.1rem 1.25rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.head h3 {
		margin: 0;
	}

	.score {
		font-size: 0.8125rem;
		color: var(--muted);
		white-space: nowrap;
	}

	.plain {
		margin: 0.15rem 0 0.7rem;
		color: var(--muted);
		font-size: 0.9375rem;
	}

	.what-is {
		margin: 0 0 0.9rem;
		font-size: 0.9375rem;
	}

	.features {
		display: grid;
		gap: 0.4rem;
		margin-bottom: 0.9rem;
	}

	.features ul {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: 0.875rem;
	}

	.hit li::before {
		content: '✓';
		color: var(--primary-deep);
		font-family: var(--font-mono);
		margin-right: 0.5rem;
	}

	.miss li {
		color: var(--muted);
	}

	.miss li::before {
		content: '–';
		font-family: var(--font-mono);
		margin-right: 0.5rem;
	}

	.next {
		margin: 0;
		font-size: 0.9375rem;
	}

	.limits {
		margin-top: 3.5rem;
		padding-top: 2rem;
		border-top: 1px solid var(--line);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin-top: 2.5rem;
	}

	@media print {
		.actions {
			display: none;
		}
	}
</style>
