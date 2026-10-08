import {extFromBlobType} from "./naming";

export function downloadBlob(blob: Blob, name?: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name || `export.${extFromBlobType(blob.type)}`;
    a.click();
    URL.revokeObjectURL(url);
    return a.download;
}