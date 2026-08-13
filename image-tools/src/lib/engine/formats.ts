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
	/**
	 * How much transparency the format can carry.
	 * full: a real alpha channel. binary: on or off only, like GIF.
	 * none: every pixel is opaque, so transparency has to be filled in.
	 */
	transparency: 'full' | 'binary' | 'none';
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
		transparency: 'full',
		blurb: 'Keeps every detail sharp and supports transparent backgrounds. Works everywhere. The safe pick for logos, graphics and screenshots.'
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
		transparency: 'none',
		blurb: 'The standard choice for photos. Files are small and every app can open them. It cannot store transparent backgrounds.',
		targetNote:
			'JPG cannot store transparent areas, so they are filled in. White by default, and you can pick any colour.'
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
		transparency: 'full',
		blurb: 'A newer format made for the web. Files are much smaller than PNG or JPG at the same quality, and it keeps transparent backgrounds.'
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
		transparency: 'full',
		blurb: 'The newest web format. It makes the smallest files of all, and every modern browser can show it.',
		targetNote: 'AVIF takes a little longer to make, so big photos can need a few seconds.'
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
		transparency: 'binary',
		blurb: 'Very old but still everywhere. It can only use 256 colours, so photos look rough, but every app can open it.',
		sourceNote: 'Moving GIFs are converted using only their first frame.',
		targetNote:
			'GIF can only use 256 colours, so photos may look grainy. Its transparency is on or off, so soft edges are blended onto the background colour you pick.'
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
		transparency: 'full',
		blurb: 'The format iPhones use for photos. Files are small, but many apps outside Apple cannot open them.'
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
		transparency: 'full',
		blurb: 'A plain Windows format with no compression. Files are big, but even very old programs can open them.'
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
		transparency: 'full',
		blurb: 'The icon format for Windows and websites. Browsers look for it when they show the small tab icon.',
		targetNote: 'Icons stop at 256 × 256. Bigger images are scaled down to fit.'
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
		transparency: 'full',
		blurb: 'Built from shapes instead of pixels, so it stays sharp at any size. Converting turns it into pixels at one fixed size.',
		sourceNote: 'SVG files are drawn at their natural size before converting.'
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
		transparency: 'full',
		blurb: 'A format used for print and scanning. Scanners often make TIFF files. It is rare on the web.',
		sourceNote: 'TIFF files with many pages are read using only the first page.'
	}
};

/**
 * Does this target need a background colour chosen? True when it cannot keep
 * transparency at all, and for on-or-off transparency, where soft edges have
 * to be blended onto something.
 */
export function needsBackground(format: Format): boolean {
	return format.transparency !== 'full';
}

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
