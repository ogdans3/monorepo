<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import SharpenEditor from '$lib/ui/tools/SharpenEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('sharpen-image')!;
</script>

<ToolPage {tool}>
	<SharpenEditor />
</ToolPage>
