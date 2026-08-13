<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { CATEGORIES, PDF_TOOLS, toolPath } from '$lib/tools/registry';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { trustFaq } from '$lib/ui/trust-faq';
	import ToolSearch from '$lib/ui/tools/ToolSearch.svelte';

	const pdfCategory = CATEGORIES.filter((c) => c.id === 'pdf');
</script>

<svelte:head>
	<title>Free Online PDF Tools - Merge, Split, Rotate, No Upload</title>
	<meta
		name="description"
		content="Free PDF tools that run in your browser. Merge, split, extract and delete pages, reorder, rotate, watermark, number pages and pull out text. No uploads."
	/>
	<link rel="canonical" href="{SITE_URL}/pdf" />
	<meta property="og:title" content="Free Online PDF Tools" />
	<meta
		property="og:description"
		content="Merge, split, reorder, rotate and stamp PDF files in your browser. Nothing is uploaded."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/pdf" />
</svelte:head>

<section class="hero">
	<h1>Free online PDF tools</h1>
	<p class="lede">
		{PDF_TOOLS.length} tools for working with documents, all running in your browser. A contract or
		a scan never leaves your device, which is rather the point.
	</p>
	<TrustLine />
</section>

<ToolSearch tools={PDF_TOOLS} categories={pdfCategory} placeholder="Search PDF tools" />

<section aria-labelledby="why-heading">
	<h2 id="why-heading">Why do this in the browser?</h2>
	<p>
		Most free PDF sites upload your document to a server and promise to delete it later. These
		tools never send it anywhere, so there is nothing to promise. That matters for contracts,
		invoices, medical letters and anything with a signature on it.
	</p>
	<p>
		Pages are copied across without being re-encoded, so text stays text and quality is untouched.
	</p>
</section>

<section aria-labelledby="images-heading">
	<h2 id="images-heading">Working with images instead?</h2>
	<p>
		There are <a href="/tools">image tools</a> for cropping, resizing, blurring and watermarking,
		and a <a href="/convert">converter</a> that reads ten formats, including HEIC from iPhones.
	</p>
</section>

<Faq items={trustFaq('PDF tools', true)} />
