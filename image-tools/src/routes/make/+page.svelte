<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { PRESETS, PRESET_GROUPS, presetPath, presetsInGroup } from '$lib/tools/presets';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Breadcrumbs from '$lib/ui/Breadcrumbs.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { trustFaq } from '$lib/ui/trust-faq';
</script>

<svelte:head>
	<title>Image Size Presets - Compress or Resize to Exact Sizes</title>
	<meta
		name="description"
		content="Ready-made pages for the sizes people actually need. Compress an image to 200 KB or 1 MB, resize to 1920 by 1080, or fit a YouTube thumbnail. Free, no uploads."
	/>
	<link rel="canonical" href="{SITE_URL}/make" />
	<meta property="og:title" content="Image Size Presets" />
	<meta
		property="og:description"
		content="Compress to an exact file size or resize to an exact shape, with the setting already filled in."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/make" />
</svelte:head>

<Breadcrumbs crumbs={[{ label: 'Home', href: '/' }]} current="Ready-made sizes" />

<section class="hero">
	<h1>Ready-made sizes</h1>
	<p class="lede">
		{PRESETS.length} pages for the sizes people actually get asked for. Each one opens with the
		setting already filled in, so there is nothing to work out.
	</p>
	<TrustLine />
</section>

{#each PRESET_GROUPS as group (group.id)}
	<section aria-labelledby="group-{group.id}">
		<h2 id="group-{group.id}">{group.label}</h2>
		<p class="group-blurb">{group.blurb}</p>
		<ul class="tool-list">
			{#each presetsInGroup(group.id) as preset (preset.slug)}
				<li>
					<a href={presetPath(preset)}>{preset.h1}</a>
					<span class="tool-blurb">{preset.blurb}</span>
				</li>
			{/each}
		</ul>
	</section>
{/each}

<section aria-labelledby="custom-heading">
	<h2 id="custom-heading">Need a size that is not here?</h2>
	<p>
		The <a href="/tools/compress-image">compress tool</a> takes any target you type, and the
		<a href="/tools/resize-image">resize tool</a> takes any width and height. These pages exist
		because those two questions get asked with the same handful of numbers over and over.
	</p>
</section>

<Faq items={trustFaq('size tools', true)} />

<style>
	.group-blurb {
		margin: -0.35rem 0 0.6rem;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
