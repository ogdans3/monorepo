<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PdfOrganiseEditor from '$lib/ui/tools/pdf/PdfOrganiseEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('organise-pdf')!;
</script>

<ToolPage {tool}>
	<PdfOrganiseEditor />
</ToolPage>
