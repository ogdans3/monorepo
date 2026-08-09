<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { TOOLS } from '$lib/tools/registry';
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
	<title>{page.sourceName} to {page.targetName} Converter - Free, Private, No Upload</title>
	<meta
		name="description"
		content="Convert {page.sourceName} to {page.targetName} online free. Files convert in your browser and are never uploaded. Batch convert, download as a zip, keep your filenames."
	/>
	<link rel="canonical" href="{SITE_URL}/{page.canonicalSlug}" />
	<meta property="og:title" content="{page.sourceName} to {page.targetName} Converter" />
	<meta
		property="og:description"
		content="Convert {page.sourceName} to {page.targetName} free, right in your browser. No uploads."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/{page.canonicalSlug}" />
</svelte:head>

<section class="hero">
	<h1>
		Convert {page.sourceName}<span class="arrow" aria-hidden="true"> → </span><span
			class="visually-hidden"
		> to </span>{page.targetName}
	</h1>
	<p class="lede">
		Free {page.sourceName} to {page.targetName} conversion that runs on your own device. Nothing
		gets uploaded, and your filenames stay put.
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

<section aria-labelledby="howto-heading">
	<h2 id="howto-heading">How to convert {page.sourceName} to {page.targetName}</h2>
	<ol class="steps">
		<li>
			Drop your {page.sourceName} files in the zone above. Clicking it opens a file picker, and
			pasting from the clipboard works too.
		</li>
		<li>Each file converts to {page.targetName} on your device, usually within a second or two.</li>
		<li>
			Download the files one by one, or grab them all as a zip. Every file keeps its original
			name.
		</li>
	</ol>
</section>

<section aria-labelledby="about-heading">
	<h2 id="about-heading">Why convert {page.sourceName} to {page.targetName}?</h2>
	<p><strong>{page.source.name}</strong>: {page.source.blurb}</p>
	<p><strong>{page.target.name}</strong>: {page.target.blurb}</p>
	<p>
		The conversion happens entirely in your browser. Each file is decoded to raw pixels and
		re-encoded as {page.targetName}. Nothing is uploaded, and the server only serves this page.
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

<section aria-labelledby="pagetools-heading">
	<h2 id="pagetools-heading">Image tools</h2>
	<ul class="pair-links">
		{#each TOOLS as tool (tool.slug)}
			<li><a href="/{tool.slug}">{tool.h1}</a></li>
		{/each}
	</ul>
</section>
