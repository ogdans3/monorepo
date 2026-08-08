<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<header>
		<a class="wordmark" href="/">image<span class="arrow">→</span>tools</a>
		<nav>
			<a href="/#all">All conversions</a>
		</nav>
	</header>

	<main>
		{@render children()}
	</main>

	<footer>
		<p>
			Everything runs in your browser — your files never leave your device. No uploads, no
			accounts, no tracking.
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
		padding: 1.1rem 0;
		border-bottom: 1px solid var(--line);
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
		margin-top: 3rem;
		padding: 1.25rem 0 1.5rem;
		border-top: 1px solid var(--line);
	}

	footer p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}
</style>
