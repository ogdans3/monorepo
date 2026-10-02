<!-- The desk is behind the password: the sign-in until it is given. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import SignIn from '$lib/admin/SignIn.svelte';
	import { session } from '$lib/admin/session.svelte';

	let { children } = $props();

	onMount(() => {
		session.check();
	});
</script>

{#if session.admin === true}
	{@render children()}
{:else if session.admin === false}
	<SignIn />
{:else}
	<main class="desk" style="min-height: 100dvh" aria-busy="true"></main>
{/if}
