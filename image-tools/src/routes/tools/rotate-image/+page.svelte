<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import RotateEditor from '$lib/ui/tools/RotateEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('rotate-image')!;
</script>

<ToolPage {tool}>
	<RotateEditor />
</ToolPage>
