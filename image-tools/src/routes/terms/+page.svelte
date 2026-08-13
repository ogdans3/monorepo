<script lang="ts">
	import { SITE_URL } from '$lib/site';
</script>

<svelte:head>
	<title>Terms of Service - imagetoolbox</title>
	<meta
		name="description"
		content="The terms for using imagetoolbox: the tools are free and unlimited, your files stay yours and never reach us, and the service is provided as is."
	/>
	<link rel="canonical" href="{SITE_URL}/terms" />
	<meta property="og:title" content="Terms of Service - imagetoolbox" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/terms" />
</svelte:head>

<section class="hero">
	<h1>Terms of service</h1>
	<p class="lede">
		The short version: the tools are free, your files stay yours and never reach us, and the
		service is provided as is. Check important results before you rely on them.
	</p>
	<p class="updated mono">Last updated 13 August 2026</p>
</section>

<section aria-labelledby="service-heading">
	<h2 id="service-heading">1. The service</h2>
	<p>
		imagetoolbox.org offers free image conversion and editing tools that run in your web browser.
		Your files are processed on your own device and are never uploaded. There is no account, no
		payment and no usage limit. By using the site you accept these terms.
	</p>
</section>

<section aria-labelledby="content-heading">
	<h2 id="content-heading">2. Your content</h2>
	<p>
		You keep every right to the images you work with. Because your files never reach our servers,
		we do not receive them, store them or claim any rights to them. None at all.
	</p>
	<p>
		You are responsible for what you process. Only work with material you have the right to use.
	</p>
</section>

<section aria-labelledby="fairuse-heading">
	<h2 id="fairuse-heading">3. Fair use of the service</h2>
	<p>
		The tools are free and unlimited for people. Do not attack the service, probe it for
		weaknesses, scrape it abusively or pass it off as your own. We may block traffic that
		threatens the service for everyone else.
	</p>
</section>

<section aria-labelledby="warranty-heading">
	<h2 id="warranty-heading">4. No warranty</h2>
	<p>
		The service is provided as is, without warranties of any kind. We care about correctness, but
		we cannot promise the tools are free of errors or fit for a particular purpose. Browsers and
		image formats change under our feet.
	</p>
	<p>
		Check important results. In particular, if you redact or blur sensitive information, open the
		downloaded file and confirm the result before you share it.
	</p>
</section>

<section aria-labelledby="liability-heading">
	<h2 id="liability-heading">5. Limitation of liability</h2>
	<p>
		To the extent permitted by law, we are not liable for damages arising from your use of the
		site, including lost data or lost profits. Note that your original files are never at risk on
		our side, since nothing you drop on the page leaves your machine.
	</p>
</section>

<section aria-labelledby="privacy-heading">
	<h2 id="privacy-heading">6. Privacy</h2>
	<p>
		How the site handles data is described in the
		<a href="/privacy">privacy policy</a>. The short version: images never leave your device, and
		the analytics is anonymous and cookieless.
	</p>
</section>

<section aria-labelledby="ip-heading">
	<h2 id="ip-heading">7. The site itself</h2>
	<p>
		The design, text and code of this website belong to its operator. The images you process are
		yours and none of ours.
	</p>
</section>

<section aria-labelledby="changes-heading">
	<h2 id="changes-heading">8. Changes</h2>
	<p>
		We may change or retire tools, and we may update these terms. The date at the top tells you
		when they last changed. Using the site after a change means you accept the new terms.
	</p>
</section>

<section aria-labelledby="law-heading">
	<h2 id="law-heading">9. Governing law</h2>
	<p>
		These terms are governed by Norwegian law, and disputes belong in Norwegian courts, unless
		mandatory consumer law in your country says otherwise.
	</p>
</section>

<section aria-labelledby="contact-heading">
	<h2 id="contact-heading">10. Contact</h2>
	<p>
		Questions about these terms: <a href="mailto:hello@imagetoolbox.org">hello@imagetoolbox.org</a>.
	</p>
</section>

<style>
	.updated {
		margin: 0.75rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
