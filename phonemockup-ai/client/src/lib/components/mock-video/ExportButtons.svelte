<script lang="ts">
    import {Button} from "$lib/components/ui/button";
    import {CameraIcon, VideoIcon} from "@lucide/svelte";

    let {
        onDownloadImage,
        onDownloadVideo
    }: {
        onDownloadImage: () => void;
        onDownloadVideo: () => void;
    } = $props();
</script>

<div class="grid grid-cols-2 gap-2">
    <Button
            class="gap-2"
            onclick={onDownloadImage}
            aria-label="Download image"
            title="Download image"
    >
        <CameraIcon class="h-4 w-4"/>
        <span>Image</span>
    </Button>

    <Button
            variant="secondary"
            class="gap-2"
            onclick={onDownloadVideo}
            aria-label="Download video"
            title="Download video"
    >
        <VideoIcon class="h-4 w-4"/>
        <span>Video</span>
    </Button>
</div>