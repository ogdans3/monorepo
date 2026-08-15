<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import logo from '$lib/assets/logo.svg';
	import { OPERATOR_LINE, SITE_URL } from '$lib/site';
	import { browser } from '$app/environment';

	// Anonymous, cookieless analytics. Nothing is stored on the device and no
	// person profiles are built, which is exactly why no consent banner is
	// needed. NEVER call posthog.identify() or alias(), and never loosen
	// cookieless_mode or person_profiles: that would reintroduce personal
	// data and break the legal basis for running without a banner.
	// Localhost is skipped so dev and test runs stay out of the numbers.
	//
	// Imported lazily and started when the browser is idle. A static import
	// puts ~55KB of analytics in the layout chunk, which every page waits for
	// before the tools become usable. Measuring beats guessing: that was the
	// single biggest thing on the critical path. The cost is that visits
	// shorter than the idle timeout go uncounted, which is a fine trade.

	/**
	 * Do Not Track and Global Privacy Control, honoured by simply not starting.
	 *
	 * PostHog has a respect_dnt option and it does not do this job here. With
	 * cookieless_mode on 'always' the SDK already considers every visitor
	 * opted out, and it captures anyway, because in its model cookieless
	 * capture is what an opted-out visitor gets. Verified in a browser: with
	 * DNT on it still posted an event. So the check belongs here, before the
	 * library is even loaded, where it is ours and it is testable.
	 *
	 * We cannot remember an opt-out any other way. Storing one would need
	 * exactly the device storage the privacy policy promises not to use.
	 */
	const objects =
		browser &&
		(navigator.doNotTrack === '1' ||
			navigator.doNotTrack === 'yes' ||
			(window as { doNotTrack?: string }).doNotTrack === '1' ||
			(navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

	if (browser && !objects && !['localhost', '127.0.0.1'].includes(location.hostname)) {
		const startAnalytics = () =>
			import('posthog-js')
				.then(({ default: posthog }) => {
					posthog.init('phc_rk387TLQFj72Q9Cv8JV2vsLka62yWC5zkZW8iEFt6VKk', {
						// Our own /t path reverse-proxies PostHog, so content
						// blockers cannot drop the requests. Built from the current
						// origin rather than hardcoded, so it works on every domain
						// the site is served from.
						api_host: `${location.origin}/t`,
						ui_host: 'https://eu.posthog.com',
						defaults: '2026-05-30',
						cookieless_mode: 'always',
						person_profiles: 'never'
					});
				})
				.catch(() => {
					/* analytics is never worth breaking a page over */
				});

		if ('requestIdleCallback' in window) {
			requestIdleCallback(startAnalytics, { timeout: 2000 });
		} else {
			setTimeout(startAnalytics, 1200);
		}
	}

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="/favicon.ico" sizes="48x48" />
	<link rel="icon" href={favicon} type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<meta property="og:site_name" content="imagetoolbox" />
	<meta property="og:image" content="{SITE_URL}/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="shell">
	<header>
		<a class="wordmark" href="/">
			<img class="mark" src={logo} alt="" width="22" height="22" />
			<span>image<span class="arrow">→</span>toolbox</span>
		</a>
		<nav aria-label="Main">
			<a href="/convert">Convert</a>
			<a href="/tools">Tools</a>
			<a href="/pdf">PDF</a>
				<a href="/video">Video</a>
			<a href="/make">Sizes</a>
		</nav>
	</header>

	<main>
		{@render children()}
	</main>

	<footer>
		<p class="footer-brand">image<span class="arrow">→</span>toolbox</p>
		<p>
			Free to use, with no account and no limits. Everything runs in your browser, and your
			files never leave your device.
		</p>
		<p class="footer-operator">{OPERATOR_LINE}</p>
		<p class="footer-links">
			<a href="/privacy">Privacy</a>
			<a href="/terms">Terms</a>
		</p>
	</footer>
</div>

<style>
	.shell {
		max-width: 42rem;
		margin: 0 auto;
		padding: 0 1.25rem;
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
		padding: 1.1rem 0;
		border-bottom: 1px solid var(--line);
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.1rem;
	}

	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1rem;
		color: var(--ink);
		letter-spacing: -0.01em;
	}

	.mark {
		display: block;
	}

	.wordmark:hover {
		text-decoration: none;
		color: var(--primary-deep);
	}

	/* the nav sat in muted grey, which read as small print rather than as
	   somewhere to go. Ink is legible, olive on hover says it is a link. */
	nav a {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--ink);
	}

	nav a:hover,
	nav a:focus-visible {
		color: var(--primary);
	}

	main {
		flex: 1;
	}

	footer {
		margin-top: 3.5rem;
		padding: 1.4rem 0 1.75rem;
		border-top: 1px solid var(--line);
	}

	footer p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.footer-brand {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--ink);
		margin-bottom: 0.3rem;
	}

	/* Who is behind a site that asks you to trust it with your files. Small,
	   but present without having to open the privacy policy to find it. */
	.footer-operator {
		margin-top: 0.6rem;
	}

	.footer-links {
		margin-top: 0.5rem;
		display: flex;
		gap: 1.25rem;
	}

	.footer-links a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: oklch(0.545 0.1 112 / 0.45);
		text-underline-offset: 3px;
	}

	.footer-links a:hover,
	.footer-links a:focus-visible {
		color: var(--primary-deep);
		text-decoration-color: var(--primary);
	}
</style>
