<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import FaviconEditor from '$lib/ui/tools/FaviconEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('favicon-generator')!;
</script>

<ToolPage {tool}>
	<FaviconEditor />
</ToolPage>
