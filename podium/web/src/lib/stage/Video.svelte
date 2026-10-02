<!--
	A video on a slide. On the display it plays as the presenter set it, and
	a click on it starts or stops it; anywhere else it is a still of its first
	frame. A browser that will not play sound before a click plays it muted.
-->
<script lang="ts">
	import type { SlideElement } from '$lib/types';

	let { el, live }: { el: SlideElement; live: boolean } = $props();

	let video: HTMLVideoElement | undefined = $state();

	$effect(() => {
		if (!video) return;
		video.muted = !live || !!el.muted;
		if (live && el.autoplay) {
			video.play().catch(() => {
				if (!video) return;
				video.muted = true;
				video.play().catch(() => {});
			});
		}
	});

	function toggle() {
		if (!live || !video) return;
		if (video.paused) video.play().catch(() => {});
		else video.pause();
	}
</script>

<!-- svelte-ignore a11y_media_has_caption -->
<video
	bind:this={video}
	src={live ? `/media/${el.media}` : `/media/${el.media}#t=0.1`}
	style:object-fit={el.fit ?? 'contain'}
	playsinline
	loop={!!el.loop}
	preload={live ? 'auto' : 'metadata'}
	onclick={toggle}
></video>

<style>
	video {
		width: 100%;
		height: 100%;
	}
</style>
