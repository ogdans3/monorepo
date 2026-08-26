import { acceptAttribute, allPairs, resolveFormat, type Format } from '$lib/engine';
import { PDF_CATEGORY, TOOLS, toolPath, type ImageTool } from './registry';

/**
 * Carrying a result from one tool into the next.
 *
 * The rules of the place make this a small problem with one wrong answer. Files
 * never leave the device, so there is no server to park a working copy on, and
 * nothing is written to storage, so IndexedDB and sessionStorage are out too:
 * putting somebody's photo in device storage to save them a click would be a
 * bigger promise broken than the click was worth. What is left is memory, which
 * is exactly right. The carried file lives as long as the tab does and not one
 * moment longer, and every page of this site is one SvelteKit app, so moving
 * between tools does not lose it.
 *
 * This file is the pure half: what a file is, what a tool will take, and where
 * a given result can usefully go next. The slot itself is `ui/carry.svelte.ts`.
 */

export interface CarriedFile {
	file: File;
	/** Name of the tool it came out of, for the line that says where it is from. */
	from: string;
	/**
	 * Path the visitor chose to continue in, if they chose one. That page loads
	 * it without asking. Anywhere else offers it instead, because arriving
	 * somewhere and finding an image already open is only welcome if you asked.
	 */
	to?: string;
}

/** What a file is, as far as this site cares. */
export type FileKind = 'image' | 'pdf';

/**
 * The same rule the browser applies to an `accept` attribute: a comma-separated
 * list of MIME types, `type/*` wildcards and `.extensions`, any one of which
 * may match. Written out rather than handed to an `<input>` because the offer
 * to continue has to be decided before there is an input to ask.
 */
export function acceptsFile(file: { name: string; type: string }, accept: string): boolean {
	const tokens = accept
		.split(',')
		.map((token) => token.trim().toLowerCase())
		.filter(Boolean);
	if (tokens.length === 0) return true;
	const name = file.name.toLowerCase();
	const type = file.type.toLowerCase();
	return tokens.some((token) => {
		if (token.startsWith('.')) return name.endsWith(token);
		if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
		return type !== '' && type === token;
	});
}

/**
 * What a tool takes in. Everything here works on images except the PDF tools
 * that read a document, and those say so in the registry, because "pdf" in a
 * slug means the input on `pdf-to-jpg` and the output on `jpg-to-pdf`.
 */
export function toolTakes(tool: ImageTool): FileKind {
	return tool.takes ?? 'image';
}

/** The `accept` string a tool's dropzone uses, derived from the same field. */
export function toolAccept(tool: ImageTool): string {
	return toolTakes(tool) === 'pdf' ? 'application/pdf,.pdf' : acceptAttribute();
}

/**
 * Every tool a given result can go on to, minus the one it came from.
 *
 * Ordered as the site orders itself: the tool's own hand-picked next steps
 * first, since "you cropped it, now sharpen it" is worth more than the
 * alphabet, then everything else that will take the file.
 */
export function destinationsFor(
	file: { name: string; type: string },
	fromSlug?: string
): ImageTool[] {
	const source = TOOLS.find((tool) => tool.slug === fromSlug);
	const usable = TOOLS.filter(
		(tool) => tool.slug !== fromSlug && acceptsFile(file, toolAccept(tool))
	);
	const preferred = (source?.next ?? [])
		.map((slug) => usable.find((tool) => tool.slug === slug))
		.filter((tool): tool is ImageTool => Boolean(tool));
	return [...preferred, ...usable.filter((tool) => !preferred.includes(tool))];
}

export interface Conversion {
	slug: string;
	/** e.g. "to JPG", since the source is the file you are already holding. */
	label: string;
	path: string;
}

/**
 * The format a result already is, worked out from its name and type. The engine
 * sniffs bytes, which is the honest way in, but this file is deciding where a
 * link should point and the extension is enough for that.
 */
export function formatOf(file: { name: string; type: string }): Format | undefined {
	const ext = file.name.slice(file.name.lastIndexOf('.') + 1);
	return resolveFormat(ext) ?? [...file.type.matchAll(/image\/([a-z0-9+]+)/g)]
		.map((m) => resolveFormat(m[1]))
		.find(Boolean);
}

/**
 * Conversions worth offering for a result: the ones out of the format it is
 * already in. Every pair page can read anything, so listing all sixty-three
 * would be listing the same page sixty-three times over. From here, "to WebP"
 * is a real next step and "HEIC to JPG" is not, because this is not a HEIC.
 */
export function conversionsFor(file: { name: string; type: string }): Conversion[] {
	const source = formatOf(file);
	if (!source) return [];
	return allPairs()
		.filter((pair) => pair.source.id === source.id)
		.map((pair) => ({
			slug: pair.slug,
			label: `to ${pair.target.name}`,
			path: `/convert/${pair.slug}`
		}));
}

/**
 * The hub to send somebody to when they want the whole list. It already exists,
 * with search, categories and a description of every tool, which is why the
 * picker does not try to be a second one.
 */
export function hubFor(file: { name: string; type: string }): string {
	return acceptsFile(file, 'application/pdf,.pdf') ? '/pdf' : '/tools';
}

/** Groups a destination list for a picker: PDF tools live in their own section. */
export function groupDestinations(tools: ImageTool[]): { label: string; tools: ImageTool[] }[] {
	const images = tools.filter((tool) => tool.category !== PDF_CATEGORY);
	const pdfs = tools.filter((tool) => tool.category === PDF_CATEGORY);
	return [
		{ label: 'Image tools', tools: images },
		{ label: 'PDF tools', tools: pdfs }
	].filter((group) => group.tools.length > 0);
}

export { toolPath };
