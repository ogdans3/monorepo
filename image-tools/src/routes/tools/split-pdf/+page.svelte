<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PdfSplitEditor from '$lib/ui/tools/pdf/PdfSplitEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('split-pdf')!;
</script>

<ToolPage {tool}>
	<PdfSplitEditor />
</ToolPage>
