<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import AddTextEditor from '$lib/ui/tools/AddTextEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('add-text-to-image')!;
</script>

<ToolPage {tool}>
	<AddTextEditor  />
</ToolPage>
