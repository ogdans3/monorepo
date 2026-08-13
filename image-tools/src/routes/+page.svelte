<script lang="ts">
	import { FORMATS, parsePairSlug } from '$lib/engine';
	import { SITE_URL, convertPath } from '$lib/site';
	import { IMAGE_CATEGORIES, PDF_TOOLS, toolPath, toolsInCategory } from '$lib/tools/registry';
	import { presetBySlug, presetPath } from '$lib/tools/presets';

	const POPULAR_PRESETS = [
		'compress-image-to-200kb',
		'compress-image-to-1mb',
		'resize-image-to-1920x1080',
		'youtube-thumbnail-size',
		'instagram-post-size',
		'linkedin-banner-size'
	].map((slug) => presetBySlug(slug)!);
	import ConvertPanel from '$lib/ui/ConvertPanel.svelte';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';

	// WebApplication structured data: name, category and an explicit price of
	// zero, which is how machines learn the site is free.
	const appLd = JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'imagetoolbox',
		url: SITE_URL,
		applicationCategory: 'MultimediaApplication',
		operatingSystem: 'Any (runs in the browser)',
		description:
			'Free image converter and image tools that run in your browser. Files are never uploaded. No account, no watermarks, no limits.',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	});

	const popular = [
		'heic-to-jpg',
		'heic-to-png',
		'png-to-jpg',
		'jpg-to-png',
		'webp-to-jpg',
		'webp-to-png',
		'png-to-webp',
		'jpg-to-webp',
		'avif-to-jpg',
		'avif-to-png',
		'png-to-ico',
		'svg-to-png'
	].map((slug) => parsePairSlug(slug)!);

	// Questions this hub answers that its individual pages do not.
	const SPECIFIC = [
		{
			q: 'What is the best free image converter?',
			a: 'The one that does not make you wait for an upload, does not ask for an account and does not stamp a watermark on the result. This site converts between PNG, JPG, WebP, AVIF, HEIC, GIF, BMP, ICO, SVG and TIFF entirely inside your browser, so the file never travels anywhere and there is nothing to sign up for. It is free with no limit on how many images you convert.'
		},
		{
			q: 'How does converting an image in the browser work?',
			a: 'Your browser already knows how to read and write images, since that is most of what it does all day. Dropping a file here hands it to that machinery: the picture is unpacked into raw pixels, then saved again in the format you chose, all on your own device. The newer formats that browsers do not write natively are handled by small code libraries the page loads as it needs them.'
		},
		{
			q: 'Which image format should I use?',
			a: 'JPG for photographs that have to work everywhere, PNG when you need transparency or exact pixels such as a logo or a screenshot, and WebP for anything going on a website, since it is smaller than both at the same visible quality. AVIF is smaller still and worth using when only browsers will see the file. HEIC is what an iPhone gives you and is usually the thing to convert away from.'
		}
	];
</script>

<svelte:head>
	<title>Free Online Image Converter - PNG, JPG, WebP, HEIC, AVIF</title>
	<meta
		name="description"
		content="Free online image converter with no uploads. PNG, JPG, WebP, AVIF, HEIC and more, plus tools to crop, resize, rotate, blur, redact and combine images."
	/>
	<link rel="canonical" href="{SITE_URL}/" />
	<meta property="og:title" content="Free Online Image Converter" />
	<meta
		property="og:description"
		content="Convert images in your browser. No uploads, no signup, no watermarks."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/" />
	{@html `<script type="application/ld+json">${appLd}<\/script>`}
</svelte:head>

<section class="hero">
	<h1>A free image converter that runs in your browser</h1>
	<p class="lede">
		Convert PNG, JPG, WebP, AVIF, HEIC and more without uploading anything. Your files stay on
		your device. No signup, no watermarks, no limits.
	</p>
	<TrustLine />
</section>

<ConvertPanel target={FORMATS.png} showTargetPicker />

<section aria-labelledby="tools-heading">
	<h2 id="tools-heading">Image tools</h2>
	<div class="matrix">
		{#each IMAGE_CATEGORIES as category (category.id)}
			<div class="matrix-group">
				<h3>{category.label}</h3>
				<ul class="pair-links">
					{#each toolsInCategory(category.id) as tool (tool.slug)}
						<li><a href={toolPath(tool)}>{tool.h1}</a></li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
	<p class="all-tools-link"><a href="/tools">All image tools</a></p>
</section>

<section aria-labelledby="sizes-heading">
	<h2 id="sizes-heading">Ready-made sizes</h2>
	<p>
		Pages that open with the setting already filled in, for the sizes people get asked for most.
	</p>
	<ul class="pair-links">
		{#each POPULAR_PRESETS as preset (preset.slug)}
			<li><a href={presetPath(preset)}>{preset.h1}</a></li>
		{/each}
	</ul>
	<p class="all-tools-link"><a href="/make">All ready-made sizes</a></p>
</section>

<section aria-labelledby="pdf-heading">
	<h2 id="pdf-heading">PDF tools</h2>
	<div class="matrix">
		<div class="matrix-group">
			<ul class="pair-links">
				{#each PDF_TOOLS as tool (tool.slug)}
					<li><a href={toolPath(tool)}>{tool.h1}</a></li>
				{/each}
			</ul>
		</div>
	</div>
	<p class="all-tools-link"><a href="/pdf">All PDF tools</a></p>
</section>

<section aria-labelledby="popular-heading">
	<h2 id="popular-heading">Popular conversions</h2>
	<ul class="pair-links">
		{#each popular as p (p.slug)}
			<li><a href={convertPath(p.slug)}>{p.sourceName} to {p.targetName}</a></li>
		{/each}
	</ul>
	<p class="all-tools-link"><a href="/convert">All conversions</a></p>
</section>

<section aria-labelledby="how-heading">
	<h2 id="how-heading">How it works</h2>
	<p>
		imagetoolbox is a free image converter and a set of image tools that run in your browser.
		Your browser already knows how to read most image formats, and this site adds a little extra
		code for the rest, like HEIC and TIFF. Every file is turned into raw pixels on your own
		computer, then saved again in the format you picked. The server only sends you this page.
		That is why the converter is free, and why your images stay private.
	</p>
</section>

<Faq items={pageFaq('image converter', SPECIFIC)} />

<style>
	.all-tools-link {
		margin: 1.1rem 0 0;
		font-size: 0.875rem;
	}
</style>
