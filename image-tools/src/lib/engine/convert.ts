import type { Format } from './formats';
import { sniffFormat } from './sniff';
import { decodeToRaw } from './decode';
import { encodeRaw, type EncodeOptions } from './encode';
import { outputFileName } from './names';

export interface ConvertOptions extends EncodeOptions {
	/**
	 * Extension for the output name, e.g. ".jpeg" on the …-to-jpeg page.
	 * Defaults to the target's primary extension.
	 */
	targetExt?: string;
}

export interface Converted {
	blob: Blob;
	name: string;
	width: number;
	height: number;
	/** What the file actually was, per its bytes. */
	source: Format;
}

/** The whole pipeline: sniff → decode to RGBA → encode → rename. */
export async function convertFile(file: File, target: Format, opts: ConvertOptions): Promise<Converted> {
	const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
	const source = sniffFormat(head, file.name);
	if (!source) throw new Error(`Not an image format this tool recognises`);
	if (!source.canDecode) throw new Error(`${source.name} files can't be read in the browser`);

	const raw = await decodeToRaw(file, source);
	const blob = await encodeRaw(raw, target, { quality: opts.quality });
	return {
		blob,
		name: outputFileName(file.name, opts.targetExt ?? target.extensions[0]),
		width: raw.width,
		height: raw.height,
		source
	};
}
