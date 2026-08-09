/**
 * The tools registry. Nav, the /tools hub, the landing section, the sitemap,
 * cross-links and every tool page's SEO copy derive from this one table,
 * mirroring how formats.ts drives the conversion pages.
 *
 * Copy style: plain sentences, no em dashes, no semicolons (guarded by test).
 */

export type ToolCategory = 'edit' | 'transform' | 'privacy' | 'background';

export const CATEGORIES: { id: ToolCategory; label: string; blurb: string }[] = [
	{ id: 'edit', label: 'Edit', blurb: 'Change what is in the frame.' },
	{ id: 'transform', label: 'Transform', blurb: 'Change size and orientation.' },
	{ id: 'privacy', label: 'Privacy', blurb: 'Hide what should not be shared.' },
	{ id: 'background', label: 'Background', blurb: 'Work on what is behind the subject.' }
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
		lede: 'Free online cropping that runs on your own device. Drag the frame, pick an aspect ratio if you need one and download the result.',
		blurb: 'Drag a frame, pick an aspect ratio and download at full resolution.',
		steps: [
			'Drop an image in the zone above. Any format this site can read works, HEIC and TIFF included.',
			'Drag the corners or edges of the crop frame, or pick a preset like 1:1 or 16:9. You can also type exact pixel sizes.',
			'Choose an output format and download. The file keeps its name with -cropped added.'
		],
		aboutHeading: 'About cropping images here',
		about: [
			'The crop frame shows a rule of thirds grid to help with composition. Lock the aspect ratio for profile pictures, thumbnails or covers, or keep it free and frame exactly what you want.',
			'Cropping happens entirely in your browser. The image is never uploaded, and the download is rendered from the original resolution, not from the on-screen preview.'
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
			'Drop two or more images in the zone above.',
			'Pick a layout, drag the dividers to set the split, and drag any image to position it inside its cell.',
			'Set the output size and spacing, then download the combined image.'
		],
		aboutHeading: 'About combining images here',
		about: [
			'Each image fills its cell and can be dragged to choose the visible part, so nothing gets squashed or stretched. Moving the dividers changes how much space each image gets, which makes before and after shots, comparisons and simple collages quick to build.',
			'The preview is scaled to fit your screen, but the download is rendered at the exact pixel size you set.'
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
		lede: 'Type a new size in pixels or jump to a percentage. The aspect ratio stays locked unless you unlock it.',
		blurb: 'Exact pixels or quick percentages, aspect ratio locked.',
		steps: [
			'Drop an image in the zone above.',
			'Type a new width or height, or hit a percentage like 50%. With the lock on, the other side follows automatically.',
			'Choose an output format and download at the exact new size.'
		],
		aboutHeading: 'About resizing images here',
		about: [
			'Downscaling here happens in steps, halving the image until it approaches the target before the final pass. That avoids the muddy artefacts a single big jump produces and keeps text and edges sharp.',
			'Upscaling works too, but no tool can add detail that was never captured. Expect softness when you enlarge.'
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
			'Drop an image in the zone above.',
			'Use the rotate buttons for quarter turns and the flip buttons to mirror. The preview always shows exactly what you will get.',
			'Choose an output format and download.'
		],
		aboutHeading: 'About rotating and flipping here',
		about: [
			'Photos load with their camera orientation already applied, so what you see is what you start from. Quarter turns and flips are exact operations, no quality is lost in the rotation itself.',
			'The only re-encoding happens at download, in the format and quality you choose.'
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
			'Drop an image in the zone above.',
			'Drag across the part you want hidden. Boxes and ovals both work, and you can add as many as you need.',
			'Pick blur or pixelate, set the strength, then download. Undo removes the last shape.'
		],
		aboutHeading: 'Blur, pixelate, and when to redact instead',
		about: [
			'Blurring softens a region beyond recognition and pixelation reduces it to coarse blocks. Both are drawn straight onto the pixels, so the download contains no trace of the original region at full detail.',
			'One honest caveat: for text in a known font, heavy research tools can sometimes reconstruct blurred or pixelated characters. For names, account numbers and anything truly sensitive, use the redact tool and a solid box instead.'
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
			'Drop an image in the zone above, for example a screenshot with details to hide.',
			'Drag boxes or ovals over whatever needs to go. Pick black, white or a custom colour.',
			'Download the censored copy. Undo removes the last shape if you cover too much.'
		],
		aboutHeading: 'Why solid redaction beats blurring',
		about: [
			'A solid box replaces the pixels underneath outright. Unlike blurring or pixelation there is nothing left to reconstruct, which makes it the safe choice for text like names, addresses and account numbers.',
			'The shapes are burned into the image itself before download, not stored as a removable layer, so the covered content is gone from the file.'
		],
		suffix: '-redacted'
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
			'Drop an image in the zone above, then click the colour you want to remove.',
			'Adjust the tolerance slider. Higher tolerance erases a wider range of similar shades, and your last click updates live while you drag it.',
			'Undo any click if you go too far, then download as PNG or WebP to keep the transparency.'
		],
		aboutHeading: 'How the transparent background tool works',
		about: [
			'The eraser works like a magic wand. It starts at the pixel you clicked and spreads to neighbouring pixels of similar colour, stopping when it reaches something different. That makes it precise on logos, scans, screenshots and product photos with a plain background.',
			'Export as PNG or WebP to keep the transparency. JPG has no alpha channel, so transparent areas turn white there.'
		],
		suffix: '-transparent'
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
