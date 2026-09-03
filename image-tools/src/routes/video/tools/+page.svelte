<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { VIDEO_CATEGORIES, VIDEO_TOOLS, videoToolPath, videoToolsInCategory } from '$lib/video/tools';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Breadcrumbs from '$lib/ui/Breadcrumbs.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';

	const instant = VIDEO_TOOLS.filter((tool) => tool.keepsFrames);

	const SPECIFIC = [
		{
			q: 'Can you really edit video in a browser?',
			a: "Yes. ffmpeg, the program behind most video editing anywhere, has been compiled to WebAssembly and runs inside the page. It's the same tool doing the same work, on your machine rather than on somebody's server. That's why nothing has to be uploaded, why there's no queue and why there's no size limit beyond what a tab can hold."
		},
		{
			q: 'Why do most video edits take so long?',
			a: "Because changing the picture means every frame has to be decoded, altered and encoded again, and there's no shortcut for that. Trimming on a keyframe and removing the sound are the exceptions, since both copy the picture instead of rebuilding it and finish in about a second. Any site that does a crop instantly is doing the same work on a server you're waiting for."
		},
		{
			q: 'Do these tools put a watermark on my video?',
			a: "No. Nothing is added to the picture that you did not ask for, and there's no free tier to upsell you out of. The add text tool draws a caption because that's what you came to it for, and every other tool leaves the frame exactly as it found it apart from the change you asked for."
		}
	];
</script>

<svelte:head>
	<title>Free Online Video Tools - No Upload, No Limit</title>
	<meta
		name="description"
		content="Free video tools that run in your browser with no uploads. Trim, crop, resize, rotate, blur, caption, mute and compress video, with no account and no size limit."
	/>
	<link rel="canonical" href="{SITE_URL}/video/tools" />
	<meta property="og:title" content="Free Online Video Tools" />
	<meta
		property="og:description"
		content="Trim, crop, resize, caption and compress video in your browser. No uploads."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/video/tools" />
</svelte:head>

<Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Video', href: '/video' }]} current="Tools" />

<section class="hero">
	<h1>Free online video tools</h1>
	<p class="lede">
		{VIDEO_TOOLS.length} tools, and every one of them runs on your own machine. Nothing is uploaded,
		nothing is watermarked and nothing needs an account.
	</p>
	<TrustLine />
</section>

<section aria-labelledby="instant-heading">
	<h2 id="instant-heading">The two that finish in a second</h2>
	<p>
		Most video edits rebuild every frame. These two copy the picture instead, so they're over
		before you look up and every frame comes back identical to the one you started with.
	</p>
	<ul class="tool-links">
		{#each instant as tool (tool.slug)}
			<li><a href={videoToolPath(tool)}>{tool.h1}</a>. {tool.blurb}</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="all-heading">
	<h2 id="all-heading">Every video tool</h2>
	<div class="groups">
		{#each VIDEO_CATEGORIES as group (group.id)}
			<div class="group">
				<h3>{group.label}</h3>
				<ul class="tool-links">
					{#each videoToolsInCategory(group.id) as tool (tool.slug)}
						<li><a href={videoToolPath(tool)}>{tool.name}</a>. {tool.blurb}</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</section>

<section aria-labelledby="convert-heading">
	<h2 id="convert-heading">Need a different format instead?</h2>
	<p>
		The <a href="/video">video converter</a> handles MP4, MOV, WebM, MKV and AVI in every
		direction, plus video to GIF and video to MP3. Moving a video into a different container
		copies the streams and takes about a second, which is the one thing on this site that is
		faster than the two tools above.
	</p>
</section>

<section aria-labelledby="images-heading">
	<h2 id="images-heading">Working with pictures instead?</h2>
	<p>
		The <a href="/tools">image tools</a> crop, resize, compress and redact, and the
		<a href="/convert">image converter</a> reads PNG, JPG, WebP, AVIF, HEIC and more. Everything
		on this site runs the same way, on your own device.
	</p>
</section>

<Faq items={pageFaq('video tools', SPECIFIC, true)} />

<style>
	.groups {
		display: flex;
		flex-direction: column;
		gap: 1.35rem;
	}

	.group h3 {
		margin: 0 0 0.45rem;
		font-size: 0.8125rem;
		font-weight: 650;
		color: var(--muted);
	}

	.tool-links {
		margin: 0.6rem 0 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9375rem;
	}
</style>
