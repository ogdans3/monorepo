import type { Format, PairPage } from './formats';

/**
 * Facts that are true of one conversion and no other, derived from the format
 * table. Without these every pair page is the same template with two names
 * swapped, which reads as boilerplate to a person and to a search engine.
 */

/** Rough size class, used to say something honest about the file size. */
type Weight = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

const WEIGHT: Record<string, Weight> = {
	avif: 'tiny',
	webp: 'small',
	heic: 'small',
	jpg: 'medium',
	png: 'large',
	gif: 'large',
	tiff: 'huge',
	bmp: 'huge',
	ico: 'small',
	svg: 'tiny'
};

const ORDER: Weight[] = ['tiny', 'small', 'medium', 'large', 'huge'];

function sizeSentence(source: Format, target: Format, sourceName: string, targetName: string): string {
	const from = ORDER.indexOf(WEIGHT[source.id] ?? 'medium');
	const to = ORDER.indexOf(WEIGHT[target.id] ?? 'medium');
	const step = to - from;
	if (step <= -2) {
		return `${targetName} files are usually a good deal smaller than ${sourceName}, so this is a common way to save space.`;
	}
	if (step === -1) {
		return `${targetName} files are usually a little smaller than ${sourceName}.`;
	}
	if (step === 0) {
		return `File sizes stay roughly similar, so this is about what can open the file rather than about space.`;
	}
	if (step === 1) {
		return `${targetName} files are usually a little bigger than ${sourceName}, which is the price of wider support.`;
	}
	return `${targetName} files are usually much bigger than ${sourceName}, so only do this when something really needs ${targetName}.`;
}

function transparencySentence(source: Format, target: Format, targetName: string): string | null {
	if (source.transparency === 'none') return null; // nothing to lose
	if (target.transparency === 'none') {
		return `${targetName} cannot store transparency, so see-through areas are filled with the colour you pick below.`;
	}
	if (target.transparency === 'binary' && source.transparency === 'full') {
		return `${targetName} transparency is on or off with no in between, so soft edges are blended onto the background colour.`;
	}
	return null;
}

function qualitySentence(source: Format, target: Format, sourceName: string, targetName: string): string | null {
	if (!source.lossy && target.lossy) {
		return `${sourceName} keeps every pixel exactly, while ${targetName} throws some detail away to save space. Use the quality slider to decide how much.`;
	}
	if (source.lossy && !target.lossy) {
		return `${targetName} is lossless, but it cannot bring back detail ${sourceName} already discarded. The file will grow without looking better.`;
	}
	if (source.lossy && target.lossy) {
		return `Both formats are lossy, so this saves the picture a second time. Keep the quality high if the image matters.`;
	}
	return null;
}

/** The one thing most people are actually here to do. */
function reasonSentence(source: Format, target: Format, sourceName: string, targetName: string): string {
	const key = `${source.id}-${target.id}`;
	const known: Record<string, string> = {
		'heic-jpg': 'This is the usual fix for iPhone photos that a website, an email or a Windows PC refuses to open.',
		'heic-png': 'Useful when you want an iPhone photo in a format that keeps every pixel exactly as it was.',
		'png-jpg': 'The usual reason is file size. A screenshot or export saved as PNG can be several times bigger than it needs to be.',
		'jpg-png': 'Worth doing when you need a lossless copy to edit further, though it will not undo the compression already in the JPG.',
		'png-webp': 'A common step before putting an image on a website, since pages load faster with smaller files.',
		'jpg-webp': 'A common step before putting a photo on a website. Same picture, noticeably smaller file.',
		'webp-jpg': 'Handy when an older program or an upload form does not accept WebP yet.',
		'webp-png': 'Handy when something will not take WebP and you want to keep the transparency.',
		'avif-jpg': 'AVIF is very new, so this is the fix when an app or a printer does not recognise it.',
		'png-ico': 'This is how you turn a logo into the small icon a browser shows on a tab.',
		'svg-png': 'Turns a logo into pixels for places that will not take vector files, like most social sites and documents.',
		'gif-png': 'Takes a single still out of a GIF at full quality.',
		'tiff-jpg': 'Scanners produce TIFF files that are far too big to email. This is the usual answer.',
		'bmp-png': 'BMP files are enormous for what they hold. PNG keeps every pixel and takes a fraction of the room.'
	};
	if (known[key]) return known[key];
	if (target.id === 'ico') return `Turns a ${sourceName} image into the icon format browsers and Windows expect.`;
	if (source.id === 'heic') return `Puts an iPhone photo into a format more programs can open.`;
	if (target.id === 'webp' || target.id === 'avif') {
		return `Both are modern web formats, so this is usually about making a page load faster.`;
	}
	if (source.id === 'svg') return `Turns a drawing made of shapes into fixed pixels, for places that need an ordinary image.`;
	return `Most people do this because something they are using will not accept ${sourceName} files.`;
}

/**
 * Two to four sentences that belong to this pair alone. Ordered so the most
 * useful one comes first, since that is what gets read and quoted.
 */
export function pairFacts(page: PairPage): string[] {
	const { source, target, sourceName, targetName } = page;
	return [
		reasonSentence(source, target, sourceName, targetName),
		sizeSentence(source, target, sourceName, targetName),
		qualitySentence(source, target, sourceName, targetName),
		transparencySentence(source, target, targetName)
	].filter((s): s is string => Boolean(s));
}
