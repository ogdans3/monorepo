<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import logo from '$lib/assets/logo.svg';
	import { SITE_URL } from '$lib/site';

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
			<a href="/convert">Conversions</a>
			<a href="/tools">Tools</a>
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

	nav a {
		font-size: 0.875rem;
		color: var(--muted);
	}

	nav a:hover {
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
</style>
