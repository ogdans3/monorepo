<script lang="ts">
    import {Label} from "$lib/components/ui/label";
    import {Button} from "$lib/components/ui/button";
    import {Separator} from "$lib/components/ui/separator";
    import {
        Tooltip,
        TooltipContent,
        TooltipProvider,
        TooltipTrigger
    } from "$lib/components/ui/tooltip";
    import {Image as ImageIcon, Video, Download} from "@lucide/svelte";
    import {unfocusElement} from "$lib/components/mock-video/unfocus";
    import {project} from "$lib/stores/project.svelte";

    // Props (Svelte 5)
    let {onDownloadImage, onDownloadVideo} = $props<{
        onDownloadImage: () => void;
        onDownloadVideo: () => void;
    }>();

</script>

<section class="px-2 py-2 space-y-3" aria-label="Export settings">
    <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium">Export</h3>
    </div>

    <!-- Action group -->
    <div class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">Export actions</Label>

        <TooltipProvider>
            <div class="flex flex-col gap-4 justify-start">
                <Button
                        onclick={() => {onDownloadImage(); unfocusElement();}}
                        class="h-8 gap-2"
                        aria-label="Download image"
                >
                    <ImageIcon class="h-4 w-4" aria-hidden="true"/>
                    <span>
                        {#if project.isBulk}
                            Bulk download images
                        {:else}
                            Download as image
                        {/if}
                    </span>
                </Button>

                <Button
                        onclick={() => {onDownloadVideo(); unfocusElement();}}
                        variant="secondary"
                        class="h-8 gap-2"
                        aria-label="Download video"
                >
                    <Video class="h-4 w-4" aria-hidden="true"/>
                    <span>
                        {#if project.isBulk}
                            Bulk download videos
                        {:else}
                            Download as video
                        {/if}
                    </span>
                </Button>

                <!--
                <Button
                        variant="outline"
                        class="h-8 gap-2"
                        disabled
                        aria-label="Batch export (coming soon)"
                >
                    <Download class="h-4 w-4" aria-hidden="true"/>
                    <span>Batch export</span>
                </Button>
                -->
            </div>
        </TooltipProvider>
    </div>
</section>