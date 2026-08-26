<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import DrawEditor from '$lib/ui/tools/DrawEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('draw-on-image')!;
</script>

<ToolPage {tool}>
	<DrawEditor suffix={tool.suffix} />
</ToolPage>
