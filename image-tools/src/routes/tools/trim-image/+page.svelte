<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import TrimEditor from '$lib/ui/tools/TrimEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('trim-image')!;
</script>

<ToolPage {tool}>
	<TrimEditor  />
</ToolPage>
