import type { Format } from './formats';
import type { RawImage } from './raw';
import { encodeBmp } from './bmp';
import { flattenPartialAlpha, hexToRgb } from './flatten';
import { wrapPngAsIco } from './ico';

export interface EncodeOptions {
	/** 1–100, used by lossy targets. */
	quality: number;
	/**
	 * Colour to put behind transparent areas, as hex. Only formats that cannot
	 * keep full transparency use it: JPG fills everything with it, and GIF
	 * blends soft edges onto it while keeping fully transparent pixels clear.
	 */
	background?: string;
}

/**
 * Encode raw RGBA into the target format. Native canvas encoders where the
 * browser has them, lazy-loaded WASM/JS encoders where it doesn't.
 */
export async function encodeRaw(img: RawImage, target: Format, opts: EncodeOptions): Promise<Blob> {
	switch (target.id) {
		case 'png':
			return canvasToBlob(toCanvas(img), 'image/png');
		case 'jpg':
			// JPEG has no alpha channel, so every pixel gets the chosen colour
			// behind it. White by default, since that is what most pages expect.
			return canvasToBlob(
				toCanvas(img, opts.background ?? '#ffffff'),
				'image/jpeg',
				opts.quality / 100
			);
		case 'webp':
			return encodeWebp(img, opts.quality);
		case 'avif':
			return encodeAvif(img, opts.quality);
		case 'gif':
			return encodeGif(img, opts.background ?? '#ffffff');
		case 'bmp':
			return new Blob([encodeBmp(img)], { type: 'image/bmp' });
		case 'ico':
			return encodeIco(img);
		default:
			throw new Error(`Cannot encode ${target.name}`);
	}
}

function toCanvas(img: RawImage, background?: string): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = img.width;
	canvas.height = img.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D is not available');
	const pixels = new ImageData(img.data, img.width, img.height);
	if (background) {
		// putImageData bypasses compositing, so go through a scratch canvas.
		const scratch = document.createElement('canvas');
		scratch.width = img.width;
		scratch.height = img.height;
		scratch.getContext('2d')?.putImageData(pixels, 0, 0);
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, img.width, img.height);
		ctx.drawImage(scratch, 0, 0);
	} else {
		ctx.putImageData(pixels, 0, 0);
	}
	return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error(`Could not encode ${type}`))),
			type,
			quality
		)
	);
}

async function encodeWebp(img: RawImage, quality: number): Promise<Blob> {
	// Chrome and Firefox encode WebP natively. Safari doesn't — it silently
	// hands back a PNG, so check the type instead of trusting the call.
	const native = await canvasToBlob(toCanvas(img), 'image/webp', quality / 100).catch(() => null);
	if (native?.type === 'image/webp') return native;
	const { encode } = await import('@jsquash/webp');
	const buffer = await encode(new ImageData(img.data, img.width, img.height), { quality });
	return new Blob([buffer], { type: 'image/webp' });
}

async function encodeAvif(img: RawImage, quality: number): Promise<Blob> {
	const { encode } = await import('@jsquash/avif');
	const buffer = await encode(new ImageData(img.data, img.width, img.height), {
		quality,
		speed: 8
	});
	return new Blob([buffer], { type: 'image/avif' });
}

async function encodeGif(img: RawImage, background: string): Promise<Blob> {
	const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

	// GIF transparency is on or off, so a soft edge cannot be half see-through.
	// Blend those pixels onto the background first, or they keep their own
	// colour at full strength and read as a halo. Fully clear pixels stay clear.
	const flattened = flattenPartialAlpha(img.data, hexToRgb(background));
	const rgba = new Uint8Array(flattened.buffer, flattened.byteOffset, flattened.byteLength);

	let hasTransparency = false;
	for (let i = 3; i < rgba.length; i += 4) {
		if (rgba[i] < 128) {
			hasTransparency = true;
			break;
		}
	}

	const format = hasTransparency ? 'rgba4444' : 'rgb565';
	const palette = quantize(rgba, 256, { format, oneBitAlpha: true });
	const index = applyPalette(rgba, palette, format);
	const transparentIndex = hasTransparency ? palette.findIndex((c) => c[3] === 0) : -1;

	const gif = GIFEncoder();
	gif.writeFrame(index, img.width, img.height, {
		palette,
		transparent: transparentIndex >= 0,
		transparentIndex: Math.max(0, transparentIndex)
	});
	gif.finish();
	return new Blob([gif.bytes()], { type: 'image/gif' });
}

async function encodeIco(img: RawImage): Promise<Blob> {
	let canvas = toCanvas(img);
	const scale = 256 / Math.max(img.width, img.height);
	if (scale < 1) {
		const scaled = document.createElement('canvas');
		scaled.width = Math.max(1, Math.round(img.width * scale));
		scaled.height = Math.max(1, Math.round(img.height * scale));
		const ctx = scaled.getContext('2d');
		if (!ctx) throw new Error('Canvas 2D is not available');
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
		canvas = scaled;
	}
	const png = await canvasToBlob(canvas, 'image/png');
	const ico = wrapPngAsIco(new Uint8Array(await png.arrayBuffer()), canvas.width, canvas.height);
	return new Blob([ico], { type: 'image/x-icon' });
}
