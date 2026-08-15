import { describe, expect, it } from 'vitest';
import {
	REQUEST_KINDS,
	bodyFor,
	isSendable,
	mailtoFor,
	subjectFor,
	type FeedbackDraft
} from './feedback';

const draft = (over: Partial<FeedbackDraft> = {}): FeedbackDraft => ({
	kind: 'tool',
	message: 'Please add a tool that removes the background from a photo.',
	...over
});

describe('feedback', () => {
	it('offers a reason for every kind of request', () => {
		expect(REQUEST_KINDS.map((k) => k.id)).toEqual(['tool', 'format', 'bug', 'other']);
		for (const kind of REQUEST_KINDS) {
			expect(kind.placeholder.length, kind.id).toBeGreaterThan(5);
			expect(kind.label, kind.id).not.toContain('—');
		}
	});

	it('titles the mail by what it is about', () => {
		expect(subjectFor(draft())).toBe('Tool request');
		expect(subjectFor(draft({ kind: 'bug' }))).toBe('Bug report');
	});

	it('leads with what the person said, not with our diagnostics', () => {
		const body = bodyFor(draft({ fromPath: '/tools/crop-image' }), { browser: 'Firefox' });
		expect(body.startsWith('Please add a tool')).toBe(true);
		expect(body).toContain('Page: /tools/crop-image');
		expect(body).toContain('Browser: Firefox');
		// the context is separated so it reads as a footnote
		expect(body.indexOf('---')).toBeGreaterThan(body.indexOf('background'));
	});

	it('adds no footnote at all when there is nothing to add', () => {
		expect(bodyFor(draft())).toBe('Please add a tool that removes the background from a photo.');
		expect(bodyFor(draft())).not.toContain('---');
	});

	it('trims what was typed', () => {
		expect(bodyFor(draft({ message: '  spaced out  ' }))).toBe('spaced out');
	});

	it('builds a mailto that survives punctuation', () => {
		const url = mailtoFor(
			draft({ message: 'Add HEIF & AVIF, please? 50% would be nice.' }),
			'hello@imagetoolbox.org'
		);
		expect(url.startsWith('mailto:hello@imagetoolbox.org?')).toBe(true);
		const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
		expect(params.get('body')).toContain('HEIF & AVIF, please? 50% would be nice.');
		expect(params.get('subject')).toBe('Tool request');
	});

	it('encodes spaces as %20, since a mail client shows a + as a plus', () => {
		const url = mailtoFor(draft(), 'hello@imagetoolbox.org');
		expect(url).not.toContain('+');
		expect(url).toContain('%20');
	});

	it('keeps newlines intact through the round trip', () => {
		const url = mailtoFor(draft({ message: 'One\n\nTwo' }), 'a@b.c');
		const body = new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('body');
		expect(body).toBe('One\n\nTwo');
	});

	it('waits for something worth sending', () => {
		expect(isSendable(draft({ message: '' }))).toBe(false);
		expect(isSendable(draft({ message: 'more' }))).toBe(false);
		expect(isSendable(draft({ message: '          ' }))).toBe(false);
		expect(isSendable(draft())).toBe(true);
	});
});
