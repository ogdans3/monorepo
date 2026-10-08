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
    import {Download, Play, Pause} from "@lucide/svelte";
    import Rating from "$lib/components/mock-video/recording/Rating.svelte";
    import {project} from "$lib/stores/project.svelte";
    import posthog from "posthog-js";
    import {
        transformControlPosition,
        transformControlRotation,
    } from "$lib/stores/transform.svelte";
    import {ChangeOrigin} from "$lib/components/mock-video/Animation";

    import type {
        ScenePair,
        VideoContext,
    } from "$lib/components/mock-video/recording/core/types";
    import {toKebabCase, extFromBlobType} from "$lib/components/mock-video/recording/util/naming";
    import {downloadBlob} from "$lib/components/mock-video/recording/util/blob";
    import {SingleImageRecorder} from "$lib/components/mock-video/recording/recorders/SingleImageRecorder";
    import {saveEditorState} from "$lib/components/mock-video/recording/core/editor-state";

    let {onFinished, autoClose} = $props();

    let rendererSceneRef: any = $state();
    let previewSceneRef: any = $state();

    let progress = $state(0);
    let inProgress = $state(true);
    let status = $state("Preparing…");
    let renderPaused: boolean = $state(false); // present but disabled

    let abortController: AbortController;
    let finalBlob: Blob | null = $state(null);
    let finalUrl: string | null = $state(null);
    let lastDownloadName: string | null = $state(null);
    const restoreEditor = saveEditorState();

    $effect(() => {
        const blob = finalBlob;
        if (!blob) {
            finalUrl = null;
            return;
        }
        const url = URL.createObjectURL(blob);
        finalUrl = url;
        return () => URL.revokeObjectURL(url);
    });

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

    function filenameFor(ext: string) {
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
        return `${base || "mockup"}.${ext}`;
    }

    function trackDownload() {
        try {
            posthog.capture("export_image", {format: "png"});
        } catch {
            // ignore
        }
    }

    function downloadAndRemember(blob: Blob, name?: string) {
        const dlName = downloadBlob(blob, name);
        lastDownloadName = dlName;
    }

    function getUseLiveControls() {
        return (
            get(transformControlPosition).origin === ChangeOrigin.User ||
            get(transformControlRotation).origin === ChangeOrigin.User
        );
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
        setMediaSource: () => {
        },
        getEndTimeSec: () => project.timeline.endTime ?? 0,
        getPlayheadAnimateFromSec: () => get(get(videoController).playheadAnimateFrom) ?? 0,
    };

    let imageRecorder: SingleImageRecorder;

    onMount(() => {
        abortController = new AbortController();
        imageRecorder = new SingleImageRecorder(scenes, videoCtx);
        exportSingleImage();
    });

    onDestroy(() => {
        if (abortController) abortController.abort();
        restoreEditor();
        onFinished?.();
    });

    function closeDialog() {
        abortController?.abort();
        onFinished?.();
    }

    function cancel() {
        closeDialog();
    }

    async function exportSingleImage() {
        const signal = abortController.signal;
        try {
            inProgress = true;
            finalBlob = null;
            status = "Loading the phone…";
            await tick();
            // Capturing before the phone has loaded gives an empty picture.
            await Promise.all([rendererSceneRef?.whenReady?.(), previewSceneRef?.whenReady?.()]);
            if (signal.aborted) return;
            status = "Capturing frame…";
            setProgress(50);

            const useLiveControls = getUseLiveControls();
            const liveT = get(currentPlayheadTime) ?? 0;
            const plannedT = videoCtx.getPlayheadAnimateFromSec();
            const tSec = useLiveControls ? liveT : plannedT;

            const blob = await imageRecorder.record({
                tSec,
                useLiveControls,
                type: "image/png",
                preDelayMs: 0,
                postDelayMs: 0,
            });
            if (signal.aborted) return;

            if (!blob) throw new Error("Failed to capture image");
            finalBlob = blob;

            trackDownload();
            downloadAndRemember(blob, filenameFor("png"));

            status = "Done";
            setProgress(100);
        } catch (e) {
            if (signal.aborted) return;
            console.error(e);
            toast.error("Failed to export image");
            status = "Failed";
        } finally {
            inProgress = false;
            restoreEditor();
            if (autoClose && !signal.aborted) closeDialog();
        }
    }
</script>

<div class="flex h-full flex-col gap-4 min-h-0">
    <!-- Controls -->
    <div class="flex gap-2">
        <Button onclick={exportSingleImage} disabled={inProgress}>
            Export image
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
                                    Exporting image… Keep this tab open.
                                {:else}
                                    Ready to export image.
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
                    <CardTitle class="text-sm font-medium">Image</CardTitle>
                    <div class="flex flex-col gap-2">
                        <Button
                                variant="outline"
                                onclick={() => {
                                    if (!finalBlob) return;
                                    downloadBlob(finalBlob, lastDownloadName ?? filenameFor("png"));
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
                    {#if finalUrl}
                        <img
                                class="max-h-full max-w-full object-contain rounded-md"
                                src={finalUrl}
                                alt="Exported"
                        />
                    {/if}
                </CardContent>
            </Card>
        {/if}
    </div>
</div>