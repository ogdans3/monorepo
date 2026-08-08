<script lang="ts">
	import { formatBytes } from '$lib/engine';
	import type { Job } from './converter.svelte';

	let {
		job,
		onremove,
		onretry
	}: {
		job: Job;
		onremove: () => void;
		onretry: () => void;
	} = $props();

	const savings = $derived(
		job.result ? Math.round((1 - job.result.blob.size / job.file.size) * 100) : 0
	);
</script>

<li class="row">
	<span class="thumb checker">
		{#if job.url}
			<img src={job.url} alt="" />
		{/if}
	</span>

	<div class="row-main">
		<span class="row-name" title={job.file.name}>
			{job.status === 'done' && job.result ? job.result.name : job.file.name}
		</span>
		{#if job.status === 'done' && job.result}
			<span class="row-meta">
				{formatBytes(job.file.size)} <span class="arrow">→</span> {formatBytes(job.result.blob.size)}
				{#if savings > 0}<span class="pill">−{savings}%</span>{/if}
				<span class="dim">· {job.result.width} × {job.result.height} px</span>
			</span>
		{:else if job.status === 'error'}
			<span class="row-meta error">{job.error}</span>
		{:else}
			<span class="row-meta">{formatBytes(job.file.size)}</span>
		{/if}
	</div>

	<div class="row-actions">
		{#if job.status === 'done' && job.url && job.result}
			<a class="btn" href={job.url} download={job.result.name}>Download</a>
		{:else if job.status === 'error'}
			<button class="btn-ghost" onclick={onretry}>Retry</button>
		{:else}
			<span class="spinner" role="status" aria-label="Converting {job.file.name}"></span>
		{/if}
		<button class="remove" onclick={onremove} aria-label="Remove {job.file.name}">×</button>
	</div>
</li>

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem 0.9rem;
		padding: 0.7rem 0;
		border-bottom: 1px solid var(--line);
		animation: row-in 200ms var(--ease);
	}

	@keyframes row-in {
		from {
			opacity: 0;
			translate: 0 4px;
		}
	}

	.thumb {
		flex: none;
		width: 56px;
		height: 56px;
		border-radius: var(--r-s);
		border: 1px solid var(--line);
		overflow: hidden;
		display: grid;
		place-items: center;
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.row-main {
		/* the 11rem basis pushes the actions onto their own line on phones */
		flex: 1 1 11rem;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.row-name {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-meta {
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.row-meta.error {
		color: var(--danger);
		font-family: var(--font-ui);
	}

	.dim {
		opacity: 0.75;
	}

	.pill {
		display: inline-block;
		margin: 0 0.15rem;
		padding: 0.05rem 0.4rem;
		border-radius: 99px;
		background: oklch(0.4 0.11 78 / 0.12);
		color: var(--accent);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.row-actions {
		flex: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--line);
		border-top-color: var(--primary);
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	.remove {
		width: 1.75rem;
		height: 1.75rem;
		border: 0;
		background: none;
		border-radius: var(--r-s);
		color: var(--muted);
		font-size: 1.1rem;
		line-height: 1;
		cursor: pointer;
	}

	.remove:hover {
		background: var(--surface-deep);
		color: var(--ink);
	}

	@media (max-width: 480px) {
		.row-actions .btn {
			padding: 0.45rem 0.6rem;
		}
	}
</style>
