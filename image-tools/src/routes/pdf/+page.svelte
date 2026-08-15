<script lang="ts">
	import { SITE_URL } from '$lib/site';
	import { CATEGORIES, PDF_TOOLS, toolPath } from '$lib/tools/registry';
	import TrustLine from '$lib/ui/TrustLine.svelte';
	import Faq from '$lib/ui/Faq.svelte';
	import { pageFaq } from '$lib/faq';
	import ToolSearch from '$lib/ui/tools/ToolSearch.svelte';

	const pdfCategory = CATEGORIES.filter((c) => c.id === 'pdf');

	// Questions this hub answers that its individual pages do not.
	const SPECIFIC = [
		{
			q: 'Are my PDFs uploaded when I merge or split them?',
			a: 'No, and that matters more here than almost anywhere else, because PDFs are where contracts, invoices, medical letters and identity documents live. The file is opened and rewritten inside your browser and never sent anywhere, which is worth knowing given that most free PDF sites work by uploading your document to their servers.'
		},
		{
			q: 'Does editing a PDF here reduce its quality?',
			a: 'No. Pages are copied from one document to another as whole objects rather than rendered into pictures and saved again, so text stays selectable and searchable, fonts stay embedded, and images keep the resolution they had. The exception is the PDF to image tool, which is meant to produce pictures.'
		},
		{
			q: 'Can I edit the text inside a PDF?',
			a: 'Not here. These tools work on whole pages: merging, splitting, extracting, deleting, reordering, rotating, watermarking and numbering. Rewriting the words on a page means unpicking the fonts and the layout, which is a much larger job and one that usually goes better in the program the document came from.'
		}
	];
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
		tools never send it anywhere, so there's nothing to promise. That matters for contracts,
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

<Faq items={pageFaq('PDF tools', SPECIFIC, true)} />
