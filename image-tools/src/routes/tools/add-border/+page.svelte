<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import CanvasFrameEditor from '$lib/ui/tools/CanvasFrameEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('add-border')!;
</script>

<ToolPage {tool}>
	<CanvasFrameEditor variant="border" suffix="-bordered" />
</ToolPage>
