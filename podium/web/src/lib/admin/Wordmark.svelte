<!-- Podium's mark: three counts on a baseline. -->
<script lang="ts">
	let { href }: { href?: string } = $props();
</script>

<svelte:element this={href ? 'a' : 'span'} class="wordmark" {href}>
	<svg viewBox="0 0 20 18" width="20" height="18" aria-hidden="true">
		<rect x="1" y="8" width="4" height="8" fill="currentColor" />
		<rect x="8" y="2" width="4" height="14" fill="currentColor" />
		<rect x="15" y="5" width="4" height="11" fill="currentColor" />
		<rect x="0" y="16.6" width="20" height="1.4" fill="currentColor" />
	</svg>
	<span>Podium</span>
</svelte:element>

<style>
	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		color: var(--text);
		font-size: 1.125rem;
		font-weight: 760;
		font-stretch: 88%;
		letter-spacing: -0.01em;
		text-decoration: none;
	}
</style>
