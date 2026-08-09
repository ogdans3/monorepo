<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import AdjustEditor from '$lib/ui/tools/AdjustEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('adjust-image')!;
</script>

<ToolPage {tool}>
	<AdjustEditor />
</ToolPage>
