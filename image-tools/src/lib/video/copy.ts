import type { FaqItem } from '$lib/faq';
import { canCopy } from './plan';
import type { VideoFormat, VideoPairPage } from './formats';

/**
 * Per-conversion copy and questions, derived from the format table the way
 * pairfacts.ts and pairfaq.ts do it for images.
 *
 * The one fact that shapes every page here is whether the target container
 * will take the streams as they are. It decides whether the conversion is over
 * before you look up or takes minutes, and it is the thing a visitor most
 * wants to know before they commit. So it leads.
 */

/** The optimistic case: what almost every real file of this type contains. */
function typicalProbe(source: VideoFormat) {
	if (source.id === 'webm') return { videoCodec: 'vp8', audioCodec: 'vorbis' };
	if (source.id === 'avi') return { videoCodec: 'mpeg4', audioCodec: 'mp3' };
	return { videoCodec: 'h264', audioCodec: 'aac' };
}

/** True when the usual file of this type moves across without re-encoding. */
export function usuallyInstant(page: VideoPairPage): boolean {
	const probe = typicalProbe(page.source);
	return canCopy(page.target, {
		...probe,
		durationSeconds: null,
		width: null,
		height: null
	});
}

function speedSentence(page: VideoPairPage): string {
	const { sourceName, targetName } = page;
	if (page.target.kind === 'audio') {
		return `This throws the picture away and keeps the sound, which is quick work even on a long recording. If the audio inside is already ${targetName}, it is lifted out untouched rather than squashed a second time.`;
	}
	if (page.target.kind === 'animation') {
		return `A GIF has to be built frame by frame, so this takes a few seconds rather than being instant. Keep the clip short, because a GIF is far larger than the video it came from.`;
	}
	if (usuallyInstant(page)) {
		return `This is usually instant. A ${sourceName} and a ${targetName} normally hold exactly the same video and audio, so the picture is not re-encoded at all, it is moved into a different container. Nothing is lost, because nothing is touched.`;
	}
	return `This one takes real time. ${targetName} cannot hold what a ${sourceName} normally contains, so every frame has to be decoded and encoded again. Expect roughly as long as the video lasts, and more on a long or high resolution file.`;
}

function reasonSentence(page: VideoPairPage): string {
	const key = `${page.source.id}-${page.target.id}`;
	const known: Record<string, string> = {
		'mov-mp4':
			'This is the usual fix for a video off an iPhone that a website, an editor or a Windows PC will not take. The file almost always holds ordinary H.264 video already, so the MOV wrapper is the only thing in the way.',
		'mkv-mp4':
			'MKV is what films and recordings are often distributed in, and almost nothing outside a desktop media player will play one. MP4 is the same video in a container phones, browsers and TVs all understand.',
		'avi-mp4':
			'AVI is old enough that plenty of modern software has stopped bothering with it. Moving to MP4 makes the file play everywhere again, and usually makes it a good deal smaller.',
		'webm-mp4':
			'WebM comes out of screen recorders and browser downloads, and video editors are the usual thing to refuse it. MP4 is what they all expect.',
		'mp4-webm':
			'A step for putting video on your own website, where WebM is smaller for the same picture and needs no licence.',
		'mp4-gif':
			'For a short clip that has to play by itself in a chat, an issue tracker or a document, where a video file would just sit there as an attachment.',
		'mp4-mp3':
			'For keeping the sound and dropping the rest: a lecture, a podcast, an interview or the music from a video.',
		'mov-mp3': 'For pulling the audio out of a recording made on a phone or a camera.',
		'mp4-mov':
			'Some Apple software, Final Cut in particular, is happier with a MOV even when the video inside is identical.',
		'mkv-mov': 'For getting a film or a recording into something Apple software will open.'
	};
	if (known[key]) return known[key];
	if (page.target.kind === 'audio') return `For keeping the sound from a ${page.sourceName} and dropping the picture.`;
	if (page.target.kind === 'animation') {
		return `Turns a few seconds of ${page.sourceName} into something that plays by itself anywhere a picture does.`;
	}
	return `Most people do this because something they are using will not accept ${page.sourceName} files.`;
}

function sizeSentence(page: VideoPairPage): string | null {
	if (page.target.kind === 'audio') {
		return `The file gets dramatically smaller, since the picture is almost all of a video's size.`;
	}
	if (page.target.kind === 'animation') {
		return `Expect the GIF to be bigger than the video, often several times bigger, because a GIF cannot compress motion the way a video codec does. Trimming to the seconds that matter helps more than anything else.`;
	}
	if (usuallyInstant(page)) {
		return `The size barely changes, because the video itself is untouched. Only the container around it is different.`;
	}
	return null;
}

/** Two to four sentences that belong to this conversion alone. */
export function videoFacts(page: VideoPairPage): string[] {
	return [reasonSentence(page), speedSentence(page), sizeSentence(page)].filter(
		(s): s is string => Boolean(s)
	);
}

/** Three questions specific to this conversion. */
export function videoFaq(page: VideoPairPage): FaqItem[] {
	const { sourceName, targetName } = page;
	const items: FaqItem[] = [];

	if (page.target.kind === 'audio') {
		items.push({
			q: `How do I get the audio out of a ${sourceName} file?`,
			a: `Drop the file and the picture is discarded, leaving the sound as a ${targetName}. If the audio inside is already ${targetName} it is copied out exactly as it was, so nothing is compressed a second time. Otherwise it is encoded once, at a quality setting high enough that speech and music both survive it.`
		});
		items.push({
			q: `Does extracting the audio reduce its quality?`,
			a: `Only if it has to be re-encoded, and even then the setting used is a high one. What it can never do is improve on the sound already in the video. If the recording was quiet or muffled, the ${targetName} will be quiet and muffled too, at a fraction of the file size.`
		});
	} else if (page.target.kind === 'animation') {
		items.push({
			q: `How do I turn a ${sourceName} into a GIF?`,
			a: `Drop the file and it is converted at a size and frame rate chosen to keep the result usable, since a GIF at full resolution and 30 frames a second would be enormous. A palette is built from your own footage rather than using the standard web colours, which is the difference between a GIF that looks like the video and one that looks like 1998.`
		});
		items.push({
			q: `Why is my GIF so much bigger than the video?`,
			a: `Because GIF has no idea how to compress motion. A video codec stores what changed between frames, while a GIF stores whole pictures over and over. That is why a ten second clip can turn into several megabytes, and why keeping it to the few seconds that matter is the single most useful thing you can do.`
		});
	} else if (usuallyInstant(page)) {
		items.push({
			q: `Does converting ${sourceName} to ${targetName} lose quality?`,
			a: `No. A ${sourceName} and a ${targetName} usually hold the same video and audio, so the streams are copied across and the container is swapped. Not a single frame is decoded or re-encoded, which is why it finishes in about a second and why the result is identical to what you started with.`
		});
		items.push({
			q: `Why is it so much faster than other converters?`,
			a: `Because there is nothing to upload and, in this case, nothing to re-encode. Sites that upload your file spend most of their time moving it to a server and back. Here the work happens on your own machine, and for this conversion the work is little more than rewriting the file's wrapper.`
		});
	} else {
		items.push({
			q: `Does converting ${sourceName} to ${targetName} lose quality?`,
			a: `A little, because ${targetName} cannot hold what a ${sourceName} contains, so the video has to be decoded and encoded again. It is set to a quality where the difference is hard to see on normal footage. What you should not do is convert the same file back and forth repeatedly, since each pass costs a little more.`
		});
		items.push({
			q: `How long will converting a ${sourceName} to ${targetName} take?`,
			a: `Roughly as long as the video itself, and longer for high resolution footage, because every frame is being rebuilt. A one minute clip is a minute or two of waiting. There is a progress bar rather than a guess, and the tab has to stay open, since your own machine is doing the work.`
		});
	}

	items.push({
		q: `Is there a limit on the size of the video?`,
		a: `Not one we set, but there is a practical one. The whole file is held in your browser's memory while it works, so very large files can run a tab out of room, and a phone gives up sooner than a computer. Files up to a few hundred megabytes are comfortable on an ordinary machine.`
	});

	return items;
}
