<script lang="ts">
	import VideoToolPage from '$lib/ui/VideoToolPage.svelte';
	import { videoToolBySlug } from '$lib/video/tools';

	const tool = videoToolBySlug('rotate-video')!;
</script>

<VideoToolPage {tool} />
