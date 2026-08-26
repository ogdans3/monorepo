<script lang="ts">
	import { goto } from '$app/navigation';
	import { destinationsFor, groupDestinations, toolPath } from '$lib/tools/handoff';
	import { carry } from './carry.svelte';

	let {
		produce,
		from,
		name,
		type,
		exclude,
		disabled = false
	}: {
		/** The finished result, encoded exactly as its Download button would. */
		produce: () => File | Promise<File>;
		/** Where it came from, for the line the next tool shows. */
		from: string;
		/** Name and type of the result, which decide where it can usefully go. */
		name: string;
		type: string;
		/** Slug of the tool offering this, so it does not offer itself. */
		exclude?: string;
		disabled?: boolean;
	} = $props();

	let busy = $state(false);
	const groups = $derived(groupDestinations(destinationsFor({ name, type }, exclude)));

	/**
	 * Hands the result to another tool without it touching the disk. What gets
	 * carried is the same file the Download button produces, so a chain of tools
	 * and a chain of download-then-upload end at identical bytes.
	 */
	async function choose(event: Event & { currentTarget: HTMLSelectElement }) {
		const to = event.currentTarget.value;
		event.currentTarget.value = '';
		if (!to) return;
		busy = true;
		try {
			carry.hand(await produce(), from, to);
			await goto(to);
		} finally {
			busy = false;
		}
	}
</script>

{#if groups.length > 0}
	<select
		class="continue"
		aria-label="Continue with {name} in another tool"
		disabled={disabled || busy}
		onchange={choose}
	>
		<option value="">Continue in…</option>
		{#each groups as group (group.label)}
			<optgroup label={group.label}>
				{#each group.tools as tool (tool.slug)}
					<option value={toolPath(tool)}>{tool.name}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
{/if}

<style>
	.continue {
		padding: 0.35rem 0.5rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: var(--bg);
		color: var(--ink);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.continue:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
