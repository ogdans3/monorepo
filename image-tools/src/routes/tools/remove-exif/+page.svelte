<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import ExifEditor from '$lib/ui/tools/ExifEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('remove-exif')!;
</script>

<ToolPage {tool}>
	<ExifEditor />
</ToolPage>
