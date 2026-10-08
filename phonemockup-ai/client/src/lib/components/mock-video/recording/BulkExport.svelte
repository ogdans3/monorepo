<script lang="ts">
    import {onMount, onDestroy, tick} from "svelte";
    import Canvas from "$lib/components/mock-video/canvas/Canvas.svelte";
    import {currentPlayheadTime, videoController} from "$lib/stores/video.svelte.js";
    import {get} from "svelte/store";
    import {toast} from "svelte-sonner";
    import {Button} from "$lib/components/ui/button";
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
    } from "$lib/components/ui/card";
    import {Progress} from "$lib/components/ui/progress";
    import * as Select from "$lib/components/ui/select";
    import {Download, Play, Pause} from "@lucide/svelte";
    import Rating from "$lib/components/mock-video/recording/Rating.svelte";
    import {project} from "$lib/stores/project.svelte";
    import posthog from "posthog-js";

    import type {
        ExportFormat,
        ScenePair,
        VideoContext,
    } from "$lib/components/mock-video/recording/core/types";
    import {
        toKebabCase,
        extFromBlobType,
    } from "$lib/components/mock-video/recording/util/naming";
    import {downloadBlob} from "$lib/components/mock-video/recording/util/blob";
    import {SingleImageRecorder} from "$lib/components/mock-video/recording/recorders/SingleImageRecorder";
    import {SingleVideoRecorder} from "$lib/components/mock-video/recording/recorders/SingleVideoRecorder";
    import {BulkRecorder} from "$lib/components/mock-video/recording/recorders/BulkRecorder";
    import {renderAtTime} from "$lib/components/mock-video/recording/core/settle";
    import type {ProjectFile} from "$lib/components/mock-video/Project";
    import {saveEditorState} from "$lib/components/mock-video/recording/core/editor-state";
    import {UserCancelledRendering} from "$lib/components/mock-video/recording/VideoRecorder";
    import {detectIsImage} from "$lib/repo/uploadFile.svelte";
    import {transformControlPosition, transformControlRotation} from "$lib/stores/transform.svelte";
    import {ChangeOrigin} from "$lib/components/mock-video/Animation";

    let {onFinished, autoClose, downloadAsImage = false} = $props();

    let rendererSceneRef: any = $state();
    let previewSceneRef: any = $state();

    let progress = $state(0);
    let inProgress = $state(true);
    let status = $state("Preparing…");
    let renderPaused: boolean = $state(false); // disabled in bulk

    let abortController: AbortController;
    let finalBlob: Blob | null = $state(null);
    let lastDownloadName: string | null = $state(null);

    // Format select (only when downloadAsImage === false)
    let selectedFormat: ExportFormat = $state<ExportFormat>(
        (project.sceneSettings.backgroundColor?.[3] === 0
            ? "image-sequence"
            : "mp4") as ExportFormat
    );

    const formatOptions = [
        {value: "image-sequence", label: "Image sequence (ZIP of PNGs)"},
        {value: "mp4", label: "MP4 (H.264)"},
        {value: "webm", label: "WebM (VP9)"},
        {value: "gif", label: "GIF"},
    ] as const;

    let formatTriggerText = $derived(
        formatOptions.find((o) => o.value === selectedFormat)?.label ?? "Format"
    );

    const bulkList = $derived((project.files ?? []) as ProjectFile[]);
    const isBulk = $derived(bulkList.length > 0);
    let activeBulkIndex = $state(0);

    function isImageFile(f: File | null | undefined) {
        return !!f && detectIsImage(f);
    }

    function setProgress(p: number, msg?: string) {
        progress = Math.max(0, Math.min(100, Math.round(p)));
        if (msg) status = msg;
    }

    function safeProjectName() {
        try {
            return project.name ?? "recordings";
        } catch {
            return "recordings";
        }
    }

    function trackDownload(format: ExportFormat) {
        try {
            posthog.capture("export_bulk", {format});
        } catch {
            // ignore telemetry errors
        }
    }

    function downloadAndRemember(blob: Blob, name?: string) {
        const dlName = downloadBlob(blob, name);
        lastDownloadName = dlName;
    }

    // Scene + VideoCtx
    const scenes: ScenePair = {
        renderer: {
            animateFrame: (t: number) => rendererSceneRef?.animateFrame?.(t),
            animateControls: () => rendererSceneRef?.animateControls?.(),
            getRenderer: () => rendererSceneRef?.getRenderer?.(),
            captureImage: (type, quality) =>
                rendererSceneRef?.captureImage?.(type, quality),
        },
        preview: {
            animateFrame: (t: number) => previewSceneRef?.animateFrame?.(t),
            animateControls: () => previewSceneRef?.animateControls?.(),
        },
    };

    const videoCtx: VideoContext = {
        getVideoEl: () => (get(videoController).isVideo ? get(videoController).video : null),
        setMediaSource: (file, isImage) =>
            get(videoController).setMediaSource(file, isImage),
        getEndTimeSec: () => project.timeline.endTime ?? 0,
        getPlayheadAnimateFromSec: () =>
            get(get(videoController).playheadAnimateFrom) ?? 0,
    };

    let imageRecorder: SingleImageRecorder;
    let videoRecorder: SingleVideoRecorder;
    const restoreEditor = saveEditorState();
    // The batch swaps each file onto the phone; the editor gets its own back.
    const mediaBefore = get(get(videoController).currentFile);

    function restoreMedia() {
        const controller = get(videoController);
        if (mediaBefore && get(controller.currentFile) !== mediaBefore) {
            controller.setMediaSource(mediaBefore);
        }
    }

    /** Pose as the user left it by hand, as single-image export does. */
    function getUseLiveControls() {
        return (
            get(transformControlPosition).origin === ChangeOrigin.User ||
            get(transformControlRotation).origin === ChangeOrigin.User
        );
    }

    function setActiveBulkSync(i: number) {
        const max = bulkList.length - 1;
        activeBulkIndex = Math.max(0, Math.min(i, max));
        const f = bulkList[activeBulkIndex];
        if (!f) return;
        get(videoController).setMediaSource(f.fileBlob, detectIsImage(f.fileBlob));
    }

    async function setActiveBulk(i: number) {
        if (!isBulk) return;
        setActiveBulkSync(i);
        const tSec = get(currentPlayheadTime) ?? 0;
        await renderAtTime(tSec, scenes, $videoController.video);
    }

    onMount(() => {
        abortController = new AbortController();

        imageRecorder = new SingleImageRecorder(scenes, videoCtx);
        videoRecorder = new SingleVideoRecorder(
            scenes,
            videoCtx,
            project.settings.fps,
            selectedFormat,
            {transparent: project.sceneSettings.backgroundColor?.[3] === 0}
        );

        if (!isBulk) {
            inProgress = false;
            status = "Nothing to export (no files)";
            progress = 0;
            return;
        }

        setActiveBulk(0);
        inProgress = false;
        status = downloadAsImage
            ? "Ready to export images"
            : "Ready for bulk export";
        progress = 0;
        exportAll();
    });

    onDestroy(() => {
        if (abortController) abortController.abort();
        videoRecorder?.teardown();
        restoreEditor();
        restoreMedia();
        onFinished?.();
    });

    function closeDialog() {
        abortController?.abort();
        videoRecorder?.stop();
        onFinished?.();
    }

    function cancel() {
        closeDialog();
    }

    // Bulk export
    async function exportAll() {
        if (!isBulk) return;

        inProgress = true;
        status = downloadAsImage
            ? "Starting image export…"
            : "Starting bulk export…";
        progress = 0;

        const bulk = new BulkRecorder(scenes, videoCtx, imageRecorder, videoRecorder);

        const pad3 = (n: number) => String(n + 1).padStart(3, "0");
        const getFilename = (index: number, ext: string) => {
            let base = "recording";
            try {
                if (project.settings.exportSettings.kebabCase) {
                    base = toKebabCase(project.name);
                } else {
                    base = project.name?.toString?.() || "recording";
                }
            } catch {
                // ignore
            }
            return `${base}-${pad3(index)}.${ext}`;
        };

        const signal = abortController.signal;
        const failedItems: number[] = [];
        try {
            const mode = downloadAsImage ? "image" : "video";

            // Ensure video format is synced before run
            if (!downloadAsImage) {
                videoRecorder.setFormat(selectedFormat);
            }

            // Frame 0 must not be captured before the phone is in the scene.
            await Promise.all([rendererSceneRef?.whenReady?.(), previewSceneRef?.whenReady?.()]);
            if (signal.aborted) return;

            const zipBlob = await bulk.recordAll(bulkList.map(f => f.fileBlob), {
                mode,
                tSec: videoCtx.getPlayheadAnimateFromSec(),
                useLiveControls: downloadAsImage && getUseLiveControls(),
                getFilename,
                abortSignal: signal,
                callbacks: {
                    onStatus: (msg) => (status = msg),
                    onItemProgress: (i, p, msg) => {
                        // Map per-item progress to overall approx progress
                        const per = 1 / bulkList.length;
                        const overall = (i + p / 100) * per * 100;
                        setProgress(overall, msg);
                    },
                    onError: (i, e) => {
                        console.error("Render error on item", i + 1, e);
                        failedItems.push(i + 1);
                    },
                },
            });
            if (signal.aborted) return;

            if (!zipBlob) {
                status = "Failed";
                toast.error("Bulk export failed: none of the files could be exported.");
                return;
            }

            finalBlob = zipBlob;

            const zipName = `${toKebabCase(safeProjectName()) || "mockups"}-${
                downloadAsImage ? "images" : "videos"
            }.zip`;
            trackDownload(selectedFormat);
            downloadAndRemember(zipBlob, zipName);

            if (failedItems.length) {
                status = `Finished; ${failedItems.length} of ${bulkList.length} failed`;
                toast.warning(`${failedItems.length} of ${bulkList.length} files couldn't be exported (file ${failedItems.join(", ")}).`);
            } else {
                status = "Bulk export finished";
            }
            if (autoClose) closeDialog();
        } catch (e) {
            if (signal.aborted || e instanceof UserCancelledRendering) return;
            console.error(e);
            toast.error("Bulk export failed");
            status = "Failed";
        } finally {
            inProgress = false;
            restoreEditor();
            restoreMedia();
        }
    }
</script>

<div class="flex h-full flex-col gap-4 min-h-0">
    <!-- Controls -->
    <div class="flex gap-2">
        {#if !downloadAsImage}
            <div class="w-[180px]">
                <Select.Root
                        type="single"
                        name="exportFormat"
                        bind:value={selectedFormat}
                        disabled={downloadAsImage}
                >
                    <Select.Trigger
                            class="h-8 w-[180px] rounded-md border bg-background px-2.5 text-sm inline-flex items-center justify-between"
                            aria-label="Select output format"
                    >
                        {formatTriggerText}
                    </Select.Trigger>

                    <Select.Content class="min-w-[14rem]">
                        <Select.Group>
                            <Select.Label class="px-2 py-1 text-xs opacity-70">
                                Format
                            </Select.Label>
                            {#each formatOptions as opt (opt.value)}
                                <Select.Item
                                        value={opt.value}
                                        label={opt.label}
                                        class="text-sm px-2 py-1.5"
                                >
                                    {opt.label}
                                </Select.Item>
                            {/each}
                        </Select.Group>
                    </Select.Content>
                </Select.Root>
            </div>
        {/if}

        <div class="w-[260px]">
            <Select.Root
                    type="single"
                    value={String(activeBulkIndex)}
                    onValueChange={(v: string) => {
          const idx = Number(v);
          if (!Number.isNaN(idx)) setActiveBulk(idx);
        }}
                    items={bulkList.map((f, i) => ({ value: String(i), label: f.fileBlob.name }))}
            >
                <Select.Trigger
                        class="h-8 w-[260px] rounded-md border bg-background px-2.5 text-sm inline-flex items-center justify-between overflow-hidden whitespace-nowrap"
                        aria-label="Select file to preview"
                >
                    <span class="truncate">
                        {bulkList[activeBulkIndex]?.fileBlob?.name ?? "Select file"}
                    </span>
                </Select.Trigger>
                <Select.Content class="min-w-[18rem]">
                    <Select.Group>
                        <Select.Label class="px-2 py-1 text-xs opacity-70">
                            File
                        </Select.Label>
                        {#each bulkList as f, i (i)}
                            <Select.Item
                                    value={String(i)}
                                    label={f.fileBlob.name}
                                    title={f.fileBlob.name}
                                    class="text-sm px-2 py-1.5"
                            >
                                <span class="inline-block max-w-full truncate">
                                    {f.fileBlob.name} ({isImageFile(f.fileBlob) ? "image" : "video"})
                                </span>
                            </Select.Item>
                        {/each}
                    </Select.Group>
                </Select.Content>
            </Select.Root>
        </div>

        <Button onclick={exportAll} disabled={inProgress}>
            {downloadAsImage ? "Export all (images)" : "Export all"}
        </Button>

        {#if inProgress}
            <Button variant="outline" onclick={cancel}>Cancel</Button>
        {:else}
            <Button onclick={closeDialog}>Close</Button>
        {/if}
    </div>

    <!-- Main -->
    <div class="flex flex-1 h-full gap-4 max-h-[200px]">
        <div class="flex-1 h-full">
            <Card class="h-full">
                <CardHeader class="space-y-1 py-3">
                    <div class="flex flex-row justify-between">
                        <div>
                            <CardTitle class="text-sm font-medium">Progress</CardTitle>
                            <div class="text-xs text-muted-foreground">
                                {#if inProgress}
                                    {downloadAsImage
                                        ? "Exporting images…"
                                        : "Rendering batch…"} Keep this tab open.
                                {:else}
                                    {downloadAsImage
                                        ? "Image export idle."
                                        : "Bulk idle. Choose Export all."}
                                {/if}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="space-y-3">
                    <div class="flex items-center justify-between text-xs">
                        <span>{Math.round(progress)}%</span>
                        <div class="truncate text-xs text-muted-foreground">{status}</div>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, progress))}/>
                </CardContent>
            </Card>
        </div>

        <div class="flex-1 h-full w-full basis-[340px] max-w-[360px]">
            <Rating/>
        </div>
    </div>

    <div class="flex-1 h-full min-h-0">
        <!-- Mounted once for the dialog's life; see SingleVideoExport. -->
        <div class="h-full min-h-0" class:hidden={!inProgress && !!finalBlob}>
            <Card class="flex h-full min-h-0">
                <CardHeader
                        class="flex flex-row items-center justify-between space-y-0 border-b py-3"
                >
                    <CardTitle class="text-sm font-medium">Preview</CardTitle>
                    <span class="text-xs text-muted-foreground">
                        {#if inProgress}Working… {Math.round(progress)}%{:else}Idle{/if}
                    </span>
                </CardHeader>
                <CardContent class="p-0 h-full min-h-0">
                    <div class="flex h-full items-center justify-center bg-muted/30">
                        <div class="w-full max-w-full h-full">
                            <Canvas passive bind:sceneRef={previewSceneRef}/>
                            <Canvas
                                    passive
                                    resizable={false}
                                    bind:sceneRef={rendererSceneRef}
                                    class="absolute -top-200vh -left-200vw hidden"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
        {#if !inProgress && finalBlob}
            <Card class="flex h-full min-h-0">
                <CardHeader
                        class="flex flex-row items-center space-y-0 border-b py-3 justify-between"
                >
                    <CardTitle class="text-sm font-medium">
                        {downloadAsImage
                            ? "Bulk Output (ZIP of images)"
                            : "Bulk Output (ZIP)"}
                    </CardTitle>
                    <div class="flex flex-col gap-2">
                        <Button
                                variant="outline"
                                onclick={() => {
                                    if (!finalBlob) return;
                                    const zipName = `${toKebabCase(safeProjectName()) || "mockups"}-${
                                        downloadAsImage ? "images" : "videos"
                                    }.zip`;
                                    downloadBlob(finalBlob, lastDownloadName ?? zipName);
                                }}
                        >
                            <Download class="mr-2 h-4 w-4"/>
                            Download
                        </Button>
                        <span class="text-xs text-muted-foreground">
                            Click if it didn't download automatically
                        </span>
                    </div>
                </CardHeader>

                <CardContent
                        class="flex min-h-0 flex-1 flex-col gap-4 p-0 overflow-hidden"
                >
                    <div class="flex items-center justify-center p-6 text-sm text-muted-foreground">
                        Output ready to download.
                    </div>
                </CardContent>
            </Card>
        {/if}
    </div>
</div>