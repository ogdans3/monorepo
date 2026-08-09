<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import WatermarkEditor from '$lib/ui/tools/WatermarkEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('watermark-image')!;
</script>

<ToolPage {tool}>
	<WatermarkEditor />
</ToolPage>
