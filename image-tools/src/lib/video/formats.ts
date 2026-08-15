/**
 * The video format registry, mirroring engine/formats.ts. Pages, slugs, the
 * hub, accept lists and the sitemap all come from this one table.
 *
 * Video is a different shape of problem from images. An image format is one
 * thing, but a video file is a container with codecs inside it, and the two
 * are only loosely related. An MP4 and a MOV can hold byte for byte the same
 * video and audio, which is why converting between them takes milliseconds
 * rather than minutes. That distinction runs through everything here.
 */

export type VideoFormatId = 'mp4' | 'mov' | 'webm' | 'mkv' | 'avi' | 'gif' | 'mp3';

export type FormatKind = 'video' | 'animation' | 'audio';

export interface VideoFormat {
	id: VideoFormatId;
	/** Display name, e.g. "MP4". */
	name: string;
	longName: string;
	/** File extensions, primary first. */
	extensions: string[];
	/** Alternative slug spellings, each redirecting to the primary. */
	aliases: string[];
	mime: string;
	kind: FormatKind;
	/** We can read it. */
	canDecode: boolean;
	/** We can write it. */
	canEncode: boolean;
	/**
	 * Codecs this container will accept without re-encoding. Empty means the
	 * container always needs a transcode, which is what makes it slow.
	 */
	copyableVideoCodecs: string[];
	copyableAudioCodecs: string[];
	/** What we encode to when a copy is not possible. */
	videoCodec?: string;
	audioCodec?: string;
	/** One-liner used in page copy. */
	blurb: string;
}

export const VIDEO_FORMATS: Record<VideoFormatId, VideoFormat> = {
	mp4: {
		id: 'mp4',
		name: 'MP4',
		longName: 'MPEG-4 Part 14',
		extensions: ['.mp4', '.m4v'],
		aliases: ['m4v'],
		mime: 'video/mp4',
		kind: 'video',
		canDecode: true,
		canEncode: true,
		// H.264 and AAC are what almost every MP4 and MOV already contains, so
		// most conversions into MP4 are a copy rather than an encode.
		copyableVideoCodecs: ['h264', 'hevc', 'mpeg4', 'av1'],
		copyableAudioCodecs: ['aac', 'mp3', 'ac3'],
		videoCodec: 'libx264',
		audioCodec: 'aac',
		blurb:
			'The format everything plays. H.264 video inside an MP4 container is the safest thing to hand anyone.'
	},
	mov: {
		id: 'mov',
		name: 'MOV',
		longName: 'QuickTime Movie',
		extensions: ['.mov', '.qt'],
		aliases: ['qt'],
		mime: 'video/quicktime',
		kind: 'video',
		canDecode: true,
		canEncode: true,
		copyableVideoCodecs: ['h264', 'hevc', 'mpeg4', 'prores'],
		copyableAudioCodecs: ['aac', 'mp3', 'pcm_s16le'],
		videoCodec: 'libx264',
		audioCodec: 'aac',
		blurb:
			'What an iPhone and most Apple software record. Usually holds exactly the same H.264 video an MP4 would.'
	},
	webm: {
		id: 'webm',
		name: 'WebM',
		longName: 'WebM',
		extensions: ['.webm'],
		aliases: [],
		mime: 'video/webm',
		kind: 'video',
		canDecode: true,
		canEncode: true,
		// WebM only takes VP8, VP9 and AV1, so anything from an MP4 has to be
		// re-encoded. This is the one conversion here that is genuinely slow.
		copyableVideoCodecs: ['vp8', 'vp9', 'av1'],
		copyableAudioCodecs: ['vorbis', 'opus'],
		videoCodec: 'libvpx',
		audioCodec: 'libvorbis',
		blurb: 'Built for the web and free of licensing. Smaller files, but slower to produce.'
	},
	mkv: {
		id: 'mkv',
		name: 'MKV',
		longName: 'Matroska Video',
		extensions: ['.mkv'],
		aliases: ['matroska'],
		mime: 'video/x-matroska',
		kind: 'video',
		canDecode: true,
		canEncode: true,
		// Matroska takes essentially anything, so converting into it is always
		// a copy and always instant.
		copyableVideoCodecs: ['h264', 'hevc', 'vp8', 'vp9', 'av1', 'mpeg4', 'theora'],
		copyableAudioCodecs: ['aac', 'mp3', 'vorbis', 'opus', 'ac3', 'flac', 'pcm_s16le'],
		videoCodec: 'libx264',
		audioCodec: 'aac',
		blurb:
			'The container that holds anything. Popular for films and archives, less welcome on phones and websites.'
	},
	avi: {
		id: 'avi',
		name: 'AVI',
		longName: 'Audio Video Interleave',
		extensions: ['.avi'],
		aliases: [],
		mime: 'video/x-msvideo',
		kind: 'video',
		canDecode: true,
		canEncode: true,
		copyableVideoCodecs: ['h264', 'mpeg4', 'mjpeg'],
		copyableAudioCodecs: ['mp3', 'ac3', 'pcm_s16le'],
		videoCodec: 'libx264',
		audioCodec: 'libmp3lame',
		blurb: 'A format from the 1990s that refuses to die. Still what some old software insists on.'
	},
	gif: {
		id: 'gif',
		name: 'GIF',
		longName: 'Graphics Interchange Format',
		extensions: ['.gif'],
		aliases: [],
		mime: 'image/gif',
		kind: 'animation',
		// Reading a GIF as a video source is possible but it is not a
		// conversion anyone searches for, so it is a target only.
		canDecode: false,
		canEncode: true,
		copyableVideoCodecs: [],
		copyableAudioCodecs: [],
		blurb:
			'Silent, short and it plays anywhere a picture does. Enormous files for what you get, so keep it brief.'
	},
	mp3: {
		id: 'mp3',
		name: 'MP3',
		longName: 'MPEG-1 Audio Layer III',
		extensions: ['.mp3'],
		aliases: [],
		mime: 'audio/mpeg',
		kind: 'audio',
		canDecode: false,
		canEncode: true,
		copyableVideoCodecs: [],
		copyableAudioCodecs: ['mp3'],
		audioCodec: 'libmp3lame',
		blurb: 'Audio only, understood by everything ever made. The usual way to keep just the sound.'
	}
};

export const ALL_VIDEO_FORMATS = Object.values(VIDEO_FORMATS);
export const VIDEO_SOURCES = ALL_VIDEO_FORMATS.filter((f) => f.canDecode);
export const VIDEO_TARGETS = ALL_VIDEO_FORMATS.filter((f) => f.canEncode);

/** Resolve an id, an alias or an extension to a format. */
export function resolveVideoFormat(token: string): VideoFormat | null {
	const key = token.toLowerCase().replace(/^\./, '');
	for (const format of ALL_VIDEO_FORMATS) {
		if (format.id === key) return format;
		if (format.aliases.includes(key)) return format;
		if (format.extensions.some((e) => e.slice(1) === key)) return format;
	}
	return null;
}

/** For the dropzone's accept attribute. */
export function videoAcceptAttribute(): string {
	const parts = new Set<string>();
	for (const format of VIDEO_SOURCES) {
		for (const ext of format.extensions) parts.add(ext);
		parts.add(format.mime);
	}
	return [...parts].join(',');
}

export interface VideoPair {
	source: VideoFormat;
	target: VideoFormat;
	slug: string;
}

export interface VideoPairPage extends VideoPair {
	/** The spelling used in the URL, e.g. "M4V" on /video/m4v-to-mp4. */
	sourceName: string;
	targetName: string;
	canonicalSlug: string;
	targetExt: string;
}

export function allVideoPairs(): VideoPair[] {
	const pairs: VideoPair[] = [];
	for (const source of VIDEO_SOURCES) {
		for (const target of VIDEO_TARGETS) {
			if (source.id === target.id) continue;
			pairs.push({ source, target, slug: `${source.id}-to-${target.id}` });
		}
	}
	return pairs;
}

/** Every slug that should resolve, alias spellings included. */
export function allVideoSlugs(): string[] {
	const slugs: string[] = [];
	for (const source of VIDEO_SOURCES) {
		for (const target of VIDEO_TARGETS) {
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

export function parseVideoSlug(slug: string): VideoPairPage | null {
	const cut = slug.indexOf('-to-');
	if (cut <= 0) return null;
	const sourceToken = slug.slice(0, cut);
	const targetToken = slug.slice(cut + 4);
	if (!/^[a-z0-9]+$/.test(sourceToken) || !/^[a-z0-9]+$/.test(targetToken)) return null;

	const source = resolveVideoFormat(sourceToken);
	const target = resolveVideoFormat(targetToken);
	if (!source || !target) return null;
	if (!source.canDecode || !target.canEncode) return null;
	if (source.id === target.id) return null;
	// only ids and aliases make pages, so ".mp4" is not a slug
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

/** Conversions to cross-link: same source first, then same target. */
export function relatedVideoPairs(page: VideoPairPage, limit = 8): VideoPair[] {
	const all = allVideoPairs();
	const sameSource = all.filter(
		(p) => p.source.id === page.source.id && p.target.id !== page.target.id
	);
	const sameTarget = all.filter(
		(p) => p.target.id === page.target.id && p.source.id !== page.source.id
	);
	const out: VideoPair[] = [];
	const seen = new Set<string>();
	for (const p of [...sameSource, ...sameTarget]) {
		if (seen.has(p.slug)) continue;
		seen.add(p.slug);
		out.push(p);
		if (out.length >= limit) break;
	}
	return out;
}

export function videoPath(slug: string): string {
	return `/video/${slug}`;
}
