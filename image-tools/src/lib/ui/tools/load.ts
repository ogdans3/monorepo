import { decodeToRaw, sniffFormat, type RawImage } from '$lib/engine';

/** Sniff and decode one dropped file, with a readable error when it fails. */
export async function readImageFile(file: File): Promise<{ raw: RawImage; name: string }> {
	const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
	const format = sniffFormat(head, file.name);
	if (!format) throw new Error(`Could not read ${file.name} as an image`);
	return { raw: await decodeToRaw(file, format), name: file.name };
}

/** RawImage → a canvas ready for drawImage compositing. */
export function rawToCanvas(raw: RawImage): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = raw.width;
	canvas.height = raw.height;
	canvas.getContext('2d')?.putImageData(new ImageData(raw.data, raw.width, raw.height), 0, 0);
	return canvas;
}
