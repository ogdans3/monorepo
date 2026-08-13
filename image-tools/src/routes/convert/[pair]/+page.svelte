<script lang="ts">
	import { pairFacts, pairFaq } from '$lib/engine';
	import { SITE_URL, convertPath } from '$lib/site';
	import { TOOLS, toolPath } from '$lib/tools/registry';
	import ConvertPanel from '$lib/ui/ConvertPanel.svelte';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Breadcrumbs from '$lib/ui/Breadcrumbs.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';

	let { data } = $props();
	const page = $derived(data.page);
	// facts that belong to this conversion alone, so 93 pages are not one
	// template with two names swapped
	const facts = $derived(pairFacts(data.page));
	const notes = $derived(
		[data.page.source.sourceNote, data.page.target.targetNote].filter(
			(n): n is string => typeof n === 'string'
		)
	);
</script>

<svelte:head>
	<title>{page.sourceName} to {page.targetName} Converter - Free, Private, No Upload</title>
	<meta
		name="description"
		content="Convert {page.sourceName} to {page.targetName} online free. Files convert in your browser and are never uploaded. Batch convert, download as a zip, keep your filenames."
	/>
	<link rel="canonical" href="{SITE_URL}{convertPath(page.canonicalSlug)}" />
	<meta property="og:title" content="{page.sourceName} to {page.targetName} Converter" />
	<meta
		property="og:description"
		content="Convert {page.sourceName} to {page.targetName} free, right in your browser. No uploads."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}{convertPath(page.canonicalSlug)}" />
</svelte:head>

<Breadcrumbs
	crumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Conversions', href: '/convert' }
	]}
	current="{page.sourceName} to {page.targetName}"
/>

<section class="hero">
	<h1>Convert {page.sourceName} to {page.targetName}</h1>
	<p class="lede">
		Convert {page.sourceName} to {page.targetName} for free, right here in your browser. Your
		files are never uploaded, and they keep their names.
	</p>
	<TrustLine />
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

<section aria-labelledby="howto-heading">
	<h2 id="howto-heading">How to convert {page.sourceName} to {page.targetName}</h2>
	<ol class="steps">
		<li>
			Drop your {page.sourceName} files in the box above. You can also click the box to pick
			files, or paste them.
		</li>
		<li>
			Each file is converted to {page.targetName} on your own device. It usually takes a second
			or two.
		</li>
		<li>Download each file, or get them all in one zip. Every file keeps its name.</li>
	</ol>
</section>

<section aria-labelledby="about-heading">
	<h2 id="about-heading">Why convert {page.sourceName} to {page.targetName}?</h2>
	{#each facts as fact (fact)}
		<p>{fact}</p>
	{/each}
</section>

<section aria-labelledby="formats-heading">
	<h2 id="formats-heading">About the two formats</h2>
	<p><strong>{page.source.name}</strong>: {page.source.blurb}</p>
	<p><strong>{page.target.name}</strong>: {page.target.blurb}</p>
	<p>
		The whole conversion happens in your browser. Your file is unpacked into raw pixels and saved
		again as {page.targetName}. Nothing is sent to any server.
	</p>
</section>

<Faq items={pageFaq(`${page.sourceName} to ${page.targetName} converter`, pairFaq(page))} />

<section aria-labelledby="related-heading">
	<h2 id="related-heading">Related conversions</h2>
	<ul class="pair-links">
		{#each data.related as p (p.slug)}
			<li><a href={convertPath(p.slug)}>{p.source.name} to {p.target.name}</a></li>
		{/each}
	</ul>
</section>

<section aria-labelledby="pagetools-heading">
	<h2 id="pagetools-heading">Image tools</h2>
	<ul class="pair-links">
		{#each TOOLS as tool (tool.slug)}
			<li><a href={toolPath(tool)}>{tool.h1}</a></li>
		{/each}
	</ul>
</section>
