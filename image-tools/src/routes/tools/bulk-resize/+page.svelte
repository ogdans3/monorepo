<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import BulkResizeEditor from '$lib/ui/tools/BulkResizeEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('bulk-resize')!;
</script>

<ToolPage {tool}>
	<BulkResizeEditor />
</ToolPage>
