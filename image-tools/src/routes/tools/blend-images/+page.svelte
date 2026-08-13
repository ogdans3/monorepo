<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import BlendEditor from '$lib/ui/tools/BlendEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('blend-images')!;
</script>

<ToolPage {tool}>
	<BlendEditor  />
</ToolPage>
