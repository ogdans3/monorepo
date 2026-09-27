<script lang="ts">
	import ToolPage from '$lib/ui/tools/ToolPage.svelte';
	import PhoneFrameEditor from '$lib/ui/tools/PhoneFrameEditor.svelte';
	import { toolBySlug } from '$lib/tools/registry';

	const tool = toolBySlug('phone-frame')!;
</script>

<ToolPage {tool}>
	<PhoneFrameEditor />
</ToolPage>
