<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { IMAGE_CATEGORIES, IMAGE_TOOLS, PDF_TOOLS } from '$lib/tools/registry';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { trustFaq } from '$lib/ui/trust-faq';
	import ToolSearch from '$lib/ui/tools/ToolSearch.svelte';
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

<Faq items={trustFaq('image tools', true)} />
