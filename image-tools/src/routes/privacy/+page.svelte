<script lang="ts">
	import { SITE_URL } from '$lib/site';
</script>

<svelte:head>
	<title>Privacy Policy - imagetoolbox</title>
	<meta
		name="description"
		content="How imagetoolbox handles data: your images never leave your device, analytics is anonymous and cookieless, and there are no accounts. The full policy in plain language."
	/>
	<link rel="canonical" href="{SITE_URL}/privacy" />
	<meta property="og:title" content="Privacy Policy - imagetoolbox" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{SITE_URL}/privacy" />
</svelte:head>

<section class="hero">
	<h1>Privacy policy</h1>
	<p class="lede">
		The whole policy in one breath: your images never leave your device, the analytics cannot
		identify you, and nothing is stored on your machine.
	</p>
	<p class="updated mono">Last updated 13 August 2026</p>
</section>

<section aria-labelledby="who-heading">
	<h2 id="who-heading">Who runs this site</h2>
	<p>
		imagetoolbox.org is a free collection of image tools, run from Norway. For anything about
		privacy, write to <a href="mailto:hello@imagetoolbox.org">hello@imagetoolbox.org</a>.
	</p>
</section>

<section aria-labelledby="images-heading">
	<h2 id="images-heading">Your images</h2>
	<p>
		Every converter and tool on this site runs inside your browser. When you drop a file, it is
		opened and processed by code running on your own device. The file is never sent to our server
		or to anyone else. We cannot see it, copy it or store it, and neither can our hosting
		provider. The downloads are produced on your device too.
	</p>
	<p>
		The only thing our server does with your visit is send you the page itself. This is not a
		promise we have to work to keep. It is how the site is built, and you can confirm it in your
		browser's network tab.
	</p>
</section>

<section aria-labelledby="analytics-heading">
	<h2 id="analytics-heading">Analytics</h2>
	<p>
		We use <a href="https://posthog.com" rel="noopener">PostHog</a>, hosted in the European
		Union, to count visits and see which tools people use. That is how we decide what to improve.
	</p>
	<p>What we can see: which pages are visited, what country visits come from, the browser and
		device type, and the screen size. What we cannot see: who you are.</p>
	<p>How it stays anonymous:</p>
	<ul class="steps">
		<li>
			No cookies and no storage. The analytics code is configured to never write anything to
			your device, not even in local storage.
		</li>
		<li>
			No profiles. We have turned person profiles off entirely, and we never use any feature
			that could identify a visitor.
		</li>
		<li>
			To count unique visitors without cookies, PostHog's servers briefly turn your IP address
			and browser information into a salted hash. The raw IP address is discarded right away,
			and the salt rotates, so the hash cannot be traced back to you.
		</li>
	</ul>
	<p>
		Because of this setup, the analytics data cannot be linked to you as a person. It is also why
		this site has no cookie banner: there is nothing on your device to ask consent for.
	</p>
</section>

<section aria-labelledby="cookies-heading">
	<h2 id="cookies-heading">Cookies and local storage</h2>
	<p>
		This site sets no cookies and writes nothing to local storage or session storage. If you ever
		find one anyway, it is a bug. Tell us and we will remove it.
	</p>
</section>

<section aria-labelledby="logs-heading">
	<h2 id="logs-heading">Server logs</h2>
	<p>
		Like almost every web server, ours may keep short-lived technical logs of requests, which can
		include IP addresses. They exist for security and to keep the service running. They are not
		used for analytics or marketing, and they are deleted routinely.
	</p>
</section>

<section aria-labelledby="thirdparty-heading">
	<h2 id="thirdparty-heading">Third parties</h2>
	<p>
		PostHog processes the anonymous statistics described above, on servers in the European Union.
		Our hosting provider serves the website files. No images, names, email addresses or accounts
		are shared with anyone, because we never have them in the first place.
	</p>
</section>

<section aria-labelledby="rights-heading">
	<h2 id="rights-heading">Your rights</h2>
	<p>
		Under the GDPR you have the right to see, correct, delete and export personal data about you.
		Because this site does not collect data that identifies you, there is usually nothing we can
		link to you at all (GDPR article 11). If you believe we hold personal data about you, write
		to <a href="mailto:hello@imagetoolbox.org">hello@imagetoolbox.org</a> and we will look into
		it. You can also complain to your local data protection authority. In Norway that is
		Datatilsynet.
	</p>
</section>

<section aria-labelledby="children-heading">
	<h2 id="children-heading">Children</h2>
	<p>
		The site is not aimed at children. Since no personal data is collected from anyone, none is
		collected from children either.
	</p>
</section>

<section aria-labelledby="changes-heading">
	<h2 id="changes-heading">Changes to this policy</h2>
	<p>
		If the way the site handles data changes, this page and its date change with it.
	</p>
	<p>See also the <a href="/terms">terms of service</a>.</p>
</section>

<style>
	.updated {
		margin: 0.75rem 0 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
