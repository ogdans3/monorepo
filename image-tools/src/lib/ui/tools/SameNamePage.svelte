<script lang="ts">
	import { SITE_URL, convertPath } from '$lib/site';
	import { parsePairSlug } from '$lib/engine';
	import { toolPath, toolBySlug } from '$lib/tools/registry';
	import type { SameNamePage } from '$lib/tools/samename';
	import TrustLine from '../TrustLine.svelte';
	import Breadcrumbs from '../Breadcrumbs.svelte';
	import Faq from '../Faq.svelte';
	import { pageFaq } from '$lib/faq';
	import RenameJpegEditor from './RenameJpegEditor.svelte';

	let { page }: { page: SameNamePage } = $props();

	const related = ['png-to-jpg', 'heic-to-jpg', 'webp-to-jpg', 'jpg-to-png', 'jpg-to-webp'].map(
		(slug) => parsePairSlug(slug)!
	);
	const tools = ['compress-image', 'resize-image', 'crop-image'].map((slug) => toolBySlug(slug)!);
</script>

<svelte:head>
	<title>{page.title}</title>
	<meta name="description" content={page.description} />
	<link rel="canonical" href="{SITE_URL}{convertPath(page.slug)}" />
	<meta property="og:title" content={page.title} />
	<meta property="og:description" content={page.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}{convertPath(page.slug)}" />
</svelte:head>

<Breadcrumbs
	crumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Conversions', href: '/convert' }
	]}
	current="{page.from} to {page.to}"
/>

<section class="hero">
	<h1>{page.h1}</h1>
	<p class="lede">{page.lede}</p>
	<TrustLine />
</section>

<RenameJpegEditor targetExt={page.ext} />

<section aria-labelledby="howto-heading">
	<h2 id="howto-heading">How to convert {page.from} to {page.to}</h2>
	<ol class="steps">
		<li>Drop your {page.from} files in the box above. Add as many as you like.</li>
		<li>
			The bytes are checked. A real JPEG is passed straight through, and anything that turns out
			to be a different format is converted properly instead.
		</li>
		<li>
			Download each file, or take them all in one zip. Every file keeps its name, with
			<span class="mono">{page.ext}</span> on the end.
		</li>
	</ol>
</section>

<section aria-labelledby="about-heading">
	<h2 id="about-heading">Why {page.from} and {page.to} are the same thing</h2>
	{#each page.about as paragraph (paragraph)}
		<p>{paragraph}</p>
	{/each}
</section>

<Faq items={pageFaq(`${page.from} to ${page.to} converter`, page.faq)} />

<section aria-labelledby="related-heading">
	<h2 id="related-heading">Conversions that really do convert</h2>
	<ul class="pair-links">
		{#each related as pair (pair.slug)}
			<li><a href={convertPath(pair.slug)}>{pair.sourceName} to {pair.targetName}</a></li>
		{/each}
	</ul>
</section>

<section aria-labelledby="tools-heading">
	<h2 id="tools-heading">If the file itself is the problem</h2>
	<ul class="tool-list">
		{#each tools as tool (tool.slug)}
			<li>
				<a href={toolPath(tool)}>{tool.h1}</a>
				<span class="tool-blurb">{tool.blurb}</span>
			</li>
		{/each}
	</ul>
</section>
