import { describe, expect, it } from 'vitest';
import {
	acceptsFile,
	conversionsFor,
	destinationsFor,
	formatOf,
	groupDestinations,
	hubFor,
	toolAccept,
	toolTakes
} from './handoff';
import { TOOLS, toolBySlug } from './registry';

const png = { name: 'holiday-cropped.png', type: 'image/png' };
const pdf = { name: 'scan.pdf', type: 'application/pdf' };

describe('acceptsFile', () => {
	it('matches the way an accept attribute does', () => {
		expect(acceptsFile(png, 'image/png,image/jpeg')).toBe(true);
		expect(acceptsFile(png, 'image/jpeg')).toBe(false);
		expect(acceptsFile(png, 'image/*')).toBe(true);
		expect(acceptsFile(pdf, 'image/*')).toBe(false);
		expect(acceptsFile(pdf, 'application/pdf,.pdf')).toBe(true);
	});

	it('falls back to the extension, which is all a HEIC often has', () => {
		// Browsers hand over an empty type for formats they cannot display, so
		// the extension is the only thing left to go on.
		expect(acceptsFile({ name: 'IMG_0001.HEIC', type: '' }, '.heic,.png')).toBe(true);
		expect(acceptsFile({ name: 'IMG_0001.HEIC', type: '' }, 'image/png')).toBe(false);
	});

	it('takes anything when nothing is asked for', () => {
		expect(acceptsFile(png, '')).toBe(true);
	});
});

describe('what a tool reads', () => {
	it('is images unless the tool says otherwise', () => {
		expect(toolTakes(toolBySlug('crop-image')!)).toBe('image');
		expect(toolTakes(toolBySlug('image-to-pdf')!)).toBe('image');
	});

	it('is a document for the PDF tools that read one', () => {
		// "pdf" in a slug is the input on one of these and the output on the
		// other, which is exactly why it is written down rather than guessed.
		expect(toolTakes(toolBySlug('pdf-to-jpg')!)).toBe('pdf');
		expect(toolTakes(toolBySlug('jpg-to-pdf')!)).toBe('image');
	});

	it('gives every tool a dropzone filter that agrees with it', () => {
		for (const tool of TOOLS) {
			const accept = toolAccept(tool);
			expect(acceptsFile(pdf, accept), tool.slug).toBe(toolTakes(tool) === 'pdf');
			expect(acceptsFile(png, accept), tool.slug).toBe(toolTakes(tool) === 'image');
		}
	});
});

describe('destinationsFor', () => {
	it('offers every tool that can read the result', () => {
		const slugs = destinationsFor(png).map((t) => t.slug);
		expect(slugs).toContain('blur-image');
		expect(slugs).toContain('crop-image');
		expect(slugs).toContain('image-to-pdf');
		// A PDF tool that reads documents cannot do anything with a PNG.
		expect(slugs).not.toContain('merge-pdf');
	});

	it('offers the PDF tools a document, and nothing that wants a picture', () => {
		const slugs = destinationsFor(pdf).map((t) => t.slug);
		expect(slugs).toContain('pdf-to-jpg');
		expect(slugs).toContain('merge-pdf');
		expect(slugs).not.toContain('crop-image');
	});

	it('never offers the tool you are standing in', () => {
		expect(destinationsFor(png, 'crop-image').map((t) => t.slug)).not.toContain('crop-image');
	});

	it('puts the hand-picked next steps first, then the rest', () => {
		const crop = toolBySlug('crop-image')!;
		const slugs = destinationsFor(png, 'crop-image').map((t) => t.slug);
		expect(slugs.slice(0, crop.next!.length)).toEqual(crop.next);
		// and everything is still there exactly once
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it('leaves every image tool reachable from every other one', () => {
		// The promise is any order, so the only tool missing from a tool's list
		// should be itself.
		const images = TOOLS.filter((t) => toolTakes(t) === 'image');
		for (const tool of images) {
			const reachable = destinationsFor(png, tool.slug);
			expect(reachable.length, tool.slug).toBe(images.length - 1);
		}
	});
});

describe('conversionsFor', () => {
	it('offers the conversions out of the format the result already is', () => {
		const labels = conversionsFor(png).map((c) => c.label);
		expect(labels).toContain('to JPG');
		expect(labels).toContain('to WebP');
		// Every pair page reads anything, so a page for converting *to* PNG is
		// the same page again rather than a next step.
		expect(labels).not.toContain('to PNG');
		expect(conversionsFor(png).every((c) => c.slug.startsWith('png-to-'))).toBe(true);
	});

	it('reads the format off the name, and off the type when it has to', () => {
		expect(formatOf({ name: 'holiday.JPG', type: '' })?.id).toBe('jpg');
		expect(formatOf({ name: 'no-extension', type: 'image/webp' })?.id).toBe('webp');
		expect(formatOf({ name: 'scan.pdf', type: 'application/pdf' })).toBeUndefined();
	});

	it('offers nothing for a file it cannot place', () => {
		expect(conversionsFor(pdf)).toEqual([]);
	});
});

describe('hubFor', () => {
	it('sends an image to the image tools and a document to the PDF ones', () => {
		expect(hubFor(png)).toBe('/tools');
		expect(hubFor(pdf)).toBe('/pdf');
	});
});

describe('groupDestinations', () => {
	it('keeps the PDF tools in a section of their own', () => {
		const groups = groupDestinations(destinationsFor(png, 'crop-image'));
		expect(groups.map((g) => g.label)).toEqual(['Image tools', 'PDF tools']);
		expect(groups[1].tools.every((t) => t.category === 'pdf')).toBe(true);
	});

	it('drops a section with nothing in it', () => {
		const groups = groupDestinations(destinationsFor(pdf));
		expect(groups.map((g) => g.label)).toEqual(['PDF tools']);
	});
});
