<script lang="ts">
	import { goto } from '$app/navigation';
	import { destinationsFor, toolPath } from '$lib/tools/handoff';
	import { CATEGORIES, toolMatches, type ImageTool } from '$lib/tools/registry';
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

	/**
	 * A dropdown of thirty-five tools is a filing cabinet, and picking the next
	 * step is not filing. Nearly every visitor wants one of the two or three
	 * steps that obviously follow this one, which the registry already names,
	 * so those are buttons you can hit without opening anything. The rest are
	 * one click and a search box away, in the open, rather than behind a
	 * control that hides its own contents until you commit to it.
	 */
	const SHORTCUTS = 3;

	let open = $state(false);
	let query = $state('');
	let busy = $state(false);
	let panel = $state<HTMLDivElement>();

	const all = $derived(destinationsFor({ name, type }, exclude));
	const shortcuts = $derived(all.slice(0, SHORTCUTS));
	const matches = $derived(all.filter((tool) => toolMatches(tool, query)));
	const groups = $derived(
		CATEGORIES.map((category) => ({
			...category,
			tools: matches.filter((tool) => tool.category === category.id)
		})).filter((group) => group.tools.length > 0)
	);

	async function go(tool: ImageTool) {
		busy = true;
		try {
			carry.hand(await produce(), from, toolPath(tool));
			await goto(toolPath(tool));
		} finally {
			busy = false;
			open = false;
		}
	}

	function toggle() {
		open = !open;
		query = '';
		if (open) {
			// The search box is the reason to open it, so put the caret there.
			queueMicrotask(() => panel?.querySelector('input')?.focus());
		}
	}
</script>

{#if all.length > 0}
	<div class="continue">
		<span class="label" id="continue-label">Continue in</span>
		<div class="picks" role="group" aria-labelledby="continue-label">
			{#each shortcuts as tool (tool.slug)}
				<button class="chip" disabled={disabled || busy} onclick={() => go(tool)}>
					{tool.name}
				</button>
			{/each}
			{#if all.length > shortcuts.length}
				<button
					class="chip more"
					aria-expanded={open}
					aria-controls="continue-panel"
					disabled={disabled || busy}
					onclick={toggle}
				>
					{open ? 'Close' : `All ${all.length}`}
				</button>
			{/if}
		</div>

		{#if open}
			<div class="panel" id="continue-panel" bind:this={panel}>
				<label class="visually-hidden" for="continue-search">Search tools</label>
				<input
					id="continue-search"
					type="search"
					placeholder="Search tools"
					autocomplete="off"
					spellcheck="false"
					bind:value={query}
					onkeydown={(e) => {
						if (e.key === 'Escape') toggle();
					}}
				/>
				{#each groups as group (group.id)}
					<div class="group">
						<span class="group-label">{group.label}</span>
						<div class="group-tools">
							{#each group.tools as tool (tool.slug)}
								<button class="chip" disabled={busy} onclick={() => go(tool)}>{tool.name}</button>
							{/each}
						</div>
					</div>
				{:else}
					<p class="empty">Nothing matches that. Try a shorter word.</p>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.continue {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.5rem;
	}

	.label {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.picks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.more {
		font-variant-numeric: tabular-nums;
	}

	/*
	 * In flow rather than floating over the page. A panel that pushes the rest
	 * down cannot be clipped by a parent, needs no stacking order and no
	 * dismiss handling, and this is a single column with room underneath.
	 */
	.panel {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		margin-top: 0.2rem;
		padding: 0.8rem;
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--bg);
		animation: reveal 160ms var(--ease);
	}

	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(-2px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
	}

	.panel input {
		width: 100%;
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		font: inherit;
		font-size: 0.875rem;
		color: var(--ink);
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.group-label {
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.group-tools {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.empty {
		margin: 0;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>
