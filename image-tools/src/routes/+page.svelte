<script lang="ts">
	import { FORMATS, SOURCES, TARGETS, parsePairSlug } from '$lib/engine';
	import { SITE_URL } from '$lib/site';
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
	<title>Convert any image in your browser — free and private</title>
	<meta
		name="description"
		content="Free image converter that runs entirely in your browser. PNG, JPG, WebP, AVIF, HEIC, GIF, BMP, ICO, SVG, TIFF — no uploads, files never leave your device."
	/>
	<link rel="canonical" href="{SITE_URL}/" />
</svelte:head>

<section class="hero">
	<h1>Convert any image in your browser</h1>
	<p class="lede">
		Free and private. Files never leave your device — no uploads, no accounts, no watermarks.
	</p>
</section>

<ConvertPanel target={FORMATS.png} showTargetPicker />

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
	<h2 id="all-heading">Every conversion</h2>
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
		Your browser already ships excellent image codecs; this site adds WASM decoders for the rest
		(HEIC, TIFF, and AVIF on older engines). Files are decoded to raw pixels on your own machine,
		re-encoded to the target format, and handed straight back — the server only serves this page.
		That's why it's free, and why it's private.
	</p>
</section>

<style>
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
