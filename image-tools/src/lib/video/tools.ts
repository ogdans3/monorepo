import type { EditOp } from './edit';

/**
 * The video tools registry, mirroring `src/lib/tools/registry.ts` for images.
 *
 * A parallel table rather than an extra column on that one, because the two
 * sections have almost nothing in common past the words: video tools take a
 * different input, run through ffmpeg instead of a canvas, live under /video,
 * and carry a warning about how long the work takes that no image tool needs.
 * Folding them together would mean a `takes: 'video'` flag threaded through
 * every hub, search box and cross-link that has no idea what a codec is.
 *
 * Copy style is the site's: plain sentences, no em dashes, no semicolons,
 * contractions in body copy but not in titles. Guarded by tests.
 */

export type VideoToolCategory = 'frame' | 'time' | 'look' | 'sound';

export const VIDEO_CATEGORIES: { id: VideoToolCategory; label: string; blurb: string }[] = [
	{ id: 'frame', label: 'Frame and size', blurb: 'Change what is in the picture.' },
	{ id: 'time', label: 'Length and speed', blurb: 'Change how long it runs.' },
	{ id: 'look', label: 'Look and finish', blurb: 'Blur it, caption it, shrink it.' },
	{ id: 'sound', label: 'Sound', blurb: 'What comes out of the speakers.' }
];

export interface VideoTool {
	/** URL slug, also the route folder name, under /video. */
	slug: string;
	category: VideoToolCategory;
	/** The edit this page performs. */
	op: EditOp['kind'];
	name: string;
	h1: string;
	/** <title>, aim below 60 characters. */
	title: string;
	/** Meta description, 100 to 165 characters. */
	description: string;
	lede: string;
	blurb: string;
	steps: string[];
	aboutHeading: string;
	about: string[];
	faq: { q: string; a: string }[];
	/** Output name suffix, e.g. "-trimmed". */
	suffix: string;
	next?: string[];
	keywords?: string[];
	/**
	 * True when the picture is copied rather than re-encoded, so the work is
	 * over in about a second and every frame is bit for bit the original. Only
	 * two tools can say it, and it is the most useful thing either of them has
	 * to tell somebody deciding whether to bother.
	 */
	keepsFrames?: boolean;
}

export const VIDEO_TOOLS: VideoTool[] = [
	{
		slug: 'trim-video',
		category: 'time',
		op: 'trim',
		name: 'Trim',
		h1: 'Trim a video',
		title: 'Trim Video Online - Free, Private, No Upload',
		description:
			'Cut the start and end off a video online free, in your browser. Nothing is uploaded, and a cut on a keyframe finishes in about a second.',
		lede: 'Cut the dead air off the front and the back. Set where it starts and where it stops, and download.',
		blurb: 'Cut the start and the end, usually in about a second.',
		steps: [
			'Drop a video in the box above. MP4, MOV, WebM, MKV and AVI all work.',
			'Set where the clip should start and where it should stop.',
			'Download. The file keeps its name, with -trimmed added.'
		],
		aboutHeading: 'About trimming video here',
		about: [
			"Trimming is the one video edit that doesn't have to touch the picture. The cut lands on the nearest keyframe and both streams are copied straight into a new file, so a clip of any length is done in about a second and every frame that survives is bit for bit the one you started with.",
			"Keyframes are typically a second or two apart, so the start can land slightly before where you asked. If you need the cut exactly where you put it, turn on the exact option and the clip is re-encoded, which takes as long as any other edit here but puts the first frame precisely where you said."
		],
		next: ['mute-video', 'compress-video', 'resize-video'],
		keywords: ['cut', 'clip', 'shorten', 'split'],
		faq: [
			{
				q: 'Does trimming a video lose quality?',
				a: "Not when the cut lands on a keyframe, which is what happens by default here. Both the picture and the sound are copied into a new file without being decoded, so what you get back is the same data you started with, minus the parts you cut off. Quality only changes if you switch on the exact option, which re-encodes the clip so the first frame lands precisely where you asked."
			},
			{
				q: 'Why does my clip start slightly before the point I set?',
				a: "Because video is stored as occasional complete frames with the differences between them in between, and a player can only start at one of those complete frames. They are usually a second or two apart. Copying the stream means starting at the nearest one, which is what makes it instant. The exact option re-encodes from your mark instead, so it starts where you said at the cost of the wait."
			}
		],
		suffix: '-trimmed',
		keepsFrames: true
	},
	{
		slug: 'merge-videos',
		category: 'time',
		op: 'merge',
		name: 'Merge',
		h1: 'Merge videos into one',
		title: 'Merge Videos Online - Free, No Upload Needed',
		description:
			'Join two or more videos into one file online free, in your browser. Set the order, and clips that already match are joined in about a second.',
		lede: 'Put several clips end to end in one file. Drag them into the order you want and download the result.',
		blurb: 'Join clips end to end, sometimes in a second.',
		steps: [
			'Drop two or more videos in the box above. MP4, MOV, WebM, MKV and AVI all work.',
			'Put them in the order you want them played. The first clip decides the size and shape of the result.',
			'Download. The file is named after the first clip, with -merged added.'
		],
		aboutHeading: 'About merging video here',
		about: [
			"Clips that already agree about everything are joined without being decoded at all. Two exports from the same phone, or two halves of one recording, are copied straight into a new file, so a join of any length is over in about a second and every frame is bit for bit the one you started with.",
			"Clips from different sources rarely agree, and then there's no way round rebuilding them. Each one is fitted to the frame of the first clip, letterboxed rather than stretched so nothing comes back squashed, and the whole thing is encoded once. That takes roughly as long as the videos run. Both paths are tried in that order, so you get the fast one whenever it's available without having to know which case you're in.",
			"Sound is handled the way you'd want rather than the way that's easiest. If one clip is silent and the others aren't, the silent one gets a silent track of its own length instead of the sound being dropped from all of them. A quiet title card in front of a clip you want to hear is the usual version of this, and losing the audio would lose the point."
		],
		next: ['trim-video', 'compress-video', 'resize-video'],
		keywords: ['join', 'combine', 'concatenate', 'stitch', 'append', 'multiple videos'],
		faq: [
			{
				q: 'Can I merge videos with different sizes or formats?',
				a: "Yes. Anything that doesn't match the first clip is scaled to fit its frame and padded with black rather than stretched, so a vertical phone clip dropped in beside a widescreen one keeps its proportions instead of being squashed across. Mixing formats means the result has to be rebuilt rather than copied, so it takes longer than joining two clips that already match."
			},
			{
				q: 'Why is merging sometimes instant and sometimes slow?',
				a: "Because two clips that already share a codec, a resolution and a frame rate can be written into one file without being decoded, which takes about as long as copying the file. Clips that disagree about any of that have to be decoded, fitted to one frame and encoded again. This page tries the fast way first every time, so you never have to work out which case you have."
			}
		],
		suffix: '-merged'
	},
	{
		slug: 'crop-video',
		category: 'frame',
		op: 'crop',
		name: 'Crop',
		h1: 'Crop a video',
		title: 'Crop Video Online - Free, No Upload Needed',
		description:
			'Crop a video online free in your browser. Drag a frame or type exact pixels, keep any aspect ratio, and nothing is ever uploaded to a server.',
		lede: 'Cut the edges off the picture. Drag the frame over the preview or type the size you want.',
		blurb: 'Drag a frame over the picture and cut the rest away.',
		steps: [
			'Drop a video in the box above.',
			'Drag the frame over the part of the picture you want to keep, or type the width, height and offset.',
			'Download. The file keeps its name and its format, with -cropped added.'
		],
		aboutHeading: 'About cropping video here',
		about: [
			"Cropping changes the shape of the picture, which means every frame has to be decoded and encoded again. That's the honest cost: a short clip takes a few seconds and a long one takes longer, and the progress bar is telling you the truth rather than pretending.",
			"The width and the height are rounded down to even numbers before anything runs, because H.264 refuses to encode an odd one and the failure that produces is not obvious. Cropping to a square or a vertical shape for a phone feed is what most people are here for, and both are a matter of dragging the frame."
		],
		next: ['resize-video', 'blur-video', 'add-text-to-video'],
		keywords: ['cut edges', 'square', 'vertical', 'aspect ratio', 'reframe'],
		faq: [
			{
				q: 'Can I crop a video to a square or a vertical shape?',
				a: "Yes, and it's what most people come here to do. Drag the frame to the shape you want or type the exact width and height, and everything outside it is cut away. A square works for a feed post and a nine by sixteen shape fills a phone screen. The picture inside the frame is not stretched or squashed to fit, it's simply what survives."
			},
			{
				q: 'Why does cropping take longer than converting the same file?',
				a: "Because a conversion can often move the existing picture into a different container without looking at it, which takes about as long as copying the file. Changing the shape of the frame means every frame has to be decoded, cut and encoded again. There is no shortcut for that, and any tool that claims otherwise is quietly doing the same work on a server."
			}
		],
		suffix: '-cropped'
	},
	{
		slug: 'resize-video',
		category: 'frame',
		op: 'resize',
		name: 'Resize',
		h1: 'Resize a video',
		title: 'Resize Video Online - Free, Private, No Upload',
		description:
			'Resize a video online free in your browser. Scale to 1080p, 720p or any width you like, keeping the aspect ratio. Nothing leaves your device.',
		lede: 'Make the picture smaller, or bring an oversized clip down to something a website will accept.',
		blurb: 'Scale to 1080p, 720p or a width you choose.',
		steps: [
			'Drop a video in the box above.',
			'Pick a common size or type the width you want. The height follows so nothing is stretched.',
			'Download. The file keeps its name and its format, with -resized added.'
		],
		aboutHeading: 'About resizing video here',
		about: [
			"Type a width and the height is worked out from it, rounded to an even number, so the picture keeps its proportions and never comes back squashed. Scaling down is what this is for, and it's also the most reliable way to make a file substantially smaller without touching the quality settings.",
			"Scaling up is possible and rarely worth it. A 720p clip enlarged to 1080p has no more detail in it than it did, and the file gets bigger for nothing. If you're trying to meet an upload limit, going the other way and combining it with compression does far more."
		],
		next: ['compress-video', 'crop-video', 'change-video-frame-rate'],
		keywords: ['scale', 'shrink', '1080p', '720p', 'downscale', 'smaller'],
		faq: [
			{
				q: 'What size should I make a video for the web?',
				a: "1080p wide is the usual answer for anything watched full screen, and 720p is plenty for a clip that sits inside a page. Going below that starts to show on a large monitor. If you're aiming at a phone feed, the width matters less than the shape, since the player scales it to the screen anyway and a vertical crop does more for how it looks."
			},
			{
				q: 'Does resizing a video make the file smaller?',
				a: "Usually by a lot, because there are fewer pixels to describe in every frame. Halving the width and the height leaves a quarter of the pixels, and file size tends to follow. It's a more predictable way to shrink a file than turning quality down, since it removes detail you can point at rather than detail the encoder decides to throw away."
			}
		],
		suffix: '-resized'
	},
	{
		slug: 'change-video-speed',
		category: 'time',
		op: 'speed',
		name: 'Speed',
		h1: 'Change video speed',
		title: 'Change Video Speed Online - Free, No Upload',
		description:
			'Speed a video up or slow it down online free, in your browser. Quarter speed to four times, with the sound kept in step. Nothing is uploaded.',
		lede: 'Speed it up or slow it down, anywhere from a quarter of the pace to four times it. The sound follows.',
		blurb: 'Quarter speed to four times, sound kept in step.',
		steps: [
			'Drop a video in the box above.',
			'Pick a speed. Above one is faster and shorter, below one is slower and longer.',
			'Download. The file keeps its name and its format, with -speed added.'
		],
		aboutHeading: 'About changing video speed here',
		about: [
			"The picture and the sound are moved together, so a clip at double speed is half as long and still in sync. The sound is stretched rather than resampled, which keeps voices recognisable instead of turning them into chipmunks, though a large change is always going to be audible.",
			"The filter that stretches audio only accepts a change between half and double, so anything beyond that is applied more than once. Quarter speed is two halvings and quadruple is two doublings. Without that the sound silently comes out wrong, which is the kind of bug that gets shipped because the picture looked fine."
		],
		next: ['slow-motion-video', 'trim-video', 'change-video-frame-rate'],
		keywords: ['fast forward', 'timelapse', 'speed up', 'slow down'],
		faq: [
			{
				q: 'Does changing the speed make the audio sound wrong?',
				a: "Less than you would expect. The sound is time stretched rather than simply played faster, so the pitch stays where it was and a voice still sounds like that person. A small change is close to unnoticeable. A big one, like quarter speed or four times, does leave an audible artefact, which is why a lot of slow motion clips drop the sound entirely."
			},
			{
				q: 'Can I make a timelapse from a normal video?',
				a: "Yes, by speeding it up. Four times is the fastest single pass here, so an hour of footage comes down to fifteen minutes. For a stronger effect, run the result through again. Pairing it with a lower frame rate helps as well, since a timelapse doesn't need sixty frames a second and dropping them makes the file considerably smaller."
			}
		],
		suffix: '-speed'
	},
	{
		slug: 'slow-motion-video',
		category: 'time',
		op: 'stretch',
		name: 'Slow motion',
		h1: 'Slow down part of a video',
		title: 'Slow Motion Video Online - Free, No Upload',
		description:
			'Slow one section of a video down to an exact length online free, in your browser. The rest of the clip keeps its own pace, and nothing is uploaded.',
		lede: 'Mark the part that matters and say how long it should take, or draw a curve and let the clip ease into slow motion and back out again.',
		blurb: 'Stretch one section to an exact length, or draw the pace as a curve.',
		steps: [
			'Drop a video in the box above. MP4, MOV, WebM, MKV and AVI all work.',
			'Pick section and length to mark one part and give it a running time, or speed curve to draw the pace across the whole clip.',
			'Drag the marks or the curve until the preview reads right, then download. The file keeps its name, with -slowed added.'
		],
		aboutHeading: 'About slowing part of a video down here',
		about: [
			"The other speed page changes the pace of the whole clip. This one changes a section of it and leaves the rest alone, which is what you want when the thing worth looking at is four seconds in the middle of a two minute recording. Say how long the section should take rather than how many times slower it should go, since a length is usually what you actually know.",
			"The frames aren't repeated to fill the new running time. A section stretched fourteen times over holds exactly the frames it always did, spread out, so it steps rather than glides. That's what slowing footage down looks like unless it was shot at a high frame rate to begin with, and inventing the frames in between would mean encoding fourteen times as many of them for a picture that changes at the same moments anyway.",
			"The sound is stretched along with the picture so it stays in step. A gentle slowdown still sounds like a voice, and a large one sounds like a large one. If the result is unusable, the mute page drops the track entirely and copies the picture untouched.",
			"The speed curve is the other way in. Instead of one section at one pace it takes a graph of how fast the clip runs at each moment, so the footage can ease down into slow motion, hold there, and ease back to its own speed. Everything between two points on the curve is eased rather than switched, which is the difference between a ramp that looks deliberate and one that looks like a dropped frame. The preview plays the curve as you drag it, so you can see the shape before spending a single second encoding."
		],
		next: ['change-video-speed', 'trim-video', 'compress-video'],
		keywords: ['slow motion', 'slowmo', 'slow down', 'stretch', 'section', 'ramp', 'speed ramp', 'speed curve', 'ease'],
		faq: [
			{
				q: 'How do I slow down only one part of a video?',
				a: "Mark where the section starts and stops, then say how long it should take. Everything before and after it is kept at its original pace and joined back on, so you get one file rather than three pieces to stitch together yourself. A two minute clip with ten seconds stretched to sixty comes out two minutes and fifty seconds long."
			},
			{
				q: 'Why does heavily slowed footage look jerky?',
				a: "Because the camera only recorded so many pictures a second, and slowing the clip down spreads those same pictures over more time rather than finding new ones. At fourteen times slower each frame is held for about half a second. Footage shot at 120 or 240 frames a second has the extra pictures already and slows down smoothly, which is what a phone's slow motion mode is doing."
			},
			{
				q: 'How do I make a video get slower and then speed back up?',
				a: "Switch to the speed curve and drag the line down where you want the slow part and back up where you want it to end. The curve eases between the points you place rather than jumping between them, so the clip slides into slow motion, holds as long as the line stays flat, and slides back out to its own pace. There are buttons for the usual shapes if you would rather not draw one."
			}
		],
		suffix: '-slowed'
	},
	{
		slug: 'change-video-frame-rate',
		category: 'time',
		op: 'fps',
		name: 'Frame rate',
		h1: 'Change video frame rate',
		title: 'Change Video Frame Rate Online - Free, No Upload',
		description:
			'Change a video frame rate online free in your browser. Drop 60fps to 30 or 24, or raise it for a player that needs it. Nothing is uploaded.',
		lede: 'Set how many frames a second the file holds. Dropping from 60 to 30 halves the frames without changing how long it runs.',
		blurb: 'Drop 60fps to 30 or 24, or set any rate you need.',
		steps: [
			'Drop a video in the box above.',
			'Pick a frame rate, or type one. The clip stays the same length either way.',
			'Download. The file keeps its name and its format, with -fps added.'
		],
		aboutHeading: 'About frame rate here',
		about: [
			"Changing the frame rate changes how many pictures a second the file holds, not how long it runs. Going from 60 to 30 throws away every second frame and leaves the clip exactly as long as it was, usually at a good deal less than half the size, since there's simply less to store.",
			"Raising the rate doesn't add detail that was never recorded. Frames are repeated to fill the gaps, so a 30fps clip at 60 looks the same and takes up more room. It's worth doing when something downstream insists on a particular rate, and not otherwise."
		],
		next: ['compress-video', 'change-video-speed', 'resize-video'],
		keywords: ['fps', '60fps', '30fps', '24fps', 'frames per second'],
		faq: [
			{
				q: 'What frame rate should a video be?',
				a: "24 or 25 is the film look and what most edited video ends up at. 30 is the usual default for a phone. 60 is worth keeping only for fast motion or gameplay, where the extra frames genuinely show. Dropping 60 to 30 is the change most people want, because it halves the frames with no visible difference on ordinary footage."
			},
			{
				q: 'Does lowering the frame rate make the file smaller?',
				a: "Usually a lot smaller, since half as many frames means roughly half as much to store, though the exact saving depends on how much movement there is. It's often a better trade than turning quality down, because throwing away frames of a mostly still scene costs almost nothing you can see, while lower quality shows up on every frame at once."
			}
		],
		suffix: '-fps'
	},
	{
		slug: 'rotate-video',
		category: 'frame',
		op: 'rotate',
		name: 'Rotate',
		h1: 'Rotate a video',
		title: 'Rotate Video Online - Free, Private, No Upload',
		description:
			'Rotate a video 90, 180 or 270 degrees online free, or mirror it. Runs in your browser with no upload, and keeps the original format.',
		lede: 'Turn a clip that came out of the phone sideways, or mirror it left to right.',
		blurb: 'Turn it a quarter at a time, or mirror it.',
		steps: [
			'Drop a video in the box above.',
			'Turn it a quarter at a time until it looks right, and mirror it if you need to.',
			'Download. The file keeps its name and its format, with -rotated added.'
		],
		aboutHeading: 'About rotating video here',
		about: [
			"A clip that plays sideways is usually a phone recording whose rotation flag some player ignored. Turning it here bakes the rotation into the picture itself, so every player shows it the right way up rather than depending on one to read the flag correctly.",
			"Mirroring is a separate switch from turning, because they're different jobs. Flipping left to right is what you want for footage from a front facing camera where text reads backwards. Turning is what you want when the whole picture is on its side."
		],
		next: ['crop-video', 'resize-video', 'add-text-to-video'],
		keywords: ['turn', 'sideways', 'upside down', 'mirror', 'flip', '90 degrees'],
		faq: [
			{
				q: 'Why does my video play sideways on one device and not another?',
				a: "Because phones record the picture in one orientation and store a flag saying which way up it should be shown. Players that read the flag get it right and players that ignore it show the raw picture on its side. Rotating it here turns the actual frames, so there's no flag left to misread and it looks the same everywhere."
			},
			{
				q: 'Is mirroring a video the same as rotating it?',
				a: "No, and mixing them up is easy. Rotating turns the whole picture round a corner, so a sideways clip stands up. Mirroring reflects it left to right, which leaves it the same way up but reverses everything across. Mirroring is what fixes footage from a front facing camera where any writing in shot reads backwards."
			}
		],
		suffix: '-rotated'
	},
	{
		slug: 'blur-video',
		category: 'look',
		op: 'blur',
		name: 'Blur',
		h1: 'Blur a video',
		title: 'Blur Video Online - Free, Private, No Upload',
		description:
			'Blur a whole video online free in your browser. Adjustable strength, no upload and no account. Works with MP4, MOV, WebM, MKV and AVI.',
		lede: 'Soften the whole picture, by a little or a lot. Useful for a background, a placeholder or anything that should not be readable.',
		blurb: 'Soften the whole picture, by a little or a lot.',
		steps: [
			'Drop a video in the box above.',
			'Set how strong the blur should be and watch the preview.',
			'Download. The file keeps its name and its format, with -blurred added.'
		],
		aboutHeading: 'About blurring video here',
		about: [
			"This blurs the whole frame rather than a part of it. That's the right tool for a background behind other content, for a placeholder, or for making a clip unreadable before sharing it as an example of something.",
			"It is not the tool for hiding one face or one number plate. Blurring only a region needs the picture cut out, blurred and laid back over the original, and a way to drag that region while it moves through the clip. That's a genuinely different job and this page doesn't pretend to do it."
		],
		next: ['crop-video', 'compress-video', 'add-text-to-video'],
		keywords: ['soften', 'blurry', 'obscure', 'background', 'unreadable'],
		faq: [
			{
				q: 'Can I blur just one part of a video, like a face?',
				a: "Not on this page, which blurs the whole frame. Covering one face or one number plate means cutting that region out, blurring it and laying it back over the picture, and following it as it moves. Cropping the clip so the thing you want hidden falls outside the frame is often a simpler answer, and it's completely reliable."
			},
			{
				q: 'Is a blurred video safe to share?',
				a: "Treat a strong blur as making something hard to read rather than impossible to recover. It genuinely destroys detail, and at a high strength there's nothing left to reconstruct. At a light setting, text and faces can sometimes still be made out, especially if the same content appears across many frames. Crop it out if it truly must not be seen."
			}
		],
		suffix: '-blurred'
	},
	{
		slug: 'add-text-to-video',
		category: 'look',
		op: 'text',
		name: 'Add text',
		h1: 'Add text to a video',
		title: 'Add Text to Video Online - Free, No Upload',
		description:
			'Add a caption to a video online free in your browser. Choose the size, colour and position, with an optional backing box. Nothing is uploaded.',
		lede: 'Put a line of text over the picture. Pick where it sits, how big it is and whether it needs something behind it.',
		blurb: 'Put a caption over the picture, with a backing box if it needs one.',
		steps: [
			'Drop a video in the box above.',
			'Type your text and set the size, the colour and where on the frame it sits.',
			'Download. The file keeps its name and its format, with -text added.'
		],
		aboutHeading: 'About adding text to video here',
		about: [
			"The text is drawn into the picture itself, so it shows in any player and survives being uploaded anywhere. That's the difference between this and a subtitle file, which is a separate thing a player can choose to display, translate or ignore.",
			"A caption over a moving picture is often unreadable without something behind it, because the frame underneath changes from bright to dark while the text stays one colour. The backing box is there for exactly that and costs nothing. The face is Roboto Bold, shipped with the page, since there are no system fonts inside a browser sandbox to borrow."
		],
		next: ['crop-video', 'blur-video', 'compress-video'],
		keywords: ['caption', 'title', 'watermark', 'subtitle', 'label', 'overlay text'],
		faq: [
			{
				q: 'Is the text burned into the video or a separate subtitle?',
				a: "It's drawn into the frames themselves, which means it appears in every player and survives being uploaded to anywhere that re-encodes the file. The trade is that it cannot be turned off, translated or restyled afterwards. A subtitle file keeps those options but has to travel alongside the video and be understood by whatever plays it."
			},
			{
				q: 'Why does my caption disappear over bright parts of the video?',
				a: "Because the text is one fixed colour and the picture underneath is not. White text vanishes over a bright sky and black text vanishes in shadow, and over a moving clip it's usually both at different moments. Turning on the backing box puts a half transparent panel behind the words, which keeps them readable no matter what passes underneath."
			}
		],
		suffix: '-text'
	},
	{
		slug: 'mute-video',
		category: 'sound',
		op: 'mute',
		name: 'Remove sound',
		h1: 'Remove sound from a video',
		title: 'Remove Audio From Video - Free, No Upload',
		description:
			'Remove the sound from a video online free, in your browser. The picture is copied untouched, so it finishes in about a second with no quality loss.',
		lede: 'Drop the audio track and keep the picture exactly as it was. Finished in about a second.',
		blurb: 'Drop the sound, keeping every frame untouched.',
		steps: [
			'Drop a video in the box above.',
			'Press remove sound. There is nothing to set.',
			'Download. The file keeps its name and its format, with -muted added.'
		],
		aboutHeading: 'About removing sound here',
		about: [
			"The audio track is left out of the new file and the picture is copied across without being decoded, so this is one of two things on the site that finishes in about a second no matter how long the clip is. Every frame you get back is bit for bit the frame you started with.",
			"Muting a clip in a player only affects that player. Removing the track means the sound genuinely isn't in the file any more, which is what you want before sharing something recorded somewhere with a conversation going on in the background."
		],
		next: ['trim-video', 'compress-video', 'change-video-speed'],
		keywords: ['mute', 'silent', 'remove audio', 'strip sound', 'no sound'],
		faq: [
			{
				q: 'Does removing the sound reduce the video quality?',
				a: "Not at all. The picture is copied into the new file without being decoded or encoded, so every frame is identical to the one you started with. The only thing that changes is that the audio track isn't there any more, which also makes the file a little smaller. It's the fastest edit on the site for the same reason."
			},
			{
				q: 'Is this different from muting the video in a player?',
				a: "Yes, and the difference matters. Muting in a player is a setting on that player, and anyone who opens the file elsewhere hears the sound as normal. This removes the audio track from the file itself, so there is nothing left to play. That's what you want before sending on a clip recorded where something private was being said."
			}
		],
		suffix: '-muted',
		keepsFrames: true
	},
	{
		slug: 'compress-video',
		category: 'look',
		op: 'compress',
		name: 'Compress',
		h1: 'Compress a video',
		title: 'Compress Video Online - Free, Private, No Upload',
		description:
			'Compress a video online free in your browser to get under an upload limit. Choose the quality, see the saving, and never upload the file anywhere.',
		lede: 'Get a file under an upload limit. Pick how much quality you are willing to trade and see what it saved.',
		blurb: 'Trade a little quality for a much smaller file.',
		steps: [
			'Drop a video in the box above.',
			'Pick a quality. Lower quality means a smaller file.',
			'Download. The file keeps its name and its format, with -compressed added.'
		],
		aboutHeading: 'About compressing video here',
		about: [
			"Quality here is a constant rate factor, which tells the encoder how much detail it's allowed to throw away rather than aiming at a target size. It's the setting that gives the most consistent result, because a still shot and a fast pan need very different amounts of data to look the same.",
			"If compression alone isn't enough, resizing does more and does it more predictably. Halving the width leaves a quarter of the pixels, and that shows up in the file size immediately. Dropping the frame rate is the other big lever. Both remove something you can point at, rather than asking the encoder to guess."
		],
		next: ['resize-video', 'change-video-frame-rate', 'trim-video'],
		keywords: ['smaller', 'reduce size', 'shrink', 'file size', 'upload limit'],
		faq: [
			{
				q: 'How small can I get a video without it looking bad?',
				a: "Around half the original size is usually invisible on ordinary footage, and a quarter is often acceptable for something watched on a phone. Past that it starts to show first in fast movement and in flat areas like a sky, which go blotchy. Footage with a lot of motion needs more data than a static shot to look the same, so there's no single answer."
			},
			{
				q: 'Should I compress or resize to get under an upload limit?',
				a: "Resize first, then compress if you still need to. Halving the width leaves a quarter of the pixels and the file size tends to follow, which is a bigger and more predictable saving than any quality setting. Compression is the finer control to reach for once the picture is already the size it needs to be."
			}
		],
		suffix: '-compressed'
	}
];

export function videoToolBySlug(slug: string): VideoTool | undefined {
	return VIDEO_TOOLS.find((tool) => tool.slug === slug);
}

export function videoToolPath(tool: VideoTool): string {
	return `/video/${tool.slug}`;
}

export function videoToolsInCategory(id: VideoToolCategory): VideoTool[] {
	return VIDEO_TOOLS.filter((tool) => tool.category === id);
}

/** The tools a finished result is most usefully taken into next. */
export function nextVideoTools(tool: VideoTool): VideoTool[] {
	return (tool.next ?? []).map(videoToolBySlug).filter((t): t is VideoTool => Boolean(t));
}
