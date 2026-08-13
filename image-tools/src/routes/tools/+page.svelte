<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { IMAGE_CATEGORIES, IMAGE_TOOLS, PDF_TOOLS } from '$lib/tools/registry';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';
	import ToolSearch from '$lib/ui/tools/ToolSearch.svelte';

	// Questions this hub answers that its individual pages do not.
	const SPECIFIC = [
		{
			q: 'Can I use several tools on the same image?',
			a: 'Yes, one after another. Download the result of the first tool and drop that file into the next one. Most tool pages list the steps people usually take next, which saves you hunting for the right one. Use PNG or WebP for the files in between, so nothing is compressed twice on the way through.'
		},
		{
			q: 'Do these tools work on a phone?',
			a: 'Yes. Everything runs in the browser, so a phone works the same way a computer does and the tools that need dragging respond to touch. The one thing to watch on an older phone is a very large image, since the whole picture has to fit in memory at once.'
		},
		{
			q: 'Is there a limit on file size?',
			a: 'Not one that this site sets. The ceiling is your device, since the image is decoded in memory rather than sent to a server that would have a limit of its own. An ordinary computer handles very large photographs comfortably. A phone with an enormous scan is where you might notice.'
		}
	];
</script>

<svelte:head>
	<title>Free Online Image Tools - Crop, Resize, Blur, Redact</title>
	<meta
		name="description"
		content="Free image tools that run in your browser with no uploads. Crop, resize, rotate, blur, redact, watermark, compress and combine images, and more."
	/>
	<link rel="canonical" href="{SITE_URL}/tools" />
	<meta property="og:title" content="Free Online Image Tools" />
	<meta
		property="og:description"
		content="Crop, resize, rotate, blur, redact and combine images in your browser. No uploads."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/tools" />
</svelte:head>

<section class="hero">
	<h1>Free online image tools</h1>
	<p class="lede">
		{IMAGE_TOOLS.length} tools, and every one of them runs in your browser. Nothing is uploaded,
		nothing is watermarked and nothing needs an account.
	</p>
	<TrustLine />
</section>

<ToolSearch tools={IMAGE_TOOLS} categories={IMAGE_CATEGORIES} placeholder="Search image tools" />

<section aria-labelledby="pdf-heading">
	<h2 id="pdf-heading">Working with PDF files?</h2>
	<p>
		There are <a href="/pdf">{PDF_TOOLS.length} PDF tools</a> in their own section, for merging,
		splitting, reordering and stamping documents.
	</p>
</section>

<section aria-labelledby="convert-heading">
	<h2 id="convert-heading">Need a different format instead?</h2>
	<p>
		The <a href="/">converter</a> reads PNG, JPG, WebP, AVIF, HEIC, GIF, BMP, ICO, SVG and TIFF.
		Every pair has its <a href="/convert">own page</a>, like
		<a href="/convert/heic-to-jpg">HEIC to JPG</a> or
		<a href="/convert/png-to-webp">PNG to WebP</a>.
	</p>
</section>

<Faq items={pageFaq('image tools', SPECIFIC, true)} />
