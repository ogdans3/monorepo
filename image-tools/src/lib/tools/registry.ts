/**
 * The tools registry. Nav, both hubs, the landing section, the sitemap,
 * cross-links and every tool page's SEO copy derive from this one table,
 * mirroring how formats.ts drives the conversion pages.
 *
 * Copy style: plain sentences, no em dashes, no semicolons (guarded by test).
 */

/**
 * Categories are grouped by what the visitor is trying to do, not by how the
 * code works. Two rules learned by getting it wrong: a category with one tool
 * is just a lonely heading, and tools that only look at an image do not belong
 * next to tools that change it.
 */
export type ToolCategory =
	| 'frame'
	| 'size'
	| 'colour'
	| 'decorate'
	| 'annotate'
	| 'privacy'
	| 'inspect'
	| 'web'
	| 'pdf';

export const CATEGORIES: { id: ToolCategory; label: string; blurb: string }[] = [
	{ id: 'frame', label: 'Crop and combine', blurb: 'Change what is in the frame.' },
	{ id: 'size', label: 'Size and orientation', blurb: 'Resize, rotate and mirror.' },
	{ id: 'colour', label: 'Colour and light', blurb: 'Tune how the image looks.' },
	{ id: 'decorate', label: 'Borders and effects', blurb: 'Frame it and finish it.' },
	{ id: 'annotate', label: 'Text and marks', blurb: 'Put your words on it.' },
	{ id: 'privacy', label: 'Privacy', blurb: 'Hide what should not be shared.' },
	{ id: 'inspect', label: 'Inspect', blurb: 'Look at an image without changing it.' },
	{ id: 'web', label: 'For the web', blurb: 'Smaller files and site assets.' },
	{ id: 'pdf', label: 'PDF', blurb: 'Work with documents. These live under /pdf.' }
];

/** PDF tools live under /pdf, everything else under /tools. */
export const PDF_CATEGORY: ToolCategory = 'pdf';

export interface ImageTool {
	/** URL slug, also the route folder name, under /tools or /pdf. */
	slug: string;
	category: ToolCategory;
	/** Short label for nav, hub and lists. */
	name: string;
	h1: string;
	/** <title>, aim below 60 characters. */
	title: string;
	/** Meta description, aim for 150 to 160 characters. */
	description: string;
	lede: string;
	/** One-liner for the hub and landing lists. */
	blurb: string;
	/** The how-to section, one list item each. */
	steps: string[];
	aboutHeading: string;
	/** Paragraphs for the about section. */
	about: string[];
	/**
	 * Slugs to offer as the obvious next step, most useful first. Hand-picked,
	 * because "you cropped a photo, now sharpen it" beats an alphabetical list.
	 */
	next?: string[];
	/** Extra words people search for, used by the hub search box. */
	keywords?: string[];
	/**
	 * Two questions this tool answers and no other tool does. They sit after
	 * the two shared trust questions, and they are the reason a tool page has
	 * anything of its own to say. Write the answer so it stands alone, since
	 * that is how a search result or an assistant will quote it. A test
	 * insists every tool has them.
	 */
	faq: { q: string; a: string }[];
	/** Output name suffix, e.g. "-cropped". */
	suffix: string;
}

export const TOOLS: ImageTool[] = [
	{
		slug: 'crop-image',
		category: 'frame',
		name: 'Crop',
		h1: 'Crop an image',
		title: 'Crop Image Online - Free, Private, No Upload',
		description:
			'Crop images online free, right in your browser. Aspect ratio presets, exact pixel sizes and no uploads. Works with PNG, JPG, WebP, HEIC and more.',
		lede: 'Crop images for free, right in your browser. Drag the frame, pick a shape if you need one, and download.',
		blurb: 'Drag a frame, pick a shape and download at full quality.',
		steps: [
			'Drop an image in the box above. Any format this site can read works, even HEIC and TIFF.',
			'Drag the corners or edges of the crop frame, or pick a preset like 1:1 or 16:9. You can also type exact pixel sizes.',
			'Choose a format and download. The file keeps its name, with -cropped added.'
		],
		aboutHeading: 'About cropping images here',
		about: [
			'The crop frame shows a faint grid that helps you line things up. Lock the shape for profile pictures or thumbnails, or keep it free and cut exactly what you want.',
			'Cropping happens in your browser. The image is never uploaded, and the download uses the full quality of your original, not the small preview.'
		],
		next: ['trim-image', 'resize-image', 'round-corners'],
		keywords: ['cut', 'square', 'aspect ratio', 'thumbnail'],
		faq: [
			{
				q: 'Does cropping an image reduce its quality?',
				a: 'Not in itself. Cropping throws away the parts of the picture outside the frame and leaves the rest untouched at full resolution, so what remains is exactly as sharp as it was. Quality only drops if you save the result as JPG at a low setting, or if you crop so tightly that the piece you kept has to be enlarged later.'
			},
			{
				q: 'How do I crop a photo to a perfect square?',
				a: 'Pick the 1:1 preset and the frame locks to a square you can drag around the picture until the right part is inside it. That\'s the shape most profile pictures and feed posts want. If you need an exact pixel size as well, type the width and the height into the boxes and the frame snaps to it.'
			}
		],
		suffix: '-cropped'
	},
	{
		slug: 'combine-images',
		category: 'frame',
		name: 'Combine',
		h1: 'Combine images into one',
		title: 'Combine Images Into One - Free Online, No Upload',
		description:
			'Combine multiple images into one online free. Side by side, stacked or in a grid, with draggable dividers, adjustable spacing and full control of the crop.',
		lede: 'Put photos side by side, stack them or build a grid. Drag the dividers to decide how much room each image gets, and drag any image to choose which part shows.',
		blurb: 'Side by side, stacked or a grid, with draggable dividers.',
		steps: [
			'Drop two or more images in the box above.',
			'Pick a layout, drag the dividers to set the split, and drag any image to position it inside its cell.',
			'Set the output size and spacing, then download the combined image.'
		],
		aboutHeading: 'About combining images here',
		about: [
			'Each image fills its own cell, and you can drag it to choose which part shows. Nothing gets squashed or stretched. Moving the lines changes how much room each image gets, which makes side by side shots and simple collages quick to build.',
			'The preview is shrunk to fit your screen. The download uses the exact size you set.'
		],
		next: ['blend-images', 'split-image', 'image-to-pdf'],
		keywords: ['collage', 'side by side', 'merge photos', 'grid'],
		faq: [
			{
				q: 'How do I put two photos side by side?',
				a: 'Drop both images, choose the side by side layout and you get one picture with the two of them next to each other. Drag the divider between them to give one more room than the other, and drag either photo inside its own cell to choose which part shows. The result downloads as a single file.'
			},
			{
				q: 'Do the images have to be the same size?',
				a: 'No. Each one is fitted into its own cell and the parts that don\'t fit are cropped rather than squashed, so nothing ends up stretched. Drag a photo inside its cell to pick which part survives that crop. If you would rather see whole images with no cropping, add spacing so each cell keeps its own shape.'
			}
		],
		suffix: '-combined'
	},
	{
		slug: 'resize-image',
		category: 'size',
		name: 'Resize',
		h1: 'Resize an image',
		title: 'Resize Image Online - Free, Private, No Upload',
		description:
			'Resize images online free, right in your browser. Exact pixel sizes or quick percentages, with the aspect ratio locked so nothing gets stretched.',
		lede: 'Type a new size or pick a percent. The shape stays locked, so nothing gets stretched.',
		blurb: 'Exact pixels or quick percentages, with the shape locked.',
		steps: [
			'Drop an image in the box above.',
			'Type a new width or height, or hit a percentage like 50%. With the lock on, the other side follows automatically.',
			'Choose an output format and download at the exact new size.'
		],
		aboutHeading: 'About resizing images here',
		about: [
			'If you shrink a photo in one big jump, it can turn muddy. This tool shrinks in several small steps instead, so edges and text stay sharp.',
			'You can also make images bigger, but no tool can invent detail. Bigger versions will look a little soft.'
		],
		next: ['sharpen-image', 'compress-image', 'bulk-resize'],
		keywords: ['scale', 'dimensions', 'shrink', 'enlarge'],
		faq: [
			{
				q: 'Will resizing make my image blurry?',
				a: 'Making an image smaller keeps it sharp, and the sharpen tool will bring back any crispness the shrinking softened. Making it bigger is the problem, because the extra pixels have to be invented from the ones already there, so the result looks soft no matter what tool you use. Always resize down from the largest original you have.'
			},
			{
				q: 'How do I resize an image without stretching it?',
				a: 'Leave the lock on. With the lock closed you type one measurement and the other follows automatically, which keeps the original proportions and stops anything looking squashed. Turn the lock off only when something demands an exact width and height that don\'t match the shape of your picture, and expect distortion when you do.'
			}
		],
		suffix: '-resized'
	},
	{
		slug: 'rotate-image',
		category: 'size',
		name: 'Rotate',
		h1: 'Rotate an image',
		title: 'Rotate Image Online - Free, Private, No Upload',
		description:
			'Rotate images in 90 degree steps online free, right in your browser. A sideways phone photo is fixed in two clicks, with no uploads and no signup.',
		lede: 'Turn your image in 90 degree steps. A phone photo lying on its side is fixed in two clicks.',
		blurb: 'Quarter turns, two clicks and done.',
		steps: [
			'Drop an image in the box above.',
			'Use the rotate buttons for quarter turns. The preview always shows exactly what you will get. Flip buttons are there too.',
			'Choose an output format and download.'
		],
		aboutHeading: 'About rotating images here',
		about: [
			'Photos open the right way up, just as your camera saved them. Turning loses no quality at all.',
			'Need a mirror image instead? The flip tool does that, and the flip buttons here work too. The image is only saved again when you download it.'
		],
		next: ['flip-image', 'crop-image'],
		keywords: ['turn', 'sideways', 'straighten', 'orientation'],
		faq: [
			{
				q: 'Why does my photo look sideways in some programs but not others?',
				a: 'A phone doesn\'t usually turn the picture when you hold the camera sideways. It saves it the way the sensor saw it and writes a note in the file saying which way up it should be shown. Programs that read that note show it correctly and programs that ignore it show it on its side. Rotating here turns the actual pixels, so it looks right everywhere.'
			},
			{
				q: 'Does rotating a JPG lose quality?',
				a: 'A quarter turn moves whole pixels around without changing any of them, so nothing is lost in the rotation itself. What costs you a little is saving the file again as JPG afterwards. Keep the quality slider high, or download as PNG, and the difference won\'t be visible.'
			}
		],
		suffix: '-rotated'
	},
	{
		slug: 'flip-image',
		category: 'size',
		name: 'Flip',
		h1: 'Flip or mirror an image',
		title: 'Flip or Mirror an Image - Free Online, No Upload',
		description:
			'Flip an image like a mirror, left to right or upside down, free and right in your browser. Full quality out, with no uploads and no signup.',
		lede: 'Mirror your image left to right, flip it upside down, or both. What you see is what you download.',
		blurb: 'Mirror left to right or flip upside down.',
		steps: [
			'Drop an image in the box above. It mirrors left to right right away.',
			'Turn the mirror and flip buttons on or off. The preview updates as you click.',
			'Choose a format and download at full quality.'
		],
		aboutHeading: 'About mirroring images here',
		about: [
			'Mirroring helps with selfies that came out backwards, text that scanned reversed, and stencils or iron-on prints that need to be laid out in reverse.',
			'Flipping is exact and loses nothing. The image is only saved again when you download it, in the format you choose.'
		],
		next: ['rotate-image', 'crop-image'],
		keywords: ['mirror', 'reverse', 'horizontal', 'vertical'],
		faq: [
			{
				q: 'What is the difference between flipping and rotating?',
				a: 'Flipping mirrors the picture, so left and right swap places and any text in the image reads backwards. Rotating turns it, so the picture stays the right way round but stands on a different edge. If your photo is on its side, you want rotate. If you want a mirror image, you want flip.'
			},
			{
				q: 'Why does my selfie look mirrored?',
				a: 'Most phones show you a mirrored preview while you take a selfie, because that\'s what you\'re used to seeing in a mirror, and some then save the picture the correct way round. The result is a photo that looks wrong to you and right to everyone else. Mirroring it left to right here gives you back the version you saw on screen.'
			}
		],
		suffix: '-flipped'
	},
	{
		slug: 'blur-image',
		category: 'privacy',
		name: 'Blur',
		h1: 'Blur part of an image',
		title: 'Blur Part of an Image - Free Online, No Upload',
		description:
			'Blur or pixelate parts of an image online free. Draw boxes or ovals over faces, names or screens, set the strength and download. No uploads.',
		lede: 'Draw a box over anything you want hidden. Choose blur or pixelate, set the strength and download.',
		blurb: 'Draw boxes over the sensitive parts, blur or pixelate them.',
		steps: [
			'Drop an image in the box above.',
			'Drag across the part you want hidden. Boxes and ovals both work, and you can add as many as you need.',
			'Pick blur or pixelate, set the strength, then download. Undo removes the last shape.'
		],
		aboutHeading: 'Blur, pixelate, and when to redact instead',
		about: [
			'Blur makes an area too soft to read. Pixelate turns it into big blocks. Both change the real pixels, so the download doesn\'t contain the hidden part.',
			'One honest warning. Special software can sometimes read blurred text again. For names, card numbers and real secrets, use the redact tool instead. A solid box can\'t be undone.'
		],
		next: ['redact-image', 'pixelate-image', 'remove-exif'],
		keywords: ['censor', 'hide face', 'blur face', 'obscure'],
		faq: [
			{
				q: 'Can a blurred face or number be recovered?',
				a: 'Not from the image itself. The blur is applied to the pixels and the file you download contains only the blurred result, so there\'s nothing underneath to uncover. Two things do give people away: a blur so light that the shape is still readable, and posting the untouched original somewhere else. Use a strong setting and check the preview before you download.'
			},
			{
				q: 'Should I blur or pixelate?',
				a: 'Pixelation is easier to judge, because you can see exactly how much detail is left in the blocks. Blur looks tidier in a screenshot you\'re going to publish. Both are safe when the setting is strong enough, and both are unsafe when it isn\'t. For text like an account number, use a strength where you can\'t read a single character.'
			}
		],
		suffix: '-blurred'
	},
	{
		slug: 'redact-image',
		category: 'privacy',
		name: 'Redact',
		h1: 'Redact an image',
		title: 'Redact an Image Online - Free, Private, No Upload',
		description:
			'Redact images online free. Draw solid boxes over names, faces or numbers in any colour, right in your browser, and download a censored copy. No uploads.',
		lede: 'Draw solid boxes over names, faces or numbers. Black, white or any colour you pick.',
		blurb: 'Solid boxes over anything private. The safe way to censor.',
		steps: [
			'Drop an image in the box above, for example a screenshot with details to hide.',
			'Drag boxes or ovals over whatever needs to go. Pick black, white or a custom colour.',
			'Download the censored copy. Undo removes the last shape if you cover too much.'
		],
		aboutHeading: 'Why solid redaction beats blurring',
		about: [
			'A solid box replaces the pixels under it completely. There\'s nothing left to recover. That makes it the safe choice for names, addresses and card numbers.',
			'The boxes become part of the image itself. They aren\'t a layer someone can peel off. The covered content is gone from the file.'
		],
		next: ['blur-image', 'remove-exif'],
		keywords: ['black box', 'censor', 'hide text', 'cover'],
		faq: [
			{
				q: 'Is a black box safe for hiding sensitive information?',
				a: 'In an image, yes. The box is painted onto the pixels and the ones underneath are gone from the file you download, so there\'s nothing to peel back. This is the difference between redacting a picture and drawing a black rectangle in a PDF or a Word document, where the shape is a separate layer that can simply be deleted to reveal the text under it.'
			},
			{
				q: 'What should I cover in a screenshot before sharing it?',
				a: 'Names and email addresses, account and order numbers, addresses, anything in a browser bar, and the small details people forget: the file path in a title bar, notification badges, the other tabs that are open and the auto-complete suggestions in a search box. Cover more than feels necessary, since the shapes are free.'
			}
		],
		suffix: '-redacted'
	},
	{
		slug: 'adjust-image',
		category: 'colour',
		name: 'Adjust',
		h1: 'Adjust brightness, contrast and saturation',
		title: 'Adjust Brightness and Contrast Online - Free, No Upload',
		description:
			'Adjust image brightness, contrast and saturation online free, with a live preview and no uploads. Brighten dark photos or pull colours back, right in your browser.',
		lede: 'Three sliders with a live preview. Brighten a dark photo, add punch with contrast or pull the colours back.',
		blurb: 'Brightness, contrast and saturation with a live preview.',
		steps: [
			'Drop an image in the box above.',
			'Drag the sliders. The preview updates live, and Reset takes you back to the original.',
			'Choose an output format and download.'
		],
		aboutHeading: 'About adjusting images here',
		about: [
			'Brightness lifts or darkens everything evenly, contrast pushes lights and darks apart, and saturation controls how vivid the colours are. Saturation all the way down gives a clean black and white.',
			'The preview and the download use the same math, so what you see is exactly what you get, at full quality.'
		],
		next: ['sharpen-image', 'image-histogram', 'grayscale-image'],
		keywords: ['brightness', 'contrast', 'saturation', 'exposure'],
		faq: [
			{
				q: 'How do I fix a photo that is too dark?',
				a: 'Raise brightness first, in small steps, until the subject reads clearly. If the picture then looks flat and washed out, add a little contrast to bring the depth back. Watch the darkest and lightest parts while you drag, because detail that goes fully black or fully white is gone and no slider will bring it back.'
			},
			{
				q: 'What is the difference between brightness and contrast?',
				a: 'Brightness lifts or lowers everything by the same amount, so the whole picture gets lighter or darker together. Contrast pushes the dark parts darker and the light parts lighter, which adds punch but also loses detail at both ends. Brightness for an exposure that was wrong, contrast for a picture that looks flat.'
			}
		],
		suffix: '-adjusted'
	},
	{
		slug: 'transparent-background',
		category: 'frame',
		name: 'Transparent',
		h1: 'Make a background transparent',
		title: 'Transparent Background Maker - Free, Private, No Upload',
		description:
			'Make an image background transparent online free. Click a colour, tune the tolerance slider and download as PNG or WebP. No uploads, it runs in your browser.',
		lede: 'Click the colour you want gone. The eraser spreads from that spot until it reaches a different colour, and the tolerance slider decides how strict that\'s.',
		blurb: 'Click a colour to erase it, tune the tolerance. A classic magic wand.',
		steps: [
			'Drop an image in the box above, then click the colour you want to remove.',
			'Adjust the tolerance slider. Higher tolerance erases a wider range of similar shades, and your last click updates live while you drag it.',
			'Undo any click if you go too far, then download as PNG or WebP to keep the transparency.'
		],
		aboutHeading: 'How the transparent background tool works',
		about: [
			'The eraser works like a magic wand. It starts at the pixel you clicked and spreads to neighbouring pixels of similar colour, stopping when it reaches something different. That makes it precise on logos, scans, screenshots and product photos with a plain background.',
			'Export as PNG or WebP to keep the transparency. JPG can\'t store it, so it fills the cleared areas with the colour you pick in the download bar.'
		],
		next: ['replace-color', 'round-corners', 'trim-image'],
		keywords: ['remove background', 'magic wand', 'transparent png', 'cut out'],
		faq: [
			{
				q: 'How do I remove a white background from an image?',
				a: 'Click anywhere on the white and the eraser spreads out from that point, taking every neighbouring pixel close enough in colour until it meets something different. Raise the tolerance if patches of off white survive, and lower it if the eraser eats into your subject. Then download as PNG or WebP, since those keep the transparency.'
			},
			{
				q: 'Why are there rough or coloured edges left around my subject?',
				a: 'The edge pixels are a blend of the subject and the old background, so they\'re neither one colour nor the other. A higher tolerance takes more of them but starts biting into the subject. This works best on flat, even backgrounds like a logo or a product shot on white. A photo of a person against a busy background is a job for a proper cut out.'
			}
		],
		suffix: '-transparent'
	},
	{
		slug: 'remove-exif',
		category: 'privacy',
		name: 'EXIF',
		h1: 'View and remove EXIF data',
		title: 'Remove EXIF Data from Photos - Free, Private, No Upload',
		description:
			'See what a photo reveals about you, camera, time and often the exact place, then download a copy with every trace of metadata removed. Free, no uploads.',
		lede: 'See exactly what a photo says about you, camera, time and often the place, then download a copy with all of it gone.',
		blurb: 'See what a photo reveals, download a copy with nothing in it.',
		steps: [
			'Drop a photo in the box above. The metadata table shows everything the file carries.',
			'Look for the location row in particular. Phones embed GPS coordinates by default.',
			'Download the clean copy. Every metadata block is gone: EXIF, GPS, XMP, IPTC and embedded thumbnails.'
		],
		aboutHeading: 'What EXIF data gives away',
		about: [
			'Most phones and cameras hide extra info inside every photo. It can show the device, the exact time, and often the exact place it was taken. Anyone you send the file to can read it.',
			'The clean copy is made by rebuilding the image from raw pixels. Hidden info can\'t survive that. This tool simply shows you what was there before it goes.'
		],
		next: ['redact-image', 'compress-image'],
		keywords: ['metadata', 'gps', 'location', 'strip data'],
		faq: [
			{
				q: 'Do my photos really contain my location?',
				a: 'Very often, yes. Phones write GPS coordinates into the file by default, accurate enough to identify a house, along with the date and time, the camera or phone model and sometimes the serial number. The table on this page shows exactly what your file carries, which is usually more of a surprise than the answer to this question.'
			},
			{
				q: 'Do social networks strip metadata for me?',
				a: 'The big ones usually do when they process an upload, but you can\'t rely on it, and it does nothing for a photo sent by email, posted to a forum, attached to a listing or shared in a chat that keeps the original file. Anywhere the actual file changes hands, the metadata goes with it. Strip it yourself and the question stops mattering.'
			}
		],
		suffix: '-clean'
	},
	{
		slug: 'watermark-image',
		category: 'annotate',
		name: 'Watermark',
		h1: 'Watermark an image',
		title: 'Add a Watermark to an Image - Free Online, No Upload',
		description:
			'Add a text or logo watermark to images online free. Control size, opacity and colour, place it in any corner or tile it across the whole image. No uploads.',
		lede: 'Put text or a logo on your image. Pick the size, the colour and how see-through it is, in any corner or tiled all over.',
		blurb: 'Text or logo, any corner or tiled across the image.',
		steps: [
			'Drop an image in the box above.',
			'Type your text or pick a logo file, then set size, opacity and colour.',
			'Choose a corner, or tile it across the image, and download.'
		],
		aboutHeading: 'About watermarking here',
		about: [
			'A mark in the corner stays subtle. Tiling repeats it across the whole image, which makes it much harder to crop out or remove.',
			'The watermark becomes part of the pixels at full quality, so it survives in every format you download.'
		],
		next: ['add-text-to-image', 'compress-image'],
		keywords: ['logo', 'copyright', 'branding', 'signature'],
		faq: [
			{
				q: 'Where should I put a watermark so it is not annoying?',
				a: 'A corner at low opacity is the usual answer for photos you want people to enjoy, and it\'s enough to say who made it. Tiling it across the whole image is for proofs and previews you don\'t want used as they\'re. The trade is always the same: the harder a watermark is to remove, the more it gets in the way of the picture.'
			},
			{
				q: 'Can someone remove my watermark?',
				a: 'A corner mark at low opacity can be cropped or painted out by anyone with a little patience, so treat it as a credit rather than a lock. A tiled watermark over the middle of the picture is much harder to remove cleanly. Nothing you put into an image is truly permanent, which is why proofs are usually sent at a low resolution as well.'
			}
		],
		suffix: '-watermarked'
	},
	{
		slug: 'compress-image',
		category: 'web',
		name: 'Compress',
		h1: 'Compress an image to a target size',
		title: 'Compress Image to a Target Size - Free Online, No Upload',
		description:
			'Compress images to an exact file size online free, like under 1 MB or 200 KB. Finds the best quality that fits, optionally downscaling. No uploads.',
		lede: 'Tell it the file size you need, like 500 KB. It finds the best quality that fits. It can also shrink the image if the target is very small.',
		blurb: 'Hit an exact file size, like under 1 MB, at the best quality that fits.',
		steps: [
			'Drop an image in the box above.',
			'Set the target size and pick JPG or WebP. The tool searches for the best quality that stays under it.',
			'Check the result line, then download. Allow downscaling if the target is very tight.'
		],
		aboutHeading: 'How the compressor hits the target',
		about: [
			'The tool tries different quality levels until it finds the highest one that stays under your target. If even the lowest quality is too big, it can shrink the image step by step and try again.',
			'WebP files are usually smaller than JPG at the same quality. Try WebP first if the site you need the file for accepts it.'
		],
		next: ['resize-image', 'bulk-resize'],
		keywords: ['smaller file', 'reduce size', 'kb', 'optimise'],
		faq: [
			{
				q: 'How do I get an image under a specific file size?',
				a: 'Type the size you need, for example 500 KB, and the tool tries different quality settings until it finds the best one that still fits, rather than leaving you to guess with a slider. If the target is very tight for the picture, turn on downscaling and it will also reduce the dimensions, because a smaller image at decent quality beats a large one at terrible quality.'
			},
			{
				q: 'Which format compresses best, JPG or WebP?',
				a: 'WebP, usually by a clear margin at the same visible quality, and it\'s the better choice for anything going on a website. JPG is the safer choice when a form, an older program or a printer has to accept the file, since it has been understood everywhere for decades. Try WebP first and fall back to JPG if something rejects it.'
			}
		],
		suffix: '-compressed'
	},
	{
		slug: 'favicon-generator',
		category: 'web',
		name: 'Favicon',
		h1: 'Generate favicons',
		title: 'Favicon Generator - ICO and PNG Set, Free, No Upload',
		description:
			'Generate a complete favicon set online free: multi size ICO, PNGs for every slot, apple touch icon and the HTML to paste. Runs in your browser, no uploads.',
		lede: 'Drop in one logo and get the whole favicon set: the ICO file, all the PNG sizes, and the HTML to paste.',
		blurb: 'One logo in, the full icon set out, HTML included.',
		steps: [
			'Drop your logo in the box above. Square works best, anything else is padded with transparency.',
			'Check the previews, especially the 16 pixel one. Simple shapes survive, fine detail doesn\'t.',
			'Download the zip and paste the HTML snippet into your page head.'
		],
		aboutHeading: 'What the favicon pack contains',
		about: [
			'The zip holds favicon.ico with 16, 32 and 48 pixel versions embedded, favicon-16x16.png and favicon-32x32.png, apple-touch-icon.png at 180 pixels, and icon-192.png plus icon-512.png for web manifests.',
			'Each size is made from your original, so it stays as sharp as possible. If the 16 pixel one looks muddy, try a simpler logo.'
		],
		next: ['round-corners', 'resize-image'],
		keywords: ['ico', 'site icon', 'tab icon', 'apple touch'],
		faq: [
			{
				q: 'What sizes does a favicon need?',
				a: 'A browser tab uses 16 and 32 pixels, Windows shortcuts use 48, and 180 pixels covers the icon iOS saves to a home screen. All of them are generated here from one image, the small ones packed into a single favicon.ico and the rest as PNG files. Start from a square image of at least 256 pixels so nothing has to be enlarged.'
			},
			{
				q: 'Where do the favicon files go?',
				a: 'Put them in the root of your site, so the browser finds favicon.ico by itself even before it reads any of your HTML, then paste the snippet from this page into the head of your pages to point at the rest. If an old icon sticks around after you change it, that\'s your browser caching it, and a hard refresh clears it.'
			}
		],
		suffix: '-favicons'
	},
	{
		slug: 'round-corners',
		category: 'decorate',
		name: 'Round corners',
		h1: 'Round image corners or crop a circle',
		title: 'Round Image Corners or Crop a Circle - Free, No Upload',
		description:
			'Round the corners of an image or crop it into a perfect circle, free and right in your browser. Adjustable radius, transparent corners, no uploads.',
		lede: 'A radius slider for soft corners, or one switch for a perfect circle. The corners come out transparent.',
		blurb: 'Soft corners or a full circle, with transparent edges.',
		steps: [
			'Drop an image in the box above.',
			'Drag the radius slider, or flip on Circle for a round avatar. Circle crops to a centred square first.',
			'Download as PNG or WebP to keep the transparent corners.'
		],
		aboutHeading: 'About rounding corners here',
		about: [
			'The corners become truly transparent, not painted white, so the image sits cleanly on any background. Circle mode first cuts a square from the middle, which is what avatar pictures need.',
			'Download as PNG or WebP to keep the transparent corners. JPG can\'t store them, so it fills them with the colour you pick in the download bar.'
		],
		next: ['drop-shadow', 'transparent-background'],
		keywords: ['rounded', 'circle', 'avatar', 'radius'],
		faq: [
			{
				q: 'How do I make a circular profile picture?',
				a: 'Turn on Circle. The image is cropped to a centred square first and then cut to a circle, with everything outside it transparent. Download as PNG or WebP, because a JPG has no way to store the transparent area and would fill the corners with a solid colour instead.'
			},
			{
				q: 'Why did my rounded corners come out black or white?',
				a: 'That\'s what happens when the result is saved as JPG. The corners are transparent, JPG can\'t store transparency, so every see-through pixel has to become a real colour. Save as PNG or WebP and the corners stay clear against whatever the image sits on.'
			}
		],
		suffix: '-rounded'
	},
	{
		slug: 'split-image',
		category: 'frame',
		name: 'Split',
		h1: 'Split an image into a grid',
		title: 'Split an Image Into a Grid - Free Online, No Upload',
		description:
			'Split an image into equal tiles online free, for Instagram grids, puzzles or spritesheets. Pick rows and columns, download every tile as a zip. No uploads.',
		lede: 'Pick rows and columns, see the grid on the image, and download every tile in one zip.',
		blurb: 'Cut into equal tiles and download them all as a zip.',
		steps: [
			'Drop an image in the box above.',
			'Set rows and columns. The grid overlay shows exactly where the cuts land.',
			'Download the zip. Tiles are named by row and column so the order never gets lost.'
		],
		aboutHeading: 'About splitting images here',
		about: [
			'Tiles are cut at full quality and sized evenly. The last row and column take any leftover pixels, so nothing is lost.',
			'The classic use is an Instagram grid, but it works just as well for puzzles and posters you print at home.'
		],
		next: ['crop-image', 'combine-images'],
		keywords: ['tiles', 'grid', 'instagram grid', 'slice'],
		faq: [
			{
				q: 'How do I split a photo for an Instagram grid?',
				a: 'Set 1 row and 3 columns for the usual wide strip across a profile, or 3 by 3 for a full square block. Download the zip and post the tiles in the right order, which on Instagram means starting from the last one, since the newest post takes the top left position.'
			},
			{
				q: 'Are the tiles all exactly the same size?',
				a: 'They are as equal as the image allows. When the width doesn\'t divide evenly by the number of columns the spare pixels are spread across the tiles rather than dumped on the last one, so no single tile ends up a few pixels short in a way you would notice. Each file is named by its row and column so the order can\'t get lost.'
			}
		],
		suffix: '-tiles'
	},
	{
		slug: 'sharpen-image',
		category: 'colour',
		name: 'Sharpen',
		h1: 'Sharpen an image',
		title: 'Sharpen an Image Online - Free, Private, No Upload',
		description:
			'Sharpen blurry or soft images online free with an unsharp mask and a live preview, right in your browser. One slider, no uploads, full resolution out.',
		lede: 'One slider with a live preview. It brings back the crisp edges that soft focus or shrinking took away.',
		blurb: 'One slider that makes soft images crisp again.',
		steps: [
			'Drop an image in the box above.',
			'Drag the slider until edges look crisp. If bright outlines appear, go back a little.',
			'Choose a format and download at full quality.'
		],
		aboutHeading: 'How sharpening works here',
		about: [
			'The tool compares your image with a blurry copy of itself. The parts that differ are the edges, and those get boosted. It can\'t invent detail, but it makes real detail easy to see again.',
			'Sharpening is the classic last step after shrinking a photo, which is why it pairs well with the resize tool.'
		],
		next: ['resize-image', 'adjust-image'],
		keywords: ['unsharp', 'crisp', 'blurry fix', 'focus'],
		faq: [
			{
				q: 'Can sharpening fix a blurry photo?',
				a: 'It can make a slightly soft photo look crisp, which covers most pictures that lost their edge to shrinking, a cheap lens or a little camera shake. It can\'t rescue one that\'s badly out of focus or smeared by motion, because the detail was never recorded and sharpening only exaggerates the edges that are already there.'
			},
			{
				q: 'How much sharpening is too much?',
				a: 'Watch the edges between light and dark. When a pale outline appears around them, like a halo, you have gone past the point where it looks natural and into the point where it looks processed. Back off until the halo disappears. Faces and skin need less than buildings and text.'
			}
		],
		suffix: '-sharpened'
	},
	{
		slug: 'invert-image',
		category: 'colour',
		name: 'Invert',
		h1: 'Invert image colours',
		title: 'Invert Image Colors Online - Free, Private, No Upload',
		description:
			'Invert image colors online free. Turn a picture into its negative, or turn a negative back into a picture, right in your browser with no uploads.',
		lede: 'Turn every colour into its opposite, like a photo negative. One click, full quality out.',
		blurb: 'Flip every colour to its opposite, like a film negative.',
		steps: [
			'Drop an image in the box above. It inverts right away.',
			'Use the Original and Inverted buttons to compare. Transparent parts stay transparent.',
			'Choose a format and download at full quality.'
		],
		aboutHeading: 'About inverting colours here',
		about: [
			'Every pixel flips to its opposite. Black turns white, blue turns orange, light turns dark. It\'s the same look as an old film negative.',
			'Inverting is exact and loses nothing. Run it twice and you get your original image back. That also means it can turn a scanned negative into a normal photo.'
		],
		next: ['grayscale-image', 'adjust-image'],
		keywords: ['negative', 'opposite colours', 'film negative'],
		faq: [
			{
				q: 'What is inverting an image used for?',
				a: 'Reading a scanned negative, turning white on black diagrams into black on white so they print without eating a cartridge, checking a design against a dark background, and the occasional visual effect. It\'s also a quick way to see detail hidden in a very dark or very bright area, since the eye reads the flipped version differently.'
			},
			{
				q: 'Does inverting twice give me the original back?',
				a: 'Yes. Every colour is swapped for its exact opposite, so doing it a second time lands on precisely the values you started with. Nothing is estimated or thrown away. Just download as PNG rather than JPG if you\'re going to invert repeatedly, so the compression doesn\'t build up.'
			}
		],
		suffix: '-inverted'
	},
	{
		slug: 'image-color-picker',
		category: 'inspect',
		name: 'Colour picker',
		h1: 'Pick colours from an image',
		title: 'Image Color Picker - Hex Codes and Palette, No Upload',
		description:
			'Pick any colour from an image and get its hex, RGB and HSL codes, plus an extracted palette of the dominant colours. Free, in your browser, no uploads.',
		lede: 'Click anywhere in the image for the exact hex, RGB and HSL values, and get the dominant colours as a ready palette.',
		blurb: 'Click for hex, RGB and HSL, plus the dominant palette.',
		steps: [
			'Drop an image in the box above. The dominant palette appears straight away.',
			'Click any pixel for its exact values. Every pick lands in a history row.',
			'Copy any value with one click. Hex, RGB and HSL are all there.'
		],
		aboutHeading: 'About picking colours here',
		about: [
			'The palette shows the main colours in your image. It\'s a good starting point for picking brand colours or matching a design.',
			'Clicks read the original pixels, not the small preview, so the values are exact.'
		],
		next: ['replace-color', 'image-histogram'],
		keywords: ['hex', 'rgb', 'palette', 'eyedropper'],
		faq: [
			{
				q: 'How do I find the hex code of a colour in a picture?',
				a: 'Click that spot in the image and the exact value appears as hex, RGB and HSL, ready to copy with one click. Every click is kept in a history row, so you can pick several colours from a photo or a screenshot and compare them before you decide.'
			},
			{
				q: 'How are the dominant colours chosen?',
				a: 'The whole image is sampled and the colours are grouped into families, then the largest families are shown in order of how much of the picture they cover. That\'s why a photo of grass gives you several greens rather than one. It\'s a good starting point for a palette, though a designer will usually adjust the result by eye.'
			}
		],
		suffix: '-palette'
	},
	{
		slug: 'bulk-resize',
		category: 'size',
		name: 'Bulk resize',
		h1: 'Bulk resize images',
		title: 'Bulk Resize Images - Free Online, No Upload',
		description:
			'Resize many images at once online free. Set a width or a percentage, pick a format, and download every result in one zip. Nothing gets uploaded.',
		lede: 'Drop a pile of images, set one width or percentage, and take the whole batch home as a zip.',
		blurb: 'One setting, a whole folder of images, one zip out.',
		steps: [
			'Drop any number of images in the box above.',
			'Set a target width or a percentage. Every image keeps its own aspect ratio.',
			'Pick an output format and download the zip.'
		],
		aboutHeading: 'About bulk resizing here',
		about: [
			'Every image is shrunk the same careful way the single resize tool uses, so quality stays high.',
			'You can mix formats. HEIC photos, PNG screenshots and WebP files can all go in the same batch and come out matching.'
		],
		next: ['compress-image', 'resize-image'],
		keywords: ['batch', 'many images', 'multiple', 'folder'],
		faq: [
			{
				q: 'How do I resize many photos at once?',
				a: 'Drop the whole pile in together, set one width or one percentage, and every image is resized and packed into a single zip. There\'s no queue and no limit on how many you add, since the work happens on your own machine rather than on a server that has to ration it.'
			},
			{
				q: 'What happens if the photos are different shapes?',
				a: 'Each one keeps its own proportions. Setting a width means every image comes out that wide with its own height, so a portrait and a landscape photo stay the shapes they were and nothing is stretched or cropped. Use a percentage instead when you want everything reduced by the same amount rather than made the same width.'
			}
		],
		suffix: '-resized'
	},
	{
		slug: 'image-to-pdf',
		category: 'pdf',
		name: 'Image to PDF',
		h1: 'Convert images to a PDF',
		title: 'Image to PDF Converter (JPG, PNG, HEIC) - Free, No Upload',
		description:
			'Convert JPG, PNG, HEIC and more to PDF online free. Combine several images into one PDF, reorder pages, pick page size. Runs in your browser, no uploads.',
		lede: 'Drop one image or twenty. Put them in order, pick a page size and download one PDF.',
		blurb: 'One or many images into a single PDF, pages in your order.',
		steps: [
			'Drop your images in the box above. JPG, PNG, HEIC, WebP and everything else this site reads.',
			'Use the arrows to put the pages in order, then choose matching page sizes or A4.',
			'Download the PDF. One image per page, at full quality.'
		],
		aboutHeading: 'About making PDFs here',
		about: [
			'Each image becomes one page. Match mode makes every page the same size as its image. A4 mode puts each image in the middle of a standard page, which is best for printing.',
			'The PDF is built in your browser. Scans, receipts and ID photos never touch a server. For private papers, that\'s the whole point.'
		],
		next: ['merge-pdf', 'pdf-to-jpg'],
		keywords: ['jpg to pdf', 'png to pdf', 'scan to pdf', 'photos to pdf'],
		faq: [
			{
				q: 'How do I turn several photos into one PDF?',
				a: 'Drop them all in, put them in the order you want with the arrows, and download. Each image becomes one page, at full quality, in a single document. This is the usual way to send scanned or photographed paperwork, since one PDF is easier for the person at the other end than a folder of loose pictures.'
			},
			{
				q: 'Should I choose A4 or match the image?',
				a: 'Choose A4 when the PDF is going to be printed or sent as a document, so every page is the same familiar size with the picture fitted inside it. Match the image when the pictures are the point, for example a set of photographs or artwork, so nothing is surrounded by empty margins.'
			}
		],
		suffix: ''
	},
	{
		slug: 'pdf-to-jpg',
		category: 'pdf',
		name: 'PDF to JPG',
		h1: 'Convert a PDF to images',
		title: 'PDF to JPG Converter - Free, Private, No Upload',
		description:
			'Convert PDF pages to JPG, PNG or WebP online free. Pick the resolution, download single pages or the whole document as a zip. No uploads, fully private.',
		lede: 'Every page becomes an image. Pick the resolution and format, download one page or the whole document as a zip.',
		blurb: 'PDF pages out as JPG, PNG or WebP, single or zipped.',
		steps: [
			'Drop a PDF in the box above.',
			'Pick the resolution. Higher looks better and weighs more.',
			'Download pages one by one, or grab the whole document as a zip.'
		],
		aboutHeading: 'About converting PDFs here',
		about: [
			'Pages are drawn with the same engine Firefox uses to show PDFs, running in your browser. The document never leaves your device. That matters for contracts and anything with a signature on it.',
			'JPG works well for most pages. PNG keeps sharp lines and drawings, and WebP makes the smallest files.'
		],
		next: ['pdf-to-text', 'image-to-pdf'],
		keywords: ['pdf to image', 'pdf to png', 'export pages'],
		faq: [
			{
				q: 'What resolution should I choose when converting a PDF to images?',
				a: '150 dots per inch is plenty for reading on a screen and keeps the files small. 300 is the usual choice for anything that will be printed or where small print has to stay legible. Higher than that mostly buys you a bigger file, since it can\'t add detail the PDF doesn\'t contain.'
			},
			{
				q: 'Can I convert just one page of a PDF?',
				a: 'Yes. Every page is rendered and listed with its own download button, so you can take the single page you need and ignore the rest. The zip is there for when you want the whole document at once.'
			}
		],
		suffix: ''
	},
	{
		slug: 'grayscale-image',
		category: 'colour',
		name: 'Black and white',
		h1: 'Convert an image to black and white',
		title: 'Convert Image to Black and White - Free, No Upload',
		description:
			'Turn a photo black and white online free, right in your browser. True greyscale that keeps detail, with a slider to mix back some colour. No uploads.',
		lede: 'Turn a photo black and white, with a slider if you want to mix a little colour back in.',
		blurb: 'True black and white, with a strength slider.',
		steps: [
			'Drop an image in the box above. It turns black and white right away.',
			'Slide the strength down if you want a partly faded look instead of full black and white.',
			'Choose a format and download at full quality.'
		],
		aboutHeading: 'About black and white here',
		about: [
			'Colours are mixed by how bright they look to the eye, not by a plain average. Green counts most and blue least, which is why skies and leaves keep their difference instead of turning into the same grey mush.',
			'Nothing else about the image changes, and the download is made from your original at full size.'
		],
		next: ['sepia-image', 'adjust-image'],
		keywords: ['black and white', 'greyscale', 'monochrome', 'desaturate'],
		faq: [
			{
				q: 'What is the difference between grayscale and black and white?',
				a: 'Grayscale keeps the full range of greys between black and white, which is what people almost always mean by a black and white photo. True black and white in the strict sense allows only two values with no greys at all, which looks like a fax. This tool gives you greys.'
			},
			{
				q: 'Does converting to grayscale make the file smaller?',
				a: 'Usually a little, because there\'s less colour information to store, though the saving is smaller than most people expect and depends on the format. If size is what you\'re after, the compress tool will do far more for you than removing the colour will.'
			}
		],
		suffix: '-bw'
	},
	{
		slug: 'sepia-image',
		category: 'colour',
		name: 'Sepia',
		h1: 'Add a sepia tone to an image',
		title: 'Sepia Photo Effect Online - Free, Private, No Upload',
		description:
			'Give a photo the warm brown sepia look of an old photograph, free and in your browser. Adjustable strength, full quality out, and no uploads.',
		lede: 'The warm brown of an old photograph. Slide the strength to taste.',
		blurb: 'The warm brown look of an old photograph.',
		steps: [
			'Drop an image in the box above.',
			'Slide the strength until it looks right.',
			'Choose a format and download.'
		],
		aboutHeading: 'About the sepia effect here',
		about: [
			'Sepia is the brown tone real photographs took on with age. The effect mixes each colour towards that warmth rather than just tinting the whole picture, so light and dark areas stay separate.',
			'Pair it with a vignette for a convincingly old look.'
		],
		next: ['vignette-image', 'grayscale-image'],
		keywords: ['vintage', 'old photo', 'retro', 'brown'],
		faq: [
			{
				q: 'What is a sepia photo?',
				a: 'A photograph in shades of warm brown rather than grey. It started as a chemical treatment in the nineteenth century that made prints last longer, and the look stuck as the way old photographs are remembered. Now it is used to suggest age, warmth or nostalgia.'
			},
			{
				q: 'Should I use sepia or grayscale?',
				a: 'Grayscale is the neutral, serious choice and it suits portraits, documents and anything modern. Sepia reads as old and warm, which is lovely on a family photograph and out of place on a product shot. If you\'re not sure, try grayscale first, since sepia is a strong flavour.'
			}
		],
		suffix: '-sepia'
	},
	{
		slug: 'pixelate-image',
		category: 'privacy',
		name: 'Pixelate',
		h1: 'Pixelate an image',
		title: 'Pixelate an Image Online - Free, Private, No Upload',
		description:
			'Pixelate a whole image online free, with a slider for the block size. Runs in your browser with no uploads. For faces and names, redaction is safer.',
		lede: 'Turn the whole image into blocks, with a slider for how big they\'re.',
		blurb: 'Turn the whole image into coarse blocks.',
		steps: [
			'Drop an image in the box above.',
			'Slide the block size until it looks the way you want.',
			'Choose a format and download.'
		],
		aboutHeading: 'Pixelating a whole image, and when not to',
		about: [
			'This covers the entire picture, which is what you want for a censored look, a retro game feel or a low fidelity avatar.',
			'To hide something specific, use the blur tool to cover just that part. And for names or numbers that really must not be readable, use redact and a solid box, because heavy blocks can sometimes be worked backwards.'
		],
		next: ['blur-image', 'redact-image'],
		keywords: ['mosaic', 'blocks', 'censor', '8 bit'],
		faq: [
			{
				q: 'Can pixelated text be read again?',
				a: 'If the blocks are small, sometimes yes. Text is predictable enough that a determined person can work backwards from coarse blocks to the characters that produced them, especially for something with a known shape like a number plate or a date. Use blocks big enough that you can\'t make out a single character yourself, and the guesswork stops being possible.'
			},
			{
				q: 'How big should the blocks be to hide a face?',
				a: 'Big enough that the face is no more than a handful of blocks across. If you can still tell where the eyes are, so can everyone else. Check the preview at the size the picture will actually be seen, since a pixelation that looks strong on a small preview can be much weaker at full size.'
			}
		],
		suffix: '-pixelated'
	},
	{
		slug: 'replace-color',
		category: 'colour',
		name: 'Replace colour',
		h1: 'Replace a colour in an image',
		title: 'Replace a Color in an Image - Free Online, No Upload',
		description:
			'Swap one colour for another in an image online free. Click the colour to change, pick the new one, tune the tolerance. Runs in your browser, no uploads.',
		lede: 'Click the colour you want to change, pick what to change it to, and tune how many similar shades come along.',
		blurb: 'Swap one colour for another, with tolerance.',
		steps: [
			'Drop an image in the box above, then click the colour you want to change.',
			'Pick the new colour and adjust the tolerance until the right areas are covered.',
			'Choose a format and download.'
		],
		aboutHeading: 'About replacing a colour here',
		about: [
			'Every pixel close enough to the colour you clicked is swapped, wherever it is in the image. That makes it good for recolouring a logo, changing a flat background or fixing one wrong brand colour.',
			'Tolerance decides how close is close enough. Photos need a higher tolerance than flat graphics, since a real surface is never one exact colour.'
		],
		next: ['transparent-background', 'image-color-picker'],
		keywords: ['swap colour', 'recolour', 'change colour', 'hue'],
		faq: [
			{
				q: 'How do I change the colour of something in a photo?',
				a: 'Click the colour you want to change, pick the new one, and every pixel close enough to the original is swapped. It works beautifully on flat colour, so logos, icons, diagrams and graphics with clean areas are the ideal case. A photograph of a shirt has hundreds of shades in it, so expect to raise the tolerance and still touch up the edges.'
			},
			{
				q: 'Why did other parts of the picture change too?',
				a: 'The tolerance is set high enough to include colours you didn\'t intend. Every pixel within that distance of the one you clicked is changed, wherever it happens to be in the image, so a sky and a pair of blue jeans can easily fall into the same range. Lower the tolerance until only the area you want is affected.'
			}
		],
		suffix: '-recoloured'
	},
	{
		slug: 'trim-image',
		category: 'frame',
		name: 'Trim',
		h1: 'Trim the edges of an image',
		title: 'Auto Crop and Trim Image Edges - Free, No Upload',
		description:
			'Automatically trim a flat or transparent border from an image, free and in your browser. Removes white space around scans and logos. No uploads.',
		lede: 'Cut away the empty border automatically. Handy for scans with white margins and logos with transparent space around them.',
		blurb: 'Cut away a flat or transparent border automatically.',
		steps: [
			'Drop an image in the box above. The border is found for you.',
			'Raise the tolerance if a slightly uneven border is being left behind.',
			'Choose a format and download the trimmed image.'
		],
		aboutHeading: 'About trimming edges here',
		about: [
			'The colour of the top left pixel is taken as the border colour, and every edge is pulled in while it stays that colour. Transparent edges count as border whatever colour they claim to be.',
			'A scan is never perfectly even, so raise the tolerance a little if a thin line survives. If the whole image is one colour there\'s nothing to keep, and the tool leaves it alone.'
		],
		next: ['crop-image', 'extend-canvas'],
		keywords: ['autocrop', 'auto crop', 'whitespace', 'margins', 'edges'],
		faq: [
			{
				q: 'How do I remove the white space around an image?',
				a: 'Drop it in and the border is detected for you by working in from each edge until the colour changes. Scans with paper margins and logos with transparent space around them are the usual cases. Raise the tolerance if a slightly uneven or off white border is left behind.'
			},
			{
				q: 'Why is nothing being trimmed?',
				a: 'Usually because the border isn\'t as even as it looks. Scanner noise, a faint shadow or JPG compression can leave the margin very slightly different from pixel to pixel, so the edge never reads as one flat colour. Raising the tolerance tells it to treat close enough as the same, which is normally all it takes.'
			}
		],
		suffix: '-trimmed'
	},
	{
		slug: 'extend-canvas',
		category: 'frame',
		name: 'Extend canvas',
		h1: 'Add space around an image',
		title: 'Extend Image Canvas and Add Borders - Free, No Upload',
		description:
			'Add space around an image online free. Grow the canvas on any side, fill it with a colour or leave it transparent, and pad an image to a square. No uploads.',
		lede: 'Grow the space around your image instead of cutting into it. Fill it with a colour, or leave it transparent.',
		blurb: 'Add space around an image, or pad it to a square.',
		steps: [
			'Drop an image in the box above.',
			'Set how much space to add on each side, or hit the square button to pad it evenly.',
			'Pick a fill colour or keep it transparent, then download.'
		],
		aboutHeading: 'About extending the canvas here',
		about: [
			'This is the opposite of cropping. Your image is untouched and new space appears around it, which is exactly what you need when a site demands a square image or a print needs a margin.',
			'Keep the fill transparent and download as PNG or WebP to leave the new space see-through.'
		],
		next: ['add-border', 'crop-image'],
		keywords: ['padding', 'canvas size', 'square', 'instagram'],
		faq: [
			{
				q: 'How do I add white space around a photo?',
				a: 'Set how much space you want on each side and pick white as the fill. The photo stays exactly as it is and the canvas grows around it, which is how you give a picture a margin for printing or framing. Leave the fill transparent instead and download as PNG if you want the space to stay clear.'
			},
			{
				q: 'How is this different from resizing?',
				a: 'Resizing changes the picture itself, making it larger or smaller. Extending the canvas leaves every pixel of the picture untouched and adds empty room around it, so the file gets bigger dimensions without anything being scaled or reinvented. Use it to reach a shape something demands, for example turning a wide photo into a square post.'
			}
		],
		suffix: '-padded'
	},
	{
		slug: 'add-border',
		category: 'decorate',
		name: 'Border',
		h1: 'Add a border to an image',
		title: 'Add a Border to an Image - Free Online, No Upload',
		description:
			'Add a border or frame to an image online free. Pick the width, the colour and an optional inner line, then download. Runs in your browser, no uploads.',
		lede: 'A clean border in any width and colour, with an optional thin inner line.',
		blurb: 'A clean border in any width and colour.',
		steps: [
			'Drop an image in the box above.',
			'Set the width and colour. Add an inner line for a framed look.',
			'Choose a format and download.'
		],
		aboutHeading: 'About borders here',
		about: [
			'The border is drawn around your image, so nothing is covered up and no detail is lost. A wide white border is the classic look for prints and social posts.',
			'The inner line sits just inside the border, which is the trick that makes a plain frame look considered.'
		],
		next: ['drop-shadow', 'extend-canvas', 'round-corners'],
		keywords: ['frame', 'outline', 'edge', 'white border'],
		faq: [
			{
				q: 'How thick should a border on a photo be?',
				a: 'Something between one and three percent of the shorter side looks deliberate without competing with the picture. Anything thinner tends to disappear on a phone screen. A white border with a thin darker inner line is the classic print look and works on almost any photograph.'
			},
			{
				q: 'Does adding a border change the size of the image?',
				a: 'Yes, it\'s added outside the picture, so the file comes out wider and taller by twice the border width and none of the original is covered. If you need to hit an exact final size, work out the border first and resize the photo to fit inside it, or extend the canvas to the size you want instead.'
			}
		],
		suffix: '-bordered'
	},
	{
		slug: 'drop-shadow',
		category: 'decorate',
		name: 'Drop shadow',
		h1: 'Add a drop shadow to an image',
		title: 'Add a Drop Shadow to an Image - Free, No Upload',
		description:
			'Add a soft drop shadow to an image online free. Control the blur, the offset, the colour and the padding around it. Runs in your browser with no uploads.',
		lede: 'A soft shadow that lifts the image off the page. Control how soft it is and where it falls.',
		blurb: 'A soft shadow that lifts the image off the page.',
		steps: [
			'Drop an image in the box above.',
			'Set how soft the shadow is and how far it falls.',
			'Download as PNG or WebP to keep the space around it transparent.'
		],
		aboutHeading: 'About drop shadows here',
		about: [
			'Room is added around the image so the shadow has somewhere to land, and that space stays transparent unless you fill it.',
			'Download as PNG or WebP to keep it transparent. JPG can\'t, so it fills the space with the colour you pick, which is white by default.'
		],
		next: ['add-border', 'round-corners'],
		keywords: ['shadow', 'depth', 'mockup', 'lift'],
		faq: [
			{
				q: 'Why does the shadow disappear or turn into a grey box when I save?',
				a: 'Because the file was saved as JPG, which can\'t store transparency. A shadow is soft precisely because it fades into transparent space, so JPG has to fill that space with a solid colour and the effect is ruined. Download as PNG or WebP and the shadow stays soft against whatever the image sits on.'
			},
			{
				q: 'How do I make a product photo look like it is floating?',
				a: 'Cut the background out first with the transparent background tool, then add a soft shadow offset slightly downward. The offset is what sells it, since a shadow directly behind an object reads as a glow rather than a shadow. Keep it subtle, because a heavy shadow looks pasted on.'
			}
		],
		suffix: '-shadow'
	},
	{
		slug: 'vignette-image',
		category: 'decorate',
		name: 'Vignette',
		h1: 'Add a vignette to an image',
		title: 'Add a Vignette to a Photo - Free Online, No Upload',
		description:
			'Darken the corners of a photo with a vignette, free and in your browser. Adjustable strength and size, light or dark, with no uploads and no signup.',
		lede: 'Darken the corners so the eye goes to the middle. Or lighten them, for a faded old look.',
		blurb: 'Darken the corners to draw the eye inwards.',
		steps: [
			'Drop an image in the box above.',
			'Set the strength and how far in the shading reaches.',
			'Choose a format and download.'
		],
		aboutHeading: 'About vignettes here',
		about: [
			'A vignette is a soft shading around the edges. Old lenses did it by accident, and photographers have used it on purpose ever since, because it pushes attention towards the middle of the frame.',
			'Keep it subtle. If you can clearly see where the shading starts, it\'s too strong.'
		],
		next: ['sepia-image', 'adjust-image'],
		keywords: ['darken edges', 'corners', 'moody', 'lomo'],
		faq: [
			{
				q: 'What is a vignette in photography?',
				a: 'A darkening towards the corners and edges of the picture. Old lenses did it by accident, and photographers liked the result enough to keep doing it on purpose, because a darker frame quietly pushes the eye towards the middle. A light one is invisible and still works. A heavy one announces itself.'
			},
			{
				q: 'When should I lighten the corners instead?',
				a: 'Lightening gives a faded, washed out look that suits a soft or nostalgic image, and it can lift a photograph that feels heavy at the edges. It\'s the less common choice by a long way. If you\'re unsure which you want, try darkening first, since that\'s what almost everyone means by a vignette.'
			}
		],
		suffix: '-vignette'
	},
	{
		slug: 'blend-images',
		category: 'decorate',
		name: 'Blend',
		h1: 'Blend two images together',
		title: 'Blend Two Images Together - Free Online, No Upload',
		description:
			'Blend two images into one online free. Fade between them with a slider and choose a blend mode like multiply or screen. Runs in your browser, no uploads.',
		lede: 'Fade one image into another with a slider, and pick how the two mix.',
		blurb: 'Fade two images into one, with blend modes.',
		steps: [
			'Drop two images in the box above. The first one is the base.',
			'Slide the mix and try the blend modes. Normal fades, multiply darkens and screen lightens.',
			'Choose a format and download.'
		],
		aboutHeading: 'About blending images here',
		about: [
			'The second image is scaled to cover the first, so the result is always the size of the base image and nothing is left empty.',
			'Normal is a plain fade between the two. Multiply keeps whatever is dark in either one, screen keeps whatever is light, and overlay does both at once for more contrast.'
		],
		next: ['combine-images', 'adjust-image'],
		keywords: ['fade', 'double exposure', 'mix', 'overlay', 'multiply'],
		faq: [
			{
				q: 'How do I fade two photos into each other?',
				a: 'Drop both images, leave the mode on normal and drag the mix slider. At the halfway point you see equal parts of each, and moving either way favours one over the other. The first image you drop is the base, so the second is the one being mixed into it.'
			},
			{
				q: 'What do multiply and screen actually do?',
				a: 'Multiply keeps whatever is dark in either image, so the result is always darker and white areas vanish. That makes it the way to lay a texture or a stamp over a picture. Screen does the opposite, keeping whatever is light, so black areas vanish and the result glows. It\'s how light leaks and flares are added.'
			}
		],
		suffix: '-blended'
	},
	{
		slug: 'add-text-to-image',
		category: 'annotate',
		name: 'Add text',
		h1: 'Add text to an image',
		title: 'Add Text to an Image - Free Online, No Upload',
		description:
			'Add text to a photo online free. Place it anywhere, pick the size, colour and an outline so it stays readable on any background. No uploads, no signup.',
		lede: 'Put text anywhere on the image. An outline keeps it readable over a busy photo.',
		blurb: 'Put text anywhere, with an outline that keeps it readable.',
		steps: [
			'Drop an image in the box above and type your text.',
			'Drag the text where you want it, then set the size, colour and outline.',
			'Choose a format and download.'
		],
		aboutHeading: 'About adding text here',
		about: [
			'Text is drawn into the pixels at full size, so it stays sharp and travels with the file in every format.',
			'The outline is what makes text readable over a photo. White text with a thin dark outline works on almost anything, which is why captions have looked that way for a century.'
		],
		next: ['watermark-image', 'add-border'],
		keywords: ['caption', 'meme', 'words on photo', 'label'],
		faq: [
			{
				q: 'How do I make text readable over a busy photo?',
				a: 'Turn on the outline. A dark outline around light text, or the reverse, keeps every letter separate from whatever is behind it, which is why subtitles have used the trick for decades. Beyond that, put the text over the quietest part of the picture and make it larger than feels necessary, since it will be seen small.'
			},
			{
				q: 'Will the text stay sharp in the downloaded file?',
				a: 'Yes. The preview is scaled to fit your screen, but the text is drawn into the image at its full resolution, so it comes out as crisp as the picture allows rather than looking like an enlarged screenshot. It\'s drawn in your device system font, with a bold option.'
			}
		],
		suffix: '-text'
	},
	{
		slug: 'image-histogram',
		category: 'inspect',
		name: 'Histogram',
		h1: 'View an image histogram',
		title: 'Image Histogram Viewer - Free Online, No Upload',
		description:
			'See the brightness and colour histogram of any image, free and in your browser. Spot clipping in the shadows and highlights before you edit. No uploads.',
		lede: 'See how the light and colour in your photo are spread out, and whether anything is clipped.',
		blurb: 'See how light and colour are spread, and what is clipped.',
		steps: [
			'Drop an image in the box above.',
			'Read the shape. Bars piled at the left mean crushed shadows, and at the right mean blown highlights.',
			'Switch between brightness and the separate colour channels.'
		],
		aboutHeading: 'How to read a histogram',
		about: [
			'The width is brightness, from black on the left to white on the right, and the height is how many pixels sit at that brightness. A photo using its whole range has bars across the middle rather than a spike at one end.',
			'Bars jammed against either edge mean detail has been lost there and no editing will bring it back. That\'s worth knowing before you start adjusting.'
		],
		next: ['adjust-image', 'image-color-picker'],
		keywords: ['levels', 'exposure', 'clipping', 'brightness chart'],
		faq: [
			{
				q: 'How do I read a histogram?',
				a: 'It\'s a count of how many pixels sit at each level of brightness, dark on the left and light on the right, with height showing how many. A photo with most of its bars in the middle is evenly exposed. Bars bunched to the left mean a dark picture, and bunched to the right mean a bright one. There\'s no correct shape, only the one that suits the picture.'
			},
			{
				q: 'What does clipping mean?',
				a: 'A spike hard against either end. On the left it means areas that are pure black with no detail left in them, and on the right pure white. Clipped pixels hold no information at all, so no amount of brightening or darkening later will recover anything from them. A little clipping is normal, a large spike means the exposure was off.'
			}
		],
		suffix: ''
	},
	{
		slug: 'merge-pdf',
		category: 'pdf',
		name: 'Merge PDF',
		h1: 'Merge PDF files',
		title: 'Merge PDF Files - Free Online, No Upload',
		description:
			'Combine several PDF files into one online free. Put the files in any order and download a single document. Your files never leave your browser.',
		lede: 'Drop two or more PDF files, put them in the order you want, and download one document.',
		blurb: 'Several PDF files into one, in your order.',
		steps: [
			'Drop your PDF files in the box above.',
			'Use the arrows to set the order. The page count of each file is shown.',
			'Download the merged PDF.'
		],
		aboutHeading: 'About merging PDF files here',
		about: [
			'Pages are copied across exactly as they\'re, so text stays text and quality is untouched. Nothing is re-compressed.',
			'The whole merge happens in your browser. Contracts, invoices and scans never reach a server, which is the part that matters for documents.'
		],
		next: ['organise-pdf', 'split-pdf', 'pdf-page-numbers'],
		keywords: ['combine pdf', 'join pdf', 'append'],
		faq: [
			{
				q: 'How do I combine PDF files into one document?',
				a: 'Drop the files in, put them in the order you want with the arrows, and download the result as a single PDF. The page count of each file is shown so you can check you have the right ones. Pages are copied across as they\'re, so text stays selectable and nothing is re-rendered or re-compressed.'
			},
			{
				q: 'Is there a limit on how many PDFs I can merge?',
				a: 'No limit is imposed. The work happens on your own device, so the only real ceiling is your computer memory, and merging a few hundred pages is comfortable on any ordinary machine. Very large scanned documents are the ones to be careful with, since they can be enormous.'
			}
		],
		suffix: '-merged'
	},
	{
		slug: 'split-pdf',
		category: 'pdf',
		name: 'Split PDF',
		h1: 'Split a PDF',
		title: 'Split PDF Online - Free, Private, No Upload',
		description:
			'Split a PDF into separate files online free. Break it into single pages or cut it at the pages you choose, then download everything as a zip. No uploads.',
		lede: 'Break a PDF into single pages, or cut it into parts at the pages you choose.',
		blurb: 'Break a PDF into single pages or custom parts.',
		steps: [
			'Drop a PDF in the box above.',
			'Choose one file per page, or type where to cut, like 3, 7 to get three parts.',
			'Download all the parts in one zip.'
		],
		aboutHeading: 'About splitting a PDF here',
		about: [
			'Pages are copied without being re-encoded, so every part keeps the quality and the text of the original.',
			'Everything happens in your browser, so the document never reaches a server.'
		],
		next: ['extract-pdf-pages', 'merge-pdf'],
		keywords: ['separate pdf', 'break up', 'cut pdf'],
		faq: [
			{
				q: 'How do I split a PDF into separate pages?',
				a: 'Choose one file per page and every page comes out as its own PDF, all packed into a single zip. Use the cut points option instead when you want fewer, larger parts, for example typing 3 and 7 to break a document into three sections.'
			},
			{
				q: 'Do the split files keep their quality?',
				a: 'Yes. Pages are copied out of the original untouched, not rendered into pictures and saved again, so text stays selectable, fonts stay embedded and image quality is exactly what it was. A split page is the same page, only in a file of its own.'
			}
		],
		suffix: '-split'
	},
	{
		slug: 'extract-pdf-pages',
		category: 'pdf',
		name: 'Extract pages',
		h1: 'Extract pages from a PDF',
		title: 'Extract PDF Pages - Free Online, No Upload',
		description:
			'Pick the pages you want from a PDF and save them as a new file, free and in your browser. Click pages or type a range like 1-3, 7. No uploads.',
		lede: 'Click the pages you want to keep, or type a range like 1-3, 7. The rest is left behind.',
		blurb: 'Keep only the pages you pick.',
		steps: [
			'Drop a PDF in the box above.',
			'Click the pages you want, or type a range in the box.',
			'Download a new PDF with just those pages.'
		],
		aboutHeading: 'About extracting pages here',
		about: [
			'The pages you pick are copied into a fresh document in the order they appear. Nothing is re-encoded, so quality and text are untouched.',
			'Your file is read and rewritten in your browser and never uploaded.'
		],
		next: ['delete-pdf-pages', 'split-pdf'],
		keywords: ['pick pages', 'keep pages', 'select pages'],
		faq: [
			{
				q: 'How do I save only some pages of a PDF?',
				a: 'Click the pages you want, or type a range like 1-3, 7 if you know the numbers, and download a new PDF containing just those. The original file on your device isn\'t touched. This is the usual way to send someone the two pages they asked for instead of a hundred page report.'
			},
			{
				q: 'Does extracting pages reduce the quality?',
				a: 'No. The pages are lifted out of the original as they\'re, so text remains selectable and searchable and images keep their original resolution. Nothing is converted to a picture along the way, which is what separates this from printing to PDF.'
			}
		],
		suffix: '-pages'
	},
	{
		slug: 'delete-pdf-pages',
		category: 'pdf',
		name: 'Delete pages',
		h1: 'Delete pages from a PDF',
		title: 'Delete Pages from a PDF - Free Online, No Upload',
		description:
			'Remove pages from a PDF online free. Click the pages you want gone and download the rest as a new file. Runs in your browser with no uploads.',
		lede: 'Click the pages you want gone. Everything else is kept, in order.',
		blurb: 'Remove the pages you don\'t want.',
		steps: [
			'Drop a PDF in the box above.',
			'Click the pages to remove, or type a range like 2, 5-6.',
			'Download the PDF without them.'
		],
		aboutHeading: 'About deleting pages here',
		about: [
			'The pages you keep are copied into a new document untouched. The removed pages are simply not carried over, so nothing of them is left in the file.',
			'This happens in your browser, so the document never reaches a server.'
		],
		next: ['extract-pdf-pages', 'organise-pdf'],
		keywords: ['remove pages', 'drop pages'],
		faq: [
			{
				q: 'How do I delete a page from a PDF?',
				a: 'Click the pages you want gone, or type them as a range like 2, 5-6, and download the document without them. Everything else stays in its original order and quality. Blank pages from a scanner and duplicated sheets are the usual reason people come here.'
			},
			{
				q: 'Can I get a deleted page back?',
				a: 'Not from the new file, but your original PDF is untouched on your device, because the download is a new copy rather than an edit of the file you dropped in. If you removed the wrong page, drop the original in again and start over.'
			}
		],
		suffix: '-edited'
	},
	{
		slug: 'organise-pdf',
		category: 'pdf',
		name: 'Reorder pages',
		h1: 'Reorder PDF pages',
		title: 'Reorder PDF Pages - Free Online, No Upload',
		description:
			'Change the page order in a PDF online free. Move pages up or down, drop the ones you do not need, and download the rearranged file. No uploads.',
		lede: 'Move pages around until the order is right, and drop any you don\'t need.',
		blurb: 'Put the pages in the right order.',
		steps: [
			'Drop a PDF in the box above.',
			'Use the arrows on each page to move it, and the cross to remove it.',
			'Download the rearranged PDF.'
		],
		aboutHeading: 'About reordering pages here',
		about: [
			'Pages are copied into a new document in the order you set. Nothing is re-encoded, so the file keeps its quality and its text.',
			'A scan that came out back to front is fixed in a few clicks, without the file ever leaving your device.'
		],
		next: ['merge-pdf', 'delete-pdf-pages'],
		keywords: ['reorder', 'rearrange', 'sort pages', 'move pages'],
		faq: [
			{
				q: 'How do I reorder the pages in a PDF?',
				a: 'Every page is shown as a thumbnail with arrows to move it earlier or later, and a cross to drop it entirely. Rearrange until the order looks right and download the result. Scans that came out back to front, or an appendix that belongs at the end, are the usual cases.'
			},
			{
				q: 'Does rearranging the pages change their content?',
				a: 'No. Pages are moved as complete objects, so text, fonts, images and links inside each page are exactly what they were and only the order changes. What doesn\'t follow along is anything that referred to the old order, so a table of contents with page numbers in it will need checking.'
			}
		],
		suffix: '-reordered'
	},
	{
		slug: 'rotate-pdf',
		category: 'pdf',
		name: 'Rotate PDF',
		h1: 'Rotate PDF pages',
		title: 'Rotate PDF Pages - Free Online, No Upload',
		description:
			'Rotate PDF pages online free. Turn every page at once or only the sideways ones, then download the fixed file. Runs in your browser, no uploads.',
		lede: 'Turn every page at once, or click the sideways ones and fix only those.',
		blurb: 'Turn pages the right way up.',
		steps: [
			'Drop a PDF in the box above.',
			'Rotate all pages, or click the pages you want and rotate just those.',
			'Download the fixed PDF.'
		],
		aboutHeading: 'About rotating a PDF here',
		about: [
			'Rotation is stored as a page setting, so nothing is redrawn and no quality is lost. Text stays selectable.',
			'Scanners often turn a page the wrong way. This fixes it without touching anything else in the file.'
		],
		next: ['organise-pdf', 'pdf-to-jpg'],
		keywords: ['turn pages', 'sideways pdf', 'landscape'],
		faq: [
			{
				q: 'How do I permanently rotate a PDF?',
				a: 'Rotate the pages here and download, and the new file opens the right way up everywhere. The rotate button in a PDF viewer usually only turns the page on your screen for as long as it is open, which is why the document looks sideways again for the person you sent it to. This writes the rotation into the file itself.'
			},
			{
				q: 'Can I rotate only the pages that are sideways?',
				a: 'Yes. Click the pages that need turning and rotate just those, leaving the rest alone. That\'s the normal case with a scanned document, where a few sheets went through the feeder the wrong way round and the rest are fine.'
			}
		],
		suffix: '-rotated'
	},
	{
		slug: 'watermark-pdf',
		category: 'pdf',
		name: 'Watermark PDF',
		h1: 'Add a watermark to a PDF',
		title: 'Watermark a PDF - Free Online, No Upload',
		description:
			'Add a text watermark to every page of a PDF online free. Set the size, colour, opacity and angle, then download. Runs in your browser with no uploads.',
		lede: 'Stamp text like DRAFT or CONFIDENTIAL across every page. Size, angle and opacity are yours.',
		blurb: 'Stamp text like DRAFT across every page.',
		steps: [
			'Drop a PDF in the box above.',
			'Type your text and set the size, opacity and angle.',
			'Download the watermarked PDF.'
		],
		aboutHeading: 'About watermarking a PDF here',
		about: [
			'The text is drawn into each page as part of the document, not added as a note someone can click away.',
			'Everything happens in your browser, so a confidential draft stays on your machine.'
		],
		next: ['pdf-page-numbers', 'merge-pdf'],
		keywords: ['draft stamp', 'confidential', 'stamp pdf'],
		faq: [
			{
				q: 'How do I add a DRAFT watermark to a PDF?',
				a: 'Type the word, set the size, the angle and how see-through it should be, and it\'s stamped across every page. Large, diagonal and faint is the usual recipe, so the word is unmistakable while the text underneath stays readable. CONFIDENTIAL, SAMPLE and a company name work the same way.'
			},
			{
				q: 'Can the watermark be removed afterwards?',
				a: 'It\'s drawn into each page rather than hidden in the file properties, so it won\'t come off by changing a setting. Someone determined enough could still edit it out with the right software, as with any watermark. Treat it as a clear statement of status rather than a lock on the document.'
			}
		],
		suffix: '-watermarked'
	},
	{
		slug: 'pdf-page-numbers',
		category: 'pdf',
		name: 'Page numbers',
		h1: 'Add page numbers to a PDF',
		title: 'Add Page Numbers to a PDF - Free Online, No Upload',
		description:
			'Add page numbers to a PDF online free. Choose the position, the size and where the count starts, then download. Runs in your browser with no uploads.',
		lede: 'Number the pages, with a choice of corner, size and starting number.',
		blurb: 'Number the pages, in any corner.',
		steps: [
			'Drop a PDF in the box above.',
			'Pick the position and size, and set which number to start from.',
			'Download the numbered PDF.'
		],
		aboutHeading: 'About adding page numbers here',
		about: [
			'Numbers are drawn into each page in a standard font, so they print exactly as you see them.',
			'Useful for handouts and contracts that need to be referred to page by page. The file never leaves your browser.'
		],
		next: ['watermark-pdf', 'merge-pdf'],
		keywords: ['numbering', 'footer', 'paginate'],
		faq: [
			{
				q: 'How do I add page numbers to a PDF?',
				a: 'Pick the corner they should sit in and the size, and every page is numbered as you download. This is the quick fix for a document assembled out of several files, where the numbering either restarts halfway through or was never there at all.'
			},
			{
				q: 'Can I start the numbering from a different number?',
				a: 'Yes. Set the starting number and the count runs on from there, which is what you want when the pages are one section of a longer document, or when a cover page should not count as page one.'
			}
		],
		suffix: '-numbered'
	},
	{
		slug: 'jpg-to-pdf',
		category: 'pdf',
		name: 'JPG to PDF',
		h1: 'Convert JPG to PDF',
		title: 'JPG to PDF Converter - Free Online, No Upload',
		description:
			'Convert JPG to PDF online free. Turn one photo or a whole batch of scans into a single PDF, in page order, right in your browser with no uploads.',
		lede: 'Drop your JPG files, put them in order and download one PDF. Pages start at A4, which is what scans and receipts usually want.',
		blurb: 'JPG photos and scans into one PDF document.',
		steps: [
			'Drop your JPG files in the box above. Add as many as you need.',
			'Use the arrows to put the pages in the right order.',
			'Download the PDF. It opens at A4, and you can switch to matching the image size instead.'
		],
		aboutHeading: 'About turning JPG into PDF',
		about: [
			'This is the usual way to send paperwork. A phone photo of a receipt, a form or an ID document is a JPG, and the office at the other end wants one PDF rather than four loose pictures.',
			'The page starts on A4 because that\'s what printed paperwork expects. Switch to matching the image if the photographs themselves are the point and you don\'t want white margins around them.'
		],
		next: ['merge-pdf', 'pdf-page-numbers', 'compress-image'],
		keywords: ['jpeg to pdf', 'photo to pdf', 'scan to pdf', 'receipt to pdf'],
		faq: [
			{
				q: 'How do I combine several JPG photos into one PDF?',
				a: 'Drop them all in at once, use the arrows until the order is right, and download. Each photo becomes one page of a single document. Sending one PDF instead of a folder of loose images is what most offices and application forms actually ask for, and it keeps the pages in the order you meant.'
			},
			{
				q: 'Does the photo lose quality inside the PDF?',
				a: 'Barely. The image is placed into the page at its own resolution, so what you see is what was in the JPG. There\'s a quality setting for the copy that goes into the document, which matters because a dozen phone photos at full size make a PDF too large to email. Leave it high for anything with small print on it.'
			}
		],
		suffix: ''
	},
	{
		slug: 'png-to-pdf',
		category: 'pdf',
		name: 'PNG to PDF',
		h1: 'Convert PNG to PDF',
		title: 'PNG to PDF Converter - Free Online, No Upload',
		description:
			'Convert PNG to PDF online free. Turn screenshots, diagrams and charts into one PDF at A4, in your browser, with no uploads and no signup.',
		lede: 'Drop your PNG files, put them in order and download one PDF. Pages start at A4, so screenshots come out looking like a document.',
		blurb: 'Screenshots and diagrams into one PDF document.',
		steps: [
			'Drop your PNG files in the box above.',
			'Use the arrows to put them in the order you want to read them.',
			'Download the PDF. A4 pages by default, or switch to matching each image.'
		],
		aboutHeading: 'About turning PNG into PDF',
		about: [
			'PNG is what screenshots, charts and exported diagrams come out as, and a PDF is how you send a set of them to someone as one readable document rather than a folder of attachments.',
			'Transparent areas have to be filled in, because a PDF page has no way to be see-through. White is used unless you pick another colour, which is almost always what you want on a page meant to be printed.'
		],
		next: ['merge-pdf', 'pdf-page-numbers', 'image-to-pdf'],
		keywords: ['screenshot to pdf', 'diagram to pdf', 'chart to pdf'],
		faq: [
			{
				q: 'What happens to transparent parts of a PNG in the PDF?',
				a: 'They are filled with a solid colour, because a PDF page can\'t be see-through. White is the default and suits anything that will be printed or read on a white background. If your graphic was designed against a dark background, pick that colour instead so the edges don\'t glow.'
			},
			{
				q: 'Will my screenshot still be readable in the PDF?',
				a: 'Yes, as long as the screenshot itself was sharp. The image is placed into the page at its own resolution rather than being redrawn, so small text stays exactly as legible as it was on screen. What you can\'t do is make a blurry screenshot sharp by putting it in a PDF.'
			}
		],
		suffix: ''
	},
	{
		slug: 'heic-to-pdf',
		category: 'pdf',
		name: 'HEIC to PDF',
		h1: 'Convert HEIC to PDF',
		title: 'HEIC to PDF Converter - Free Online, No Upload',
		description:
			'Convert HEIC to PDF online free. Turn iPhone photos into one PDF without installing anything, in your browser, with no uploads and no signup.',
		lede: 'Drop the photos straight from your iPhone. They are decoded here and come out as one PDF, at the shape of the photos themselves.',
		blurb: 'iPhone photos into a single PDF document.',
		steps: [
			'Drop your HEIC photos in the box above, straight from the phone or from a folder.',
			'Put them in the order you want with the arrows.',
			'Download the PDF. Pages match the photos, and you can switch to A4 if it\'s going to be printed.'
		],
		aboutHeading: 'About turning HEIC into PDF',
		about: [
			'HEIC is what an iPhone saves photos as, and very little outside Apple can open it. That\'s awkward when someone asks for a document and all you have is a photo of it. Going straight to PDF skips a step, since a PDF opens anywhere.',
			'Pages match the shape of each photo by default, because photographs usually look wrong stranded in the middle of an A4 sheet. Switch to A4 when the PDF is paperwork that will be printed.'
		],
		next: ['merge-pdf', 'image-to-pdf', 'compress-image'],
		keywords: ['iphone photo to pdf', 'heif to pdf', 'apple photo to pdf'],
		faq: [
			{
				q: 'Can I make a PDF from iPhone photos without installing anything?',
				a: 'Yes. The HEIC files are decoded here in the browser, so there\'s nothing to install and no app to give your photo library to. It works from the phone itself as well as from a computer, which is useful when the photos never left the phone in the first place.'
			},
			{
				q: 'Should I use A4 or match the photo?',
				a: 'Match the photo when the pictures are the content, for example documenting damage or sending someone a set of images, since it fills the page instead of leaving margins. Choose A4 when the PDF is paperwork that will be printed or filed, so every page comes out the same familiar size.'
			}
		],
		suffix: ''
	},
	{
		slug: 'pdf-to-png',
		category: 'pdf',
		name: 'PDF to PNG',
		h1: 'Convert a PDF to PNG images',
		title: 'PDF to PNG Converter - Free, Private, No Upload',
		description:
			'Convert PDF pages to PNG online free. Lossless images with sharp text and clean lines, at the resolution you choose, in your browser with no uploads.',
		lede: 'Every page comes out as a PNG, which keeps text and line drawings crisp. Pick the resolution and take one page or all of them.',
		blurb: 'PDF pages out as lossless PNG images.',
		steps: [
			'Drop a PDF in the box above.',
			'Pick the resolution. Higher looks better and weighs more.',
			'Download pages one at a time, or the whole document as a zip.'
		],
		aboutHeading: 'About converting PDF pages to PNG',
		about: [
			'PNG is the right choice when a page is mostly text, tables, diagrams or line drawings. It stores every pixel exactly, so edges stay hard and thin lines don\'t pick up the smudging that JPG leaves around them.',
			'The price is size. A PNG of a text page is often several times the size of the same page as JPG. For pages that are mainly photographs, JPG or WebP will serve you better.'
		],
		next: ['pdf-to-jpg', 'pdf-to-text', 'compress-image'],
		keywords: ['pdf to image', 'pdf page to png', 'export pdf page'],
		faq: [
			{
				q: 'Should I export PDF pages as PNG or JPG?',
				a: 'PNG for anything with text, tables, diagrams or line art, because it keeps every edge exactly sharp. JPG for pages that are mostly photographs, where the smaller file is worth more than the last trace of detail. A scanned page of typed text is the clearest case for PNG.'
			},
			{
				q: 'Why is my PNG page so much bigger than the PDF?',
				a: 'Because a PDF stores text as instructions for drawing letters, while a PNG has to store every single pixel of the result. Rendering a page turns a few kilobytes of text into a full picture at whatever resolution you chose. Lower the resolution, or use JPG, if the size is a problem.'
			}
		],
		suffix: ''
	},
	{
		slug: 'pdf-to-text',
		category: 'pdf',
		name: 'PDF to text',
		h1: 'Extract text from a PDF',
		title: 'PDF to Text - Copy Text from a PDF, Free, No Upload',
		description:
			'Extract the text from a PDF online free and copy it or download it as a plain text file. Runs in your browser, so the document is never uploaded.',
		lede: 'Pull the text out of a PDF so you can copy it or save it as a plain text file.',
		blurb: 'Get the text out of a PDF, ready to copy.',
		steps: [
			'Drop a PDF in the box above.',
			'The text of every page appears below, page by page.',
			'Copy it, or download it as a .txt file.'
		],
		aboutHeading: 'What this can and cannot read',
		about: [
			'This reads the real text stored in the PDF, which is why it is exact and instant. It works for documents made by a computer, like invoices, reports and contracts.',
			'A scanned page is a picture of text, not text, so nothing comes out. Reading those needs character recognition, which this tool doesn\'t do.'
		],
		next: ['pdf-to-jpg', 'extract-pdf-pages'],
		keywords: ['copy text', 'extract text', 'txt'],
		faq: [
			{
				q: 'Why is no text found in my PDF?',
				a: 'Because it is almost certainly a scan. A scanned page is a photograph of paper, so the file contains an image with no text in it at all, however clearly you can read it on screen. Pulling words out of that needs character recognition, which is a different job from this one. A PDF made from a document rather than a scanner will give up its text immediately.'
			},
			{
				q: 'Does the layout survive?',
				a: 'Not really. You get the words in reading order, page by page, which is what you want for copying a quote, searching for a phrase or feeding the content somewhere else. Columns, tables and headers don\'t come through as they looked, because that arrangement lives in the PDF page rather than in the text.'
			}
		],
		suffix: ''
	},
	{
		slug: 'image-to-base64',
		category: 'web',
		name: 'Base64',
		h1: 'Convert an image to Base64',
		title: 'Image to Base64 Converter - Data URL, Free, No Upload',
		description:
			'Convert an image to a Base64 data URL online free. Copy the raw string, an img tag or a CSS background, straight from your browser with no uploads.',
		lede: 'The file as a data URL, ready to paste. Copy the raw string, an img tag or a CSS background rule.',
		blurb: 'Data URLs for inlining, with img and CSS snippets ready.',
		steps: [
			'Drop an image in the box above. The original file is encoded as is, byte for byte.',
			'Copy the raw data URL, the img tag or the CSS rule.',
			'Mind the size. Base64 adds about a third, so it\'s for small images.'
		],
		aboutHeading: 'When Base64 makes sense',
		about: [
			'Putting the image inside your code saves a network request. That\'s worth it for tiny icons and single-file pages. The text version is about a third larger than the file, so it only makes sense for small images.',
			'The file is encoded exactly as it is. Nothing is re-compressed, so you get byte for byte what you dropped.'
		],
		next: ['compress-image', 'favicon-generator'],
		keywords: ['data url', 'inline', 'encode', 'css'],
		faq: [
			{
				q: 'When should I use a base64 image instead of a file?',
				a: 'For small things that would otherwise cost a separate request, such as an icon, a tiny logo or a placeholder, and for places where you can only paste text and not upload a file. For anything larger, a normal image file wins, because the browser can cache it separately and won\'t have to parse it again with every page.'
			},
			{
				q: 'Why is the base64 string bigger than the original file?',
				a: 'Because base64 rewrites the bytes using only characters that are safe to put in text, and that costs about a third more space. A 30 KB image becomes roughly 40 KB of text. It\'s the price of carrying a file inside a document, and the reason base64 stops being a good idea as images get larger.'
			}
		],
		suffix: ''
	}
];

export function toolBySlug(slug: string): ImageTool | undefined {
	return TOOLS.find((t) => t.slug === slug);
}

/** PDF tools sit under /pdf, image tools under /tools. */
export function toolPath(tool: ImageTool): string {
	return `${tool.category === PDF_CATEGORY ? '/pdf' : '/tools'}/${tool.slug}`;
}

export function pathForSlug(slug: string): string | null {
	const tool = toolBySlug(slug);
	return tool ? toolPath(tool) : null;
}

export function toolsInCategory(category: ToolCategory): ImageTool[] {
	return TOOLS.filter((t) => t.category === category);
}

export const IMAGE_TOOLS: ImageTool[] = TOOLS.filter((t) => t.category !== PDF_CATEGORY);
export const PDF_TOOLS: ImageTool[] = TOOLS.filter((t) => t.category === PDF_CATEGORY);

/** Categories holding image tools, in hub order. */
export const IMAGE_CATEGORIES = CATEGORIES.filter((c) => c.id !== PDF_CATEGORY);

/** The next steps for a tool, resolved and with anything unknown dropped. */
export function nextTools(tool: ImageTool): ImageTool[] {
	return (tool.next ?? []).map((slug) => toolBySlug(slug)).filter((t): t is ImageTool => Boolean(t));
}

/**
 * Match a tool against a search box. Name, headline, blurb and the extra
 * keywords all count, so "mirror" finds flip and "metadata" finds EXIF.
 */
export function toolMatches(tool: ImageTool, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	const haystack = [tool.name, tool.h1, tool.blurb, tool.slug, ...(tool.keywords ?? [])]
		.join(' ')
		.toLowerCase();
	// every word must appear somewhere, so "pdf page" narrows rather than widens
	return q.split(/\s+/).every((word) => haystack.includes(word));
}
