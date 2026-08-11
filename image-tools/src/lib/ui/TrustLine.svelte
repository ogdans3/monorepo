<!-- The four promises, shown under every hero: free, local, no account, no limits. -->
<ul class="trust" aria-label="Good to know">
	<li>Free</li>
	<li>Runs on your device</li>
	<li>No account</li>
	<li>No limits</li>
</ul>

<style>
	.trust {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.5rem;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.trust li::before {
		content: '✓';
		font-family: var(--font-mono);
		color: var(--primary);
		margin-right: 0.4rem;
	}
</style>
