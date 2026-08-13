<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SITE_URL, convertPath } from '$lib/site';
	import { nextTools, PDF_CATEGORY, TOOLS, toolPath, type ImageTool } from '$lib/tools/registry';
	import { parsePairSlug } from '$lib/engine';
	import TrustLine from '../TrustLine.svelte';
	import Breadcrumbs from '../Breadcrumbs.svelte';
	import Faq from '../Faq.svelte';
	import { pageFaq } from '$lib/faq';

	let { tool, children }: { tool: ImageTool; children: Snippet } = $props();

	const isPdf = $derived(tool.category === PDF_CATEGORY);
	/** Hand-picked next steps, then the rest of the same category to fill out. */
	const nextUp = $derived(nextTools(tool));
	const sameCategory = $derived(
		TOOLS.filter(
			(t) =>
				t.category === tool.category &&
				t.slug !== tool.slug &&
				!nextUp.some((n) => n.slug === t.slug)
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

<Breadcrumbs
	crumbs={[
		{ label: 'Home', href: '/' },
		isPdf ? { label: 'PDF tools', href: '/pdf' } : { label: 'Image tools', href: '/tools' }
	]}
	current={tool.h1}
/>

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

<Faq items={pageFaq(`${tool.name.toLowerCase()} tool`, tool.faq)} />

{#if nextUp.length}
	<section aria-labelledby="next-heading">
		<h2 id="next-heading">What people usually do next</h2>
		<ul class="tool-list">
			{#each nextUp as t (t.slug)}
				<li>
					<a href={toolPath(t)}>{t.h1}</a>
					<span class="tool-blurb">{t.blurb}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section aria-labelledby="more-heading">
	<h2 id="more-heading">More tools</h2>
	{#if sameCategory.length}
		<ul class="pair-links">
			{#each sameCategory as t (t.slug)}
				<li><a href={toolPath(t)}>{t.h1}</a></li>
			{/each}
		</ul>
	{/if}
	<p class="all-tools">
		{#if isPdf}
			<a href="/pdf">All PDF tools</a> · <a href="/tools">image tools</a>
		{:else}
			<a href="/tools">All image tools</a> · <a href="/pdf">PDF tools</a>
		{/if}
	</p>
	<ul class="pair-links">
		{#each conversions as p (p.slug)}
			<li><a href={convertPath(p.slug)}>{p.sourceName} to {p.targetName}</a></li>
		{/each}
	</ul>
</section>

<style>
	.all-tools {
		margin: 0.75rem 0 1rem;
		font-size: 0.875rem;
	}
</style>
