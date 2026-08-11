<script lang="ts">
	import { SOURCES, TARGETS } from '$lib/engine';
	import { SITE_URL, convertPath } from '$lib/site';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { trustFaq } from '$lib/ui/trust-faq';

	const bySource = SOURCES.map((source) => ({
		source,
		targets: TARGETS.filter((t) => t.id !== source.id)
	}));
</script>

<svelte:head>
	<title>All Image Conversions - Free, Private, No Upload</title>
	<meta
		name="description"
		content="Every image conversion this site can do, each with its own page. PNG, JPG, WebP, AVIF, HEIC, GIF, BMP, ICO, SVG and TIFF, free and right in your browser."
	/>
	<link rel="canonical" href="{SITE_URL}/convert" />
	<meta property="og:title" content="All Image Conversions" />
	<meta
		property="og:description"
		content="Every image conversion on imagetoolbox, free and in your browser. No uploads."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/convert" />
</svelte:head>

<section class="hero">
	<h1>All image conversions</h1>
	<p class="lede">
		Every conversion has its own page. Pick the one you need, drop your files and download.
	</p>
	<TrustLine />
</section>

<section aria-labelledby="matrix-heading">
	<h2 id="matrix-heading" class="visually-hidden">Conversions by format</h2>
	<div class="matrix">
		{#each bySource as group (group.source.id)}
			<div class="matrix-group">
				<h3>{group.source.name}</h3>
				<ul class="pair-links">
					{#each group.targets as t (t.id)}
						<li>
							<a href={convertPath(`${group.source.id}-to-${t.id}`)}
								>{group.source.name} to {t.name}</a
							>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</section>

<section aria-labelledby="tools-x-heading">
	<h2 id="tools-x-heading">Need to edit instead?</h2>
	<p>
		The <a href="/tools">tools</a> crop, resize, blur, redact, watermark and combine images, make
		backgrounds transparent, remove hidden EXIF data and more.
	</p>
</section>

<Faq items={trustFaq('image converter')} />

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
