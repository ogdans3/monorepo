<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import RoundCornersEditor from '$lib/ui/tools/RoundCornersEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('round-corners')!;
</script>

<ToolPage {tool}>
	<RoundCornersEditor />
</ToolPage>
