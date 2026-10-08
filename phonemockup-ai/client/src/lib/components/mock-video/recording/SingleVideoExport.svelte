<script lang="ts">
    import {onMount, onDestroy, tick} from "svelte";
    import Canvas from "$lib/components/mock-video/canvas/Canvas.svelte";
    import FrameStepperRecorder, {
        type RecorderCallbacks as NativeRecorderCallbacks,
        UserCancelledRendering,
    } from "$lib/components/mock-video/recording/VideoRecorder";
    import {videoController} from "$lib/stores/video.svelte.js";
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
    import {SingleVideoRecorder} from "$lib/components/mock-video/recording/recorders/SingleVideoRecorder";
    import {saveEditorState} from "$lib/components/mock-video/recording/core/editor-state";

    // Props
    let {onFinished, autoClose} = $props();

    // Scene refs
    let rendererSceneRef: any = $state();
    let previewSceneRef: any = $state();

    let progress = $state(0);
    let inProgress = $state(true);
    let status = $state("Preparing…");
    let failure = $state<string | null>(null);
    let renderPaused: boolean = $state(false);

    let finalBlob: Blob | null = $state(null);
    /** The format finalBlob was made in; the picker may have moved on since. */
    let finalFormat: ExportFormat | null = $state(null);
    let finalUrl: string | null = $state(null);
    let lastDownloadName: string | null = $state(null);

    // A see-through background only survives in some formats, so a scene
    // with one starts on a lossless one that keeps it.
    const transparent = project.sceneSettings.backgroundColor?.[3] === 0;
    let selectedFormat: ExportFormat = $state<ExportFormat>(transparent ? "image-sequence" : "mp4");

    const formatOptions = [
        {value: "image-sequence", label: "Image sequence (ZIP of PNGs)"},
        {value: "mp4", label: "MP4 (H.264)"},
        {value: "webm", label: "WebM (VP9)"},
        {value: "gif", label: "GIF"},
    ] as const;

    let formatTriggerText = $derived(
        formatOptions.find((o) => o.value === selectedFormat)?.label ?? "Format"
    );
    const losesTransparency = $derived(transparent && selectedFormat === "mp4");

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
        return `${base || "recording"}.${ext}`;
    }

    function downloadNameFor(blob: Blob, format: ExportFormat) {
        if (format === "image-sequence") {
            return `${toKebabCase(safeProjectName()) || "recording"}-frames.zip`;
        }
        return filenameFor(extFromBlobType(blob.type));
    }

    function trackDownload(format: ExportFormat) {
        try {
            posthog.capture("export_video", {format});
        } catch {
            // ignore telemetry errors
        }
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
        // Only a recording on screen needs seeking; a picture has no clock.
        getVideoEl: () => (get(videoController).isVideo ? get(videoController).video : null),
        setMediaSource: () => {
        },
        getEndTimeSec: () => project.timeline.endTime ?? 0,
        getPlayheadAnimateFromSec: () => get(get(videoController).playheadAnimateFrom) ?? 0,
    };

    let videoRecorder: SingleVideoRecorder;
    // The editor's pose and playhead, put back once exporting is over.
    const restoreEditor = saveEditorState();

    /** One export at a time: starting another ends the current one first. */
    let run: {abort: AbortController; done: Promise<void>} | null = null;

    onMount(() => {
        // Nothing survives a closed dialog; a leftover recorder is stale.
        if (FrameStepperRecorder.hasInstance()) FrameStepperRecorder.reset();
        videoRecorder = new SingleVideoRecorder(
            scenes,
            videoCtx,
            project.settings.fps,
            selectedFormat,
            {transparent}
        );
        startExport();
    });

    onDestroy(() => {
        run?.abort.abort();
        videoRecorder?.teardown();
        restoreEditor();
        onFinished?.();
    });

    function closeDialog() {
        run?.abort.abort();
        onFinished?.();
    }

    function cancel() {
        closeDialog();
    }

    function toggleRender() {
        if (!videoRecorder) return;
        if (renderPaused) {
            videoRecorder.resume();
        } else {
            videoRecorder.pause();
        }
        renderPaused = !renderPaused;
    }

    async function startExport() {
        const previous = run;
        if (previous) {
            previous.abort.abort();
            videoRecorder.stop();
            await previous.done;
        }

        const abort = new AbortController();
        let finished!: () => void;
        const done = new Promise<void>((resolve) => (finished = resolve));
        run = {abort, done};

        const format = selectedFormat;
        renderPaused = false;
        failure = null;
        finalBlob = null;
        finalFormat = null;
        lastDownloadName = null;
        inProgress = true;
        setProgress(0, "Loading the phone…");

        const callbacks: NativeRecorderCallbacks = {
            onStart: () => setProgress(0, "Initializing…"),
            onProgress: (p, _frame, _total, msg) => setProgress(p, msg),
        };

        try {
            await tick();
            // Frame 0 must not be captured before the phone is in the scene.
            await Promise.all([rendererSceneRef?.whenReady?.(), previewSceneRef?.whenReady?.()]);
            if (abort.signal.aborted) return;

            videoRecorder.setFormat(format);
            const blob = await videoRecorder.recordToBlob(abort.signal, callbacks);
            if (!blob || abort.signal.aborted) return;

            finalBlob = blob;
            finalFormat = format;
            setProgress(100, "Done");
            trackDownload(format);
            lastDownloadName = downloadBlob(blob, downloadNameFor(blob, format));
            if (autoClose) closeDialog();
        } catch (e) {
            if (abort.signal.aborted || e instanceof UserCancelledRendering) return;
            console.error(e);
            failure = e instanceof Error && e.message ? e.message : "Unknown error";
            status = "Failed";
            toast.error("Failed to export video");
        } finally {
            if (run?.abort === abort) {
                run = null;
                inProgress = false;
                restoreEditor();
            }
            finished();
        }
    }
</script>

<div class="flex h-full flex-col gap-4 min-h-0">
    <!-- Controls -->
    <div class="flex gap-2">
        <div class="w-[180px]">
            <Select.Root
                    type="single"
                    name="exportFormat"
                    bind:value={selectedFormat}
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

        <Button onclick={startExport}>{inProgress ? "Restart export" : "Export again"}</Button>

        {#if inProgress}
            <Button variant="outline" onclick={cancel}>Cancel</Button>
        {:else}
            <Button onclick={closeDialog}>Close</Button>
        {/if}
    </div>
    {#if losesTransparency}
        <p class="text-xs text-muted-foreground -mt-2">
            MP4 can't store a transparent background, so it will be black. WebM, GIF and
            the image sequence keep it.
        </p>
    {/if}

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
                                    This may take a moment. Keep this tab open.
                                {:else if failure}
                                    <span class="text-destructive">Export failed: {failure}</span>
                                {:else}
                                    Export finished.
                                {/if}
                            </div>
                        </div>
                        <Button
                                variant="secondary"
                                size="icon"
                                aria-label={renderPaused ? "Resume export" : "Pause export"}
                                onclick={toggleRender}
                                disabled={!inProgress}
                                title={renderPaused ? "Resume export" : "Pause export"}
                        >
                            {#if renderPaused}
                                <Play fill="#ffffff"/>
                            {:else}
                                <Pause fill="#ffffff"/>
                            {/if}
                        </Button>
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
        <!-- The canvases stay mounted for the dialog's life: remounting them
             reloads the phone, and an export would start before it's back. -->
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
                    <CardTitle class="text-sm font-medium">Output</CardTitle>
                    <div class="flex flex-col gap-2">
                        <Button
                                variant="outline"
                                onclick={() => {
                                    if (!finalBlob || !finalFormat) return;
                                    downloadBlob(finalBlob, lastDownloadName ?? downloadNameFor(finalBlob, finalFormat));
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
                    {#if finalFormat === "gif" && finalUrl}
                        <div class="flex min-h-0 flex-1 justify-center overflow-hidden rounded-md">
                            <img class="max-h-full max-w-full object-contain" src={finalUrl} alt="Exported GIF"/>
                        </div>
                    {:else if finalFormat !== "image-sequence" && finalUrl}
                        <div
                                class="flex min-h-0 flex-1 justify-center overflow-hidden rounded-md"
                        >
                            <!-- svelte-ignore a11y_media_has_caption -->
                            <video
                                    class="max-h-full max-w-full"
                                    src={finalUrl}
                                    controls
                                    preload="metadata"
                            ></video>
                        </div>
                    {:else}
                        <div
                                class="flex items-center justify-center p-6 text-sm text-muted-foreground"
                        >
                            Output ready to download.
                        </div>
                    {/if}
                </CardContent>
            </Card>
        {/if}
    </div>
</div>