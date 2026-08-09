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

/** Scale in halving steps toward the target. One big jump goes muddy. */
export function steppedScale(source: HTMLCanvasElement, tw: number, th: number): HTMLCanvasElement {
	let current = source;
	let cw = source.width;
	let ch = source.height;
	while (cw / 2 > tw && ch / 2 > th) {
		cw = Math.max(tw, Math.round(cw / 2));
		ch = Math.max(th, Math.round(ch / 2));
		const step = document.createElement('canvas');
		step.width = cw;
		step.height = ch;
		const ctx = step.getContext('2d');
		if (!ctx) break;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(current, 0, 0, cw, ch);
		current = step;
	}
	const out = document.createElement('canvas');
	out.width = tw;
	out.height = th;
	const ctx = out.getContext('2d');
	if (ctx) {
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(current, 0, 0, tw, th);
	}
	return out;
}
