// Letters that don't decompose into a base letter and an accent.
const FOLDED: Record<string, string> = {
    æ: "ae", Æ: "Ae", ø: "o", Ø: "O", œ: "oe", Œ: "Oe", ß: "ss",
    đ: "d", Đ: "D", ł: "l", Ł: "L", þ: "th", Þ: "Th",
};

/**
 * A file name from a project name. Accents come off Latin letters
 * ("Café Ålesund" is cafe-alesund, "Ærlig" is aerlig), and letters of other
 * scripts are kept rather than dropped.
 */
export function toKebabCase(name: string): string {
    return name
        .replace(/[æÆøØœŒßđĐłŁþÞ]/g, (c) => FOLDED[c])
        .normalize("NFKD")
        .replace(/([A-Za-z])\p{M}+/gu, "$1")
        .normalize("NFC")
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/\s*-\s*/g, "-")
        .replace(/\s+/g, "-")
        .replace(/[^\p{L}\p{N}-]/gu, "")
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