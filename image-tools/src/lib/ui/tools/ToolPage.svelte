<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SITE_URL } from '$lib/site';
	import { TOOLS, type ImageTool } from '$lib/tools/registry';
	import { parsePairSlug } from '$lib/engine';

	let { tool, children }: { tool: ImageTool; children: Snippet } = $props();

	const otherTools = $derived(TOOLS.filter((t) => t.slug !== tool.slug));
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
	<link rel="canonical" href="{SITE_URL}/{tool.slug}" />
	<meta property="og:title" content={tool.title} />
	<meta property="og:description" content={tool.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/{tool.slug}" />
</svelte:head>

<section class="hero">
	<h1>{tool.h1}</h1>
	<p class="lede">{tool.lede}</p>
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
		Like everything on this site, the tool runs entirely in your browser. Your image is never
		uploaded, and the server only serves this page.
	</p>
</section>

<section aria-labelledby="more-heading">
	<h2 id="more-heading">More tools</h2>
	<ul class="pair-links">
		{#each otherTools as t (t.slug)}
			<li><a href="/{t.slug}">{t.h1}</a></li>
		{/each}
		{#each conversions as p (p.slug)}
			<li>
				<a class="mono" href="/{p.slug}"
					>{p.sourceName} <span class="arrow" aria-hidden="true">→</span><span
						class="visually-hidden">to</span
					> {p.targetName}</a
				>
			</li>
		{/each}
	</ul>
</section>
