<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import HistogramEditor from '$lib/ui/tools/HistogramEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('image-histogram')!;
</script>

<ToolPage {tool}>
	<HistogramEditor  />
</ToolPage>
