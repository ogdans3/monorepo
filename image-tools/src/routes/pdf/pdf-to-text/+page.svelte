<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PdfTextEditor from '$lib/ui/tools/pdf/PdfTextEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('pdf-to-text')!;
</script>

<ToolPage {tool}>
	<PdfTextEditor />
</ToolPage>
