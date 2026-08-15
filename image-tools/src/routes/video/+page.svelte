<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { VIDEO_SOURCES, VIDEO_TARGETS, allVideoPairs, videoPath } from '$lib/video/formats';
	import { usuallyInstant } from '$lib/video/copy';
	import { parseVideoSlug } from '$lib/video/formats';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';

	const bySource = VIDEO_SOURCES.map((source) => ({
		source,
		targets: VIDEO_TARGETS.filter((t) => t.id !== source.id)
	}));

	// The conversions that finish in about a second get their own list, since
	// that is the thing worth knowing before picking one.
	const instant = allVideoPairs()
		.map((p) => parseVideoSlug(p.slug)!)
		.filter((p) => usuallyInstant(p))
		.slice(0, 12);

	const SPECIFIC = [
		{
			q: 'Can you really convert video in a browser?',
			a: 'Yes. ffmpeg, the program behind most video conversion anywhere, has been compiled to WebAssembly and runs inside the page. It\'s the same tool doing the same work, just on your machine instead of someone else large server. That\'s why nothing has to be uploaded and why there\'s no size limit or queue.'
		},
		{
			q: 'Why are some conversions instant and others slow?',
			a: 'A video file is a container with codecs inside it. Moving H.264 video from a MOV into an MP4 changes only the container, so it takes about a second no matter how long the video is. Converting to WebM means every frame has to be decoded and encoded again, which takes roughly as long as the video lasts. Each page says which kind it is.'
		},
		{
			q: 'How big a video can I convert?',
			a: 'There\'s no limit imposed here, but there\'s a practical one. The file is held in your browser memory while it works, so a few hundred megabytes is comfortable on a computer and a phone will give up sooner. This is the opposite trade from an upload site, which caps you at a size but does the work on hardware you don\'t have to own.'
		}
	];
</script>

<svelte:head>
	<title>Free Online Video Converter - No Upload, No Limit</title>
	<meta
		name="description"
		content="Convert video in your browser for free. MP4, MOV, MKV, AVI and WebM, plus video to GIF and video to MP3. Nothing is uploaded, there is no size limit and no signup."
	/>
	<link rel="canonical" href="{SITE_URL}/video" />
	<meta property="og:title" content="Free Online Video Converter" />
	<meta
		property="og:description"
		content="Convert video in your browser. No uploads, no size limit, no signup."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/video" />
</svelte:head>

<section class="hero">
	<h1>Free online video converter</h1>
	<p class="lede">
		Convert video without uploading it anywhere. The whole thing runs on your own machine, so
		there's no queue, no size cap and no waiting for a file to travel twice.
	</p>
	<TrustLine />
</section>

<section aria-labelledby="instant-heading">
	<h2 id="instant-heading">The ones that finish in a second</h2>
	<p>
		These conversions don't rebuild the video, they move it into a different container. Nothing
		is re-encoded, so nothing is lost and it's over before you look up.
	</p>
	<ul class="pair-links">
		{#each instant as pair (pair.slug)}
			<li><a href={videoPath(pair.slug)}>{pair.sourceName} to {pair.targetName}</a></li>
		{/each}
	</ul>
</section>

<section aria-labelledby="matrix-heading">
	<h2 id="matrix-heading">Every conversion</h2>
	<div class="matrix">
		{#each bySource as group (group.source.id)}
			<div class="matrix-group">
				<h3>{group.source.name}</h3>
				<ul class="pair-links">
					{#each group.targets as t (t.id)}
						<li>
							<a href={videoPath(`${group.source.id}-to-${t.id}`)}>
								{group.source.name} to {t.name}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</section>

<section aria-labelledby="images-x-heading">
	<h2 id="images-x-heading">Working with pictures instead?</h2>
	<p>
		The <a href="/convert">image converter</a> handles PNG, JPG, WebP, AVIF, HEIC and more, and
		the <a href="/tools">image tools</a> crop, resize, compress and redact. Everything on this site
		runs the same way, on your own device.
	</p>
</section>

<Faq items={pageFaq('video converter', SPECIFIC)} />

<style>
	.matrix {
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
	}

	.matrix-group h3 {
		margin: 0 0 0.45rem;
		font-size: 0.8125rem;
		font-weight: 650;
		color: var(--muted);
	}
</style>
