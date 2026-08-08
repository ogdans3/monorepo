/**
 * The hub every conversion passes through: decoded, unencoded RGBA pixels.
 * Shape-compatible with the DOM's ImageData, but usable in plain Node too,
 * which keeps the pure encoders (BMP, ICO) testable without a browser.
 */
export interface RawImage {
	width: number;
	height: number;
	/** RGBA, row-major, exactly width × height × 4 bytes. */
	data: Uint8ClampedArray<ArrayBuffer>;
}
