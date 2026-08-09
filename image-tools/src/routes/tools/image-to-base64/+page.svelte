<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import Base64Editor from '$lib/ui/tools/Base64Editor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('image-to-base64')!;
</script>

<ToolPage {tool}>
	<Base64Editor />
</ToolPage>
