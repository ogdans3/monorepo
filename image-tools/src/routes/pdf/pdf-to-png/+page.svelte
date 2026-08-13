<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PdfToImageEditor from '$lib/ui/tools/PdfToImageEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('pdf-to-png')!;
</script>

<ToolPage {tool}>
	<PdfToImageEditor initialFormat="png" />
</ToolPage>
