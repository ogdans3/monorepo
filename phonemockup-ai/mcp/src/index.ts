#!/usr/bin/env node
/**
 * phonemockup MCP server.
 *
 * Renders phone mockups locally: headless Chromium runs the same three.js
 * scene as phonemockup.app, ffmpeg encodes the result. Nothing is uploaded and
 * no backend is contacted — the only network access is Playwright fetching a
 * Chromium build on first install.
 */
import {mkdtemp, mkdir, rm, writeFile, access} from "node:fs/promises";
import {tmpdir} from "node:os";
import {dirname, extname, join, resolve} from "node:path";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {z} from "zod";
import {RenderSession, type Catalog} from "./renderer.js";
import {resolveStaticDir} from "./paths.js";
import {existsSync} from "node:fs";
import {encodeVideo, extractFrames, type VideoFormat} from "./video.js";
import {DEFAULT_MODEL, isTransparent, resolveScene, sceneSchema, type SceneInput} from "./scene.js";

/** Chromium is expensive to start, so one session is shared across calls. */
let session: RenderSession | null = null;
let catalogCache: Catalog | null = null;

async function getSession(): Promise<RenderSession> {
    if (!session) session = await RenderSession.launch();
    return session;
}

async function getCatalog(): Promise<Catalog> {
    if (!catalogCache) catalogCache = await (await getSession()).catalog();
    return catalogCache;
}

async function requireFile(path: string, label: string): Promise<string> {
    const full = resolve(path);
    try {
        await access(full);
    } catch {
        throw new Error(`${label} not found: ${full}`);
    }
    return full;
}

async function prepareOutput(path: string): Promise<string> {
    const full = resolve(path);
    await mkdir(dirname(full), {recursive: true});
    return full;
}

function text(body: string) {
    return {content: [{type: "text" as const, text: body}]};
}

type ToolExtra = {
    _meta?: {progressToken?: string | number};
    sendNotification: (notification: any) => Promise<void>;
};

/**
 * Emits `notifications/progress` for the current request, when the caller
 * asked for it by supplying a progress token. No-op otherwise.
 */
function progressReporter(extra: ToolExtra, total: number) {
    const progressToken = extra._meta?.progressToken;
    if (progressToken === undefined) return async () => undefined;

    return async (progress: number, message: string) => {
        await extra.sendNotification({
            method: "notifications/progress",
            params: {progressToken, progress, total, message}
        }).catch(() => undefined);
    };
}

const server = new McpServer(
    {name: "phonemockup", version: "0.1.0"},
    {
        instructions:
            "Renders 3D phone mockups from a screenshot or screen recording, locally. " +
            "Call list_phone_models and list_animations first to discover valid ids, " +
            "then render_mockup_image or render_mockup_video. Both write a file to disk " +
            "and return its path."
    }
);

server.registerTool(
    "list_phone_models",
    {
        title: "List phone models",
        description:
            "Lists the 3D phone models available for mockups, with the id to pass as `model`.",
        inputSchema: {}
    },
    async () => {
        const staticDir = resolveStaticDir();
        const {models} = await getCatalog();
        const lines = models.map((m) => {
            const available = existsSync(join(staticDir, m.modelPath));
            const suffix = available ? "" : "  [UNAVAILABLE: asset missing]";
            return `${m.id}  —  ${m.name}${suffix}`;
        });
        return text(
            `${models.length} models (default: ${DEFAULT_MODEL}):\n\n${lines.join("\n")}`
        );
    }
);

server.registerTool(
    "list_animations",
    {
        title: "List animations",
        description:
            "Lists the camera/phone animation presets, with the id to pass as `animation` " +
            "and each one's natural duration in seconds.",
        inputSchema: {}
    },
    async () => {
        const {animations} = await getCatalog();
        const sorted = [...animations].sort((a, b) => a.priority - b.priority);
        const lines = sorted.map(
            (a) =>
                `${a.id}  —  ${a.name}  (${a.duration}s` +
                (a.categories.length ? `, ${a.categories.join("/")}` : "") +
                ")"
        );
        return text(`${animations.length} animations:\n\n${lines.join("\n")}`);
    }
);

server.registerTool(
    "render_mockup_image",
    {
        title: "Render mockup image",
        description:
            "Renders a still image of a phone displaying your screenshot, and writes it to " +
            "`output`. Use `animation` + `time` to pose the phone at a moment from one of " +
            "the animation presets; without them the phone faces the camera straight on.",
        inputSchema: {
            screenshot: z
                .string()
                .describe("Path to the image shown on the phone screen (png, jpg or webp)."),
            output: z.string().describe("Path to write the rendered image to (.png or .jpg)."),
            animation: z
                .string()
                .optional()
                .describe("Animation preset id to take the pose from. See list_animations."),
            time: z
                .number()
                .min(0)
                .default(0)
                .describe("Seconds into the animation to freeze at. Requires `animation`."),
            ...sceneSchema
        }
    },
    async (args) => {
        const screenshot = await requireFile(args.screenshot, "Screenshot");
        const output = await prepareOutput(args.output);
        const scene = resolveScene(args as SceneInput, {width: 3840, height: 2160});

        const asJpeg = /\.jpe?g$/i.test(output);
        if (asJpeg && isTransparent(scene.background)) {
            throw new Error(
                "JPEG cannot store transparency. Write a .png, or set an opaque background."
            );
        }

        const s = await getSession();
        await s.initScene(scene);
        await s.setScreenSource(screenshot);

        const image = args.animation
            ? await s.renderFrame(
                args.animation,
                args.time,
                asJpeg ? "image/jpeg" : "image/png",
                asJpeg ? 0.95 : undefined
            )
            : await s.renderStill(asJpeg ? "image/jpeg" : "image/png", asJpeg ? 0.95 : undefined);

        await writeFile(output, image);
        return text(
            `Rendered ${scene.width}x${scene.height} mockup on ${scene.modelId}\n${output}`
        );
    }
);

server.registerTool(
    "render_mockup_video",
    {
        title: "Render mockup video",
        description:
            "Renders an animated video of a phone displaying your screenshot or screen " +
            "recording, and writes it to `output`. Pass `screenshot` for a static screen or " +
            "`screenRecording` to play a video on the phone. Rendering is frame by frame on " +
            "the CPU, so keep resolution and duration modest.",
        inputSchema: {
            animation: z
                .string()
                .describe("Animation preset id. See list_animations."),
            output: z
                .string()
                .describe("Path to write the video to. Extension sets the format if `format` is omitted."),
            screenshot: z
                .string()
                .optional()
                .describe("Path to a still image to show on the phone screen."),
            screenRecording: z
                .string()
                .optional()
                .describe("Path to a video to play on the phone screen. Takes priority over `screenshot`."),
            duration: z
                .number()
                .min(0.1)
                .max(60)
                .optional()
                .describe("Seconds to render. Defaults to the animation's own duration."),
            fps: z.number().int().min(1).max(60).default(30).describe("Frames per second."),
            format: z
                .enum(["mp4", "webm", "gif"])
                .optional()
                .describe("Output format. Inferred from the output extension when omitted."),
            ...sceneSchema
        }
    },
    async (args, extra) => {
        if (!args.screenshot && !args.screenRecording) {
            throw new Error("Pass either `screenshot` or `screenRecording`.");
        }

        const output = await prepareOutput(args.output);
        const format = (args.format ?? extname(output).slice(1).toLowerCase()) as VideoFormat;
        if (!["mp4", "webm", "gif"].includes(format)) {
            throw new Error(
                `Unsupported video format "${format}". Use mp4, webm or gif.`
            );
        }

        const scene = resolveScene(args as SceneInput, {width: 1080, height: 1920});
        const transparent = isTransparent(scene.background);
        if (transparent && format === "mp4") {
            throw new Error(
                "MP4 cannot store transparency. Use webm or gif, or set an opaque background."
            );
        }

        const {animations} = await getCatalog();
        const preset = animations.find((a) => a.id === args.animation);
        if (!preset) {
            throw new Error(
                `Unknown animation "${args.animation}". Available: ` +
                animations.map((a) => a.id).join(", ")
            );
        }

        const duration = args.duration ?? preset.duration;
        const frameCount = Math.max(1, Math.round(duration * args.fps));

        const workDir = await mkdtemp(join(tmpdir(), "phonemockup-"));
        try {
            const s = await getSession();
            await s.initScene(scene);

            // Screen content: either one still for every frame, or a decoded
            // frame sequence stepped in lockstep with the render.
            let screenFrames: string[] | null = null;
            if (args.screenRecording) {
                const input = await requireFile(args.screenRecording, "Screen recording");
                screenFrames = await extractFrames(input, workDir, args.fps);
                await s.setScreenSource(screenFrames[0]);
            } else {
                await s.setScreenSource(await requireFile(args.screenshot!, "Screenshot"));
            }

            // PNG preserves alpha; JPEG is far cheaper to move out of the
            // browser and is re-encoded by ffmpeg anyway.
            const frameExt = transparent ? "png" : "jpg";
            const mimeType = transparent ? "image/png" : "image/jpeg";
            const quality = transparent ? undefined : 0.95;

            // Rendering is software-rasterised and a long clip can run for
            // many minutes, well past the 60s a client typically allows for a
            // silent request. Progress notifications keep it alive.
            const report = progressReporter(extra, frameCount);

            for (let i = 0; i < frameCount; i++) {
                extra.signal.throwIfAborted();
                const time = frameCount === 1 ? 0 : (i / frameCount) * duration;

                if (screenFrames) {
                    // Hold the last decoded frame if the recording is shorter
                    // than the animation.
                    await s.setScreenFrame(screenFrames[Math.min(i, screenFrames.length - 1)]);
                }

                const frame = await s.renderFrame(args.animation, time, mimeType, quality);
                await writeFile(
                    join(workDir, `out-${String(i).padStart(6, "0")}.${frameExt}`),
                    frame
                );
                await report(i + 1, `frame ${i + 1}/${frameCount}`);
            }

            await report(frameCount, `encoding ${format}`);

            await encodeVideo({
                framePattern: join(workDir, `out-%06d.${frameExt}`),
                fps: args.fps,
                format,
                output,
                transparent
            });

            return text(
                `Rendered ${frameCount} frames at ${scene.width}x${scene.height} ` +
                `(${duration}s @ ${args.fps}fps, ${format}) on ${scene.modelId}\n${output}`
            );
        } finally {
            await rm(workDir, {recursive: true, force: true});
        }
    }
);

async function shutdown() {
    await session?.close().catch(() => undefined);
    session = null;
}

process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
});

const transport = new StdioServerTransport();
await server.connect(transport);
