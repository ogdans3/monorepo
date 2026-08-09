<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import ColorPickerEditor from '$lib/ui/tools/ColorPickerEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('image-color-picker')!;
</script>

<ToolPage {tool}>
	<ColorPickerEditor />
</ToolPage>
