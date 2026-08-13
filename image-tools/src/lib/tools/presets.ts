/**
 * Landing pages for the thing someone is actually stuck on: a form that wants
 * a file under 200 KB, a banner that has to be exactly 1584 by 396.
 *
 * The rule that keeps these honest: every preset carries a real setting, and
 * the tool arrives already configured for it. A page that only changed its
 * title would be a doorway, and would deserve to be treated as one.
 */

export type PresetKind = 'compress' | 'resize';

export interface Preset {
	/** Slug under /make/. */
	slug: string;
	kind: PresetKind;
	h1: string;
	title: string;
	description: string;
	lede: string;
	/** One line for the hub list. */
	blurb: string;
	/** Grouping on the hub. */
	group: 'size' | 'dimensions' | 'social';
	/** Extra sentences, specific to this preset. */
	about: string[];
	/** Target file size in bytes, for compress presets. */
	bytes?: number;
	/** Target dimensions, for resize presets. */
	width?: number;
	height?: number;
	/** Crop to the exact shape rather than just scaling. */
	exact?: boolean;
}

function compressPreset(label: string, bytes: number, blurbExtra: string, about: string[]): Preset {
	const slug = `compress-image-to-${label.toLowerCase().replace(/\s+/g, '')}`;
	return {
		slug,
		kind: 'compress',
		group: 'size',
		h1: `Compress an image to ${label}`,
		title: `Compress Image to ${label} - Free Online, No Upload`,
		description: `Compress an image to under ${label} online free. The best quality that fits is found for you, right in your browser, with no uploads and no signup.`,
		lede: `Drop an image and it is squeezed to fit under ${label}, at the best quality that still fits.`,
		blurb: blurbExtra,
		about,
		bytes
	};
}

function sizePreset(
	slug: string,
	/** How it reads in a sentence, e.g. "a YouTube thumbnail". */
	name: string,
	/** The title, written out, because it has to match what people type. */
	title: string,
	width: number,
	height: number,
	group: 'dimensions' | 'social',
	lede: string,
	about: string[],
	exact = true
): Preset {
	return {
		slug,
		kind: 'resize',
		group,
		width,
		height,
		exact,
		h1: `Resize an image for ${name}`,
		title,
		description: `Resize an image to ${width} by ${height} pixels, the size ${name} expects. Free, in your browser, with no uploads and no signup.`,
		lede,
		blurb: `${width} × ${height} pixels`,
		about
	};
}

export const PRESETS: Preset[] = [
	// The form said the file is too big
	compressPreset('20KB', 20 * 1024, 'For strict upload limits', [
		'20 KB is very tight, so expect visible softness on a photo. Line art and simple graphics survive it far better.',
		'If the result looks too rough, allow downscaling. A smaller image at decent quality usually beats a large one at terrible quality.'
	]),
	compressPreset('50KB', 50 * 1024, 'Common for older forms', [
		'50 KB suits small profile pictures and thumbnails, and it is a common cap on older government and school forms.',
		'WebP will get you noticeably further than JPG at this size, if whatever you are uploading accepts it.'
	]),
	compressPreset('100KB', 100 * 1024, 'A frequent form limit', [
		'100 KB is one of the most common limits on upload forms, and a normal photo needs real compression to reach it.',
		'Try WebP first. At this size it holds detail that JPG has already given up.'
	]),
	compressPreset('200KB', 200 * 1024, 'Room for a real photo', [
		'200 KB is enough for a decent looking photo at web size, which is why so many forms settle on it.',
		'If the quality slider has to drop below about 60 to fit, shrink the dimensions instead. The result will look better.'
	]),
	compressPreset('500KB', 500 * 1024, 'Comfortable for photos', [
		'500 KB is comfortable for a full width web photo. Most images reach it with quality to spare.',
		'This is a sensible ceiling for anything going on a web page, since it keeps the page quick on a phone.'
	]),
	compressPreset('1MB', 1024 * 1024, 'The usual attachment cap', [
		'1 MB is the classic limit for email attachments and job application forms.',
		'Most photos straight off a phone are several times this, so a little compression goes a long way.'
	]),
	compressPreset('2MB', 2 * 1024 * 1024, 'Generous, keeps quality', [
		'2 MB is generous enough that the picture usually keeps its quality entirely.',
		'A common cap for passport and visa uploads, and for forums that still allow full size photos.'
	]),
	compressPreset('5MB', 5 * 1024 * 1024, 'For large uploads', [
		'5 MB fits nearly any photo without a visible change, so this is about clearing a limit rather than saving space.',
		'Camera photos and scans are the usual reason to need it.'
	]),

	// Exact pixel sizes people ask for by name
	sizePreset(
		'resize-image-to-1920x1080',
		'1920 by 1080',
		'Resize Image to 1920x1080 - Free, No Upload',
		1920,
		1080,
		'dimensions',
		'Full HD, the size of most screens and the standard for video thumbnails and slides.',
		[
			'1920 by 1080 is Full HD, so it fits a normal monitor exactly and is the safe size for a presentation slide or a video still.',
			'The image is scaled to cover the whole frame and the overflow is trimmed, so nothing ends up stretched.'
		]
	),
	sizePreset(
		'resize-image-to-1080x1080',
		'1080 by 1080',
		'Resize Image to 1080x1080 Square - Free Online',
		1080,
		1080,
		'dimensions',
		'A perfect square at the size social feeds like best.',
		[
			'A 1080 pixel square is the size most social platforms treat as native, so nothing is cropped or blurred when you post it.',
			'If your photo is not square, the middle is kept. Use the crop tool first if you want to choose which part survives.'
		]
	),
	sizePreset(
		'resize-image-to-800x600',
		'800 by 600',
		'Resize Image to 800x600 - Free, No Upload',
		800,
		600,
		'dimensions',
		'A small, classic size for documents and older systems.',
		[
			'800 by 600 is small, quick to load and still large enough to read. Plenty of older systems and forms ask for exactly this.',
			'The 4:3 shape matches most scanned documents and older cameras.'
		]
	),
	sizePreset(
		'resize-image-to-512x512',
		'512 by 512',
		'Resize Image to 512x512 - Free, No Upload',
		512,
		512,
		'dimensions',
		'The usual size for app icons and avatars.',
		[
			'512 by 512 is the standard for app icons, web manifest icons and most avatar uploads.',
			'For a browser tab icon, the favicon generator makes the whole set at once instead.'
		]
	),

	// Named by the platform, because that is what people type
	sizePreset(
		'youtube-thumbnail-size',
		'a YouTube thumbnail',
		'YouTube Thumbnail Size (1280x720) - Free Resizer',
		1280,
		720,
		'social',
		'1280 by 720 pixels, the size YouTube wants for a custom thumbnail.',
		[
			'YouTube asks for 1280 by 720 and a file under 2 MB. This page handles the size, and the compress tool will get you under the limit if the file is still too big.',
			'Keep faces and text well inside the frame. The thumbnail is shown very small in a phone feed.'
		]
	),
	sizePreset(
		'instagram-post-size',
		'an Instagram post',
		'Instagram Post Size (1080x1080) - Free Resizer',
		1080,
		1080,
		'social',
		'A 1080 by 1080 square, the shape a feed post is shown in.',
		[
			'Instagram shows feed posts as squares at 1080 across. Giving it exactly that avoids the extra compression that comes from uploading something bigger.',
			'For a portrait post the frame is 1080 by 1350, and for a story it is 1080 by 1920.'
		]
	),
	sizePreset(
		'instagram-story-size',
		'an Instagram story',
		'Instagram Story Size (1080x1920) - Free Resizer',
		1080,
		1920,
		'social',
		'A tall 9:16 frame, the full height of a phone screen.',
		[
			'A story fills a phone screen, which is 1080 by 1920. Anything wider gets bars or a crop.',
			'Keep anything important away from the top and bottom, where the interface sits over the picture.'
		]
	),
	sizePreset(
		'linkedin-banner-size',
		'a LinkedIn banner',
		'LinkedIn Banner Size (1584x396) - Free Resizer',
		1584,
		396,
		'social',
		'1584 by 396 pixels, the wide strip LinkedIn uses for a profile cover.',
		[
			'LinkedIn uses a wide, short banner at 1584 by 396. It is an unusual shape, so a normal photo loses a lot of its height.',
			'Your profile picture sits over the lower left of it, so keep that corner quiet.'
		]
	),
	sizePreset(
		'facebook-cover-size',
		'a Facebook cover',
		'Facebook Cover Size (1200x630) - Free Resizer',
		1200,
		630,
		'social',
		'1200 by 630 pixels, which also suits link previews.',
		[
			'1200 by 630 is the size Facebook uses for covers and link previews, and most other social sites use the same shape when they show a shared link.',
			'This is also the right size for an og:image on your own website.'
		]
	),
	sizePreset(
		'twitter-header-size',
		'an X header',
		'X Header Size (1500x500) - Free Online Resizer',
		1500,
		500,
		'social',
		'1500 by 500 pixels, a wide 3:1 strip.',
		[
			'X profile headers are 1500 by 500. Your avatar overlaps the lower left, so leave that area clear.',
			'The header is cropped differently on phones, so keep anything important near the middle.'
		]
	),
	sizePreset(
		'discord-profile-picture-size',
		'a Discord profile picture',
		'Discord Profile Picture Size (512x512) - Free',
		512,
		512,
		'social',
		'A 512 by 512 square, shown as a circle.',
		[
			'Discord takes a square and shows it as a circle, so anything in the corners is cut off.',
			'Use the round corners tool in circle mode first if you want to see exactly what will survive.'
		]
	)
];

export function presetBySlug(slug: string): Preset | undefined {
	return PRESETS.find((p) => p.slug === slug);
}

/**
 * Two questions per preset, built from the number the page is about, so the
 * 200 KB page answers the 200 KB question. Both are things people ask after
 * the first attempt does not come out the way they expected.
 */
export function presetFaq(preset: Preset): { q: string; a: string }[] {
	if (preset.kind === 'compress') {
		const label = preset.h1.replace('Compress an image to ', '');
		return [
			{
				q: `Why is my image still bigger than ${label}?`,
				a: `Because quality alone could not get it there. The tool lowers quality as far as it sensibly can, and on a very large photo with a tight target that is not always enough. Turn on downscaling and it will reduce the dimensions as well, which is almost always the better looking answer, since a smaller picture at decent quality beats a large one that has been crushed.`
			},
			{
				q: `How much quality will I lose getting down to ${label}?`,
				a: `It depends entirely on the picture rather than on the number. A soft photograph compresses beautifully and may look untouched, while a screenshot full of text and flat colour shows the damage quickly at the same file size. The result line tells you the quality setting that was used, so you can see how hard it had to work.`
			}
		];
	}
	const { width, height } = preset;
	return [
		{
			q: `Will my photo be cropped to fit ${width} by ${height}?`,
			a: `Yes, if it is not already that shape. The image is scaled until it covers the whole frame and the overflow is trimmed off, which keeps everything in proportion rather than stretching it. The middle is what survives, so if the important part is off to one side, crop it yourself first and then come back here.`
		},
		{
			q: `What if my image is smaller than ${width} by ${height}?`,
			a: `It gets enlarged to fit, and enlarging always costs sharpness, because the extra pixels have to be invented from the ones already there. It will still be exactly the right size, it just will not be as crisp as the same picture from a larger original. Start from the biggest version you have whenever you can.`
		}
	];
}

export const PRESET_GROUPS: { id: Preset['group']; label: string; blurb: string }[] = [
	{ id: 'size', label: 'Hit a file size', blurb: 'When an upload form says the file is too big.' },
	{ id: 'dimensions', label: 'Exact pixel sizes', blurb: 'When something asks for a size by number.' },
	{ id: 'social', label: 'Social and profile sizes', blurb: 'The sizes each platform expects.' }
];

export function presetsInGroup(group: Preset['group']): Preset[] {
	return PRESETS.filter((p) => p.group === group);
}

export function presetPath(preset: Preset): string {
	return `/make/${preset.slug}`;
}
