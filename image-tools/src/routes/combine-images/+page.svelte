<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import CombineEditor from '$lib/ui/tools/CombineEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('combine-images')!;
</script>

<ToolPage {tool}>
	<CombineEditor />
</ToolPage>
