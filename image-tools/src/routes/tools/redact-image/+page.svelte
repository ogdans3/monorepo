<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import RegionEditor from '$lib/ui/tools/RegionEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('redact-image')!;
</script>

<ToolPage {tool}>
	<RegionEditor variant="redact" suffix={tool.suffix} />
</ToolPage>
