import { FORMATS, resolveFormat, type Format } from './formats';

/**
 * Identify a file by its first bytes rather than trusting the extension.
 * Falls back to the extension for formats that sniff clean (or not at all).
 */
export function sniffFormat(head: Uint8Array, fileName?: string): Format | undefined {
	return sniffMagic(head) ?? sniffSvg(head) ?? sniffExtension(fileName);
}

function sniffMagic(b: Uint8Array): Format | undefined {
	if (b.length < 12) return undefined;
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return FORMATS.png;
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return FORMATS.jpg;
	if (ascii(b, 0, 4) === 'GIF8') return FORMATS.gif;
	if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return FORMATS.webp;
	if (b[0] === 0x42 && b[1] === 0x4d) return FORMATS.bmp;
	if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return FORMATS.ico;
	if (ascii(b, 0, 4) === 'II\x2a\x00' || ascii(b, 0, 4) === 'MM\x00\x2a') return FORMATS.tiff;
	if (ascii(b, 4, 8) === 'ftyp') return sniffFtyp(b);
	return undefined;
}

const AVIF_BRANDS = new Set(['avif', 'avis']);
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs', 'mif1', 'msf1']);

/** ISO-BMFF: both HEIC and AVIF are ftyp boxes — the brands tell them apart. */
function sniffFtyp(b: Uint8Array): Format | undefined {
	const boxSize = (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
	const end = Math.min(b.length, boxSize);
	const brands = [ascii(b, 8, 12)];
	for (let at = 16; at + 4 <= end; at += 4) brands.push(ascii(b, at, at + 4));
	if (brands.some((brand) => AVIF_BRANDS.has(brand))) return FORMATS.avif;
	if (brands.some((brand) => HEIC_BRANDS.has(brand))) return FORMATS.heic;
	return undefined;
}

function sniffSvg(b: Uint8Array): Format | undefined {
	const text = new TextDecoder('utf-8', { fatal: false })
		.decode(b.slice(0, 1024))
		.replace(/^﻿/, '')
		.trimStart();
	if (text.startsWith('<') && /<svg[\s>]/i.test(text)) return FORMATS.svg;
	return undefined;
}

function sniffExtension(fileName?: string): Format | undefined {
	const ext = fileName?.match(/\.([^./\\]+)$/)?.[1];
	return ext ? resolveFormat(ext) : undefined;
}

function ascii(b: Uint8Array, from: number, to: number): string {
	let s = '';
	for (let i = from; i < to; i++) s += String.fromCharCode(b[i]);
	return s;
}
