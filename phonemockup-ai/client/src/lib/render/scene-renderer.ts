/**
 * Framework-agnostic three.js scene for phone mockups.
 *
 * This holds everything that actually produces a rendered frame: renderer
 * setup, lighting, environment, GLB loading, media texture linking and the
 * transform math. It knows nothing about Svelte, stores or the DOM layout.
 *
 * Two consumers:
 *  - `ThreeScene.svelte` — the in-browser editor, which adds DOM sizing,
 *    pointer controls and store wiring on top.
 *  - `headless-harness.ts` — the bundle the MCP runs inside headless Chromium.
 */
import {lidAngleAt} from "./lid-motion";
import * as THREE from "three";
import {PerspectiveCamera, Scene, WebGLRenderer} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {RectAreaLightUniformsLib} from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import {RoomEnvironment} from "three/examples/jsm/environments/RoomEnvironment.js";
import {RGBELoader} from "three/examples/jsm/loaders/RGBELoader.js";
import type {Layer, Model} from "$lib/models/3d-models/3d-models-spec";
import type {RGBA} from "$lib/models/models";
import type {Vec3} from "$lib/components/mock-video/Animation";
import type {Track} from "$lib/components/mock-video/Project";
import {getInterpolatedTransform} from "$lib/components/mock-video/canvas/3dModelUtil.svelte";

export type MediaSource =
    | {kind: "video"; el: HTMLVideoElement}
    | {
    kind: "image";
    el: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap;
};

export type SceneRendererOptions = {
    width: number;
    height: number;
    background: RGBA;
    glassReflections?: boolean;
    /** Existing canvas to render into. One is created when omitted. */
    canvas?: HTMLCanvasElement;
    /**
     * Maps a model's `modelPath` to something GLTFLoader can fetch. The editor
     * serves GLBs over HTTP so the default is identity; the headless harness
     * hands back a `blob:` URL for bytes the MCP injected.
     */
    resolveModelUrl?: (modelPath: string) => string;
    /**
     * MSAA on the default framebuffer. Free on a GPU, but a large share of the
     * frame cost under software rasterisation, which is what headless
     * rendering falls back to.
     */
    antialias?: boolean;
};

const deg2rad = (d: number) => (d * Math.PI) / 180;

/**
 * How far from the camera the premade animations expect the phone to rest.
 * The iPhone models sit here (`z: -1` against a camera at `z: 3`), and the
 * presets' z keyframes were written against them.
 */
const REFERENCE_DISTANCE = 4;

export class SceneRenderer {
    readonly scene: Scene;
    readonly camera: PerspectiveCamera;
    readonly renderer: WebGLRenderer;

    /**
     * A pivot group holding the loaded GLB, centred on its bounding box, so
     * every transform moves and turns the phone about its own middle whatever
     * origin the file was exported with.
     */
    model: THREE.Object3D | null = null;
    modelConfig: Model | null = null;

    /** Where the phone's centre rests, taken from the model config's defaults. */
    basePos: Vec3 = {x: 0, y: 0, z: 0};
    baseRot: Vec3 = {x: 0, y: 0, z: 0};

    /**
     * World units per unit of z in a keyframe. Models are different sizes and
     * rest at different distances, so a raw world-space z would zoom a small
     * phone parked near the camera straight through it. Scaling z by the rest
     * distance makes the same keyframe zoom every model by the same factor.
     */
    private zScale = 1;
    private lastLidTime = 0;

    private width: number;
    private height: number;
    private background: RGBA;
    private glassReflections: boolean;
    private readonly resolveModelUrl: (modelPath: string) => string;

    private mediaTexture: THREE.Texture | null = null;
    private envRT: THREE.WebGLRenderTarget | null = null;
    private pmremGen: THREE.PMREMGenerator | null = null;

    /**
     * Whether the last drawn frame is out of date. Everything that changes
     * what a frame looks like sets it, and render() clears it, so a caller
     * can draw only when something moved (see `needsRender`).
     */
    private dirty = true;
    private renderedMediaVersion = -1;
    private stopWatchingMedia: (() => void) | null = null;
    private lastPose: number[] = [];

    /** The last model asked for; a load that finishes after another request is dropped. */
    private requestedModel: Model | null = null;
    private pendingLoad: {config: Model; promise: Promise<void>} | null = null;

    private readonly _tmpWorld = new THREE.Vector3();

    constructor(opts: SceneRendererOptions) {
        this.width = opts.width;
        this.height = opts.height;
        this.background = opts.background;
        this.glassReflections = opts.glassReflections ?? false;
        this.resolveModelUrl = opts.resolveModelUrl ?? ((p) => p);

        this.scene = new THREE.Scene();

        // The near plane is close because the Pixel models rest 0.2 units from
        // the camera; zooming in on them must not cut through the phone.
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.01, 100);
        this.camera.position.set(0, 0, 3);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas: opts.canvas,
            antialias: opts.antialias ?? true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(this.width, this.height);

        // Match Blender Filmic more closely
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Physically based lighting
        if ("useLegacyLights" in this.renderer) {
            // @ts-ignore
            this.renderer.useLegacyLights = false;
        } else {
            // @ts-ignore
            this.renderer.physicallyCorrectLights = true;
        }

        if ("outputColorSpace" in this.renderer) {
            // @ts-ignore
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        } else {
            // @ts-ignore
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        }

        this.setBackground(this.background);
        this.setupEnvironment();
        this.setupLights();
    }

    get domElement(): HTMLCanvasElement {
        return this.renderer.domElement;
    }

    /* ------------------------------------------------------------------ */
    /* Sizing                                                              */
    /* ------------------------------------------------------------------ */

    /** The logical output resolution, i.e. what an export is measured in. */
    setTargetSize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.dirty = true;
    }

    /**
     * Resize the drawing buffer for on-screen display without touching the
     * logical target size. Only the editor needs this; exports always render
     * at the target size.
     */
    setDisplaySize(displayWidth: number, displayHeight: number, pixelRatio: number) {
        this.camera.aspect = displayWidth / displayHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(displayWidth, displayHeight, false);
        this.dirty = true;
    }

    setBackground(background: RGBA) {
        this.background = background;
        const [r, g, b, a] = background;
        // The channels are sRGB, as picked in a colour input. Color(r, g, b)
        // would read them as linear and the output would come out lighter.
        const color = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
        this.renderer.setClearColor(color, a);
        this.dirty = true;
    }

    /* ------------------------------------------------------------------ */
    /* Environment and lighting                                            */
    /* ------------------------------------------------------------------ */

    setupEnvironment() {
        this.envRT?.dispose();
        this.pmremGen?.dispose?.();
        this.pmremGen = new THREE.PMREMGenerator(this.renderer);
        const room = new RoomEnvironment();
        this.envRT = this.pmremGen.fromScene(room, 0.04);
        this.scene.environment = this.envRT.texture;
        this.dirty = true;
    }

    /** Load the same HDR used in Blender to match lighting exactly. */
    async loadEnvironmentHDR(url: string) {
        this.envRT?.dispose();
        this.pmremGen?.dispose?.();
        this.pmremGen = new THREE.PMREMGenerator(this.renderer);
        const hdr = await new RGBELoader().loadAsync(url);
        const env = this.pmremGen.fromEquirectangular(hdr);
        hdr.dispose();
        this.envRT = env;
        this.scene.environment = this.envRT.texture;
        this.dirty = true;
    }

    /** Switch between Filmic and Standard, with exposure control. */
    setViewTransform(mode: "filmic" | "standard" = "filmic", exposure = 1.0) {
        if (mode === "filmic") {
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = exposure;
        } else {
            this.renderer.toneMapping = THREE.NoToneMapping;
            this.renderer.toneMappingExposure = exposure;
        }
        this.render();
    }

    private setupLights() {
        RectAreaLightUniformsLib.init();

        // Keep ambient low; rely on IBL + area lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        this.scene.add(ambientLight);

        // Rectangular keys to shape highlights
        const keyLight = new THREE.RectAreaLight(0xffffff, 2.2, 2, 0.5);
        keyLight.position.set(1.2, 0.8, 2.2);
        keyLight.lookAt(0, 0, 0);
        this.scene.add(keyLight);

        const keyLight2 = new THREE.RectAreaLight(0xffffff, 2.2, 4, 0.12);
        keyLight2.position.set(1.5, 2, 2.2);
        keyLight2.lookAt(0, 0, 0);
        this.scene.add(keyLight2);
    }

    /* ------------------------------------------------------------------ */
    /* Model                                                               */
    /* ------------------------------------------------------------------ */

    /**
     * Swap in a phone model. Resolves once the GLB is in the scene, so callers
     * can await a first render instead of polling.
     *
     * Recolouring the same model is handled without a reload, matching the
     * editor's behaviour when only `caseColor` changes.
     *
     * The current phone stays on screen until the new one has loaded, and
     * stays there if the load fails. When loads overlap, the last call wins.
     */
    setModel(config: Model): Promise<void> {
        this.requestedModel = config;

        const current = this.modelConfig;
        if (this.model && current && sameModel(current, config)) {
            this.pendingLoad = null;
            if (config.caseColor && config.caseColor !== current.caseColor) {
                this.setModelColor(new THREE.Color(config.caseColor));
            }
            this.applyModelDefaults(config);
            return Promise.resolve();
        }
        if (this.pendingLoad && sameModel(this.pendingLoad.config, config)) {
            return this.pendingLoad.promise;
        }

        const promise = new Promise<void>((resolve, reject) => {
            new GLTFLoader().load(
                this.resolveModelUrl(config.modelPath),
                (gltf) => {
                    const latest = this.requestedModel;
                    if (!latest || !sameModel(latest, config)) {
                        resolve();
                        return;
                    }
                    this.pendingLoad = null;
                    if (this.model) {
                        this.scene.remove(this.model);
                    }

                    const box = new THREE.Box3().setFromObject(gltf.scene);
                    const center = box.getCenter(new THREE.Vector3());
                    gltf.scene.position.sub(center);
                    const pivot = new THREE.Group();
                    pivot.name = "phone";
                    pivot.add(gltf.scene);
                    this.model = pivot;
                    this.scene.add(pivot);
                    this.dirty = true;

                    this.applyModelDefaults(latest);
                    if (latest.caseColor) {
                        this.setModelColor(new THREE.Color(latest.caseColor));
                    }
                    this.linkModelAndMediaTexture(latest, this.glassReflections);
                    resolve();
                },
                undefined,
                (err) => {
                    if (this.pendingLoad?.promise === promise) this.pendingLoad = null;
                    const latest = this.requestedModel;
                    if (latest && sameModel(latest, config)) reject(err);
                    else resolve();
                }
            );
        });
        this.pendingLoad = {config, promise};
        return promise;
    }

    private applyModelDefaults(config: Model) {
        this.modelConfig = config;
        this.basePos = config.defaultPosition || {x: 0, y: 0, z: 0};
        this.baseRot = config.defaultRotation || {x: 0, y: 0, z: 0};
        const restDistance = this.camera.position.z - this.basePos.z;
        this.zScale = restDistance > 0 ? restDistance / REFERENCE_DISTANCE : 1;
        this.setLidAtTime(this.lastLidTime);
    }

    /** Pose only the articulated lid, retaining the base and the rest-pose pivot. */
    setLidAtTime(time: number) {
        this.lastLidTime = time;
        const config = this.modelConfig;
        if (!this.model || !config?.hinge) return;
        const angle = lidAngleAt(config, time);
        const hinge = this.model.getObjectByName(config.hinge.node);
        if (!hinge || angle === null) return;
        const rotation = -deg2rad(angle);
        if (Math.abs(hinge.rotation.x - rotation) > 1e-10) {
            hinge.rotation.x = rotation;
            this.model.updateMatrixWorld(true);
            this.dirty = true;
        }
    }

    setModelColor(
        color: THREE.ColorRepresentation,
        opts: {only?: (mesh: THREE.Mesh) => boolean} = {}
    ) {
        if (!this.model) return;
        const only = opts.only ?? (() => true);
        const layers = (this.modelConfig?.layers ?? []).filter(showsMedia);

        this.model.traverse((child: any) => {
            if (!child.isMesh || !only(child)) return;
            // The screen's colour would tint the picture on it.
            if (layers.some((layer) => layerMatches(layer, child))) return;

            const mats = Array.isArray(child.material) ? child.material : [child.material];

            for (let material of mats) {
                if (material.name === "white") return;
                // Glass stays glass: painted, the Pixel 10's front glass
                // would tint the screen behind it.
                if (material.transmission > 0) continue;

                material.color.set(color);
                material.needsUpdate = true;
            }
        });

        this.render();
    }

    /**
     * Increase env reflections and slightly tighten roughness on metals.
     * mult 1.0 = neutral. Try 1.5–2.5 for punchier metal.
     */
    setMetallicStrength(mult = 1.8) {
        if (!this.model) return;
        forEachMaterial(this.model, (m) => {
            const isStd = m.isMeshStandardMaterial || m.isMeshPhysicalMaterial;
            if (!isStd) return;

            const metalness = typeof m.metalness === "number" ? m.metalness : 0;
            const likelyMetal =
                metalness >= 0.5 || /metal|steel|alum|chrome|gold|copper/i.test(m.name);
            if (!likelyMetal) return;

            const baseEnv = m.envMapIntensity ?? 1.0;
            m.envMapIntensity = Math.max(0.0, baseEnv * mult);

            if (typeof m.roughness === "number") {
                const r = m.roughness / Math.sqrt(mult);
                m.roughness = Math.max(0.04, Math.min(1.0, r));
            }

            if (typeof m.metalness === "number") {
                m.metalness = Math.min(1.0, Math.max(0.9, m.metalness));
            }

            if ("specularIntensity" in m && m.specularIntensity != null) {
                m.specularIntensity = Math.min(
                    1.0,
                    (m.specularIntensity ?? 1.0) * Math.min(mult, 1.5)
                );
            }

            m.needsUpdate = true;
        });
        this.render();
    }

    /* ------------------------------------------------------------------ */
    /* Media (the phone's screen content)                                  */
    /* ------------------------------------------------------------------ */

    setMedia(src: MediaSource, link: boolean = true) {
        if (this.mediaTexture) {
            this.mediaTexture.dispose();
            this.mediaTexture = null;
        }

        const texture =
            src.kind === "video" ? makeVideoTexture(src.el) : makeImageTexture(src.el);
        this.mediaTexture = texture;
        this.dirty = true;

        // A picture still loading, or a recording that seeks while paused,
        // brings new pixels without anything else changing: flag the texture
        // so the next check draws them.
        this.stopWatchingMedia?.();
        const refresh = () => {
            if (this.mediaTexture === texture) texture.needsUpdate = true;
        };
        const el = src.el;
        if (src.kind === "image" && el instanceof HTMLImageElement && !el.complete) {
            el.addEventListener("load", refresh, {once: true});
            this.stopWatchingMedia = () => el.removeEventListener("load", refresh);
        } else if (src.kind === "video") {
            const video = src.el;
            video.addEventListener("seeked", refresh);
            video.addEventListener("loadeddata", refresh);
            this.stopWatchingMedia = () => {
                video.removeEventListener("seeked", refresh);
                video.removeEventListener("loadeddata", refresh);
            };
        } else {
            this.stopWatchingMedia = null;
        }

        if (link && this.modelConfig) {
            this.linkModelAndMediaTexture(this.modelConfig, this.glassReflections);
            this.render();
        }
    }

    /** Flag the media texture as dirty, e.g. after seeking a video element. */
    markMediaDirty() {
        if (this.mediaTexture) this.mediaTexture.needsUpdate = true;
        this.dirty = true;
    }

    setGlassReflections(glassReflections: boolean) {
        this.glassReflections = glassReflections;
        this.dirty = true;
        if (this.modelConfig) {
            this.linkModelAndMediaTexture(this.modelConfig, glassReflections);
        }
    }

    linkModelAndMediaTexture(config: Model, glassReflections: boolean) {
        if (!this.model || !this.mediaTexture) return;
        this.dirty = true;

        this.model.traverse((child: any) => {
            if (!child.isMesh) return;

            for (const layer of config.layers || []) {
                if (!layerMatches(layer, child)) continue;

                if (showsMedia(layer)) {
                    if (layer.uv === "planar") this.projectScreenUvs(child);
                    if (layer.uv === "upright") this.useUprightScreenUvs(child);
                    // Keep the file's sidedness: screens are exported
                    // double-sided, and one whose faces are wound inward
                    // vanishes under a front-side-only material.
                    const side = child.material.side;
                    if (!glassReflections) {
                        child.material = new THREE.MeshBasicMaterial({
                            name: child.material.name,
                            map: this.mediaTexture,
                            side,
                            toneMapped: false
                        });
                    } else {
                        child.material = new THREE.MeshPhysicalMaterial({
                            name: child.material.name,
                            map: this.mediaTexture,
                            side,
                            metalness: 0.2,
                            roughness: 0.1,
                            toneMapped: false
                        });
                    }
                    child.material.needsUpdate = true;
                }
            }
        });
    }

    /**
     * Give a screen mesh texture coordinates that lay the image flat across
     * it: left to right and top to bottom as the camera sees the phone at
     * rest. Written once per geometry.
     */
    private useUprightScreenUvs(mesh: THREE.Mesh) {
        const geometry = mesh.geometry;
        if (geometry.userData.uprightScreenUvs) return;
        const original = geometry.getAttribute("uv");
        if (!original) return;
        // Counter the media texture's historical quarter-turn using the asset's
        // local UVs (glTF V runs down). A moving lid must never be projected from its world pose.
        const uv = new Float32Array(original.count * 2);
        for (let i = 0; i < original.count; i++) {
            uv[i * 2] = 1 - original.getY(i);
            uv[i * 2 + 1] = original.getX(i);
        }
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        geometry.userData.uprightScreenUvs = true;
    }

    private projectScreenUvs(mesh: THREE.Mesh) {
        const geometry = mesh.geometry as THREE.BufferGeometry;
        if (!this.model || geometry.userData.planarScreenUvs) return;
        const position = geometry.getAttribute("position");
        if (!position) return;

        // Mesh space -> the phone pivot's space -> turned to its rest pose.
        this.model.updateMatrixWorld(true);
        const toRest = new THREE.Matrix4()
            .makeRotationFromEuler(new THREE.Euler(
                deg2rad(this.baseRot.x),
                deg2rad(this.baseRot.y),
                deg2rad(this.baseRot.z)
            ))
            .multiply(this.model.matrixWorld.clone().invert())
            .multiply(mesh.matrixWorld);

        const points: THREE.Vector3[] = [];
        const bounds = new THREE.Box3();
        for (let i = 0; i < position.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(toRest);
            points.push(p);
            bounds.expandByPoint(p);
        }
        const width = bounds.max.x - bounds.min.x || 1;
        const height = bounds.max.y - bounds.min.y || 1;

        // Media textures are turned a quarter and not flipped (see
        // makeImageTexture), which samples the image at (v, 1 - u); so an
        // image position (x across, y down) is written as uv (1 - y, x).
        const uv = new Float32Array(position.count * 2);
        points.forEach((p, i) => {
            const x = (p.x - bounds.min.x) / width;
            const y = (bounds.max.y - p.y) / height;
            uv[i * 2] = 1 - y;
            uv[i * 2 + 1] = x;
        });
        geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        geometry.userData.planarScreenUvs = true;
    }

    /* ------------------------------------------------------------------ */
    /* Transform and rendering                                             */
    /* ------------------------------------------------------------------ */

    /**
     * Position/rotate the model for a given control offset.
     *
     * `pos` is in screen-relative units: x/y are fractions of the visible
     * frame at the model's depth, so a nudge means the same thing regardless
     * of aspect ratio. z is depth in units of `REFERENCE_DISTANCE`'s scene,
     * so it zooms every model by the same factor (see `zScale`).
     */
    applyTransform(pos: Vec3, rot: Vec3) {
        if (!this.model) return;

        const pose = [pos.x, pos.y, pos.z, rot.x, rot.y, rot.z,
            this.basePos.x, this.basePos.y, this.basePos.z,
            this.baseRot.x, this.baseRot.y, this.baseRot.z, this.zScale];
        if (pose.some((v, i) => v !== this.lastPose[i])) {
            this.lastPose = pose;
            this.dirty = true;
        }

        this.model.position.set(
            this.basePos.x,
            this.basePos.y,
            this.basePos.z + pos.z * this.zScale
        );

        this.model.updateMatrixWorld();
        this.model.getWorldPosition(this._tmpWorld);

        const screenW = this.getScreenWorldWidthAtPoint(this.camera, this._tmpWorld);
        const screenH = this.getScreenWorldHeightAtPoint(this.camera, this._tmpWorld);

        this.model.position.x += (this.basePos.x + pos.x) * screenW - this.basePos.x * screenW;
        this.model.position.y += (this.basePos.y + pos.y) * screenH - this.basePos.y * screenH;

        this.model.rotation.set(
            deg2rad(this.baseRot.x + rot.x),
            deg2rad(this.baseRot.y + rot.y),
            deg2rad(this.baseRot.z + rot.z)
        );
    }

    /** Resolve a track's transform at `time` without touching the scene. */
    transformAt(track: Track, time: number): {pos: Vec3; rot: Vec3} {
        return getInterpolatedTransform(track, time);
    }

    /** Pose the model to a track's state at `time` and draw it. */
    renderAt(track: Track, time: number): {pos: Vec3; rot: Vec3} {
        this.setLidAtTime(time);
        const transform = this.transformAt(track, time);
        this.applyTransform(transform.pos, transform.rot);
        this.render();
        return transform;
    }

    render() {
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
        this.renderedMediaVersion = this.mediaTexture?.version ?? -1;
    }

    /** Whether anything changed since the last frame was drawn. */
    get needsRender(): boolean {
        if (this.dirty) return true;
        return !!this.mediaTexture && this.mediaTexture.version !== this.renderedMediaVersion;
    }

    /** Draw at the full target resolution, ignoring any display downscale. */
    renderAtTargetSize() {
        this.renderer.setSize(this.width, this.height, false);
        this.render();
        // The buffer is now at export size, not display size.
        this.dirty = true;
    }

    private getScreenWorldWidthAtPoint(
        cam: THREE.PerspectiveCamera,
        pointWorld: THREE.Vector3
    ): number {
        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camForward, pointWorld);

        const ndcY = pointWorld.clone().project(cam).y;

        const leftNDC = new THREE.Vector3(-1, ndcY, 0.5);
        const rightNDC = new THREE.Vector3(1, ndcY, 0.5);

        const camPos = cam.position.clone();

        const leftWorld = leftNDC.clone().unproject(cam);
        const rightWorld = rightNDC.clone().unproject(cam);

        const rayL = new THREE.Ray(camPos, leftWorld.sub(camPos).normalize());
        const rayR = new THREE.Ray(camPos, rightWorld.sub(camPos).normalize());

        const hitL = new THREE.Vector3();
        const hitR = new THREE.Vector3();
        rayL.intersectPlane(plane, hitL);
        rayR.intersectPlane(plane, hitR);

        return hitL.distanceTo(hitR);
    }

    private getScreenWorldHeightAtPoint(
        cam: THREE.PerspectiveCamera,
        pointWorld: THREE.Vector3
    ): number {
        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camForward, pointWorld);

        const ndcX = pointWorld.clone().project(cam).x;

        const topNDC = new THREE.Vector3(ndcX, 1, 0.5);
        const bottomNDC = new THREE.Vector3(ndcX, -1, 0.5);

        const camPos = cam.position.clone();

        const topWorld = topNDC.clone().unproject(cam);
        const bottomWorld = bottomNDC.clone().unproject(cam);

        const rayT = new THREE.Ray(camPos, topWorld.sub(camPos).normalize());
        const rayB = new THREE.Ray(camPos, bottomWorld.sub(camPos).normalize());

        const hitT = new THREE.Vector3();
        const hitB = new THREE.Vector3();
        rayT.intersectPlane(plane, hitT);
        rayB.intersectPlane(plane, hitB);

        return hitT.distanceTo(hitB);
    }

    /* ------------------------------------------------------------------ */
    /* Capture and teardown                                                */
    /* ------------------------------------------------------------------ */

    captureDataURL(type: "image/png" | "image/jpeg" = "image/png", quality?: number): string {
        this.renderAtTargetSize();
        return this.renderer.domElement.toDataURL(type, quality);
    }

    dispose() {
        this.stopWatchingMedia?.();
        this.envRT?.dispose();
        this.pmremGen?.dispose?.();
        this.mediaTexture?.dispose();
        this.renderer.dispose();
        this.scene.clear();
    }
}

function makeVideoTexture(el: HTMLVideoElement) {
    const tex = new THREE.VideoTexture(el);
    // @ts-ignore
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    const c = 0.5;
    tex.center.set(c, c);
    tex.rotation = Math.PI / 2;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
}

function makeImageTexture(
    el: HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap
) {
    const tex = new THREE.Texture(el as any);
    // @ts-ignore
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    const c = 0.5;
    tex.center.set(c, c);
    tex.rotation = Math.PI / 2;
    tex.needsUpdate = true;
    return tex;
}

/**
 * Whether a layer names this mesh: its `match` is part of the mesh's name or
 * of its material's, in any case. The Pixels' screen is only named by its
 * mesh, "LED", so the material name alone isn't enough.
 */
function layerMatches(layer: Layer, mesh: THREE.Mesh): boolean {
    const q = layer.match.toLowerCase();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return (
        mesh.name.toLowerCase().includes(q) ||
        materials.some((m) => m?.name.toLowerCase().includes(q))
    );
}

/** Whether a layer is where the user's picture or video goes. */
function showsMedia(layer: Layer): boolean {
    return layer.material === "video" || layer.material === "image";
}

function sameModel(a: Model, b: Model) {
    return a.id === b.id && a.modelPath === b.modelPath;
}

function forEachMaterial(root: THREE.Object3D, fn: (m: any, mesh: any) => void) {
    root.traverse((obj: any) => {
        if (!obj.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
            if (!m) continue;
            fn(m, obj);
        }
    });
}
