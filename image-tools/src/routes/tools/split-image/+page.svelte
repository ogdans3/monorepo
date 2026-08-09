<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import SplitEditor from '$lib/ui/tools/SplitEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('split-image')!;
</script>

<ToolPage {tool}>
	<SplitEditor />
</ToolPage>
