import {readFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {dirname, extname, join, normalize, resolve, sep} from "node:path";
import {chromium, type Browser, type Page} from "playwright";
import {harnessBundle, resolveStaticDir} from "./paths.js";

/**
 * Synthetic origin for the render page. Nothing is ever fetched over the
 * network — every request against this host is answered from disk by a
 * Playwright route handler, which is how the MCP stays serverless.
 */
const ORIGIN = "https://phonemockup.local";

const MIME_TYPES: Record<string, string> = {
    ".glb": "model/gltf-binary",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".hdr": "image/vnd.radiance",
    ".js": "text/javascript",
    ".html": "text/html"
};

export type RGBA = [number, number, number, number];

export type SceneOptions = {
    modelId: string;
    width: number;
    height: number;
    background: RGBA;
    glassReflections: boolean;
    caseColor?: string | null;
    antialias?: boolean;
    showCameraIsland?: boolean;
    showLogo?: boolean;
    lidAngle?: number;
    lidOpenDuration?: number;
};

export type CatalogModel = {
    id: string;
    name: string;
    modelPath: string;
    caseColor: string | null;
    supportsCameraIsland: boolean;
    showCameraIsland?: boolean;
    supportsLogo: boolean;
    showLogo?: boolean;
};

export type CatalogAnimation = {
    screenCut?: {start: number; end: number; at: number};
    id: string;
    name: string;
    categories: string[];
    priority: number;
    duration: number;
};

export type Catalog = {models: CatalogModel[]; animations: CatalogAnimation[]};

const PAGE_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>phonemockup harness</title>
<style>html,body{margin:0;padding:0;background:#000}canvas{display:block}</style>
</head>
<body></body>
</html>`;

/**
 * A headless Chromium page running the render harness.
 *
 * One instance can render many mockups; the browser launch dominates cost, so
 * the server keeps a single session alive and reuses it.
 */
export class RenderSession {
    private constructor(
        private readonly browser: Browser,
        private readonly page: Page,
        private readonly staticDir: string,
        /** The exact files the page may fetch as screen content, per call. */
        private readonly mediaFiles: Set<string>
    ) {
        // The page's renderer can die (out of memory, killed) while the
        // browser stays up. Close the browser then, so the session counts as
        // gone and the next call starts a new one instead of "Target crashed".
        page.on("crash", () => {
            void browser.close().catch(() => undefined);
        });
    }

    static async launch(): Promise<RenderSession> {
        if (!existsSync(harnessBundle)) {
            throw new Error(
                `Render harness is not built. Expected ${harnessBundle}. ` +
                "Run `npm run build:harness` in the mcp/ directory."
            );
        }

        const staticDir = resolveStaticDir();
        const mediaFiles = new Set<string>();

        const browser = await chromium.launch({args: launchArgs()});
        try {
            return await RenderSession.open(browser, staticDir, mediaFiles);
        } catch (error) {
            // A harness that fails to load must not leave its browser running.
            await browser.close().catch(() => undefined);
            throw error;
        }
    }

    private static async open(browser: Browser, staticDir: string, mediaFiles: Set<string>): Promise<RenderSession> {
        const page = await browser.newPage();
        const harness = await readFile(harnessBundle, "utf8");

        await page.route("**/*", async (route) => {
            const url = new URL(route.request().url());

            if (url.origin !== ORIGIN) {
                // The harness is fully self-contained; anything else is a bug
                // or a stray request, and must not reach the network.
                return route.abort();
            }

            if (url.pathname === "/" || url.pathname === "/index.html") {
                return route.fulfill({contentType: "text/html", body: PAGE_HTML});
            }

            const file =
                url.pathname === "/media"
                    ? resolveMediaRequest(url, mediaFiles)
                    : resolveStaticFile(url.pathname, staticDir);
            if (!file) return route.fulfill({status: 404, body: "Not found"});

            return route.fulfill({
                contentType: MIME_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
                body: await readFile(file)
            });
        });

        const errors: string[] = [];
        page.on("pageerror", (err) => errors.push(err.message));

        await page.goto(`${ORIGIN}/index.html`);
        await page.addScriptTag({content: harness});
        try {
            await page.waitForFunction(() => Boolean((window as any).mockupHarness), null, {
                timeout: 30_000
            });
        } catch (error) {
            // Say why, rather than reporting a bare 30 s timeout.
            if (errors.length) throw new Error(`Harness failed to load: ${errors.join("; ")}`);
            throw error;
        }

        if (errors.length) {
            throw new Error(`Harness failed to load: ${errors.join("; ")}`);
        }

        return new RenderSession(browser, page, staticDir, mediaFiles);
    }

    /** False once the browser or its page has crashed, been killed or closed. */
    isConnected(): boolean {
        return this.browser.isConnected() && !this.page.isClosed();
    }

    /** Calls when the browser goes away, so the caller can start a new one. */
    onDisconnected(listener: () => void) {
        this.browser.on("disconnected", listener);
    }

    /** Allow the page to fetch exactly this file as screen content. */
    allowMediaFile(file: string) {
        this.mediaFiles.add(resolve(file));
    }

    /** Forget every allowed file; each tool call allows its own. */
    resetMedia() {
        this.mediaFiles.clear();
    }

    /** URL the page should use to fetch a file from an allowed media dir. */
    mediaUrl(file: string): string {
        return `${ORIGIN}/media?path=${encodeURIComponent(resolve(file))}`;
    }

    async catalog(): Promise<Catalog> {
        return this.page.evaluate(() => (window as any).mockupHarness.catalog());
    }

    async initScene(opts: SceneOptions): Promise<void> {
        await this.page.setViewportSize({
            width: Math.min(opts.width, 4096),
            height: Math.min(opts.height, 4096)
        });
        await this.page.evaluate(
            (o) => (window as any).mockupHarness.init(o),
            opts as unknown as Record<string, unknown>
        );
    }

    async setScreenSource(file: string): Promise<void> {
        this.allowMediaFile(file);
        await this.page.evaluate(
            (url) => (window as any).mockupHarness.setScreenSource(url),
            this.mediaUrl(file)
        );
    }

    async setScreenFrame(file: string): Promise<void> {
        this.allowMediaFile(file);
        await this.page.evaluate(
            (url) => (window as any).mockupHarness.setScreenFrame(url),
            this.mediaUrl(file)
        );
    }

    /** Render a still pose (no animation applied) and return the encoded image. */
    async renderStill(mimeType: string, quality?: number): Promise<Buffer> {
        const dataUrl: string = await this.page.evaluate(
            ({mimeType, quality}) =>
                (window as any).mockupHarness.renderStill(mimeType, quality),
            {mimeType, quality}
        );
        return decodeDataUrl(dataUrl);
    }

    /** Render one frame of an animation at `time` seconds. */
    async renderFrame(
        animationId: string,
        time: number,
        mimeType: string,
        quality?: number
    ): Promise<Buffer> {
        const dataUrl: string = await this.page.evaluate(
            ({animationId, time, mimeType, quality}) =>
                (window as any).mockupHarness.renderFrame(animationId, time, mimeType, quality),
            {animationId, time, mimeType, quality}
        );
        return decodeDataUrl(dataUrl);
    }

    async close(): Promise<void> {
        await this.browser.close();
    }
}

/**
 * WebGL flags for the render browser.
 *
 * Software rasterisation via SwiftShader is the default because it works on
 * any machine, headless or not. It is also the reason a frame costs hundreds
 * of milliseconds; set `PHONEMOCKUP_GPU=1` on a machine with a usable GPU to
 * let Chromium pick hardware instead.
 */
function launchArgs(): string[] {
    const base = ["--headless=new", "--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist"];
    if (process.env.PHONEMOCKUP_GPU === "1") {
        return [...base, "--enable-gpu"];
    }
    return [
        ...base,
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader"
    ];
}

function decodeDataUrl(dataUrl: string): Buffer {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) throw new Error("Renderer returned malformed image data");
    return Buffer.from(dataUrl.slice(comma + 1), "base64");
}

/**
 * Map a request path onto a file inside the static dir.
 *
 * Model paths (`/Iphone-17-pro-max.glb`) come from the app's own model JSON,
 * so they resolve here. The prefix check keeps `..` from escaping the dir.
 */
function resolveStaticFile(pathname: string, staticDir: string): string | null {
    const decoded = decodeURIComponent(pathname);
    const candidate = normalize(join(staticDir, decoded));
    if (!candidate.startsWith(staticDir + sep)) return null;
    return existsSync(candidate) ? candidate : null;
}

/**
 * Screen content is addressed explicitly via `/media?path=…` and must sit in a
 * directory the caller opted in to, so a crafted path cannot read arbitrary
 * files off the machine.
 */
function resolveMediaRequest(url: URL, mediaFiles: Set<string>): string | null {
    const requested = url.searchParams.get("path");
    if (!requested) return null;
    const file = resolve(requested);
    return mediaFiles.has(file) && existsSync(file) ? file : null;
}
