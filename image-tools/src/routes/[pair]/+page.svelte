<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import ConvertPanel from '$lib/ui/ConvertPanel.svelte';

	let { data } = $props();
	const page = $derived(data.page);
	const notes = $derived(
		[data.page.source.sourceNote, data.page.target.targetNote].filter(
			(n): n is string => typeof n === 'string'
		)
	);
</script>

<svelte:head>
	<title>Convert {page.sourceName} to {page.targetName} — free, private, in your browser</title>
	<meta
		name="description"
		content="Convert {page.sourceName} images to {page.targetName} for free, right in your browser. No uploads — files never leave your device. Batch conversion with zip download."
	/>
	<link rel="canonical" href="{SITE_URL}/{page.canonicalSlug}" />
</svelte:head>

<section class="hero">
	<h1>
		Convert {page.sourceName}<span class="arrow" aria-hidden="true"> → </span><span
			class="visually-hidden"
		> to </span>{page.targetName}
	</h1>
	<p class="lede">
		Drop your {page.sourceName} files below — they convert to {page.targetName} on your own device,
		and the filenames stay put.
	</p>
</section>

{#key page.slug}
	<ConvertPanel
		target={page.target}
		targetExt={page.targetExt}
		sourceName={page.sourceName}
		zipName="{page.slug}.zip"
	/>
{/key}

{#if notes.length}
	<ul class="notes">
		{#each notes as note (note)}
			<li>{note}</li>
		{/each}
	</ul>
{/if}

<section aria-labelledby="about-heading">
	<h2 id="about-heading">{page.sourceName} and {page.targetName}</h2>
	<p><strong>{page.source.name}</strong> — {page.source.blurb}</p>
	<p><strong>{page.target.name}</strong> — {page.target.blurb}</p>
	<p>
		The conversion happens entirely in your browser: each file is decoded to raw pixels and
		re-encoded as {page.targetName}. Nothing is uploaded — the server only serves this page.
	</p>
</section>

<section aria-labelledby="related-heading">
	<h2 id="related-heading">Related conversions</h2>
	<ul class="pair-links">
		{#each data.related as p (p.slug)}
			<li>
				<a class="mono" href="/{p.slug}"
					>{p.source.name} <span class="arrow" aria-hidden="true">→</span><span
						class="visually-hidden">to</span
					> {p.target.name}</a
				>
			</li>
		{/each}
	</ul>
</section>
