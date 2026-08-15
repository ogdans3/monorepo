import type { Format, PairPage } from './formats';
import type { FaqItem } from '$lib/faq';

/**
 * Questions people actually type before a conversion, answered for one pair
 * and no other.
 *
 * The two trust questions in faq.ts are the same everywhere by design. These
 * are the opposite: derived from the format table the same way pairfacts.ts
 * derives the body copy, so a page about JPG answers the JPG question rather
 * than a generic one with two names swapped. Written as whole sentences that
 * stand on their own, because a search engine or an assistant quotes the
 * answer without the question around it.
 */

/** Rough size class, the same ranking pairfacts.ts uses. */
const WEIGHT: Record<string, number> = {
	avif: 0,
	svg: 0,
	webp: 1,
	heic: 1,
	ico: 1,
	jpg: 2,
	png: 3,
	gif: 3,
	tiff: 4,
	bmp: 4
};

function weight(format: Format): number {
	return WEIGHT[format.id] ?? 2;
}

/** The single most searched question about any conversion. */
function qualityQuestion(page: PairPage): FaqItem {
	const { source, target, sourceName, targetName } = page;
	const q = `Does converting ${sourceName} to ${targetName} lose quality?`;

	if (!source.lossy && target.lossy) {
		return {
			q,
			a: `A little, because ${targetName} saves space by throwing away detail the eye is least likely to miss, while ${sourceName} keeps every pixel exactly. At the default quality of 90 most people can't tell the two apart on a photo. Flat colour, sharp edges and text suffer the most, so lower the quality slider only while you're watching the preview.`
		};
	}
	if (source.lossy && !target.lossy) {
		return {
			q: `Does converting ${sourceName} to ${targetName} improve quality?`,
			a: `No. ${targetName} keeps every pixel it is given, but the detail ${sourceName} discarded when it was first saved is already gone and nothing can bring it back. What you get is a faithful copy of the ${sourceName}, in a bigger file. Convert to ${targetName} when you need a lossless working copy, not to repair an image.`
		};
	}
	if (source.lossy && target.lossy) {
		return {
			q,
			a: `Slightly, because the picture is compressed a second time and each pass throws away a little more. It's rarely visible in one step at a high quality setting. Where it shows is after several rounds, so work from the best original you have rather than converting the same file back and forth.`
		};
	}
	return {
		q,
		a: `No. Both ${sourceName} and ${targetName} store every pixel exactly as it was, so the picture that comes out is identical to the one that went in. Only the file size and what can open the file change.`
	};
}

/** Only asked when there is really something to lose. */
function transparencyQuestion(page: PairPage): FaqItem | null {
	const { source, target, sourceName, targetName } = page;
	if (source.transparency === 'none') return null;

	if (target.transparency === 'none') {
		return {
			q: `What happens to a transparent background when I convert ${sourceName} to ${targetName}?`,
			a: `It gets filled in. ${targetName} has no way to store transparency, so every see-through pixel has to become a real colour. White is used unless you pick another one under the preview, and picking the colour of the page the image will sit on is usually what you want. If you need to keep the transparency, convert to PNG or WebP instead.`
		};
	}
	if (target.transparency === 'binary' && source.transparency === 'full') {
		return {
			q: `Does ${targetName} keep the transparency from my ${sourceName}?`,
			a: `Partly. ${targetName} transparency is on or off for each pixel with nothing in between, so a fully see-through area survives but a soft or faded edge can't. Those half transparent pixels are blended onto the background colour you choose, which stops the ragged halo you would otherwise get around the edges.`
		};
	}
	return null;
}

/** The other thing people want to know before they click. */
function sizeQuestion(page: PairPage): FaqItem {
	const { source, target, sourceName, targetName } = page;
	const step = weight(target) - weight(source);
	const q = `Will the ${targetName} file be smaller than the ${sourceName}?`;

	if (step <= -2) {
		return {
			q,
			a: `Usually much smaller. ${targetName} compresses far harder than ${sourceName}, and it's common to see a file drop to a fraction of what it was with no visible difference. How much you save depends on the picture, since photographs compress better than screenshots and line art.`
		};
	}
	if (step === -1) {
		return {
			q,
			a: `Usually a bit smaller, though the gap isn't dramatic. The exact saving depends on the picture. If size is the whole reason you're here, the compress tool will hit a number you name instead of leaving it to chance.`
		};
	}
	if (step === 0) {
		return {
			q,
			a: `Not really. The two formats compress about as hard as each other, so expect a file of roughly the same size. This conversion is about what can open the file, not about saving space.`
		};
	}
	if (step === 1) {
		return {
			q,
			a: `No, expect it to grow somewhat. ${targetName} doesn't compress as hard as ${sourceName}, which is the price of the wider support you're converting for. Compress it afterwards if the size matters.`
		};
	}
	return {
		q,
		a: `No, expect it to be a good deal bigger. ${targetName} stores images far less efficiently than ${sourceName}, so only convert when something genuinely needs ${targetName}. Compress the result afterwards if you have to send it anywhere.`
	};
}

/** True of every conversion here, and asked constantly. */
function metadataQuestion(page: PairPage): FaqItem {
	const { sourceName, targetName } = page;
	return {
		q: `Does converting ${sourceName} to ${targetName} keep the date and location from the original?`,
		a: `No. The image is rebuilt pixel by pixel, so the camera model, the date and any GPS location in the original aren't carried into the ${targetName} file. That cuts both ways: it strips information you may not want to share, and it loses information you may have wanted to keep. Check the original with the metadata viewer first if it matters.`
	};
}

function batchQuestion(page: PairPage): FaqItem {
	const { sourceName, targetName } = page;
	return {
		q: `Can I convert several ${sourceName} files to ${targetName} at once?`,
		a: `Yes. Drop as many files as you like and each one is converted and listed separately, with its own download button. Nothing is queued or rationed, because the work happens on your own device rather than on a server that has to be paid for.`
	};
}

/**
 * Written by hand for the conversions people search for most, where the real
 * question is about the situation rather than about the formats. These lead,
 * because they are the reason the visit happened.
 */
const KNOWN: Record<string, FaqItem[]> = {
	'heic-jpg': [
		{
			q: 'Why will Windows not open my HEIC photos?',
			a: 'HEIC is the format an iPhone saves photos in by default, and Windows doesn\'t read it without an extra codec from the Microsoft Store that\'s not always free. Converting to JPG sidesteps the problem completely, because every version of Windows has opened JPG for decades. The same goes for older photo printers, upload forms and email clients that reject HEIC.'
		},
		{
			q: 'Can I stop my iPhone saving photos as HEIC?',
			a: 'Yes. In Settings, under Camera and then Formats, choose Most Compatible and the camera saves JPG from then on. Worth knowing before you do: a HEIC file is roughly half the size of the same photo as JPG, so the compatible setting costs you storage on every picture you take. Converting only the ones you need to share keeps both.'
		}
	],
	'heic-png': [
		{
			q: 'Should I convert an iPhone photo to PNG or to JPG?',
			a: 'JPG for almost anything you\'re sending or uploading, because the file will be a fraction of the size and nobody will see the difference. PNG only when you\'re going to edit the photo repeatedly and want a lossless working copy, or when whatever you\'re feeding it to demands PNG. A PNG of a normal phone photo is often ten times the size of the HEIC it came from.'
		}
	],
	'png-jpg': [
		{
			q: 'Why is my PNG screenshot so large?',
			a: 'PNG stores every pixel exactly, which is perfect for sharp text and flat colour and wasteful for a screenshot full of photographic detail or a gradient. A full screen PNG can easily run to several megabytes where the same picture as JPG is a few hundred kilobytes. That gap is the usual reason for converting.'
		}
	],
	'jpg-png': [
		{
			q: 'Will converting to PNG remove the JPG artefacts?',
			a: 'No. The blocky edges and the smudging around sharp lines are baked into the pixels of the JPG, and PNG copies those pixels faithfully. Converting gives you a lossless file to edit from, not a cleaner picture. To actually reduce artefacts you need the original from before it was ever saved as JPG.'
		}
	],
	'png-webp': [
		{
			q: 'Is WebP safe to use on a website now?',
			a: 'Yes. Every current browser has supported WebP for years, including Safari since 2020, so you no longer need a JPG or PNG fallback for ordinary visitors. The place to be careful is anything outside a browser, such as an older desktop program or a print service, which may still refuse the file.'
		}
	],
	'webp-jpg': [
		{
			q: 'Why will my program not open a WebP file?',
			a: 'WebP is a web format first, so browsers handle it everywhere while desktop software has been slower. Older versions of Photoshop, plenty of upload forms and a lot of printing services still expect JPG or PNG. Converting is the quickest way past that, and on a photograph the JPG will look the same.'
		}
	],
	'avif-jpg': [
		{
			q: 'Why can nothing open my AVIF file?',
			a: 'AVIF is the newest of the common image formats. Browsers took it up quickly, but desktop software, phones on older systems and most upload forms haven\'t caught up. Converting to JPG is the reliable fix, at the cost of a bigger file, since AVIF compresses better than anything else in wide use.'
		}
	],
	'png-ico': [
		{
			q: 'What size should a favicon be?',
			a: 'Start from a square PNG of at least 256 pixels and the ICO is built with the sizes a browser and Windows actually ask for, 16, 32, 48 and 256, packed into one file. Design it so it still reads at 16 pixels, which usually means one bold shape rather than a shrunken logo. The favicon generator makes the whole set at once.'
		}
	],
	'svg-png': [
		{
			q: 'What size should I export an SVG at?',
			a: 'Twice the size it will be displayed at, so it stays sharp on a high resolution screen. An SVG has no size of its own, since it\'s a set of shapes rather than pixels, so the export size is a decision rather than a property of the file. Keep the SVG as your master and export a new PNG whenever you need a different size.'
		}
	],
	'gif-png': [
		{
			q: 'Which frame of the GIF do I get?',
			a: 'The first one. A GIF holds a whole animation and a PNG holds a single still, so the opening frame is taken and the rest are dropped. If you want a different moment, that frame has to be the first one in the file before you convert.'
		}
	],
	'tiff-jpg': [
		{
			q: 'Why are scanned TIFF files so big?',
			a: 'A scanner stores every pixel without throwing anything away, usually at 300 dots per inch or more, so a single scanned page can run to tens of megabytes. That\'s exactly what you want in an archive and exactly what an email will reject. JPG at a high quality setting normally cuts it by a factor of ten with no visible change on screen.'
		}
	],
	'bmp-png': [
		{
			q: 'Is anything lost converting BMP to PNG?',
			a: 'Nothing. BMP normally stores pixels with no compression at all and PNG compresses them without discarding any, so the picture is identical and the file is very much smaller. There\'s no reason to keep an ordinary BMP once you have the PNG.'
		}
	]
};

/**
 * Three questions specific to this conversion, most useful first. Hand
 * written ones lead where they exist, then quality, then whichever of
 * transparency, size, metadata and batch actually says something here.
 */
export function pairFaq(page: PairPage): FaqItem[] {
	const key = `${page.source.id}-${page.target.id}`;
	const candidates: (FaqItem | null)[] = [
		...(KNOWN[key] ?? []),
		qualityQuestion(page),
		transparencyQuestion(page),
		sizeQuestion(page),
		metadataQuestion(page),
		batchQuestion(page)
	];
	return candidates.filter((item): item is FaqItem => Boolean(item)).slice(0, 3);
}
