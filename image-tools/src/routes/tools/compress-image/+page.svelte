<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import CompressEditor from '$lib/ui/tools/CompressEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('compress-image')!;
</script>

<ToolPage {tool}>
	<CompressEditor />
</ToolPage>
