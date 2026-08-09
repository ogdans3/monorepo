<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} | image→toolbox</title>
</svelte:head>

<section class="hero">
	<h1>{page.status === 404 ? 'No such conversion' : 'Something broke'}</h1>
	<p class="lede">
		{#if page.status === 404}
			That page doesn't exist. Every conversion this site can do is listed on the front page.
		{:else}
			{page.error?.message ?? 'An unexpected error occurred.'}
		{/if}
	</p>
	<p><a href="/">Back to the converter</a></p>
</section>
