<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { pageFaq } from '$lib/faq';
	import { nextVideoTools, videoToolPath, type VideoTool } from '$lib/video/tools';
	import VideoToolPanel from './VideoToolPanel.svelte';
	import VideoMergePanel from './VideoMergePanel.svelte';
	import VideoFramesPanel from './VideoFramesPanel.svelte';
	import TrustLine from './TrustLine.svelte';
	import Breadcrumbs from './Breadcrumbs.svelte';
	import Faq from './Faq.svelte';

	let { tool }: { tool: VideoTool } = $props();

	const url = $derived(`${SITE_URL}${videoToolPath(tool)}`);
	const next = $derived(nextVideoTools(tool));
</script>

<svelte:head>
	<title>{tool.title}</title>
	<meta name="description" content={tool.description} />
	<link rel="canonical" href={url} />
	<meta property="og:title" content={tool.title} />
	<meta property="og:description" content={tool.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={url} />
</svelte:head>

<Breadcrumbs
	crumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Video', href: '/video' }
	]}
	current={tool.name}
/>

<section class="hero">
	<h1>{tool.h1}</h1>
	<p class="lede">{tool.lede}</p>
	<TrustLine />
</section>

{#if tool.op === 'merge'}
	<!-- The join takes a list of files, so it has a panel of its own. -->
	<VideoMergePanel {tool} />
{:else if tool.op === 'frames'}
	<!-- And this one gives a list of files back, which needs the same. -->
	<VideoFramesPanel {tool} />
{:else}
	<VideoToolPanel {tool} />
{/if}

<section aria-labelledby="howto-heading">
	<h2 id="howto-heading">How to {tool.h1.toLowerCase()}</h2>
	<ol class="steps">
		{#each tool.steps as step (step)}
			<li>{step}</li>
		{/each}
		<li>
			The first video also fetches the video engine, about 7MB, which your browser then keeps.
			After that it starts straight away.
		</li>
	</ol>
</section>

<section aria-labelledby="about-heading">
	<h2 id="about-heading">{tool.aboutHeading}</h2>
	{#each tool.about as paragraph (paragraph)}
		<p>{paragraph}</p>
	{/each}
	{#if !tool.keepsFrames}
		<p>
			This edit changes the picture, so every frame has to be decoded and encoded again. Your own
			machine does that work, which is what keeps the file off anybody's server, and it's why a
			long clip takes longer than a short one. Trimming and removing the sound are the two things
			here that skip it entirely.
		</p>
	{/if}
</section>

<Faq items={pageFaq(tool.h1.toLowerCase(), tool.faq)} />

{#if next.length}
	<section aria-labelledby="next-heading">
		<h2 id="next-heading">What people do next</h2>
		<ul class="next-links">
			{#each next as item (item.slug)}
				<li><a href={videoToolPath(item)}>{item.h1}</a>. {item.blurb}</li>
			{/each}
		</ul>
		<p class="all-video"><a href="/video">All video tools and conversions</a></p>
	</section>
{/if}

<style>
	.next-links {
		margin: 0.6rem 0 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9375rem;
	}

	.all-video {
		margin: 0.9rem 0 0;
		font-size: 0.9375rem;
	}
</style>
