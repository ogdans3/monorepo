import { describe, expect, it } from 'vitest';
import { allVideoSlugs, parseVideoSlug } from './formats';
import {
	VIDEO_CATEGORIES,
	VIDEO_TOOLS,
	nextVideoTools,
	videoToolBySlug,
	videoToolFaqSubject,
	videoToolPath,
	videoToolsInCategory
} from './tools';
import { TOOLS, toolBySlug } from '../tools/registry';
import { trustFaq } from '../faq';

describe('the video tools table', () => {
	it('sorts every tool into a defined category, and none is lonely', () => {
		const ids = VIDEO_CATEGORIES.map((c) => c.id);
		for (const tool of VIDEO_TOOLS) expect(ids, tool.slug).toContain(tool.category);
		for (const id of ids) expect(videoToolsInCategory(id).length, id).toBeGreaterThan(0);
	});

	it('has unique kebab-case slugs that never collide with a conversion page', () => {
		const slugs = VIDEO_TOOLS.map((t) => t.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
		for (const slug of slugs) {
			expect(slug, slug).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
			// /video/[pair] is a dynamic route, so a tool slug that also parses
			// as a conversion pair would be reachable two ways and indexed twice.
			expect(parseVideoSlug(slug), slug).toBeNull();
			expect(allVideoSlugs(), slug).not.toContain(slug);
		}
	});

	it('never reuses a slug an image tool already has', () => {
		const taken = new Set(TOOLS.map((t) => t.slug));
		for (const tool of VIDEO_TOOLS) expect(taken.has(tool.slug), tool.slug).toBe(false);
	});

	it('routes every tool under /video', () => {
		for (const tool of VIDEO_TOOLS) expect(videoToolPath(tool)).toBe(`/video/${tool.slug}`);
	});

	it('keeps titles and descriptions inside sensible SEO lengths', () => {
		for (const tool of VIDEO_TOOLS) {
			expect(tool.title.length, tool.slug).toBeLessThanOrEqual(60);
			expect(tool.description.length, tool.slug).toBeGreaterThanOrEqual(100);
			expect(tool.description.length, tool.slug).toBeLessThanOrEqual(165);
			expect(tool.steps.length, tool.slug).toBeGreaterThanOrEqual(3);
			expect(tool.about.length, tool.slug).toBeGreaterThanOrEqual(2);
		}
	});

	it('respects the copy style: no em dashes, no semicolons', () => {
		for (const tool of VIDEO_TOOLS) {
			const copy = [
				tool.h1,
				tool.title,
				tool.description,
				tool.lede,
				tool.blurb,
				tool.aboutHeading,
				...tool.steps,
				...tool.about,
				...tool.faq.flatMap((f) => [f.q, f.a])
			].join(' ');
			expect(copy, tool.slug).not.toContain('—');
			expect(copy, tool.slug).not.toContain(';');
		}
	});

	it('gives every tool questions that only it could answer', () => {
		const seen = new Map<string, string>();
		for (const tool of VIDEO_TOOLS) {
			expect(tool.faq.length, tool.slug).toBeGreaterThanOrEqual(2);
			for (const { q, a } of tool.faq) {
				expect(q.endsWith('?'), `${tool.slug}: ${q}`).toBe(true);
				expect(a.length, `${tool.slug}: ${q}`).toBeGreaterThan(140);
				expect(seen.has(q), `${q} is used by both ${seen.get(q)} and ${tool.slug}`).toBe(false);
				seen.set(q, tool.slug);
			}
		}
	});

	it('does not reuse a question an image tool already answers', () => {
		const taken = new Set(TOOLS.flatMap((t) => t.faq.map((f) => f.q)));
		for (const tool of VIDEO_TOOLS) {
			for (const { q } of tool.faq) expect(taken.has(q), `${tool.slug}: ${q}`).toBe(false);
		}
	});

	it('every next step points at a tool that exists, and never at itself', () => {
		for (const tool of VIDEO_TOOLS) {
			expect(nextVideoTools(tool).length, `${tool.slug} has resolvable next steps`).toBe(
				(tool.next ?? []).length
			);
			expect(tool.next ?? [], tool.slug).not.toContain(tool.slug);
		}
	});

	it('only claims frames are kept for the two edits that copy the picture', () => {
		const keeps = VIDEO_TOOLS.filter((t) => t.keepsFrames).map((t) => t.slug);
		expect(keeps.sort()).toEqual(['mute-video', 'trim-video']);
	});

	it('links to a picture twin only when that page exists, and the twin links back', () => {
		for (const tool of VIDEO_TOOLS) {
			if (!tool.image) continue;
			const twin = toolBySlug(tool.image.slug);
			expect(twin, `${tool.slug} → ${tool.image.slug}`).toBeDefined();
			expect(twin?.video?.slug, `${tool.image.slug} links back`).toBe(tool.slug);
			expect(tool.image.label, tool.slug).not.toMatch(/[—;]/);
		}
		expect(videoToolBySlug('phone-frame-video')?.image?.slug).toBe('phone-frame');
	});

	it('asks the shared questions about a tool, not about a sentence', () => {
		for (const tool of VIDEO_TOOLS) {
			const subject = videoToolFaqSubject(tool);
			const [free] = trustFaq(subject);
			// The h1 once went in here and every page asked "Is the crop a video free?".
			expect(free.q, tool.slug).not.toMatch(/ a video free\?$/);
			expect(subject, tool.slug).toMatch(/video/);
			expect(subject, tool.slug).toBe(subject.toLowerCase());
		}
		expect(trustFaq(videoToolFaqSubject(videoToolBySlug('crop-video')!))[0].q).toBe(
			'Is the crop video tool free?'
		);
		expect(trustFaq(videoToolFaqSubject(videoToolBySlug('speed-up-video')!))[0].q).toBe(
			'Is the video speed up tool free?'
		);
		expect(trustFaq(videoToolFaqSubject(videoToolBySlug('extract-video-frames')!))[0].q).toBe(
			'Is the video frame extractor free?'
		);
	});

	it('gives the phone frame a verb for its button and names its controls as the page does', () => {
		const phone = videoToolBySlug('phone-frame-video')!;
		expect(phone.action).toBe('Add phone frame');
		const copy = [...phone.about, ...phone.faq.map((f) => f.a)].join(' ');
		// The checkbox reads "See-through corners, saved as WebM". There is no
		// control called transparent to tick.
		expect(copy).not.toMatch(/transparent option/i);
		expect(copy).toMatch(/Tick see-through corners/);
		// MOV can carry alpha (ProRes 4444, PNG). What can't is the H.264 this page writes.
		expect(copy).not.toMatch(/MP4 and MOV (can't|have no way to) store/);
		// Measured at three to seven times the clip's length in the browser.
		expect(copy).not.toMatch(/as long as the recording runs/);
	});

	it('resolves by slug', () => {
		expect(videoToolBySlug('crop-video')?.name).toBe('Crop');
		expect(videoToolBySlug('nope')).toBeUndefined();
	});
});
