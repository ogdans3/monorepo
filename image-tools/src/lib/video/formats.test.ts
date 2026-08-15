import { describe, expect, it } from 'vitest';
import {
	ALL_VIDEO_FORMATS,
	VIDEO_FORMATS,
	VIDEO_SOURCES,
	VIDEO_TARGETS,
	allVideoPairs,
	allVideoSlugs,
	parseVideoSlug,
	relatedVideoPairs,
	resolveVideoFormat,
	videoAcceptAttribute
} from './formats';
import { parsePairSlug } from '$lib/engine';

describe('video formats', () => {
	it('reads five containers and writes seven targets', () => {
		expect(VIDEO_SOURCES.map((f) => f.id)).toEqual(['mp4', 'mov', 'webm', 'mkv', 'avi']);
		expect(VIDEO_TARGETS.map((f) => f.id)).toEqual([
			'mp4',
			'mov',
			'webm',
			'mkv',
			'avi',
			'gif',
			'mp3'
		]);
	});

	it('resolves ids, aliases and extensions', () => {
		expect(resolveVideoFormat('mp4')?.id).toBe('mp4');
		expect(resolveVideoFormat('m4v')?.id).toBe('mp4');
		expect(resolveVideoFormat('.mov')?.id).toBe('mov');
		expect(resolveVideoFormat('MKV')?.id).toBe('mkv');
		expect(resolveVideoFormat('nope')).toBeNull();
	});

	it('gives every writable container something to encode with', () => {
		for (const format of VIDEO_TARGETS) {
			if (format.kind === 'video') {
				expect(format.videoCodec, format.id).toBeTruthy();
				expect(format.audioCodec, format.id).toBeTruthy();
			}
			if (format.kind === 'audio') expect(format.audioCodec, format.id).toBeTruthy();
		}
	});

	it('knows WebM will not hold H.264, which is the slow conversion', () => {
		expect(VIDEO_FORMATS.webm.copyableVideoCodecs).not.toContain('h264');
		// and Matroska will hold anything, which is why it is always instant
		for (const codec of ['h264', 'vp8', 'vp9', 'av1']) {
			expect(VIDEO_FORMATS.mkv.copyableVideoCodecs).toContain(codec);
		}
	});

	it('builds 30 conversions and parses every slug back', () => {
		const pairs = allVideoPairs();
		expect(pairs.length).toBe(30);
		for (const pair of pairs) {
			const page = parseVideoSlug(pair.slug);
			expect(page, pair.slug).not.toBeNull();
			expect(page!.canonicalSlug).toBe(pair.slug);
		}
	});

	it('accepts alias spellings and points them at the primary page', () => {
		const page = parseVideoSlug('m4v-to-mp4');
		expect(page).toBeNull(); // same format on both sides
		const alias = parseVideoSlug('m4v-to-webm')!;
		expect(alias.sourceName).toBe('M4V');
		expect(alias.canonicalSlug).toBe('mp4-to-webm');
		expect(allVideoSlugs().length).toBeGreaterThan(allVideoPairs().length);
	});

	it('refuses slugs that are not real conversions', () => {
		expect(parseVideoSlug('gif-to-mp4')).toBeNull(); // GIF is a target only
		expect(parseVideoSlug('mp3-to-mp4')).toBeNull();
		expect(parseVideoSlug('mp4-to-mp4')).toBeNull();
		expect(parseVideoSlug('mp4-to-png')).toBeNull();
		expect(parseVideoSlug('not-a-slug')).toBeNull();
		expect(parseVideoSlug('.mp4-to-mov')).toBeNull();
	});

	it('never collides with an image conversion slug', () => {
		// both sections use x-to-y, and /convert/gif-to-png must not become
		// ambiguous with anything under /video
		for (const slug of allVideoSlugs()) {
			expect(parsePairSlug(slug), slug).toBeNull();
		}
	});

	it('cross-links without repeating itself or itself', () => {
		const page = parseVideoSlug('mov-to-mp4')!;
		const related = relatedVideoPairs(page);
		expect(related.length).toBeGreaterThan(3);
		expect(related.map((p) => p.slug)).not.toContain('mov-to-mp4');
		expect(new Set(related.map((p) => p.slug)).size).toBe(related.length);
	});

	it('offers an accept list covering every readable container', () => {
		const accept = videoAcceptAttribute();
		for (const format of VIDEO_SOURCES) {
			expect(accept, format.id).toContain(format.extensions[0]);
			expect(accept, format.id).toContain(format.mime);
		}
		expect(accept).not.toContain('.gif');
	});

	it('respects the copy style in every blurb', () => {
		for (const format of ALL_VIDEO_FORMATS) {
			expect(format.blurb, format.id).not.toContain('—');
			expect(format.blurb, format.id).not.toContain(';');
			expect(format.blurb.length, format.id).toBeGreaterThan(40);
		}
	});
});
