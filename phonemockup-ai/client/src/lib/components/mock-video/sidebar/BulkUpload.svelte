<script lang="ts">
    import {Label} from "$lib/components/ui/label";
    import {Button} from "$lib/components/ui/button";
    import {TooltipProvider} from "$lib/components/ui/tooltip";
    import {Image as ImageIcon, Video} from "@lucide/svelte";
    import {project} from "$lib/stores/project.svelte";
    import * as Select from "$lib/components/ui/select/index.js";
    import {unfocusElement} from "$lib/components/mock-video/unfocus";
    import {detectIsImage} from "$lib/repo/uploadFile.svelte";
    import type {ProjectFile} from "$lib/components/mock-video/Project";
    import {v4 as uuid} from 'uuid';
    import {videoController} from "$lib/stores/video.svelte";
    import {get} from "svelte/store";

    let imageInputEl: HTMLInputElement | null = null;
    let videoInputEl: HTMLInputElement | null = null;
    let selectedIndex = $state(-1);

    // Sync selection when files change
    $effect(() => {
        if (project.files.length === 0) {
            selectedIndex = -1;
        } else if (selectedIndex < 0) {
            selectedIndex = 0;
            applySelection();
        } else if (selectedIndex >= project.files.length) {
            selectedIndex = project.files.length - 1;
            applySelection();
        }
    });

    function openImagePicker() {
        imageInputEl?.click();
    }

    function openVideoPicker() {
        videoInputEl?.click();
    }

    function createProjectFiles(files: File[]): ProjectFile[] {
        return files.map(file => ({
            id: uuid(),
            projectId: project.id,
            fileName: file.name,
            fileType: detectIsImage(file) ? 'image' : 'video',
            fileBlob: file,
            sizeBytes: file.size,
            storageProvider: "local",
        }));
    }

    function handleImagesSelected(e: Event) {
        unfocusElement();
        const target = e.target as HTMLInputElement;
        const picked = target.files ? Array.from(target.files) : [];
        if (picked.length) {
            const newFiles = createProjectFiles(picked);
            project.files = [...project.files, ...newFiles];
            if (selectedIndex < 0) {
                selectedIndex = 0;
                applySelection();
            }
        }
        if (target) target.value = "";
    }

    function handleVideosSelected(e: Event) {
        const target = e.target as HTMLInputElement;
        const picked = target.files ? Array.from(target.files) : [];
        if (picked.length) {
            const newFiles = createProjectFiles(picked);
            project.files = [...project.files, ...newFiles];
            if (selectedIndex < 0) {
                selectedIndex = 0;
                applySelection();
            }
        }
        if (target) target.value = "";
    }

    function applySelection() {
        if (selectedIndex < 0 || selectedIndex >= project.files.length) return;
        const file = project.files[selectedIndex];
        const isImage = detectIsImage(file.fileBlob);
        get(videoController).setMediaSource(file.fileBlob, isImage);
    }

    function onSelectChange(idx: string) {
        const index = parseInt(idx);
        if (!Number.isNaN(index)) {
            selectedIndex = index;
            applySelection();
        }
        unfocusElement();
    }

    function clearAll() {
        project.files = [];
        selectedIndex = -1;
        get(videoController).setMediaSource(null, false);
        unfocusElement();
    }
</script>

<section class="px-2 py-2 space-y-3" aria-label="Bulk upload">
    <div class="flex items-center gap-2">
        <h3 class="text-sm font-medium">Bulk upload</h3>
    </div>

    <div class="grid gap-1.5">
        <Label class="text-xs text-muted-foreground">Bulk import</Label>

        <TooltipProvider>
            <div class="flex flex-col gap-4 justify-start">
                <input
                        bind:this={imageInputEl}
                        type="file"
                        multiple
                        accept="image/*"
                        class="sr-only"
                        aria-hidden="true"
                        onchange={handleImagesSelected}
                />

                <input
                        bind:this={videoInputEl}
                        type="file"
                        multiple
                        accept="video/*"
                        class="sr-only"
                        aria-hidden="true"
                        onchange={handleVideosSelected}
                />

                <div class="flex flex-col gap-3">
                    <Button
                            onclick={openImagePicker}
                            class="h-8 gap-2"
                            aria-label="Bulk image upload"
                    >
                        <ImageIcon class="h-4 w-4" aria-hidden="true"/>
                        <span>Bulk image upload</span>
                    </Button>

                    <Button
                            onclick={openVideoPicker}
                            variant="secondary"
                            class="h-8 gap-2"
                            aria-label="Bulk video upload"
                    >
                        <Video class="h-4 w-4" aria-hidden="true"/>
                        <span>Bulk video upload</span>
                    </Button>
                </div>

                <div class="flex items-center justify-between w-full">
                    <span class="text-xs text-muted-foreground truncate max-w-[70%]">
                        {project.files.length} file{project.files.length === 1 ? "" : "s"} selected
                    </span>
                    <Button
                            variant="ghost"
                            class="h-8"
                            aria-label="Clear all files"
                            onclick={clearAll}
                            disabled={project.files.length === 0}
                    >
                        Clear
                    </Button>
                </div>

                <div class="grid gap-1 w-full">
                    <Label for="media-select" class="text-xs text-muted-foreground">
                        Active file
                    </Label>

                    <Select.Root
                            type="single"
                            value={selectedIndex >= 0 ? String(selectedIndex) : ""}
                            disabled={project.files.length === 0}
                            onValueChange={onSelectChange}
                            items={project.files.map((f, i) => ({ value: String(i), label: f.fileBlob.name }))}
                            allowDeselect={false}
                    >
                        <Select.Trigger
                                id="media-select"
                                class="h-8 w-full max-w-full overflow-hidden whitespace-nowrap text-ellipsis rounded border px-2 text-sm bg-background"
                                aria-label="Active file"
                        >
                            <span class="block w-full truncate">
                                {#if selectedIndex >= 0 && project.files[selectedIndex]}
                                    {project.files[selectedIndex].fileBlob.name}
                                    ({detectIsImage(project.files[selectedIndex].fileBlob) ? "image" : "video"})
                                {:else}
                                    No files
                                {/if}
                            </span>
                        </Select.Trigger>

                        <Select.Content
                                class="focus-override border-muted bg-background shadow-popover z-50 max-h-[var(--bits-select-content-available-height)] w-[var(--bits-select-anchor-width)] min-w-[var(--bits-select-anchor-width)] select-none rounded-xl border p-1"
                                sideOffset={8}
                        >
                            {#each project.files as f, i (i)}
                                <Select.Item
                                        value={String(i)}
                                        label={f.fileBlob.name}
                                        title={f.fileBlob.name}
                                        class="rounded-button data-highlighted:bg-muted outline-hidden flex h-9 w-full select-none items-center px-3 text-sm"
                                >
                                    {#snippet children({selected})}
                                        <span class="inline-block max-w-full truncate">
                                            {f.fileBlob.name} ({detectIsImage(f.fileBlob) ? "image" : "video"})
                                        </span>
                                        {#if selected}
                                            <span class="ml-auto text-muted-foreground text-xs">✓</span>
                                        {/if}
                                    {/snippet}
                                </Select.Item>
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
            </div>
        </TooltipProvider>
    </div>
</section>