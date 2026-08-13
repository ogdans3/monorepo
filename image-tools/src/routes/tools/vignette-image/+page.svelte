<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import FilterEditor from '$lib/ui/tools/FilterEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('vignette-image')!;
</script>

<ToolPage {tool}>
	<FilterEditor variant="vignette" suffix="-vignette" />
</ToolPage>
