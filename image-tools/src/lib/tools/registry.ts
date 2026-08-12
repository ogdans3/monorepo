/**
 * The tools registry. Nav, the /tools hub, the landing section, the sitemap,
 * cross-links and every tool page's SEO copy derive from this one table,
 * mirroring how formats.ts drives the conversion pages.
 *
 * Copy style: plain sentences, no em dashes, no semicolons (guarded by test).
 */

export type ToolCategory =
	| 'edit'
	| 'transform'
	| 'adjust'
	| 'privacy'
	| 'background'
	| 'documents'
	| 'web';

export const CATEGORIES: { id: ToolCategory; label: string; blurb: string }[] = [
	{ id: 'edit', label: 'Edit', blurb: 'Change what is in the frame.' },
	{ id: 'transform', label: 'Transform', blurb: 'Change size and orientation.' },
	{ id: 'adjust', label: 'Adjust', blurb: 'Tune colour and light.' },
	{ id: 'privacy', label: 'Privacy', blurb: 'Hide what should not be shared.' },
	{ id: 'background', label: 'Background', blurb: 'Work on what is behind the subject.' },
	{ id: 'documents', label: 'Documents', blurb: 'Move between images and PDF.' },
	{ id: 'web', label: 'For the web', blurb: 'Smaller files and site assets.' }
];

export interface ImageTool {
	/** URL slug under /tools/, also the route folder name. */
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
	/** Output name suffix, e.g. "-cropped". */
	suffix: string;
}

export const TOOLS: ImageTool[] = [
	{
		slug: 'crop-image',
		category: 'edit',
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
		suffix: '-cropped'
	},
	{
		slug: 'combine-images',
		category: 'edit',
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
		suffix: '-combined'
	},
	{
		slug: 'resize-image',
		category: 'transform',
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
		suffix: '-resized'
	},
	{
		slug: 'rotate-image',
		category: 'transform',
		name: 'Rotate',
		h1: 'Rotate or flip an image',
		title: 'Rotate or Flip an Image - Free Online, No Upload',
		description:
			'Rotate images in 90 degree steps or flip them horizontally and vertically, free and right in your browser. Sideways phone photos fixed in two clicks.',
		lede: 'Rotate in 90 degree steps and flip horizontally or vertically. A phone photo lying on its side is fixed in two clicks.',
		blurb: 'Quarter turns and mirror flips, two clicks and done.',
		steps: [
			'Drop an image in the box above.',
			'Use the rotate buttons for quarter turns and the flip buttons to mirror. The preview always shows exactly what you will get.',
			'Choose an output format and download.'
		],
		aboutHeading: 'About rotating and flipping here',
		about: [
			'Photos open the right way up, just as your camera saved them. Turning and flipping loses no quality at all.',
			'The image is only saved again when you download it, in the format you choose.'
		],
		suffix: '-rotated'
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
		suffix: '-redacted'
	},
	{
		slug: 'adjust-image',
		category: 'adjust',
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
		suffix: '-adjusted'
	},
	{
		slug: 'transparent-background',
		category: 'background',
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
		suffix: '-clean'
	},
	{
		slug: 'watermark-image',
		category: 'edit',
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
		suffix: '-favicons'
	},
	{
		slug: 'round-corners',
		category: 'edit',
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
		suffix: '-rounded'
	},
	{
		slug: 'split-image',
		category: 'edit',
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
		suffix: '-tiles'
	},
	{
		slug: 'sharpen-image',
		category: 'adjust',
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
		suffix: '-sharpened'
	},
	{
		slug: 'invert-image',
		category: 'adjust',
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
		suffix: '-inverted'
	},
	{
		slug: 'image-color-picker',
		category: 'adjust',
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
		suffix: '-palette'
	},
	{
		slug: 'bulk-resize',
		category: 'transform',
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
		suffix: '-resized'
	},
	{
		slug: 'image-to-pdf',
		category: 'documents',
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
		suffix: ''
	},
	{
		slug: 'pdf-to-jpg',
		category: 'documents',
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
		suffix: ''
	}
];

export function toolBySlug(slug: string): ImageTool | undefined {
	return TOOLS.find((t) => t.slug === slug);
}

export function toolPath(tool: ImageTool): string {
	return `/tools/${tool.slug}`;
}

export function toolsInCategory(category: ToolCategory): ImageTool[] {
	return TOOLS.filter((t) => t.category === category);
}
