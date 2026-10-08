<script lang="ts">
    import {onMount} from "svelte";
    import {get} from "svelte/store";
    import TopBar from "$lib/components/mock-video/topbar/Topbar.svelte";
    import Canvas from "$lib/components/mock-video/canvas/Canvas.svelte";
    import Timeline from "$lib/components/mock-video/timeline/Timeline.svelte";
    import {videoController} from "../../stores/video.svelte";
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogDescription,
    } from "$lib/components/ui/dialog";

    import VideoRecorder from "$lib/components/mock-video/recording/VideoRecorder.svelte";
    import animationGroups from "$lib/animations/animations.svelte";
    import type {AnimationGroup} from "$lib/components/mock-video/Animation";
    import DropzoneOverlay from "$lib/components/mock-video/DropzoneOverlay.svelte";
    import {Spinner} from "$lib/components/ui/spinner";
    import {project} from "$lib/stores/project.svelte";
    import Sidebar from "$lib/components/mock-video/sidebar/Sidebar.svelte";
    import {toast} from "svelte-sonner";

    let {animationGroup = undefined, prepare = undefined}: {
        animationGroup?: AnimationGroup;
        /** Runs before the editor's parts mount, to set up the project they show. */
        prepare?: () => void;
    } = $props();
    prepare?.();
    let sceneRef: any = $state();
    let open = $state(false);
    let timeline: Timeline | null;
    let recorderResolve: (() => void) | null = null;
    let autoClose: boolean = $state(false);
    let downloadAsImage: boolean = $state(false);

    // Add ref for sidebar
    let sidebarRef: any = $state(null);

    function downloadImage() {
        downloadAsImage = true;
        openRecorder();
    }

    function downloadVideo() {
        downloadAsImage = false;
        openRecorder();
    }

    function openRecorder() {
        // The export drives the playhead frame by frame; playback would fight it.
        get(videoController).pause();
        open = true;
    }

    function handleFinished() {
        open = false;
        recorderResolve?.();
        recorderResolve = null;
    }

    function openRecorderAndWaitForFinish(): Promise<void> {
        openRecorder();
        return new Promise<void>((resolve) => {
            recorderResolve = resolve;
        });
    }

    function isTextEntry(target: EventTarget | null) {
        const el = target as HTMLElement | null;
        if (!el) return false;
        if (el.isContentEditable) return true;
        if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
        if (el.tagName !== "INPUT") return false;
        const type = (el as HTMLInputElement).type;
        return !["button", "checkbox", "radio", "range", "color", "file", "submit", "reset"].includes(type);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.code !== "Space") return;
        // Typing a space, or anything behind an open dialog, isn't a play/pause.
        if (isTextEntry(e.target)) return;
        if (document.querySelector('[role="dialog"][data-state="open"]')) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        get(videoController).toggle();
    }

    function sleep(ms: number) {
        return new Promise((fulfill, reject) => {
            setTimeout(fulfill, ms);
        })
    }

    async function createMp4ForAnimations() {
        if (!timeline) return;
        autoClose = true;
        let storedProjectName = project.name;
        for (let animationGroup of animationGroups) {
            project.name = animationGroup.name;
            timeline.clear();
            await sleep(50);
            await timeline.chooseAnimation(animationGroup, project.tracks[0].id);
            await sleep(50);
            get(videoController).startTime.set(0);
            get(videoController).setEndTime(animationGroup.animations[animationGroup.animations.length - 1].end + 0.3);
            await sleep(50);
            await openRecorderAndWaitForFinish();
            await sleep(300);
        }
        project.name = storedProjectName;
        autoClose = false;
    }

    // Add function to open export panel
    function handleOpenExportPanel() {
        sidebarRef?.openOnlyExport();
    }

    onMount(() => {
        window.addEventListener("keydown", handleKeydown);
        if (project.settings.autoplay) {
            get(videoController).play();
        }
        const unsubscribeMediaError = get(videoController).mediaError.subscribe((message) => {
            if (message) toast.error(message);
        });
        return () => {
            window.removeEventListener("keydown", handleKeydown);
            unsubscribeMediaError();
            get(videoController).pause();
        };
    });
</script>

<!-- Page: column layout, full viewport height -->
<div class="min-h-dvh h-dvh flex flex-col bg-surface-950 text-surface-50">
    <!-- Topbar -->
    <TopBar onOpenExportPanel={handleOpenExportPanel}/>

    <!-- Middle row: fills remaining height, leaves space for timeline below -->
    <div class="flex flex-row flex-1 min-h-0 min-w-0">
        <!-- Sidebar: fixed width, scrolls if needed -->
        <div class="w-[340px] flex-shrink-0">
            <Sidebar bind:this={sidebarRef} onDownloadImage={downloadImage} onDownloadVideo={downloadVideo}/>
        </div>

        <!-- Canvas area: grows to fill, allow internal overflow if any -->
        <div class="flex-1 flex flex-col justify-center overflow-hidden">
            <Canvas bind:sceneRef/>
        </div>
    </div>

    <!-- Timeline: sits at bottom, controls its own height -->
    <div class="border-t">
        <Timeline bind:this={timeline} createMp4ForAnimations={createMp4ForAnimations} animationGroup={animationGroup}/>
    </div>
</div>

<DropzoneOverlay/>

<Dialog open={open} onOpenChange={(value) => { if (!value) handleFinished(); }}>
    <DialogContent class="w-[95vw] h-[95vh]
      max-w-none max-h-none p-0 overflow-hidden
      rounded-xl bg-background flex flex-col
      sm:max-w-none gap-0 duration-0
    "
                   escapeKeydownBehavior="ignore"
                   interactOutsideBehavior="ignore"
    >
        <DialogHeader class="px-4 py-3 border-b">
            <DialogTitle class="text-base font-semibold leading-6">
                Export video
            </DialogTitle>
            <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                Rendering and encoding your video.
                You can continue to monitor progress here.
            </DialogDescription>
        </DialogHeader>

        <!-- Body fills remaining space -->
        <div class="min-h-0 h-full p-4">
            <VideoRecorder onFinished={handleFinished} autoClose={autoClose} downloadAsImage={downloadAsImage}/>
        </div>
    </DialogContent>
</Dialog>
