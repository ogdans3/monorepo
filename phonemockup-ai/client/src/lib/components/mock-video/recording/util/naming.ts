export function toKebabCase(name: string): string {
    return name
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

export function extFromBlobType(mime?: string) {
    const m = mime || "";
    if (m.includes("mp4")) return "mp4";
    if (m.includes("gif")) return "gif";
    if (m.includes("zip")) return "zip";
    if (m.includes("png")) return "png";
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
    // default
    return "webm";
}

export function padNumber(n: number, width: number) {
    const s = String(n);
    return s.length >= width ? s : "0".repeat(width - s.length) + s;
}