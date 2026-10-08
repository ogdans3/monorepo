/**
 * Headless render harness.
 *
 * Bundled to a single IIFE and injected into headless Chromium by the MCP
 * server. It drives the same `SceneRenderer` the editor uses, so a mockup
 * rendered here matches what a user sees on phonemockup.app.
 *
 * Everything is fetched over normal URLs against a synthetic origin; the MCP
 * intercepts those requests and answers them from disk, so no HTTP server is
 * involved.
 */
import {SceneRenderer} from "./scene-renderer";
import {models, getModel} from "$lib/models/3d-models/3d-models-spec";
import type {Model} from "$lib/models/3d-models/3d-models-spec";
import animationGroups from "$lib/animations/animations.svelte";
import type {AnimationGroup} from "$lib/components/mock-video/Animation";
import type {Track} from "$lib/components/mock-video/Project";
import type {RGBA} from "$lib/models/models";

export type InitOptions = {
    modelId: string;
    width: number;
    height: number;
    background: RGBA;
    glassReflections: boolean;
    /** Overrides the model's own case colour when set. */
    caseColor?: string | null;
    /** Turn off MSAA to trade edge quality for speed. */
    antialias?: boolean;
    showCameraIsland?: boolean;
    lidAngle?: number;
    lidOpenDuration?: number;
};

let renderer: SceneRenderer | null = null;
let mediaCanvas: HTMLCanvasElement | null = null;
let mediaCtx: CanvasRenderingContext2D | null = null;

function requireRenderer(): SceneRenderer {
    if (!renderer) throw new Error("Harness not initialised — call init() first");
    return renderer;
}

/** Model and animation metadata, so the MCP never has to parse the app's JSON. */
function catalog() {
    return {
        models: models.map((m) => ({
            id: m.id,
            name: m.name,
            modelPath: m.modelPath,
            caseColor: m.caseColor,
            supportsCameraIsland: !!m.cameraIsland,
            showCameraIsland: m.cameraIsland ? m.showCameraIsland !== false : undefined
        })),
        animations: (animationGroups as AnimationGroup[]).map((g) => ({
            id: g.id,
            name: g.name,
            categories: g.categories ?? [],
            priority: g.priority,
            /** Longest `end` across the group — its natural duration in seconds. */
            duration: g.animations.reduce((max, a) => Math.max(max, a.end), 0)
        }))
    };
}

function findModel(id: string): Model {
    const model = getModel(id);
    if (!model) {
        throw new Error(
            `Unknown model "${id}". Available: ${models.map((m) => m.id).join(", ")}`
        );
    }
    return model;
}

function findAnimationGroup(id: string): AnimationGroup {
    const group = (animationGroups as AnimationGroup[]).find((g) => g.id === id);
    if (!group) {
        throw new Error(
            `Unknown animation "${id}". Available: ` +
            (animationGroups as AnimationGroup[]).map((g) => g.id).join(", ")
        );
    }
    return group;
}

/** Build the single track the scene animates, from an animation group id. */
function trackFor(animationId: string): Track {
    const group = findAnimationGroup(animationId);
    return {
        id: group.id,
        phoneName: "phone",
        animations: group.animations
    };
}

async function init(opts: InitOptions) {
    renderer?.dispose();

    const canvas = document.createElement("canvas");
    canvas.id = "mockup-canvas";
    document.body.replaceChildren(canvas);

    renderer = new SceneRenderer({
        canvas,
        width: opts.width,
        height: opts.height,
        background: opts.background,
        glassReflections: opts.glassReflections,
        antialias: opts.antialias ?? true
    });
    // Headless output is measured in real pixels; never scale by DPR.
    renderer.renderer.setPixelRatio(1);

    const model = findModel(opts.modelId);
    // setModel paints the case colour on load, when there is one.
    await renderer.setModel(
        {...model,
            ...(opts.caseColor === undefined ? {} : {caseColor: opts.caseColor}),
            ...(opts.showCameraIsland === undefined ? {} : {showCameraIsland: opts.showCameraIsland}),
            ...(opts.lidAngle === undefined ? {} : {lidAngle: opts.lidAngle}),
            ...(opts.lidOpenDuration === undefined ? {} : {lidOpenDuration: opts.lidOpenDuration})}
    );
}

/**
 * Point the phone's screen at an offscreen canvas we own. Every frame is then
 * a draw into that canvas plus a texture invalidation, rather than a fresh
 * texture and a material relink per frame.
 */
async function setScreenSource(url: string) {
    const r = requireRenderer();
    const img = await loadImage(url);

    mediaCanvas = document.createElement("canvas");
    mediaCanvas.width = img.naturalWidth;
    mediaCanvas.height = img.naturalHeight;
    mediaCtx = mediaCanvas.getContext("2d");
    mediaCtx?.drawImage(img, 0, 0);

    r.setMedia({kind: "image", el: mediaCanvas});
}

/** Swap in the next screen frame without rebuilding the texture. */
async function setScreenFrame(url: string) {
    const r = requireRenderer();
    if (!mediaCanvas || !mediaCtx) {
        await setScreenSource(url);
        return;
    }
    const img = await loadImage(url);
    mediaCtx.clearRect(0, 0, mediaCanvas.width, mediaCanvas.height);
    mediaCtx.drawImage(img, 0, 0, mediaCanvas.width, mediaCanvas.height);
    r.markMediaDirty();
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
}

/** Render one frame of an animation and hand back the pixels as a data URL. */
function renderFrame(animationId: string, time: number, mimeType = "image/png", quality?: number) {
    const r = requireRenderer();
    r.renderAt(trackFor(animationId), time);
    return r.renderer.domElement.toDataURL(mimeType, quality);
}

/** Render a static pose with no animation applied. */
function renderStill(mimeType = "image/png", quality?: number) {
    const r = requireRenderer();
    r.applyTransform({x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 0});
    r.render();
    return r.renderer.domElement.toDataURL(mimeType, quality);
}

function dispose() {
    renderer?.dispose();
    renderer = null;
    mediaCanvas = null;
    mediaCtx = null;
}

const harness = {
    catalog,
    init,
    setScreenSource,
    setScreenFrame,
    renderFrame,
    renderStill,
    dispose
};

declare global {
    interface Window {
        mockupHarness: typeof harness;
    }
}

window.mockupHarness = harness;

export default harness;
