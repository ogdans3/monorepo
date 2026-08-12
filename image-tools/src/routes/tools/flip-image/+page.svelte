<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import FlipEditor from '$lib/ui/tools/FlipEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('flip-image')!;
</script>

<ToolPage {tool}>
	<FlipEditor />
</ToolPage>
