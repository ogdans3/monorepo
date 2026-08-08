// Hand-rolled declarations for dependencies that ship without types.

declare module 'gifenc' {
	export interface GifWriteFrameOptions {
		palette?: number[][];
		transparent?: boolean;
		transparentIndex?: number;
		delay?: number;
		repeat?: number;
		dispose?: number;
		first?: boolean;
	}
	export function GIFEncoder(): {
		writeFrame(index: Uint8Array, width: number, height: number, opts?: GifWriteFrameOptions): void;
		finish(): void;
		bytes(): Uint8Array<ArrayBuffer>;
	};
	export function quantize(
		rgba: Uint8Array,
		maxColors: number,
		opts?: { format?: string; oneBitAlpha?: boolean | number; clearAlpha?: boolean }
	): number[][];
	export function applyPalette(
		rgba: Uint8Array,
		palette: number[][],
		format?: string
	): Uint8Array<ArrayBuffer>;
}

declare module 'libheif-js/wasm-bundle' {
	export interface HeifImage {
		get_width(): number;
		get_height(): number;
		display(target: ImageData, done: (result: ImageData | null) => void): void;
		free?(): void;
	}
	export const HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
	const libheif: { HeifDecoder: typeof HeifDecoder };
	export default libheif;
}
