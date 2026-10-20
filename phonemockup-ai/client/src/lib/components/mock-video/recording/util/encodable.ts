import {canEncodeVideo} from "mediabunny";
import type {ExportFormat} from "../core/types";

/**
 * The video formats this browser can't encode at the export size. MP4 needs
 * an H.264 encoder, which not every browser ships, and encoders that have one
 * can still stop short of the large canvases. If the check itself fails, the
 * format counts as encodable and the export reports what really happens.
 */
export async function formatsThatCannotEncode(width: number, height: number): Promise<ExportFormat[]> {
    const size = {width, height, bitrate: 8_000_000};
    const check = (codec: "avc" | "vp9") => canEncodeVideo(codec, size).catch(() => true);
    const [mp4, webm] = await Promise.all([check("avc"), check("vp9")]);
    return [...(mp4 ? [] : ["mp4" as const]), ...(webm ? [] : ["webm" as const])];
}

/** The format to fall back to when the chosen one can't be encoded. */
export function encodableAlternative(cannot: ExportFormat[]): ExportFormat {
    return cannot.includes("webm") ? "image-sequence" : "webm";
}

export function cannotEncodeMessage(format: ExportFormat, width: number, height: number): string {
    return `This browser can't encode ${format === "mp4" ? "MP4" : "WebM"} at ${width}×${height}. Choose another format, or a smaller canvas under Scene.`;
}
