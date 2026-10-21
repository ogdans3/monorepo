<script lang="ts">
  import { Upload, Image as ImageIcon, Film } from "@lucide/svelte";
  import { videoController } from "$lib/stores/video.svelte";
  import { project } from "$lib/stores/project.svelte";
  import { isScreenMedia } from "$lib/repo/uploadFile.svelte";
  import { toast } from "svelte-sonner";
  const file = $derived($videoController.currentFile);
  let input: HTMLInputElement;
  function onFileChange(event: Event) {
    const field = event.currentTarget as HTMLInputElement;
    const picked = field.files?.[0];
    field.value = "";
    if (!picked) return;
    // As for a drop: the picker's filter is only a suggestion.
    if (!isScreenMedia(picked)) {
      toast.error("Choose an image or a video to put it on the phone.");
      return;
    }
    project.files = [];
    $videoController.setMediaSource(picked);
  }
</script>

<section class="studio-screen-media" aria-label="Screen media">
  <div class="studio-section-label">
    <span>Your screen</span><span>Image or video</span>
  </div>
  <input
    bind:this={input}
    id="asset-file"
    class="sr-only"
    tabindex="-1"
    type="file"
    accept="image/*,video/*"
    onchange={onFileChange}
    aria-label="Choose an image or video file"
  />
  <button class="studio-upload" onclick={() => input.click()}>
    <span class="studio-upload-icon"><Upload size={18} /></span>
    <span
      ><strong>Upload screen</strong><small>or drop your file anywhere</small
      ></span
    >
    <span class="studio-upload-plus">+</span>
  </button>
  <div class="studio-media-current ph-no-capture">
    {#if $file?.type.startsWith("video/")}<Film size={14} />{:else}<ImageIcon
        size={14}
      />{/if}
    <span title={$file?.name}>{$file?.name ?? "Sample screen"}</span><span
      class="studio-media-dot"
    ></span>
  </div>
</section>
