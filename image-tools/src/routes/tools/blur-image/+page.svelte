<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import RegionEditor from '$lib/ui/tools/RegionEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('blur-image')!;
</script>

<ToolPage {tool}>
	<RegionEditor variant="blur" suffix={tool.suffix} />
</ToolPage>
