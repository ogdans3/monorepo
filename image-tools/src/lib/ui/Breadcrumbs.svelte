<script lang="ts">
	import { SITE_URL } from '$lib/site';

	// Visible trail plus matching structured data. The site is three levels
	// deep now, and a crumb tells both a visitor and a search engine where a
	// page sits without them having to guess from the URL.
	let {
		crumbs,
		current
	}: {
		/** Ancestors only, nearest last. The current page is added as plain text. */
		crumbs: { label: string; href: string }[];
		current: string;
	} = $props();

	const ld = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: [
				...crumbs.map((c, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: c.label,
					item: `${SITE_URL}${c.href}`
				})),
				{ '@type': 'ListItem', position: crumbs.length + 1, name: current }
			]
		})
	);
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${ld}<\/script>`}
</svelte:head>

<nav class="crumbs" aria-label="Breadcrumb">
	<ol>
		{#each crumbs as crumb (crumb.href)}
			<li><a href={crumb.href}>{crumb.label}</a></li>
		{/each}
		<li aria-current="page">{current}</li>
	</ol>
</nav>

<style>
	.crumbs {
		margin: 1.5rem 0 -1.25rem;
	}

	.crumbs ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.crumbs li + li::before {
		content: '/';
		margin-right: 0.4rem;
		color: var(--line);
	}

	.crumbs a {
		color: var(--muted);
	}

	.crumbs a:hover {
		color: var(--primary);
	}
</style>
