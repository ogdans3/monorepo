<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PdfMergeEditor from '$lib/ui/tools/pdf/PdfMergeEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('merge-pdf')!;
</script>

<ToolPage {tool}>
	<PdfMergeEditor />
</ToolPage>
