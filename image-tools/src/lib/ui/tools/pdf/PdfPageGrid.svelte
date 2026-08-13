<script lang="ts">
	import type { PdfPage } from '$lib/tools/pdf';

	let {
		pages,
		selected = new Set<number>(),
		rotation = {},
		order,
		onToggle,
		onMove,
		onDrop,
		label
	}: {
		pages: PdfPage[];
		/** Page numbers currently picked, when the tool selects pages. */
		selected?: Set<number>;
		/** Extra turns to show per page number, for the rotate tool. */
		rotation?: Record<number, number>;
		/** Page numbers in display order, for the organise tool. */
		order?: number[];
		onToggle?: (n: number) => void;
		onMove?: (index: number, dir: -1 | 1) => void;
		onDrop?: (n: number) => void;
		label: string;
	} = $props();

	const shown = $derived(
		(order ?? pages.map((p) => p.n))
			.map((n) => pages.find((p) => p.n === n))
			.filter((p): p is PdfPage => Boolean(p))
	);
</script>

<ul class="grid" aria-label={label}>
	{#each shown as page, index (page.n)}
		{@const isSelected = selected.has(page.n)}
		<li class="cell" class:selected={isSelected}>
			{#if onToggle}
				<button
					class="thumb-button"
					aria-pressed={isSelected}
					aria-label="Page {page.n}"
					onclick={() => onToggle?.(page.n)}
				>
					<img src={page.url} alt="" style:rotate="{(rotation[page.n] ?? 0) * 90}deg" />
				</button>
			{:else}
				<span class="thumb-button static">
					<img src={page.url} alt="Page {page.n}" style:rotate="{(rotation[page.n] ?? 0) * 90}deg" />
				</span>
			{/if}

			<div class="foot">
				<span class="num mono">{index + 1}{order && order[index] !== index + 1 ? '' : ''}</span>
				{#if onMove}
					<span class="moves">
						<button
							class="cell-btn"
							aria-label="Move page {page.n} earlier"
							disabled={index === 0}
							onclick={() => onMove?.(index, -1)}>↑</button
						>
						<button
							class="cell-btn"
							aria-label="Move page {page.n} later"
							disabled={index === shown.length - 1}
							onclick={() => onMove?.(index, 1)}>↓</button
						>
					</span>
				{/if}
				{#if onDrop}
					<button class="cell-btn" aria-label="Remove page {page.n}" onclick={() => onDrop?.(page.n)}
						>×</button
					>
				{/if}
			</div>
		</li>
	{/each}
</ul>

<style>
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.8rem;
	}

	.cell {
		border: 1px solid var(--line);
		border-radius: var(--r-m);
		background: var(--surface);
		overflow: hidden;
		transition: border-color 150ms var(--ease);
	}

	.cell.selected {
		border-color: var(--primary);
		box-shadow: inset 0 0 0 1px var(--primary);
	}

	.thumb-button {
		display: grid;
		place-items: center;
		width: 100%;
		padding: 0.5rem;
		border: 0;
		background: #fff;
		cursor: pointer;
	}

	.thumb-button.static {
		cursor: default;
	}

	.thumb-button img {
		max-width: 100%;
		height: auto;
		display: block;
		box-shadow: 0 1px 3px oklch(0.24 0.015 110 / 0.18);
	}

	.foot {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.45rem;
		border-top: 1px solid var(--line);
	}

	.num {
		font-size: 0.75rem;
		color: var(--muted);
		margin-right: auto;
	}

	.moves {
		display: flex;
		gap: 2px;
	}

	.cell-btn {
		width: 22px;
		height: 22px;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--r-s);
		background: none;
		color: var(--ink);
		font-size: 0.75rem;
		line-height: 1;
		cursor: pointer;
	}

	.cell-btn:hover:not(:disabled) {
		border-color: var(--muted);
	}

	.cell-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>
