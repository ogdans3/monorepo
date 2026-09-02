<script lang="ts">
	import VideoToolPage from '$lib/ui/VideoToolPage.svelte';
	import { videoToolBySlug } from '$lib/video/tools';

	const tool = videoToolBySlug('add-text-to-video')!;
</script>

<VideoToolPage {tool} />
