<!--
	The door for anyone who would rather type than scan: the code on the
	screen, and on to the ballot.
-->
<script lang="ts">
	import { goto } from '$app/navigation';

	let code = $state('');
	let problem = $state('');
	const clean = $derived(code.toUpperCase().replace(/[^0-9A-Z]/g, ''));

	function go(e: SubmitEvent) {
		e.preventDefault();
		if (clean.length === 5) goto(`/stem/${clean}`);
		else problem = clean.length === 0 ? 'Skriv koden som står på skjermen.' : `Koden har fem tegn. Her er det ${clean.length}.`;
	}
</script>

<svelte:head>
	<title>Podium · stem</title>
</svelte:head>

<main class="room door">
	<form onsubmit={go}>
		<label for="code">Koden på skjermen</label>
		<input
			id="code"
			class="figure"
			bind:value={code}
			maxlength="5"
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			inputmode="text"
			placeholder="ABCDE"
			aria-describedby="hint"
			aria-invalid={problem ? 'true' : undefined}
			oninput={() => (problem = '')}
		/>
		<button class="go">Til avstemningen</button>
		<p id="hint" aria-live="polite" class:problem>
			{problem || 'Fem tegn, som på skjermen. Store eller små bokstaver, det er det samme.'}
		</p>
	</form>
	<a class="desk-link" href="/admin">Presentere? Logg inn</a>
</main>

<style>
	.door {
		min-height: 100dvh;
		display: grid;
		grid-template-rows: 1fr auto;
		padding: max(1.5rem, env(safe-area-inset-top)) 1.25rem max(1.5rem, env(safe-area-inset-bottom));
	}

	form {
		align-self: center;
		justify-self: center;
		display: grid;
		gap: 0.9rem;
		width: min(100%, 22rem);
	}

	label {
		font-size: 1.125rem;
		font-weight: 650;
	}

	input {
		width: 100%;
		height: 5rem;
		padding: 0 1rem;
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius);
		background: var(--sunk);
		color: var(--text);
		font-size: 3rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	input::placeholder {
		color: color-mix(in oklab, var(--quiet) 75%, var(--ground));
	}

	input:focus-visible {
		outline: 2px solid var(--text);
		outline-offset: 0;
	}

	.go {
		height: 3.5rem;
		border: 0;
		border-radius: var(--radius);
		background: var(--text);
		color: var(--ground);
		font-size: 1.0625rem;
		font-weight: 650;
	}

	.go:active {
		transform: translateY(0.5px);
	}

	#hint {
		color: var(--quiet);
		font-size: 0.875rem;
	}

	#hint.problem {
		color: var(--alarm-room);
	}

	.desk-link {
		justify-self: center;
		color: var(--quiet);
		font-size: 0.875rem;
	}
</style>
