<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { PRESETS, presetFaq, presetPath } from '$lib/tools/presets';
	import { toolPath, toolBySlug } from '$lib/tools/registry';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Breadcrumbs from '$lib/ui/Breadcrumbs.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';
	import CompressEditor from '$lib/ui/tools/CompressEditor.svelte';
	import PresetResizeEditor from '$lib/ui/tools/PresetResizeEditor.svelte';

	let { data } = $props();
	const preset = $derived(data.preset);

	// siblings in the same group, since someone who needed 200 KB may next need 500
	const related = $derived(
		PRESETS.filter((p) => p.group === preset.group && p.slug !== preset.slug).slice(0, 6)
	);
	const generalTool = $derived(
		toolBySlug(preset.kind === 'compress' ? 'compress-image' : 'resize-image')!
	);
</script>

<svelte:head>
	<title>{preset.title}</title>
	<meta name="description" content={preset.description} />
	<link rel="canonical" href="{SITE_URL}{presetPath(preset)}" />
	<meta property="og:title" content={preset.title} />
	<meta property="og:description" content={preset.description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}{presetPath(preset)}" />
</svelte:head>

<Breadcrumbs
	crumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Ready-made sizes', href: '/make' }
	]}
	current={preset.h1}
/>

<section class="hero">
	<h1>{preset.h1}</h1>
	<p class="lede">{preset.lede}</p>
	<TrustLine />
</section>

{#key preset.slug}
	{#if preset.kind === 'compress'}
		<CompressEditor initialBytes={preset.bytes} />
	{:else}
		<PresetResizeEditor
			width={preset.width!}
			height={preset.height!}
			label={preset.h1.replace(/^Resize an image for /, '')}
		/>
	{/if}
{/key}

<section aria-labelledby="about-heading">
	<h2 id="about-heading">Good to know</h2>
	{#each preset.about as line (line)}
		<p>{line}</p>
	{/each}
	<p>
		This page is the <a href={toolPath(generalTool)}>{generalTool.h1.toLowerCase()}</a> tool with the
		setting already filled in. Everything happens in your browser, so the file is never uploaded.
	</p>
</section>

{#if related.length}
	<section aria-labelledby="related-heading">
		<h2 id="related-heading">Other ready-made sizes</h2>
		<ul class="tool-list">
			{#each related as other (other.slug)}
				<li>
					<a href={presetPath(other)}>{other.h1}</a>
					<span class="tool-blurb">{other.blurb}</span>
				</li>
			{/each}
		</ul>
		<p class="all-tools"><a href="/make">All ready-made sizes</a></p>
	</section>
{/if}

<Faq items={pageFaq(preset.kind === 'compress' ? 'compressor' : 'resizer', presetFaq(preset))} />
