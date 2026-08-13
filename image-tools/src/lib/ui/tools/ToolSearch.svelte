<script lang="ts">
	import {
		CATEGORIES,
		toolMatches,
		toolPath,
		type ImageTool,
		type ToolCategory
	} from '$lib/tools/registry';

	let {
		tools,
		categories,
		placeholder = 'Search tools'
	}: {
		tools: ImageTool[];
		categories: { id: ToolCategory; label: string; blurb: string }[];
		placeholder?: string;
	} = $props();

	let query = $state('');

	const matches = $derived(tools.filter((t) => toolMatches(t, query)));
	const searching = $derived(query.trim().length > 0);
	const groups = $derived(
		categories
			.map((c) => ({ ...c, tools: matches.filter((t) => t.category === c.id) }))
			.filter((g) => g.tools.length > 0)
	);
</script>

<div class="search">
	<label class="visually-hidden" for="tool-search">{placeholder}</label>
	<input
		id="tool-search"
		type="search"
		{placeholder}
		bind:value={query}
		autocomplete="off"
		spellcheck="false"
	/>
	{#if searching}
		<span class="count mono" role="status" aria-live="polite">
			{matches.length}
			{matches.length === 1 ? 'tool' : 'tools'}
		</span>
	{/if}
</div>

{#if searching && matches.length === 0}
	<p class="none" role="status">
		Nothing matches that. Try a plainer word, like blur, resize, pdf or transparent.
	</p>
{:else if searching}
	<!-- while searching, one flat list reads faster than headings -->
	<ul class="tool-list flat">
		{#each matches as tool (tool.slug)}
			<li>
				<a href={toolPath(tool)}>{tool.h1}</a>
				<span class="tool-blurb">{tool.blurb}</span>
			</li>
		{/each}
	</ul>
{:else}
	{#each groups as group (group.id)}
		<section aria-labelledby="cat-{group.id}">
			<h2 id="cat-{group.id}">{group.label}</h2>
			<p class="category-blurb">{group.blurb}</p>
			<ul class="tool-list">
				{#each group.tools as tool (tool.slug)}
					<li>
						<a href={toolPath(tool)}>{tool.h1}</a>
						<span class="tool-blurb">{tool.blurb}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
{/if}

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0 0 2rem;
	}

	.search input {
		flex: 1;
		max-width: 22rem;
		padding: 0.55rem 0.8rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
		font-size: 0.9375rem;
		color: var(--ink);
	}

	.search input::placeholder {
		color: var(--muted);
	}

	.count {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.none {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--muted);
	}

	.category-blurb {
		margin: -0.35rem 0 0.6rem;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.tool-list.flat {
		gap: 0.6rem;
	}
</style>
