<script lang="ts">
	import VideoToolPage from '$lib/ui/VideoToolPage.svelte';
	import { videoToolBySlug } from '$lib/video/tools';

	const tool = videoToolBySlug('change-video-frame-rate')!;
</script>

<VideoToolPage {tool} />
