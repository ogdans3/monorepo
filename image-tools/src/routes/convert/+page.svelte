<script lang="ts">
	import { SOURCES, TARGETS } from '$lib/engine';
	import { SITE_URL, convertPath } from '$lib/site';
	import { SAME_NAME_PAGES } from '$lib/tools/samename';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';

	const bySource = SOURCES.map((source) => ({
		source,
		targets: TARGETS.filter((t) => t.id !== source.id)
	}));

	// Questions this hub answers that its individual pages do not.
	const SPECIFIC = [
		{
			q: 'Which image formats can I convert between?',
			a: 'Ten formats in every working direction: PNG, JPG, WebP, AVIF, GIF, HEIC, BMP, ICO, SVG and TIFF. SVG can be read but not written, since turning pixels back into shapes is a different kind of job, and everything else converts both ways. That gives 93 combinations, each with a page of its own.'
		},
		{
			q: 'Can I convert several images at once?',
			a: 'Yes. Drop as many as you like, in mixed formats if you want, and each is converted separately with its own download button, or all of them together as a zip. Nothing is queued and nothing is rationed, because your own device is doing the work.'
		},
		{
			q: 'Are the filenames kept?',
			a: 'Yes. A file called holiday.heic comes back as holiday.jpg, so a folder of converted images stays in the order and the naming you already had. That sounds small until you have converted forty photos and every one of them is called download (3).'
		}
	];
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

<section aria-labelledby="same-heading">
	<h2 id="same-heading">Same format, different spelling</h2>
	<p>
		JPG and JPEG are one format with two extensions, so there is nothing to convert. These pages
		rename the file instead of re-saving it, which keeps every pixel exactly as it was.
	</p>
	<ul class="pair-links">
		{#each SAME_NAME_PAGES as page (page.slug)}
			<li><a href={convertPath(page.slug)}>{page.from} to {page.to}</a></li>
		{/each}
	</ul>
</section>

<section aria-labelledby="tools-x-heading">
	<h2 id="tools-x-heading">Need to edit instead?</h2>
	<p>
		The <a href="/tools">tools</a> crop, resize, blur, redact, watermark and combine images, make
		backgrounds transparent, remove hidden EXIF data and more.
	</p>
</section>

<Faq items={pageFaq('image converter', SPECIFIC)} />

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
