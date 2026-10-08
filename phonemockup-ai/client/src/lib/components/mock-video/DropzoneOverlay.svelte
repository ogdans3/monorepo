<script lang="ts">
    import {onMount} from "svelte";
    import {get} from "svelte/store";
    import {videoController} from "$lib/stores/video.svelte";
    import {project} from "$lib/stores/project.svelte";
    import {isScreenMedia} from "$lib/repo/uploadFile.svelte";
    import {toast} from "svelte-sonner";

    let isDragging = $state(false);
    let dragCounter = 0;

    function log(...args: any[]) {
        console.log("[Dropzone]", ...args);
    }

    function onDragEnter(e: DragEvent) {
        log("dragenter", {
            itemsLen: e.dataTransfer?.items?.length,
            filesLen: e.dataTransfer?.files?.length
        });
        if (!e.dataTransfer) return;
        e.preventDefault();
        e.stopPropagation();
        // Only files can be dropped here; don't cover the page for a dragged selection.
        if (!Array.from(e.dataTransfer.types ?? []).includes("Files")) return;

        dragCounter += 1;
        isDragging = true;
    }

    function onDragOver(e: DragEvent) {
        if (!e.dataTransfer) return;
        // Must preventDefault on dragover for drop to fire
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
    }

    function onDragLeave(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = Math.max(0, dragCounter - 1);
        log("dragleave", {dragCounter});
        if (dragCounter === 0) isDragging = false;
    }

    function extractFiles(dt: DataTransfer): File[] {
        const out: File[] = [];
        // Prefer items if present (gives directories etc.), but fall back to files
        if (dt.items && dt.items.length) {
            for (const item of Array.from(dt.items)) {
                if (item.kind === "file") {
                    const f = item.getAsFile();
                    if (f) out.push(f);
                }
            }
            if (out.length) return out;
        }
        return Array.from(dt.files || []);
    }

    async function onDrop(e: DragEvent) {
        log("drop fired");
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        isDragging = false;

        const dt = e.dataTransfer;
        if (!dt) {
            log("no dataTransfer");
            return;
        }

        const files = extractFiles(dt);
        log("dropped files", files.map((f) => ({name: f.name, type: f.type, size: f.size})));

        const acceptable = files.filter(isScreenMedia);
        if (!acceptable.length) {
            log("no acceptable files");
            if (files.length) toast.error("Drop an image or a video to put it on the phone.");
            return;
        }

        const file = acceptable[0];
        try {
            log("setting media source", {name: file.name, type: file.type, size: file.size});
            project.files = [];
            await get(videoController).setMediaSource(file);
            log("done setMediaSource");
        } catch (err) {
            console.error("[Dropzone] setMediaSource error:", err);
        }
    }

    onMount(() => {
        // Use capture + passive:false so preventDefault works even if others listen too
        const opts = {capture: true, passive: false} as AddEventListenerOptions;

        window.addEventListener("dragenter", onDragEnter, opts);
        window.addEventListener("dragover", onDragOver, opts);
        window.addEventListener("dragleave", onDragLeave, opts);
        window.addEventListener("drop", onDrop, opts);

        // Blanket prevent default navigation on document/body as well
        const preventDefaults = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
        };
        document.addEventListener("dragover", preventDefaults, opts);
        document.addEventListener("drop", preventDefaults, opts);

        log("mounted listeners");

        return () => {
            window.removeEventListener("dragenter", onDragEnter, opts);
            window.removeEventListener("dragover", onDragOver, opts);
            window.removeEventListener("dragleave", onDragLeave, opts);
            window.removeEventListener("drop", onDrop, opts);
            document.removeEventListener("dragover", preventDefaults, opts);
            document.removeEventListener("drop", preventDefaults, opts);
            log("unmounted listeners");
        };
    });
</script>

{#if isDragging}
    <!-- shadcn-style overlay -->
    <div class="fixed inset-0 z-[1000] flex items-center justify-center" aria-hidden="true">
        <div class="fixed inset-0 bg-background/80 backdrop-blur-sm"></div>

        <div
                class="relative mx-4 w-[min(640px,92vw)] rounded-xl border bg-background p-6 shadow-lg outline-none
             data-[state=open]:animate-in data-[state=closed]:animate-out
             data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
             data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
                data-state="open"
                role="dialog"
                aria-label="Drop files"
                style="pointer-events: none"
        >
            <div class="rounded-md border-2 border-dashed border-muted-foreground/60 p-8 text-center">
                <div class="text-base font-semibold">Drop image or video to load</div>
                <p class="mt-1 text-sm text-muted-foreground">
                    Accepts image/* and video/* (PNG, JPG, GIF, MP4, WebM, MOV...)
                </p>
            </div>
        </div>
    </div>
{/if}