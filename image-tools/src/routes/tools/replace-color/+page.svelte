<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import ReplaceColorEditor from '$lib/ui/tools/ReplaceColorEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('replace-color')!;
</script>

<ToolPage {tool}>
	<ReplaceColorEditor  />
</ToolPage>
