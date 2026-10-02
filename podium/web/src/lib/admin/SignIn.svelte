<script lang="ts">
	import { message } from '$lib/api';
	import { session } from './session.svelte';
	import Wordmark from './Wordmark.svelte';

	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		if (!password) {
			error = 'Skriv inn passordet.';
			return;
		}
		busy = true;
		error = '';
		try {
			await session.signIn(password);
		} catch (err) {
			error = message(err);
			password = '';
		} finally {
			busy = false;
		}
	}
</script>

<main class="desk sign-in">
	<form onsubmit={submit}>
		<Wordmark />
		<label class="field">
			<span>Passord</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="input"
				type="password"
				bind:value={password}
				autocomplete="current-password"
				autofocus
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? 'sign-in-error' : undefined}
			/>
		</label>
		<button class="btn primary" aria-busy={busy}>{busy ? 'Logger inn …' : 'Logg inn'}</button>
		{#if error}<p id="sign-in-error" class="error" role="alert">{error}</p>{/if}
	</form>
</main>

<style>
	.sign-in {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	form {
		display: grid;
		gap: 1.1rem;
		width: min(100%, 20rem);
	}

	form :global(.wordmark) {
		margin-bottom: 1rem;
	}

	.btn {
		height: 2.5rem;
	}

	.input {
		min-height: 2.5rem;
	}

	.error {
		color: var(--alarm);
		font-size: 0.875rem;
	}
</style>
