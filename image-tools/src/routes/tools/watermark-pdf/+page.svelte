<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PdfStampEditor from '$lib/ui/tools/pdf/PdfStampEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('watermark-pdf')!;
</script>

<ToolPage {tool}>
	<PdfStampEditor mode="watermark" />
</ToolPage>
