const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;
const VIDEO_EXTENSION = /\.(mp4|m4v|mov|webm|ogv|mkv)$/i;

/**
 * Whether a file is a picture rather than a screen recording. Some systems
 * leave `type` empty for less common extensions, so the name decides then.
 */
export function detectIsImage(file: File): boolean {
    const t = file.type || "";
    if (t.startsWith("image/")) return true;
    if (t.startsWith("video/")) return false;
    return IMAGE_EXTENSION.test(file.name || "");
}

/** Whether the editor can put this file on the phone's screen. */
export function isScreenMedia(file: File): boolean {
    const t = file.type || "";
    if (t.startsWith("image/") || t.startsWith("video/")) return true;
    const name = file.name || "";
    return IMAGE_EXTENSION.test(name) || VIDEO_EXTENSION.test(name);
}
