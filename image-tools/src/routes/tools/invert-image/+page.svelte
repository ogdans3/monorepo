<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import InvertEditor from '$lib/ui/tools/InvertEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('invert-image')!;
</script>

<ToolPage {tool}>
	<InvertEditor />
</ToolPage>
