<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import ResizeEditor from '$lib/ui/tools/ResizeEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('resize-image')!;
</script>

<ToolPage {tool}>
	<ResizeEditor />
</ToolPage>
