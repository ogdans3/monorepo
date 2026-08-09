<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import ImageToPdfEditor from '$lib/ui/tools/ImageToPdfEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('image-to-pdf')!;
</script>

<ToolPage {tool}>
	<ImageToPdfEditor />
</ToolPage>
