<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<a class="hopp" href="#innhold">Hopp til innholdet</a>

<div class="skall">
	<main id="innhold">
		{@render children()}
	</main>

	<footer>
		<p>
			Laget fordi statsbudsjettet er offentlig og likevel utilgjengelig. Alle tall er merket
			med hvor de kommer fra.
		</p>
	</footer>
</div>

<style>
	.hopp {
		position: absolute;
		left: -9999px;
		top: 0;
		background: var(--bg);
		color: var(--ink);
		padding: var(--space-2) var(--space-3);
		z-index: var(--z-overlay);
	}

	.hopp:focus {
		left: var(--space-3);
		top: var(--space-3);
	}

	.skall {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	main {
		flex: 1;
	}

	footer {
		margin-top: var(--space-6);
		padding: var(--space-4) var(--space-3) var(--space-5);
		border-top: 1px solid var(--line);
	}

	footer p {
		max-width: var(--measure);
		margin-inline: auto;
		color: var(--muted);
		font-size: var(--t-s);
	}
</style>
