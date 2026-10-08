import {GifWriter} from "omggif";
import type {IFrameEncoder} from "./RecordingTypes";

type RGB = [number, number, number];

type GifEncoderOptions = {
    canvas: HTMLCanvasElement;
    fps: number;
    width?: number;
    height?: number;
    repeat?: number; // 0 loop forever; -1 no loop; N loops
    background?: string;
    totalFrames: number; // for buffer prealloc
    maxColors?: number; // <= 256 (we round to power-of-two later)
    dither?: boolean; // Floyd–Steinberg
    paletteSampleLimit?: number; // sampled pixels to build palette (default 60k)
    /** Keep see-through pixels see-through (GIF has 1-bit transparency). */
    transparent?: boolean;
};

/**
 * Longest side of a GIF we write. Every pixel is matched against the palette
 * in JavaScript, and a GIF at the 4K export size is hours of work and
 * hundreds of megabytes that no one can post.
 */
const MAX_GIF_SIDE = 960;

/** Below this alpha a pixel is written as transparent. */
const ALPHA_THRESHOLD = 128;

export class GifEncoder implements IFrameEncoder {
    private workCanvas: HTMLCanvasElement;
    private workCtx: CanvasRenderingContext2D;
    private delayCs: number;
    private width: number;
    private height: number;

    private buffer: Uint8Array;
    private writer: GifWriter | null = null;
    private finished = false;

    private maxColors: number;
    private dither: boolean;
    private paletteSampleLimit: number;

    constructor(private opts: GifEncoderOptions) {
        const src = opts.canvas;
        const fit = Math.min(1, MAX_GIF_SIDE / Math.max(src.width, src.height));
        const outW = opts.width ?? Math.max(1, Math.round(src.width * fit));
        const outH = opts.height ?? Math.max(1, Math.round((src.height / src.width) * outW));
        this.width = outW;
        this.height = outH;

        this.workCanvas = document.createElement("canvas");
        this.workCanvas.width = outW;
        this.workCanvas.height = outH;
        this.workCtx = this.workCanvas.getContext("2d", {
            willReadFrequently: true,
        }) as CanvasRenderingContext2D;

        const fps = Math.max(1, opts.fps);
        const delayMs = Math.round(1000 / fps);
        this.delayCs = Math.max(1, Math.round(delayMs / 10)); // centiseconds

        this.maxColors = Math.min(256, Math.max(2, opts.maxColors ?? 256));
        this.dither = !!opts.dither;
        this.paletteSampleLimit = opts.paletteSampleLimit ?? 60_000;

        // Fixed prealloc (omggif requires fixed buffer)
        const pixels = outW * outH;
        const perFrameGuess = Math.max(
            512,
            Math.ceil(pixels * (this.maxColors <= 64 ? 0.6 : 0.8))
        );
        const headerOverhead = 4096;
        const capacity =
            headerOverhead + Math.ceil(perFrameGuess * Math.max(1, opts.totalFrames));
        const minCap = 512 * 1024;
        const maxCap = 256 * 1024 * 1024;
        const alloc = Math.min(Math.max(capacity, minCap), maxCap);
        this.buffer = new Uint8Array(alloc);
    }

    async init() {
        if (this.opts.background) {
            this.workCtx.fillStyle = this.opts.background;
            this.workCtx.fillRect(0, 0, this.width, this.height);
        }

        this.writer = new GifWriter(this.buffer, this.width, this.height, {
            loop:
                this.opts.repeat == null
                    ? 0
                    : this.opts.repeat < 0
                        ? undefined
                        : this.opts.repeat,
        });
    }

    async addFrame() {
        if (!this.writer) throw new Error("GifEncoder not initialized");
        if (this.finished) throw new Error("GifEncoder already finished");

        // Draw source onto a clean canvas; drawing over the previous frame
        // would leave it showing through wherever this one is transparent.
        this.workCtx.clearRect(0, 0, this.width, this.height);
        if (this.opts.background) {
            this.workCtx.fillStyle = this.opts.background;
            this.workCtx.fillRect(0, 0, this.width, this.height);
        }
        this.workCtx.drawImage(this.opts.canvas, 0, 0, this.width, this.height);
        const {data: rgba} = this.workCtx.getImageData(
            0,
            0,
            this.width,
            this.height
        );

        const transparent = !!this.opts.transparent;

        // 1) Build palette on a sampled subset (of the visible pixels only,
        // when see-through ones get a slot of their own)
        const sample = sampleRGB(rgba, this.paletteSampleLimit, transparent);
        let palette = medianCutPalette(sample, transparent ? this.maxColors - 1 : this.maxColors);

        // Ensure at least two colors
        if (palette.length === 0) palette = [[0, 0, 0]];
        if (palette.length === 1) {
            const [r, g, b] = palette[0];
            const alt: RGB = r + g + b > 382 ? [0, 0, 0] : [255, 255, 255];
            palette.push(alt);
        }

        // 2) Normalize to power-of-two (2..256) for omggif
        palette = normalizePalette(palette);
        let transparentIndex = -1;
        if (transparent) {
            ({palette, index: transparentIndex} = addTransparentSlot(palette));
        }

        // 3) Map pixels -> indices
        const indexed =
            this.dither
                ? mapWithDithering(rgba, this.width, this.height, palette, transparentIndex)
                : mapNearest(rgba, palette, transparentIndex);

        // Safety: clamp any stray indices (shouldn't happen)
        const palLen = palette.length;
        for (let i = 0; i < indexed.length; i++) {
            if (indexed[i] >= palLen) indexed[i] = palLen - 1;
        }

        // 4) Convert palette to 24-bit ints 0xRRGGBB (REQUIRED by omggif)
        const paletteInts: number[] = new Array(palLen);
        for (let i = 0; i < palLen; i++) {
            const [r, g, b] = palette[i];
            paletteInts[i] = (r << 16) | (g << 8) | b;
        }

        // 5) Add frame (indexed must be number[], not Uint8Array, for TS defs)
        const idxArr = Array.from(indexed);

        const frameOptions: Record<string, unknown> = {
            palette: paletteInts,
            delay: this.delayCs, // centiseconds
            disposal: 2,
        };
        if (transparentIndex >= 0) frameOptions.transparent = transparentIndex;
        const end = this.writer.addFrame(0, 0, this.width, this.height, idxArr, frameOptions);

        // omggif writes into a fixed buffer and silently drops what doesn't
        // fit, which yields a file no one can open. Fail loudly instead.
        if (end > this.buffer.length) {
            throw new Error("The GIF grew too large. Try a shorter timeline or another format.");
        }
    }

    async cancel() {
        this.finished = true;
    }

    async finalize(): Promise<Blob> {
        if (!this.writer) throw new Error("GifEncoder not initialized");
        if (this.finished) throw new Error("GifEncoder already finished");

        const used = this.writer.end();
        this.finished = true;

        const out = this.buffer.slice(0, used);
        return new Blob([out], {type: "image/gif"});
    }
}

/* ================= Helpers: palette building (median cut) ================= */

type Box = {
    rmin: number;
    rmax: number;
    gmin: number;
    gmax: number;
    bmin: number;
    bmax: number;
    pixels: RGB[];
};

function sampleRGB(rgba: Uint8ClampedArray, limit: number, opaqueOnly = false): RGB[] {
    const total = (rgba.length / 4) | 0;
    const out: RGB[] = [];
    const step = total <= limit ? 1 : Math.max(1, Math.floor(total / limit));
    for (let p = 0; p < total && out.length < limit; p += step) {
        const i = p << 2;
        if (opaqueOnly && rgba[i + 3] < ALPHA_THRESHOLD) continue;
        out.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    }
    return out;
}

/**
 * Append an index for transparent pixels, then pad back to a power of two.
 * Padding only duplicates, it never trims, so the slot survives.
 */
function addTransparentSlot(src: RGB[]): { palette: RGB[]; index: number } {
    const palette = src.slice(0, 255);
    const index = palette.length;
    palette.push([0, 0, 0]);
    let size = 2;
    while (size < palette.length) size <<= 1;
    while (palette.length < size) palette.push(palette[0].slice() as RGB);
    return {palette, index};
}

function medianCutPalette(pixels: RGB[], maxColors: number): RGB[] {
    if (pixels.length === 0) return [];
    if (maxColors < 2) maxColors = 2;

    const root = makeBox(pixels);
    const boxes: Box[] = [root];

    while (boxes.length < maxColors) {
        // pick largest volume box with >1 pixel
        let bi = -1;
        let bestVolume = -1;
        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            const vol = boxVolume(b);
            if (vol > bestVolume && b.pixels.length > 1) {
                bestVolume = vol;
                bi = i;
            }
        }
        if (bi === -1) break;

        const box = boxes[bi];
        const axis = longestAxis(box);
        box.pixels.sort((a, b) => a[axis] - b[axis]);
        const mid = box.pixels.length >> 1;
        const left = box.pixels.slice(0, mid);
        const right = box.pixels.slice(mid);

        boxes.splice(bi, 1, makeBox(left), makeBox(right));
    }

    const palette = boxes.map(avgColor);
    if (palette.length > 256) palette.length = 256;
    return palette;
}

function makeBox(pixels: RGB[]): Box {
    let rmin = 255,
        rmax = 0,
        gmin = 255,
        gmax = 0,
        bmin = 255,
        bmax = 0;
    for (const [r, g, b] of pixels) {
        if (r < rmin) rmin = r;
        if (r > rmax) rmax = r;
        if (g < gmin) gmin = g;
        if (g > gmax) gmax = g;
        if (b < bmin) bmin = b;
        if (b > bmax) bmax = b;
    }
    return {rmin, rmax, gmin, gmax, bmin, bmax, pixels};
}

function boxVolume(b: Box) {
    return (b.rmax - b.rmin + 1) * (b.gmax - b.gmin + 1) * (b.bmax - b.bmin + 1);
}

function longestAxis(b: Box): 0 | 1 | 2 {
    const dr = b.rmax - b.rmin;
    const dg = b.gmax - b.gmin;
    const db = b.bmax - b.bmin;
    if (dr >= dg && dr >= db) return 0;
    if (dg >= dr && dg >= db) return 1;
    return 2;
}

function avgColor(b: Box): RGB {
    let r = 0,
        g = 0,
        bb = 0;
    const n = b.pixels.length || 1;
    for (const [rr, gg, bbb] of b.pixels) {
        r += rr;
        g += gg;
        bb += bbb;
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(bb / n)];
}

/* ================= Palette normalization (power-of-two) ================= */

function normalizePalette(src: RGB[]): RGB[] {
    let n = src.length;
    if (n < 2) n = 2;
    if (n > 256) n = 256;
    // round to nearest power-of-two (ties up)
    const lower = 1 << Math.floor(Math.log2(n));
    const upper = Math.min(256, lower << 1);
    const target = n - lower <= upper - n ? Math.max(2, lower) : upper;

    if (src.length === target) return src.slice();

    if (src.length > target) {
        // Trim least-informative colors (closest pairs first)
        const pal = src.slice();
        while (pal.length > target) {
            let bestI = -1;
            let bestD = Infinity;
            for (let i = 0; i < pal.length; i++) {
                const d = nearestDistance(pal[i], pal, i);
                if (d < bestD) {
                    bestD = d;
                    bestI = i;
                }
            }
            pal.splice(bestI, 1);
        }
        return pal;
    }

    // Pad by duplicating well-separated colors
    const pal = src.slice();
    while (pal.length < target) {
        let bestI = 0;
        let bestD = -1;
        for (let i = 0; i < pal.length; i++) {
            const d = nearestDistance(pal[i], pal, i);
            if (d > bestD) {
                bestD = d;
                bestI = i;
            }
        }
        pal.push(pal[bestI].slice() as RGB);
    }
    return pal;
}

function nearestDistance(c: RGB, pal: RGB[], skipIndex: number): number {
    let best = Infinity;
    for (let i = 0; i < pal.length; i++) {
        if (i === skipIndex) continue;
        const d = colorDist2(c, pal[i]);
        if (d < best) best = d;
    }
    return best;
}

function colorDist2(a: RGB, b: RGB): number {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
}

/* ================= Pixel mapping ================= */

function mapNearest(rgba: Uint8ClampedArray, palette: RGB[], transparentIndex = -1): Uint8Array {
    const out = new Uint8Array((rgba.length / 4) | 0);
    const cache = new Map<number, number>(); // 24-bit rgb -> idx

    for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
        if (transparentIndex >= 0 && rgba[i + 3] < ALPHA_THRESHOLD) {
            out[p] = transparentIndex;
            continue;
        }
        const r = rgba[i],
            g = rgba[i + 1],
            b = rgba[i + 2];
        const key = (r << 16) | (g << 8) | b;

        let idx = cache.get(key);
        if (idx == null) {
            idx = nearestIndex([r, g, b], palette, transparentIndex);
            cache.set(key, idx);
        }
        out[p] = idx;
    }
    return out;
}

function mapWithDithering(
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
    palette: RGB[],
    transparentIndex = -1
): Uint8Array {
    const out = new Uint8Array((rgba.length / 4) | 0);
    const buf = new Float32Array(rgba.length);
    for (let i = 0; i < rgba.length; i++) buf[i] = rgba[i];

    const idxAt = (x: number, y: number) => (y * width + x) * 4;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = idxAt(x, y);
            if (transparentIndex >= 0 && rgba[i + 3] < ALPHA_THRESHOLD) {
                out[(i / 4) | 0] = transparentIndex;
                continue;
            }
            const r = clamp255(buf[i]);
            const g = clamp255(buf[i + 1]);
            const b = clamp255(buf[i + 2]);

            const pi = nearestIndex([r, g, b], palette, transparentIndex);
            out[(i / 4) | 0] = pi;

            const [pr, pg, pb] = palette[pi];
            const er = r - pr;
            const eg = g - pg;
            const eb = b - pb;

            // Floyd–Steinberg
            if (x + 1 < width) {
                const j = idxAt(x + 1, y);
                buf[j] += er * (7 / 16);
                buf[j + 1] += eg * (7 / 16);
                buf[j + 2] += eb * (7 / 16);
            }
            if (y + 1 < height) {
                if (x > 0) {
                    const j = idxAt(x - 1, y + 1);
                    buf[j] += er * (3 / 16);
                    buf[j + 1] += eg * (3 / 16);
                    buf[j + 2] += eb * (3 / 16);
                }
                {
                    const j = idxAt(x, y + 1);
                    buf[j] += er * (5 / 16);
                    buf[j + 1] += eg * (5 / 16);
                    buf[j + 2] += eb * (5 / 16);
                }
                if (x + 1 < width) {
                    const j = idxAt(x + 1, y + 1);
                    buf[j] += er * (1 / 16);
                    buf[j + 1] += eg * (1 / 16);
                    buf[j + 2] += eb * (1 / 16);
                }
            }
        }
    }
    return out;
}

function nearestIndex(rgb: RGB, palette: RGB[], skip = -1): number {
    let best = skip === 0 ? 1 : 0;
    let bestD = Infinity;
    const [r, g, b] = rgb;
    for (let i = 0; i < palette.length; i++) {
        if (i === skip) continue;
        const [pr, pg, pb] = palette[i];
        const dr = r - pr;
        const dg = g - pg;
        const db = b - pb;
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

function clamp255(x: number): number {
    return x < 0 ? 0 : x > 255 ? 255 : x;
}