<script lang="ts">
	import { parseRich } from '$lib/flow/richtext';

	let { text = '' }: { text?: string } = $props();

	/**
	 * Runs of consecutive bullets become one list, and everything else is a
	 * paragraph. Reading the lines into blocks first is what lets three bullets
	 * in a row render as a list rather than as three lists of one.
	 */
	type Block =
		| { kind: 'list'; lines: ReturnType<typeof parseRich> }
		| { kind: 'para'; line: ReturnType<typeof parseRich>[number] };

	const blocks = $derived.by(() => {
		const out: Block[] = [];
		for (const line of parseRich(text)) {
			if (line.bullet) {
				const last = out[out.length - 1];
				if (last?.kind === 'list') last.lines.push(line);
				else out.push({ kind: 'list', lines: [line] });
			} else if (line.runs.some((run) => run.text.trim())) {
				out.push({ kind: 'para', line });
			}
		}
		return out;
	});
</script>

<!--
	The same text the shape carries, laid out for reading rather than for fitting
	in a box: the panel is where a paragraph is allowed to be a paragraph.
-->
{#snippet runs(line: ReturnType<typeof parseRich>[number])}
	{#each line.runs as run, i (i)}
		{#if run.bold && run.italic}<strong><em>{run.text}</em></strong>
		{:else if run.bold}<strong>{run.text}</strong>
		{:else if run.italic}<em>{run.text}</em>
		{:else}{run.text}{/if}
	{/each}
{/snippet}

{#each blocks as block, i (i)}
	{#if block.kind === 'list'}
		<ul>
			{#each block.lines as line, j (j)}
				<li>{@render runs(line)}</li>
			{/each}
		</ul>
	{:else}
		<p>{@render runs(block.line)}</p>
	{/if}
{/each}

<style>
	p,
	ul {
		margin: 0 0 0.6em;
	}

	p:last-child,
	ul:last-child {
		margin-bottom: 0;
	}

	ul {
		padding-left: 1.1em;
	}

	li {
		margin-bottom: 0.2em;
	}
</style>
