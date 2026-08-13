<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PdfSelectEditor from '$lib/ui/tools/pdf/PdfSelectEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('extract-pdf-pages')!;
</script>

<ToolPage {tool}>
	<PdfSelectEditor mode="keep" suffix="-pages" />
</ToolPage>
