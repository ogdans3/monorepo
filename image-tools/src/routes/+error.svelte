<script lang="ts">
	import { page } from '$app/state';
	import { parsePairSlug } from '$lib/engine';
	import { convertPath } from '$lib/site';

	// A dead link from somewhere else is worth more than it looks. Whoever
	// followed it wanted one specific thing, so this page offers four real
	// routes onward instead of one apology and a link home.
	const SECTIONS = [
		{ href: '/convert', label: 'Convert an image', blurb: 'PNG, JPG, WebP, AVIF, HEIC and more.' },
		{ href: '/tools', label: 'Image tools', blurb: 'Crop, resize, compress, blur, redact.' },
		{ href: '/pdf', label: 'PDF tools', blurb: 'Merge, split, rotate, extract pages.' },
		{ href: '/make', label: 'Ready-made sizes', blurb: 'Hit a file size or an exact pixel size.' }
	];

	const popular = ['heic-to-jpg', 'png-to-jpg', 'jpg-to-png', 'webp-to-jpg'].map(
		(slug) => parsePairSlug(slug)!
	);

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'} | image→toolbox</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="hero">
	<h1>{notFound ? 'That page is not here' : 'Something went wrong'}</h1>
	<p class="lede">
		{#if notFound}
			The address doesn't match anything on this site. It may have been a typo, or a link that
			pointed at an older version of the site.
		{:else}
			{page.error?.message ?? 'An unexpected error stopped the page from loading.'}
		{/if}
	</p>
</section>

<section aria-labelledby="sections-heading">
	<h2 id="sections-heading">Where you probably meant to go</h2>
	<ul class="tool-list">
		{#each SECTIONS as section (section.href)}
			<li>
				<a href={section.href}>{section.label}</a>
				<span class="tool-blurb">{section.blurb}</span>
			</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="popular-heading">
	<h2 id="popular-heading">The conversions people ask for most</h2>
	<ul class="pair-links">
		{#each popular as pair (pair.slug)}
			<li><a href={convertPath(pair.slug)}>{pair.sourceName} to {pair.targetName}</a></li>
		{/each}
	</ul>
</section>
