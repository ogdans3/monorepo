import type { Format } from './formats';
import type { RawImage } from './raw';

/**
 * Fetch the heavy decoder for a format ahead of time, so the first conversion
 * does not wait on a megabyte of WASM. Call it when the user shows intent
 * (dragging a file over the page), never on page load. Errors are ignored:
 * this is only ever a head start, and decodeToRaw imports the same modules.
 */
export function warmDecoder(format: Format): void {
	const warm = (load: () => Promise<unknown>) => void load().catch(() => {});
	switch (format.id) {
		case 'heic':
			warm(() => import('libheif-js/wasm-bundle'));
			break;
		case 'tiff':
			warm(() => import('utif2'));
			break;
		case 'avif':
			// only needed where the browser cannot decode AVIF itself
			if (!('createImageBitmap' in globalThis)) warm(() => import('@jsquash/avif'));
			break;
	}
}

/**
 * Decode any supported format to raw RGBA. Browser-native codecs do the bulk
 * of the work; WASM/JS decoders are lazy-loaded only for the formats the
 * browser can't read itself (HEIC, TIFF, and AVIF on older engines).
 */
export async function decodeToRaw(blob: Blob, format: Format): Promise<RawImage> {
	switch (format.id) {
		case 'heic':
			return decodeHeic(blob);
		case 'tiff':
			return decodeTiff(blob);
		case 'avif':
			return decodeAvif(blob);
		case 'svg':
			return decodeSvg(blob);
		default:
			return decodeNative(blob);
	}
}

function readPixels(source: CanvasImageSource, width: number, height: number): RawImage {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D is not available');
	ctx.drawImage(source, 0, 0, width, height);
	const { data } = ctx.getImageData(0, 0, width, height);
	return { width, height, data };
}

async function decodeNative(blob: Blob): Promise<RawImage> {
	try {
		const bitmap = await createImageBitmap(blob);
		const raw = readPixels(bitmap, bitmap.width, bitmap.height);
		bitmap.close();
		return raw;
	} catch {
		// Some formats (ICO in some engines) decode via <img> but not ImageBitmap.
		return decodeViaImgElement(blob);
	}
}

async function decodeViaImgElement(blob: Blob, fallbackSize = 0): Promise<RawImage> {
	const url = URL.createObjectURL(blob);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		const width = img.naturalWidth || fallbackSize;
		const height = img.naturalHeight || fallbackSize;
		if (!width || !height) throw new Error('Image has no intrinsic size');
		return readPixels(img, width, height);
	} finally {
		URL.revokeObjectURL(url);
	}
}

function decodeSvg(blob: Blob): Promise<RawImage> {
	// Re-type the blob: object URLs only render as SVG with the right mime.
	const typed = blob.type === 'image/svg+xml' ? blob : new Blob([blob], { type: 'image/svg+xml' });
	// SVGs without width/height report no intrinsic size — render those at 1024.
	return decodeViaImgElement(typed, 1024);
}

async function decodeAvif(blob: Blob): Promise<RawImage> {
	try {
		const bitmap = await createImageBitmap(blob);
		const raw = readPixels(bitmap, bitmap.width, bitmap.height);
		bitmap.close();
		return raw;
	} catch {
		// Older engines without native AVIF: fall back to the WASM decoder.
		const { decode } = await import('@jsquash/avif');
		const decoded = await decode(await blob.arrayBuffer());
		if (!decoded) throw new Error('Could not decode AVIF file');
		return { width: decoded.width, height: decoded.height, data: decoded.data };
	}
}

async function decodeHeic(blob: Blob): Promise<RawImage> {
	const mod = await import('libheif-js/wasm-bundle');
	const libheif = mod.default ?? mod;
	const decoder = new libheif.HeifDecoder();
	const images = decoder.decode(new Uint8Array(await blob.arrayBuffer()));
	if (!images?.length) throw new Error('No image found in HEIC file');

	const image = images[0];
	const width = image.get_width();
	const height = image.get_height();
	const target = new ImageData(width, height);
	try {
		await new Promise<void>((resolve, reject) => {
			image.display(target, (result: ImageData | null) =>
				result ? resolve() : reject(new Error('Could not decode HEIC file'))
			);
		});
	} finally {
		for (const im of images) im.free?.();
	}
	return { width, height, data: target.data };
}

async function decodeTiff(blob: Blob): Promise<RawImage> {
	const UTIF = (await import('utif2')).default;
	const buffer = await blob.arrayBuffer();
	const pages = UTIF.decode(buffer);
	if (!pages.length) throw new Error('No image found in TIFF file');
	const page = pages[0];
	UTIF.decodeImage(buffer, page);
	const rgba = UTIF.toRGBA8(page);
	return {
		width: page.width,
		height: page.height,
		// UTIF allocates plain ArrayBuffers; its types just don't say so.
		data: new Uint8ClampedArray(rgba.buffer as ArrayBuffer, rgba.byteOffset, rgba.byteLength)
	};
}
