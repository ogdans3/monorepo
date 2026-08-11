<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { CATEGORIES, toolPath, toolsInCategory } from '$lib/tools/registry';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { trustFaq } from '$lib/ui/trust-faq';
</script>

<svelte:head>
	<title>Free Online Image Tools - Crop, Resize, Blur, Redact</title>
	<meta
		name="description"
		content="Free image tools that run in your browser with no uploads. Crop, resize, rotate, blur, redact, combine images and make backgrounds transparent."
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
		Every tool works right in your browser. Nothing is uploaded, nothing is watermarked and
		nothing needs an account. Use them as much as you like.
	</p>
	<TrustLine />
</section>

{#each CATEGORIES as category (category.id)}
	<section aria-labelledby="cat-{category.id}">
		<h2 id="cat-{category.id}">{category.label}</h2>
		<p class="category-blurb">{category.blurb}</p>
		<ul class="tool-list">
			{#each toolsInCategory(category.id) as tool (tool.slug)}
				<li>
					<a href={toolPath(tool)}>{tool.h1}</a>
					<span class="tool-blurb">{tool.blurb}</span>
				</li>
			{/each}
		</ul>
	</section>
{/each}

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

<style>
	.category-blurb {
		margin: -0.35rem 0 0.6rem;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
