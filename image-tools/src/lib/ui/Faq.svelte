<script lang="ts">
	import type { FaqItem } from './trust-faq';

	let { items }: { items: FaqItem[] } = $props();

	// FAQPage structured data mirroring the visible questions, which is what
	// makes them easy for search engines and AI assistants to pick up.
	const ld = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: items.map((item) => ({
				'@type': 'Question',
				name: item.q,
				acceptedAnswer: { '@type': 'Answer', text: item.a }
			}))
		})
	);
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${ld}<\/script>`}
</svelte:head>

<section aria-labelledby="faq-heading">
	<h2 id="faq-heading">Common questions</h2>
	{#each items as item (item.q)}
		<div class="faq-item">
			<h3>{item.q}</h3>
			<p>{item.a}</p>
		</div>
	{/each}
</section>

<style>
	.faq-item + .faq-item {
		margin-top: 1.1rem;
	}

	.faq-item h3 {
		margin: 0 0 0.25rem;
		font-size: 0.9375rem;
		font-weight: 650;
	}

	.faq-item p {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--muted);
		max-width: 62ch;
	}
</style>
