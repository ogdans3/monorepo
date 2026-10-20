<script lang="ts">
  import { SITE } from "$lib/guides/guides";

  let {
    title,
    description,
    path,
    crumbs,
  }: {
    title: string;
    description: string;
    path: string;
    crumbs: { name: string; path: string }[];
  } = $props();

  const url = $derived(`${SITE}${path}`);
  // `<` is escaped so no string in the data can close the script element.
  const breadcrumbs = $derived(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: crumb.name,
        item: `${SITE}${crumb.path}`,
      })),
    }).replace(/</g, "\\u003c"),
  );
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={url} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={url} />
  <meta property="og:image" content="https://phonemockup.app/og-cover.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  {@html '<script type="application/ld+json">' +
    breadcrumbs +
    "</" +
    "script>"}
</svelte:head>
