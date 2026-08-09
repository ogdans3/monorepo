<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import TransparentEditor from '$lib/ui/tools/TransparentEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('transparent-background')!;
</script>

<ToolPage {tool}>
	<TransparentEditor />
</ToolPage>
