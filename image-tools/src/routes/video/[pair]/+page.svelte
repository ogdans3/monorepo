<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { videoPath } from '$lib/video/formats';
	import { videoFacts, videoFaq, usuallyInstant } from '$lib/video/copy';
	import VideoPanel from '$lib/ui/VideoPanel.svelte';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Breadcrumbs from '$lib/ui/Breadcrumbs.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';

	let { data } = $props();
	const page = $derived(data.page);
	const facts = $derived(videoFacts(data.page));
	const instant = $derived(usuallyInstant(data.page));
</script>

<svelte:head>
	<title>{page.sourceName} to {page.targetName} Converter - Free, No Upload</title>
	<meta
		name="description"
		content="Convert {page.sourceName} to {page.targetName} online free. The video is converted in your browser and never uploaded, with no size limit and no signup."
	/>
	<link rel="canonical" href="{SITE_URL}{videoPath(page.canonicalSlug)}" />
	<meta property="og:title" content="{page.sourceName} to {page.targetName} Converter" />
	<meta
		property="og:description"
		content="Convert {page.sourceName} to {page.targetName} free, in your browser. Nothing is uploaded."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}{videoPath(page.canonicalSlug)}" />
</svelte:head>

<Breadcrumbs
	crumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Video', href: '/video' }
	]}
	current="{page.sourceName} to {page.targetName}"
/>

<section class="hero">
	<h1>Convert {page.sourceName} to {page.targetName}</h1>
	<p class="lede">
		Convert {page.sourceName} to {page.targetName} for free, right here in your browser. The video
		never leaves your device, however large it is.
	</p>
	<TrustLine />
</section>

{#key page.slug}
	<VideoPanel target={page.target} targetExt={page.targetExt} sourceName={page.sourceName} />
{/key}

<section aria-labelledby="howto-heading">
	<h2 id="howto-heading">How to convert {page.sourceName} to {page.targetName}</h2>
	<ol class="steps">
		<li>Drop your {page.sourceName} file in the box above, or click the box to pick one.</li>
		<li>
			The first video also fetches the conversion engine, about 7MB, which your browser then
			keeps. After that it starts straight away.
		</li>
		<li>
			{#if instant}
				The conversion finishes in about a second, because the video itself is copied rather
				than rebuilt. Then download it.
			{:else}
				Watch the progress bar. Your own machine is doing the work, so leave the tab open until
				it finishes, then download.
			{/if}
		</li>
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
		A video file is a box with codecs inside it, and the box and its contents are separate
		things. Moving a video into a different box is bookkeeping, and takes a second. Changing the
		codec means rebuilding every frame, and takes about as long as the video runs. That's the
		whole difference between the quick conversions here and the slow ones.
	</p>
</section>

<Faq items={pageFaq(`${page.sourceName} to ${page.targetName} converter`, videoFaq(page))} />

<section aria-labelledby="related-heading">
	<h2 id="related-heading">Related conversions</h2>
	<ul class="pair-links">
		{#each data.related as p (p.slug)}
			<li><a href={videoPath(p.slug)}>{p.source.name} to {p.target.name}</a></li>
		{/each}
	</ul>
	<p class="all-video"><a href="/video">All video conversions</a></p>
</section>

<style>
	.all-video {
		margin: 0.9rem 0 0;
		font-size: 0.9375rem;
	}
</style>
