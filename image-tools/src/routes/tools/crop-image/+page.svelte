<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import CropEditor from '$lib/ui/tools/CropEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('crop-image')!;
</script>

<ToolPage {tool}>
	<CropEditor />
</ToolPage>
