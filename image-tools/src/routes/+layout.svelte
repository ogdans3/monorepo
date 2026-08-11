<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta property="og:site_name" content="imagetoolbox" />
</svelte:head>

<div class="shell">
	<header>
		<a class="wordmark" href="/">image<span class="arrow">→</span>toolbox</a>
		<nav aria-label="Main">
			<a href="/tools">Tools</a>
			<a href="/#all">All conversions</a>
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
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: 1rem;
		color: var(--ink);
		letter-spacing: -0.01em;
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
