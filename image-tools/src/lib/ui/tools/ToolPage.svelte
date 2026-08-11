<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SITE_URL } from '$lib/site';
	import { TOOLS, toolPath, type ImageTool } from '$lib/tools/registry';
	import { parsePairSlug } from '$lib/engine';
	import TrustLine from '../TrustLine.svelte';

	let { tool, children }: { tool: ImageTool; children: Snippet } = $props();

	// same category first, the rest after, current tool out
	const otherTools = $derived(
		[...TOOLS.filter((t) => t.category === tool.category), ...TOOLS.filter((t) => t.category !== tool.category)].filter(
			(t) => t.slug !== tool.slug
		)
	);
	const conversions = [
		'heic-to-jpg',
		'png-to-jpg',
		'jpg-to-png',
		'webp-to-png',
		'png-to-webp',
		'avif-to-jpg'
	].map((slug) => parsePairSlug(slug)!);
</script>

<svelte:head>
	<title>{tool.title}</title>
	<meta name="description" content={tool.description} />
	<link rel="canonical" href="{SITE_URL}{toolPath(tool)}" />
	<meta property="og:title" content={tool.title} />
	<meta property="og:description" content={tool.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}{toolPath(tool)}" />
</svelte:head>

<section class="hero">
	<h1>{tool.h1}</h1>
	<p class="lede">{tool.lede}</p>
	<TrustLine />
</section>

{@render children()}

<section aria-labelledby="howto-heading">
	<h2 id="howto-heading">How to {tool.h1.toLowerCase()}</h2>
	<ol class="steps">
		{#each tool.steps as step (step)}
			<li>{step}</li>
		{/each}
	</ol>
</section>

<section aria-labelledby="about-heading">
	<h2 id="about-heading">{tool.aboutHeading}</h2>
	{#each tool.about as paragraph (paragraph)}
		<p>{paragraph}</p>
	{/each}
	<p>
		Like everything on this site, this tool runs in your browser. Your image is never uploaded.
	</p>
</section>

<section aria-labelledby="more-heading">
	<h2 id="more-heading">More tools</h2>
	<ul class="pair-links">
		{#each otherTools as t (t.slug)}
			<li><a href={toolPath(t)}>{t.h1}</a></li>
		{/each}
	</ul>
	<p class="all-tools"><a href="/tools">All image tools</a></p>
	<ul class="pair-links">
		{#each conversions as p (p.slug)}
			<li><a href="/{p.slug}">{p.sourceName} to {p.targetName}</a></li>
		{/each}
	</ul>
</section>

<style>
	.all-tools {
		margin: 0.75rem 0 1rem;
		font-size: 0.875rem;
	}
</style>
