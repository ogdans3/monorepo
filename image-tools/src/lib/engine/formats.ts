/**
 * The format registry. Everything else — conversion pages, dropzone accept
 * lists, slugs, SEO copy — is derived from this one table.
 */

export type FormatId =
	| 'png'
	| 'jpg'
	| 'webp'
	| 'avif'
	| 'gif'
	| 'heic'
	| 'bmp'
	| 'ico'
	| 'svg'
	| 'tiff';

export interface Format {
	id: FormatId;
	/** Display name, e.g. "PNG". */
	name: string;
	/** Spelled-out name for page copy. */
	longName: string;
	/** File extensions (with dot), primary first. */
	extensions: string[];
	/** Alternative slug spellings, e.g. jpg → jpeg. Each gets its own page. */
	aliases: string[];
	mime: string;
	/** We can read this format in the browser. */
	canDecode: boolean;
	/** We can write this format in the browser. */
	canEncode: boolean;
	/** Target has a quality setting. */
	lossy: boolean;
	/** Format keeps transparency. */
	alpha: boolean;
	/** One-liner used in page copy. */
	blurb: string;
	/** Caveat shown when converting FROM this format. */
	sourceNote?: string;
	/** Caveat shown when converting TO this format. */
	targetNote?: string;
}

export const FORMATS: Record<FormatId, Format> = {
	png: {
		id: 'png',
		name: 'PNG',
		longName: 'Portable Network Graphics',
		extensions: ['.png'],
		aliases: [],
		mime: 'image/png',
		canDecode: true,
		canEncode: true,
		lossy: false,
		alpha: true,
		blurb: 'Lossless and universally supported, with full transparency. The safe choice for graphics, logos and screenshots.'
	},
	jpg: {
		id: 'jpg',
		name: 'JPG',
		longName: 'Joint Photographic Experts Group',
		extensions: ['.jpg', '.jpeg'],
		aliases: ['jpeg'],
		mime: 'image/jpeg',
		canDecode: true,
		canEncode: true,
		lossy: true,
		alpha: false,
		blurb: 'The default for photographs. Small files and universal support, but no transparency.',
		targetNote: 'JPG has no transparency — transparent areas are filled with white.'
	},
	webp: {
		id: 'webp',
		name: 'WebP',
		longName: 'WebP',
		extensions: ['.webp'],
		aliases: [],
		mime: 'image/webp',
		canDecode: true,
		canEncode: true,
		lossy: true,
		alpha: true,
		blurb: 'Modern web format from Google. Noticeably smaller than PNG or JPG at the same quality, with transparency.'
	},
	avif: {
		id: 'avif',
		name: 'AVIF',
		longName: 'AV1 Image File Format',
		extensions: ['.avif'],
		aliases: [],
		mime: 'image/avif',
		canDecode: true,
		canEncode: true,
		lossy: true,
		alpha: true,
		blurb: 'The newest of the web formats. Exceptional compression, supported by every modern browser.',
		targetNote: 'AVIF encoding is thorough — large photos can take a few seconds.'
	},
	gif: {
		id: 'gif',
		name: 'GIF',
		longName: 'Graphics Interchange Format',
		extensions: ['.gif'],
		aliases: [],
		mime: 'image/gif',
		canDecode: true,
		canEncode: true,
		lossy: false,
		alpha: true,
		blurb: 'Ancient but indestructible. 256 colours, rough transparency, supported by absolutely everything.',
		sourceNote: 'Animated GIFs are flattened to their first frame.',
		targetNote: 'GIF is limited to 256 colours, so photos will look posterised.'
	},
	heic: {
		id: 'heic',
		name: 'HEIC',
		longName: 'High Efficiency Image Container',
		extensions: ['.heic', '.heif'],
		aliases: ['heif'],
		mime: 'image/heic',
		canDecode: true,
		canEncode: false, // HEVC encoding is patent-encumbered; no sane browser path
		lossy: true,
		alpha: true,
		blurb: 'What iPhones shoot. Excellent compression, but poorly supported outside Apple hardware.'
	},
	bmp: {
		id: 'bmp',
		name: 'BMP',
		longName: 'Windows Bitmap',
		extensions: ['.bmp'],
		aliases: [],
		mime: 'image/bmp',
		canDecode: true,
		canEncode: true,
		lossy: false,
		alpha: true,
		blurb: 'Plain, uncompressed Windows bitmap. Large files that any software from the last 30 years can open.'
	},
	ico: {
		id: 'ico',
		name: 'ICO',
		longName: 'Windows Icon',
		extensions: ['.ico'],
		aliases: [],
		mime: 'image/x-icon',
		canDecode: true,
		canEncode: true,
		lossy: false,
		alpha: true,
		blurb: 'The Windows icon format — what browsers expect for favicons.',
		targetNote: 'Icons are capped at 256 × 256; larger images are scaled down to fit.'
	},
	svg: {
		id: 'svg',
		name: 'SVG',
		longName: 'Scalable Vector Graphics',
		extensions: ['.svg'],
		aliases: [],
		mime: 'image/svg+xml',
		canDecode: true,
		canEncode: false, // raster → vector is tracing, a different tool entirely
		lossy: false,
		alpha: true,
		blurb: 'Vector, not pixels — it scales forever. Rasterising fixes it at one size for tools that need pixels.',
		sourceNote: 'SVGs are rasterised at their intrinsic size.'
	},
	tiff: {
		id: 'tiff',
		name: 'TIFF',
		longName: 'Tagged Image File Format',
		extensions: ['.tiff', '.tif'],
		aliases: ['tif'],
		mime: 'image/tiff',
		canDecode: true,
		canEncode: false,
		lossy: false,
		alpha: true,
		blurb: 'The archival and print workhorse — common out of scanners and DTP tools, rare on the web.',
		sourceNote: 'Multi-page TIFFs are read as their first page.'
	}
};

export const ALL_FORMATS: Format[] = Object.values(FORMATS);
export const SOURCES: Format[] = ALL_FORMATS.filter((f) => f.canDecode);
export const TARGETS: Format[] = ALL_FORMATS.filter((f) => f.canEncode);

/** id, alias or extension (with or without dot) → Format. */
const LOOKUP = new Map<string, Format>();
for (const f of ALL_FORMATS) {
	for (const key of [f.id, ...f.aliases, ...f.extensions.map((e) => e.slice(1))]) {
		LOOKUP.set(key, f);
	}
}

export function resolveFormat(token: string): Format | undefined {
	return LOOKUP.get(token.toLowerCase().replace(/^\./, ''));
}

/** The `accept` attribute for file inputs: every readable extension + mime. */
export function acceptAttribute(): string {
	const parts = new Set<string>();
	for (const f of SOURCES) {
		for (const ext of f.extensions) parts.add(ext);
		parts.add(f.mime);
	}
	parts.add('image/heif');
	return [...parts].join(',');
}

export interface Pair {
	source: Format;
	target: Format;
	/** Canonical slug, e.g. "heic-to-jpg". */
	slug: string;
}

/** Every canonical conversion pair (no aliases, no identity conversions). */
export function allPairs(): Pair[] {
	const pairs: Pair[] = [];
	for (const source of SOURCES) {
		for (const target of TARGETS) {
			if (source.id === target.id) continue;
			pairs.push({ source, target, slug: `${source.id}-to-${target.id}` });
		}
	}
	return pairs;
}

/** A parsed conversion page, including alias spellings like heif-to-jpeg. */
export interface PairPage {
	source: Format;
	target: Format;
	/** The name as spelled in the URL, e.g. "HEIF" on /heif-to-jpg. */
	sourceName: string;
	targetName: string;
	slug: string;
	/** The canonical slug this page should point its rel=canonical at. */
	canonicalSlug: string;
	/** Output extension matching the page's spelling, e.g. ".jpeg". */
	targetExt: string;
}

export function parsePairSlug(slug: string): PairPage | null {
	const cut = slug.indexOf('-to-');
	if (cut <= 0) return null;
	const sourceToken = slug.slice(0, cut);
	const targetToken = slug.slice(cut + 4);
	if (!/^[a-z0-9]+$/.test(sourceToken) || !/^[a-z0-9]+$/.test(targetToken)) return null;

	const source = resolveFormat(sourceToken);
	const target = resolveFormat(targetToken);
	if (!source || !target) return null;
	if (!source.canDecode || !target.canEncode) return null;
	if (source.id === target.id) return null;
	// Only ids and aliases make slugs — extensions resolve too, but ".jpg" ≠ a page.
	if (![source.id, ...source.aliases].includes(sourceToken)) return null;
	if (![target.id, ...target.aliases].includes(targetToken)) return null;

	return {
		source,
		target,
		sourceName: sourceToken === source.id ? source.name : sourceToken.toUpperCase(),
		targetName: targetToken === target.id ? target.name : targetToken.toUpperCase(),
		slug,
		canonicalSlug: `${source.id}-to-${target.id}`,
		targetExt: `.${targetToken}`
	};
}

/** Every page slug that should exist, alias spellings included. */
export function allPairSlugs(): string[] {
	const slugs: string[] = [];
	for (const source of SOURCES) {
		for (const target of TARGETS) {
			if (source.id === target.id) continue;
			for (const a of [source.id, ...source.aliases]) {
				for (const b of [target.id, ...target.aliases]) {
					slugs.push(`${a}-to-${b}`);
				}
			}
		}
	}
	return slugs;
}

/** Conversions to cross-link from a pair page: same source, then same target. */
export function relatedPairs(page: PairPage, limit = 8): Pair[] {
	const sameSource = allPairs().filter(
		(p) => p.source.id === page.source.id && p.target.id !== page.target.id
	);
	const sameTarget = allPairs().filter(
		(p) => p.target.id === page.target.id && p.source.id !== page.source.id
	);
	const related: Pair[] = [];
	const seen = new Set<string>();
	for (const p of [...sameSource, ...sameTarget]) {
		if (seen.has(p.slug)) continue;
		seen.add(p.slug);
		related.push(p);
		if (related.length >= limit) break;
	}
	return related;
}
