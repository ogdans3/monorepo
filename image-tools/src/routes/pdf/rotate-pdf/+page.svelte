<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PdfRotateEditor from '$lib/ui/tools/pdf/PdfRotateEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('rotate-pdf')!;
</script>

<ToolPage {tool}>
	<PdfRotateEditor />
</ToolPage>
