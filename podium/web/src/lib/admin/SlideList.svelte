<!--
	The presentation in order: every slide as a miniature of itself, the one
	on screen marked, and the questions with their count. Slides are dragged
	into a new order, or moved with the buttons under the one selected.
-->
<script lang="ts">
	import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from '@lucide/svelte';
	import Stage from '$lib/stage/Stage.svelte';
	import { votes } from '$lib/format';
	import type { Editor } from './editor.svelte';

	let { ed }: { ed: Editor } = $props();

	let from = $state<number | null>(null);
	let over = $state<number | null>(null);

	function dragstart(e: DragEvent, i: number) {
		from = i;
		e.dataTransfer?.setData('text/plain', String(i));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function dragover(e: DragEvent, i: number) {
		if (from === null) return;
		e.preventDefault();
		over = i;
	}

	function drop(e: DragEvent, i: number) {
		if (from === null) return;
		e.preventDefault();
		const a = from;
		from = over = null;
		ed.moveSlide(a, i);
	}
</script>

<nav class="slides" aria-label="Sidene">
	<ol>
		{#each ed.slides as s, i (s.id)}
			{@const current = i === ed.current}
			<li
				class:current
				class:over={over === i && from !== i}
				class:lifted={from === i}
				draggable="true"
				ondragstart={(e) => dragstart(e, i)}
				ondragover={(e) => dragover(e, i)}
				ondragleave={() => over === i && (over = null)}
				ondrop={(e) => drop(e, i)}
				ondragend={() => (from = over = null)}
			>
				<button
					class="thumb"
					aria-current={current ? 'true' : undefined}
					aria-label="Side {i + 1}{s.options.length ? ', spørsmål' : ''}{s.id === ed.p.liveSlideId ? ', på skjermen nå' : ''}"
					onclick={() => ed.goTo(i)}
				>
					<span class="n tabular">{i + 1}</span>
					<span class="mini"><Stage slide={s} code={ed.p.code} mode="thumb" /></span>
				</button>
				{#if s.id === ed.p.liveSlideId || s.options.length}
					<div class="meta">
						{#if s.id === ed.p.liveSlideId}<span class="live">Direkte</span>{/if}
						{#if s.options.length}<span class="count tabular">{votes(s.total)}</span>{/if}
					</div>
				{/if}
				{#if current}
					<div class="tools">
						<button class="btn quiet icon small" aria-label="Flytt opp" title="Flytt opp" disabled={i === 0} onclick={() => ed.moveSlide(i, i - 1)}><ArrowUp size={15} strokeWidth={1.75} /></button>
						<button class="btn quiet icon small" aria-label="Flytt ned" title="Flytt ned" disabled={i === ed.slides.length - 1} onclick={() => ed.moveSlide(i, i + 1)}><ArrowDown size={15} strokeWidth={1.75} /></button>
						<button class="btn quiet icon small" aria-label="Dupliser siden" title="Dupliser" onclick={() => ed.duplicateSlide(s.id)}><Copy size={15} strokeWidth={1.75} /></button>
						<button class="btn quiet icon small" aria-label="Slett siden" title="Slett" disabled={ed.slides.length <= 1} onclick={() => ed.deleteSlide(s.id)}><Trash2 size={15} strokeWidth={1.75} /></button>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
	<div class="add">
		<button class="btn small" onclick={() => ed.addSlide('content')}><Plus size={15} strokeWidth={2} />Side</button>
		<button class="btn small" onclick={() => ed.addSlide('question')}><Plus size={15} strokeWidth={2} />Spørsmål</button>
	</div>
</nav>

<style>
	.slides {
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		min-height: 0;
		border-right: 1px solid var(--rule);
		background: var(--desk);
	}

	ol {
		margin: 0;
		padding: 0.9rem 0.75rem 1.2rem 0.5rem;
		list-style: none;
		overflow-y: auto;
		display: grid;
		align-content: start;
		gap: 0.9rem;
	}

	li {
		display: grid;
		gap: 0.3rem;
		border-radius: var(--radius);
	}

	li.lifted {
		opacity: 0.4;
	}

	li.over .mini {
		box-shadow: 0 -3px 0 0 var(--desk-text);
	}

	.thumb {
		display: grid;
		grid-template-columns: 1.4rem minmax(0, 1fr);
		align-items: start;
		gap: 0.25rem;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
	}

	.n {
		padding-top: 0.1rem;
		color: var(--quiet);
		font-size: 0.75rem;
		font-weight: 600;
		text-align: right;
		padding-right: 0.25rem;
	}

	.mini {
		display: block;
		border-radius: 2px;
		overflow: hidden;
		box-shadow: 0 0 0 1px var(--rule);
		transition: box-shadow 120ms;
	}

	.thumb:hover .mini {
		box-shadow: 0 0 0 1px var(--rule-strong);
	}

	.current .mini {
		box-shadow:
			0 0 0 2px var(--desk),
			0 0 0 3.5px var(--desk-text);
	}

	.current .n {
		color: var(--desk-text);
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding-left: 1.65rem;
		font-size: 0.75rem;
	}

	.live {
		padding: 0.05rem 0.4rem;
		border-radius: var(--radius);
		background: var(--amber);
		color: var(--amber-ink);
		font-weight: 700;
	}

	.count {
		color: var(--quiet);
		font-weight: 560;
	}

	.tools {
		display: flex;
		gap: 0.1rem;
		padding-left: 1.4rem;
	}

	.add {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
		padding: 0.75rem;
		border-top: 1px solid var(--rule);
	}
</style>
