<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import ImageToPdfEditor from '$lib/ui/tools/ImageToPdfEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('png-to-pdf')!;
</script>

<ToolPage {tool}>
	<ImageToPdfEditor accept=".png,image/png" initialPageMode="a4" />
</ToolPage>
