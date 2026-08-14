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
	<p class="updated mono">Last updated 14 August 2026</p>
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
	<p>How it works:</p>
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
			To count visitors without cookies, PostHog's servers combine your IP address, your
			browser information and a secret value into a hash, and store only that hash. The secret
			value changes every day and is deleted once the day's data has been processed, so the
			hash cannot be turned back into your IP address.
		</li>
	</ul>
	<p>
		We would rather describe the limits of this than oversell it. Within a single day the visits
		from one browser share one hash, so they can be counted together, and the next day the hash
		is different. Two people behind the same connection using the same browser version produce
		the same hash and are counted as one. The result is a number of visits, not a person we
		could pick out or contact.
	</p>
	<p>
		This is also why the site has no cookie banner. The rule that requires one is about storing
		or reading things on your device, and we do neither.
	</p>
</section>

<section aria-labelledby="basis-heading">
	<h2 id="basis-heading">Why we are allowed to do this</h2>
	<p>
		Your IP address is personal data, and it is used as an input to the hash described above,
		even though it is not kept. Our lawful basis for that is legitimate interest, under article
		6(1)(f) of the GDPR: we need a rough idea of which tools people use in order to decide what
		to build and to keep the site running. We have kept that interest as small as it can be by
		collecting no profiles, storing nothing on your device, and keeping nothing that can be
		traced back to you.
	</p>
	<p>
		Because we store nothing on your device, we have no way to remember that you asked to be
		left out. So we honour your browser instead. If you turn on Do Not Track, or your browser
		sends a Global Privacy Control signal, no analytics event is sent at all. Content blockers
		also work, and we do not try to defeat them.
	</p>
</section>

<section aria-labelledby="retention-heading">
	<h2 id="retention-heading">How long anything is kept</h2>
	<p>
		The daily secret used for the hash is deleted by PostHog once that day's data has been
		processed. The visit statistics themselves are kept for as long as they are useful for
		deciding what to work on, and they contain no identifier that survives the day they were
		recorded. Server logs are covered below.
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
		PostHog processes the visit statistics described above on our behalf, on servers in the
		European Union, under a data processing agreement. Our hosting provider serves the website
		files. No images, names, email addresses or accounts are shared with anyone, because we
		never have them in the first place.
	</p>
</section>

<section aria-labelledby="rights-heading">
	<h2 id="rights-heading">Your rights</h2>
	<p>
		Under the GDPR you have the right to see, correct, delete and export personal data about you,
		and to object to processing based on legitimate interest. Because we keep nothing that
		identifies you, we cannot find your data even if you ask us to, since we would have no way
		to tell which record was yours (GDPR article 11). That is a real limit on these rights and
		it is a deliberate one: the reason we cannot hand your data over is that we never held it.
		To object to the analytics, use the browser setting described above, which takes effect
		immediately and needs no request to us.
	</p>
	<p>
		If you believe we hold personal data about you, write to
		<a href="mailto:hello@imagetoolbox.org">hello@imagetoolbox.org</a> and we will look into it.
		You can also complain to your local data protection authority. In Norway that is
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
