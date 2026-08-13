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
			'Blur makes an area too soft to read. Pixelate turns it into big blocks. Both change the real pixels, so the download does not contain the hidden part.',
			'One honest warning. Special software can sometimes read blurred text again. For names, card numbers and real secrets, use the redact tool instead. A solid box cannot be undone.'
		],
		next: ['redact-image', 'pixelate-image', 'remove-exif'],
		keywords: ['censor', 'hide face', 'blur face', 'obscure'],
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
			'A solid box replaces the pixels under it completely. There is nothing left to recover. That makes it the safe choice for names, addresses and card numbers.',
			'The boxes become part of the image itself. They are not a layer someone can peel off. The covered content is gone from the file.'
		],
		next: ['blur-image', 'remove-exif'],
		keywords: ['black box', 'censor', 'hide text', 'cover'],
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
		lede: 'Click the colour you want gone. The eraser spreads from that spot until it reaches a different colour, and the tolerance slider decides how strict that is.',
		blurb: 'Click a colour to erase it, tune the tolerance. A classic magic wand.',
		steps: [
			'Drop an image in the box above, then click the colour you want to remove.',
			'Adjust the tolerance slider. Higher tolerance erases a wider range of similar shades, and your last click updates live while you drag it.',
			'Undo any click if you go too far, then download as PNG or WebP to keep the transparency.'
		],
		aboutHeading: 'How the transparent background tool works',
		about: [
			'The eraser works like a magic wand. It starts at the pixel you clicked and spreads to neighbouring pixels of similar colour, stopping when it reaches something different. That makes it precise on logos, scans, screenshots and product photos with a plain background.',
			'Export as PNG or WebP to keep the transparency. JPG has no alpha channel, so transparent areas turn white there.'
		],
		next: ['replace-color', 'round-corners', 'trim-image'],
		keywords: ['remove background', 'magic wand', 'transparent png', 'cut out'],
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
			'The clean copy is made by rebuilding the image from raw pixels. Hidden info cannot survive that. This tool simply shows you what was there before it goes.'
		],
		next: ['redact-image', 'compress-image'],
		keywords: ['metadata', 'gps', 'location', 'strip data'],
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
			'Check the previews, especially the 16 pixel one. Simple shapes survive, fine detail does not.',
			'Download the zip and paste the HTML snippet into your page head.'
		],
		aboutHeading: 'What the favicon pack contains',
		about: [
			'The zip holds favicon.ico with 16, 32 and 48 pixel versions embedded, favicon-16x16.png and favicon-32x32.png, apple-touch-icon.png at 180 pixels, and icon-192.png plus icon-512.png for web manifests.',
			'Each size is made from your original, so it stays as sharp as possible. If the 16 pixel one looks muddy, try a simpler logo.'
		],
		next: ['round-corners', 'resize-image'],
		keywords: ['ico', 'site icon', 'tab icon', 'apple touch'],
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
			'Download as PNG or WebP to keep the transparent corners. JPG cannot store them, so the corners turn white there.'
		],
		next: ['drop-shadow', 'transparent-background'],
		keywords: ['rounded', 'circle', 'avatar', 'radius'],
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
			'The tool compares your image with a blurry copy of itself. The parts that differ are the edges, and those get boosted. It cannot invent detail, but it makes real detail easy to see again.',
			'Sharpening is the classic last step after shrinking a photo, which is why it pairs well with the resize tool.'
		],
		next: ['resize-image', 'adjust-image'],
		keywords: ['unsharp', 'crisp', 'blurry fix', 'focus'],
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
			'Every pixel flips to its opposite. Black turns white, blue turns orange, light turns dark. It is the same look as an old film negative.',
			'Inverting is exact and loses nothing. Run it twice and you get your original image back. That also means it can turn a scanned negative into a normal photo.'
		],
		next: ['grayscale-image', 'adjust-image'],
		keywords: ['negative', 'opposite colours', 'film negative'],
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
			'The palette shows the main colours in your image. It is a good starting point for picking brand colours or matching a design.',
			'Clicks read the original pixels, not the small preview, so the values are exact.'
		],
		next: ['replace-color', 'image-histogram'],
		keywords: ['hex', 'rgb', 'palette', 'eyedropper'],
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
			'The PDF is built in your browser. Scans, receipts and ID photos never touch a server. For private papers, that is the whole point.'
		],
		next: ['merge-pdf', 'pdf-to-jpg'],
		keywords: ['jpg to pdf', 'png to pdf', 'scan to pdf', 'photos to pdf'],
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
		lede: 'Turn the whole image into blocks, with a slider for how big they are.',
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
			'A scan is never perfectly even, so raise the tolerance a little if a thin line survives. If the whole image is one colour there is nothing to keep, and the tool leaves it alone.'
		],
		next: ['crop-image', 'extend-canvas'],
		keywords: ['autocrop', 'auto crop', 'whitespace', 'margins', 'edges'],
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
			'Download as PNG or WebP to keep it transparent. JPG cannot, so the space turns white there, which still looks right on a white page.'
		],
		next: ['add-border', 'round-corners'],
		keywords: ['shadow', 'depth', 'mockup', 'lift'],
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
			'Keep it subtle. If you can clearly see where the shading starts, it is too strong.'
		],
		next: ['sepia-image', 'adjust-image'],
		keywords: ['darken edges', 'corners', 'moody', 'lomo'],
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
			'Bars jammed against either edge mean detail has been lost there and no editing will bring it back. That is worth knowing before you start adjusting.'
		],
		next: ['adjust-image', 'image-color-picker'],
		keywords: ['levels', 'exposure', 'clipping', 'brightness chart'],
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
			'Pages are copied across exactly as they are, so text stays text and quality is untouched. Nothing is re-compressed.',
			'The whole merge happens in your browser. Contracts, invoices and scans never reach a server, which is the part that matters for documents.'
		],
		next: ['organise-pdf', 'split-pdf', 'pdf-page-numbers'],
		keywords: ['combine pdf', 'join pdf', 'append'],
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
		blurb: 'Remove the pages you do not want.',
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
		lede: 'Move pages around until the order is right, and drop any you do not need.',
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
		suffix: '-numbered'
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
			'A scanned page is a picture of text, not text, so nothing comes out. Reading those needs character recognition, which this tool does not do.'
		],
		next: ['pdf-to-jpg', 'extract-pdf-pages'],
		keywords: ['copy text', 'extract text', 'txt'],
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
			'Mind the size. Base64 adds about a third, so it is for small images.'
		],
		aboutHeading: 'When Base64 makes sense',
		about: [
			'Putting the image inside your code saves a network request. That is worth it for tiny icons and single-file pages. The text version is about a third larger than the file, so it only makes sense for small images.',
			'The file is encoded exactly as it is. Nothing is re-compressed, so you get byte for byte what you dropped.'
		],
		next: ['compress-image', 'favicon-generator'],
		keywords: ['data url', 'inline', 'encode', 'css'],
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
