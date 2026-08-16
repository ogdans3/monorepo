<script lang="ts">
	import { frontPaths, sidePaths } from '$lib/anatomy/silhouette';
	import { VIEW_H, VIEW_W } from '$lib/anatomy/proportions';

	const views = [
		{ label: 'male front', paths: frontPaths('male') },
		{ label: 'female front', paths: frontPaths('female') },
		{ label: 'male side', paths: sidePaths('male') },
		{ label: 'female side', paths: sidePaths('female') }
	];
</script>

<div class="row">
	{#each views as v (v.label)}
		<figure>
			<svg viewBox="0 0 {VIEW_W} {VIEW_H}" width="180" aria-hidden="true">
				<!-- Filled with the plate colour and stacked, so each shape hides the
				     lines behind it. Head and neck first, then the torso over the
				     neck join, then the arms over the shoulders. -->
				<g fill="var(--plate)" stroke="var(--anatomy)" stroke-width="1.6" stroke-linejoin="round">
					<path d={v.paths.headNeck} />
					<path d={v.paths.body} />
					<path d={v.paths.armLeft} />
					<path d={v.paths.armRight} />
				</g>
			</svg>
			<figcaption class="mono">{v.label}</figcaption>
		</figure>
	{/each}
</div>

<style>
	.row {
		display: flex;
		gap: 1rem;
		padding: 2rem;
		align-items: flex-start;
	}
	figure { margin: 0; text-align: center; }
	figcaption { font-size: 0.75rem; color: var(--muted); }
	svg { background: var(--plate); border-radius: 12px; }
</style>
