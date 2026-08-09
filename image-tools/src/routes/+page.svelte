<script lang="ts">
	import { FORMATS, SOURCES, TARGETS, parsePairSlug } from '$lib/engine';
	import { SITE_URL } from '$lib/site';
	import { TOOLS } from '$lib/tools/registry';
	import ConvertPanel from '$lib/ui/ConvertPanel.svelte';

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

	const bySource = SOURCES.map((source) => ({
		source,
		targets: TARGETS.filter((t) => t.id !== source.id)
	}));
</script>

<svelte:head>
	<title>Free Online Image Converter - PNG, JPG, WebP, HEIC, AVIF</title>
	<meta
		name="description"
		content="Free online image converter with no uploads. PNG, JPG, WebP, AVIF, HEIC and more, plus tools to crop images, make backgrounds transparent and combine photos."
	/>
	<link rel="canonical" href="{SITE_URL}/" />
	<meta property="og:title" content="Free Online Image Converter" />
	<meta
		property="og:description"
		content="Convert images in your browser. No uploads, no signup, no watermarks."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/" />
</svelte:head>

<section class="hero">
	<h1>A free image converter that runs in your browser</h1>
	<p class="lede">
		Convert PNG, JPG, WebP, AVIF, HEIC and more without uploading anything. Your files stay on
		your device. No signup, no watermarks.
	</p>
</section>

<ConvertPanel target={FORMATS.png} showTargetPicker />

<section aria-labelledby="tools-heading">
	<h2 id="tools-heading">Image tools</h2>
	<ul class="tool-list">
		{#each TOOLS as tool (tool.slug)}
			<li>
				<a href="/{tool.slug}">{tool.h1}</a>
				<span class="tool-blurb">{tool.blurb}</span>
			</li>
		{/each}
	</ul>
</section>

<section aria-labelledby="popular-heading">
	<h2 id="popular-heading">Popular conversions</h2>
	<ul class="pair-links">
		{#each popular as p (p.slug)}
			<li>
				<a class="mono" href="/{p.slug}"
					>{p.sourceName} <span class="arrow" aria-hidden="true">→</span><span
						class="visually-hidden">to</span
					> {p.targetName}</a
				>
			</li>
		{/each}
	</ul>
</section>

<section id="all" aria-labelledby="all-heading">
	<h2 id="all-heading">All conversions</h2>
	<div class="matrix">
		{#each bySource as group (group.source.id)}
			<div class="matrix-row">
				<span class="matrix-source mono"
					>{group.source.name} <span class="arrow" aria-hidden="true">→</span></span
				>
				<span class="matrix-targets">
					{#each group.targets as t (t.id)}
						<a class="mono" href="/{group.source.id}-to-{t.id}">{t.name}</a>
					{/each}
				</span>
			</div>
		{/each}
	</div>
</section>

<section aria-labelledby="how-heading">
	<h2 id="how-heading">How it works</h2>
	<p>
		Your browser already ships very good image codecs. This site adds WASM decoders for the
		formats it cannot read on its own, like HEIC and TIFF. Every file is decoded to raw pixels on
		your own machine and re-encoded to the format you picked. The server only serves the page.
		That is why the converter is free, and why your images stay private.
	</p>
</section>

<style>
	.tool-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.tool-list li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.6rem;
	}

	.tool-list a {
		font-weight: 600;
		color: var(--ink);
	}

	.tool-list a:hover {
		color: var(--primary);
	}

	.tool-blurb {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.matrix {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.matrix-row {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.matrix-source {
		flex: none;
		width: 5.5rem;
		color: var(--muted);
	}

	.matrix-targets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1rem;
	}
</style>
