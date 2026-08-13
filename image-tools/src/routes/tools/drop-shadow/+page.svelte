<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import CanvasFrameEditor from '$lib/ui/tools/CanvasFrameEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('drop-shadow')!;
</script>

<ToolPage {tool}>
	<CanvasFrameEditor variant="shadow" suffix="-shadow" />
</ToolPage>
