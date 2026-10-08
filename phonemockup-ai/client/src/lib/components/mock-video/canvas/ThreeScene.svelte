<script lang="ts">
    import {onDestroy, onMount, tick} from "svelte";
    import * as THREE from "three";
    import type {WebGLRenderer} from "three";
    import {
        currentPlayheadTime,
        imageElement,
        videoController as mediaController,
        videoElement
    } from "$lib/stores/video.svelte.js";
    import {get} from "svelte/store";
    import {
        transformControlPosition,
        transformControlRotation
    } from "$lib/stores/transform.svelte.js";
    import type {Model} from "$lib/models/3d-models/3d-models-spec";
    import {ChangeOrigin} from "$lib/components/mock-video/Animation";
    import {browser} from "$app/environment";
    import {Skeleton} from "$lib/components/ui/skeleton/index.js";
    import {AspectRatio} from "$lib/components/ui/aspect-ratio";
    import {toast} from "svelte-sonner";
    import {project} from "$lib/stores/project.svelte";
    import {SceneRenderer} from "$lib/render/scene-renderer";

    /**
     * `passive` is for the export dialog's canvases: no render loop of their
     * own and no pointer controls. The exporter draws every frame itself, and
     * a loop re-drawing the live pose in between could change a frame after
     * it was posed but before it was captured.
     */
    const {background, width, height, resizable, passive = false} = $props();

    let container: HTMLDivElement;
    let scene: SceneRenderer;
    let raf: number | null = null;

    let isLoading = $state(true);

    // Settles once the first phone has loaded and been drawn.
    let settleReady: {resolve: () => void; reject: (e: unknown) => void} | null = null;
    const ready = new Promise<void>((resolve, reject) => {
        settleReady = {resolve, reject};
    });
    ready.catch(() => {});

    /** Resolves when the phone is loaded and drawn; rejects if it failed to load. */
    export function whenReady(): Promise<void> {
        return ready;
    }

    onMount(setup);

    onDestroy(() => {
        if (raf) cancelAnimationFrame(raf);
        if (browser) {
            window.removeEventListener("resize", resizeCanvas);
            window.removeEventListener("resize", handleResize);
        }
        const canvas = scene?.domElement;
        if (canvas?.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }
        teardownCanvasControls();
        detachWindowDragListeners();
        scene?.dispose();
    });

    function setup() {
        isLoading = true;
        scene = new SceneRenderer({
            width,
            height,
            background,
            glassReflections: project.sceneSettings.glassReflections
        });
        container.appendChild(scene.domElement);
        scene.domElement.style.touchAction = "none";
        if (!passive) setupCanvasControls();
        setModel(project.model);
        setupResizing();
        if (!passive) animate();
    }

    $effect(() => {
        if (scene && project.model) {
            setModel(project.model);
        }
    });

    $effect(() => {
        scene?.setGlassReflections(project.sceneSettings.glassReflections);
    });

    $effect(() => {
        if (scene && $videoElement) setMedia({kind: "video", el: $videoElement});
    });

    $effect(() => {
        if (scene && $imageElement) setMedia({kind: "image", el: $imageElement});
    });

    $effect(() => {
        scene?.setBackground(background);
    });

    $effect(() => {
        if (scene && resizable) {
            scene.setTargetSize(width, height);
            resizeCanvas();
        }
    });

    export function setupEnvironment() {
        scene.setupEnvironment();
    }

    export async function loadEnvironmentHDR(url: string) {
        await scene.loadEnvironmentHDR(url);
    }

    export function setViewTransform(
        mode: "filmic" | "standard" = "filmic",
        exposure = 1.0
    ) {
        scene.setViewTransform(mode, exposure);
    }

    export function setModelColor(
        color: THREE.ColorRepresentation,
        opts: { only?: (mesh: THREE.Mesh) => boolean } = {}
    ) {
        scene.setModelColor(color, opts);
    }

    export function setMetallicStrength(mult = 1.8) {
        scene.setMetallicStrength(mult);
    }

    export function setMedia(src: Parameters<SceneRenderer["setMedia"]>[0], link = true) {
        scene.setMedia(src, link);
    }

    function setupResizing() {
        if (resizable) {
            window.addEventListener("resize", handleResize);
            window.addEventListener("resize", resizeCanvas);
        }
        resizeCanvas();
    }

    /** Resizing clears a canvas; one with no loop has to be redrawn by hand. */
    function redrawIfPassive() {
        if (passive && scene?.model) animateControls();
    }

    function animate() {
        // Ask for the next frame first: if drawing this one throws, the loop
        // must survive it, or the canvas freezes until a reload.
        raf = requestAnimationFrame(animate);
        if (!scene?.model) return;
        const controller = get(mediaController);
        if (controller.isPlaying) {
            controller.syncVideo($currentPlayheadTime);
            animateFrame($currentPlayheadTime);
            return;
        }
        // Paused: pose the phone, but only draw when something changed. A
        // full PBR frame every vsync keeps the GPU busy for a still picture.
        scene.setLidAtTime($currentPlayheadTime);
        scene.applyTransform(
            get(transformControlPosition).vector,
            get(transformControlRotation).vector
        );
        if (scene.needsRender) scene.render();
    }

    export function animateControls() {
        if (!scene?.model) {
            console.error("No model found", scene?.model);
            toast.error("No model was loaded, unable to render.");
            return;
        }
        scene.setLidAtTime($currentPlayheadTime);
        scene.applyTransform(
            get(transformControlPosition).vector,
            get(transformControlRotation).vector
        );
        scene.render();
    }

    export function animateFrame(t?: number) {
        if (!scene) return;
        if (scene.model) {
            const time = t ?? $currentPlayheadTime;
            const {pos, rot} = scene.transformAt(project.tracks[0], time);
            transformControlPosition.set({
                vector: pos,
                origin: ChangeOrigin.System
            });
            transformControlRotation.set({
                vector: rot,
                origin: ChangeOrigin.System
            });
            scene.setLidAtTime(time);
            scene.applyTransform(pos, rot);
        }
        scene.render();
    }

    function handleResize() {
        scene.setDisplaySize(
            container.clientWidth,
            container.clientHeight,
            Math.min(window.devicePixelRatio || 1, 2)
        );
        resizeCanvas();
    }

    function resizeCanvas() {
        if (!scene || !container) return;

        const targetAspect = width / height;

        const cw = container.clientWidth;
        const ch = container.clientHeight;

        const pad = 0;
        const availW = Math.max(0, cw - pad);
        const availH = Math.max(0, ch - pad);
        if (availW === 0 || availH === 0) return;

        const availAspect = availW / availH;
        let displayW: number;
        let displayH: number;

        if (availAspect > targetAspect) {
            displayH = availH;
            displayW = Math.round(displayH * targetAspect);
        } else {
            displayW = availW;
            displayH = Math.round(displayW / targetAspect);
        }

        const canvas = scene.domElement;
        canvas.style.width = `${displayW}px`;
        canvas.style.height = `${displayH}px`;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        scene.setDisplaySize(displayW, displayH, dpr);
        redrawIfPassive();
    }

    export async function captureImage(
        type: "image/png" | "image/jpeg" = "image/png",
        quality?: number
    ): Promise<Blob | null> {
        if (!scene) return null;
        scene.renderAtTargetSize();
        const canvas = scene.domElement;

        return await new Promise<Blob | null>((resolve) => {
            if (canvas.toBlob) {
                canvas.toBlob((b) => resolve(b), "image/jpg", quality);
            } else {
                try {
                    const dataUrl = canvas.toDataURL(type, quality);
                    const b64 = dataUrl.split(",")[1] ?? "";
                    const bin = atob(b64);
                    const u8 = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
                    resolve(new Blob([u8], {type}));
                } catch {
                    resolve(null);
                }
            }
        });
    }

    export function getRenderer(): WebGLRenderer {
        return scene.renderer;
    }

    function setModel(config: Model) {
        // A colour change on the phone that's showing redraws at once; only
        // a different phone has a file to wait for.
        const loaded = scene.modelConfig;
        if (!(loaded && loaded.id === config.id && loaded.modelPath === config.modelPath && scene.model)) {
            isLoading = true;
        }
        scene
            .setModel(config)
            .then(async () => {
                await tick();
                await tick();
                animateControls();
                settleReady?.resolve();
                await tick();
                setTimeout(() => {
                    isLoading = false;
                }, 50);
            })
            .catch((err) => {
                console.error("Failed to load model", config.modelPath, err);
                toast.error("No model was loaded, unable to render.");
                settleReady?.reject(err);
                isLoading = false;
            });
    }

    let isPointerDown = false;
    let dragButton: number | null = null;
    let activePointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const ROTATE_SPEED = 0.25;
    const ZOOM_SPEED = 0.005;

    let onPointerDownRef: (e: PointerEvent) => void;
    let onPointerMoveRef: (e: PointerEvent) => void;
    let onPointerUpRef: (e: PointerEvent) => void;
    let onWheelRef: (e: WheelEvent) => void;
    let onContextMenuRef: (e: MouseEvent) => void;
    let onLostPointerCaptureRef: (e: PointerEvent) => void;

    function setupCanvasControls() {
        const canvas = scene.domElement;

        onPointerDownRef = (e: PointerEvent) => {
            e.preventDefault();
            canvas.setPointerCapture?.(e.pointerId);
            isPointerDown = true;
            activePointerId = e.pointerId;
            dragButton = e.button;
            lastX = e.clientX;
            lastY = e.clientY;
            attachWindowDragListeners();
        };

        onPointerMoveRef = (e: PointerEvent) => {
            if (!isPointerDown || e.pointerId !== activePointerId) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;

            if (dragButton === 0) {
                const rot = get(transformControlRotation).vector;
                transformControlRotation.set({
                    vector: {
                        x: rot.x + dy * ROTATE_SPEED,
                        y: rot.y + dx * ROTATE_SPEED,
                        z: rot.z
                    },
                    origin: ChangeOrigin.User
                });
            } else if (dragButton === 2) {
                const pos = get(transformControlPosition).vector;
                const cw = canvas.clientWidth || width;
                const ch = canvas.clientHeight || height;
                transformControlPosition.set({
                    vector: {
                        x: pos.x + dx / cw,
                        y: pos.y - dy / ch,
                        z: pos.z
                    },
                    origin: ChangeOrigin.User
                });
            }
        };

        onPointerUpRef = (e: PointerEvent) => {
            if (e.pointerId !== activePointerId) return;
            endDrag();
        };

        onWheelRef = (e: WheelEvent) => {
            e.preventDefault();
            const pos = get(transformControlPosition).vector;
            transformControlPosition.set({
                vector: {x: pos.x, y: pos.y, z: pos.z - e.deltaY * ZOOM_SPEED},
                origin: ChangeOrigin.User
            });
        };

        onContextMenuRef = (e: MouseEvent) => {
            e.preventDefault();
        };

        onLostPointerCaptureRef = () => {
            endDrag();
        };

        canvas.addEventListener("pointerdown", onPointerDownRef);
        canvas.addEventListener("wheel", onWheelRef, {passive: false});
        canvas.addEventListener("contextmenu", onContextMenuRef);
        canvas.addEventListener(
            "lostpointercapture",
            onLostPointerCaptureRef
        );
    }

    function teardownCanvasControls() {
        const canvas = scene?.domElement;
        if (!canvas) return;
        if (onPointerDownRef)
            canvas.removeEventListener("pointerdown", onPointerDownRef);
        if (onWheelRef) canvas.removeEventListener("wheel", onWheelRef);
        if (onContextMenuRef)
            canvas.removeEventListener("contextmenu", onContextMenuRef);
        if (onLostPointerCaptureRef)
            canvas.removeEventListener(
                "lostpointercapture",
                onLostPointerCaptureRef
            );
    }

    function attachWindowDragListeners() {
        if (browser) {
            window.addEventListener("pointermove", onPointerMoveRef);
            window.addEventListener("pointerup", onPointerUpRef);
            window.addEventListener("pointercancel", onPointerUpRef);
        }
    }

    function detachWindowDragListeners() {
        if (browser) {
            window.removeEventListener("pointermove", onPointerMoveRef);
            window.removeEventListener("pointerup", onPointerUpRef);
            window.removeEventListener("pointercancel", onPointerUpRef);
        }
    }

    function endDrag() {
        const canvas = scene?.domElement;
        if (canvas && activePointerId !== null) {
            try {
                canvas.releasePointerCapture?.(activePointerId);
            } catch {
                // ignore
            }
        }
        isPointerDown = false;
        dragButton = null;
        activePointerId = null;
        detachWindowDragListeners();
    }
</script>

<div
        class="canvas-container relative rounded-lg overflow-hidden"
        class:checkerboard-bg={background?.[3] === 0}
        bind:this={container}
>
    {#if isLoading}
        <div
                class="pointer-events-none absolute left-0 right-0 top-0 bottom-0
      inset-0 z-10 flex items-center justify-center"
        >
            <AspectRatio ratio={width / height}>
                <Skeleton class="bg-neutral-800 h-full w-full rounded-lg"/>
            </AspectRatio>
        </div>
    {/if}
</div>

<style>
    .canvas-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        cursor: grab;
    }

    :global(.canvas-container canvas) {
        border-radius: inherit;
        display: block;
    }

    :global(.checkerboard-bg canvas) {
        background: conic-gradient(
                var(--checker-a) 0 25%,
                var(--checker-b) 0 50%,
                var(--checker-a) 0 75%,
                var(--checker-b) 0
        ) 0 0 / var(--checker-size) var(--checker-size);
    }
</style>
