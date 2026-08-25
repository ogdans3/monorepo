import { describe, expect, it } from 'vitest';
import { cacheControlFor } from '../../cache-policy.js';

describe('cacheControlFor', () => {
	it('lets a fingerprinted asset be kept for a year', () => {
		const forever = 'public, max-age=31536000, immutable';
		expect(cacheControlFor('/_app/immutable/entry/app.BqK2n1.js')).toBe(forever);
		expect(cacheControlFor('/ffmpeg/0.12.10/ffmpeg-core.wasm')).toBe(forever);
	});

	it('makes everything else ask first, so a deploy is live at once', () => {
		expect(cacheControlFor('/')).toBe('no-cache');
		expect(cacheControlFor('/tools/combine-images')).toBe('no-cache');
		expect(cacheControlFor('/sitemap.xml')).toBe('no-cache');
		expect(cacheControlFor('/og.png')).toBe('no-cache');
		expect(cacheControlFor('/_app/version.json')).toBe('no-cache');
	});

	it('does not trust an unversioned file left in the ffmpeg directory', () => {
		// An older build put the core straight in /ffmpeg/. Caching that for a
		// year would pin a stale 32MB core no deploy could ever replace.
		expect(cacheControlFor('/ffmpeg/ffmpeg-core.wasm')).toBe('no-cache');
	});

	it('reads the path out of a full request URL', () => {
		expect(cacheControlFor('/tools/crop-image?from=share#top')).toBe('no-cache');
		expect(cacheControlFor('/_app/immutable/x.js?v=2')).toContain('immutable');
	});
});
