/**
 * The small amount of formatting a box is allowed to carry.
 *
 * A step is often a sentence and sometimes a paragraph, and a paragraph that
 * cannot emphasise a word or list three things is a paragraph people write
 * somewhere else instead. So: bold, italic, and bullets, spelled the way
 * everybody already types them into a chat box.
 *
 * Marks live in the text itself rather than in a parallel structure of spans.
 * That keeps a node's text a plain string, which is what makes save, load,
 * Mermaid and the file format one problem rather than four, and it means the
 * writer can always see and fix their own markup. The cost is that `**` is not
 * available as literal text without a backslash, which is a trade worth making
 * for a flow chart.
 *
 * Pure: no DOM. The canvas and the exported SVG both draw what this returns,
 * for the same reason they share one wrapping rule.
 */

/** A stretch of text with one set of marks on it. */
export interface TextRun {
	text: string;
	bold: boolean;
	italic: boolean;
}

/** One line of source, once its marks and its bullet have been read off. */
export interface RichLine {
	runs: TextRun[];
	bullet: boolean;
}

/** What a bullet is drawn as, and the indent its wrapped lines carry. */
export const BULLET = '• ';
const CONTINUATION = '  ';

const BULLET_AT = /^\s*([-*•])\s+/;

/**
 * Reads one line's marks.
 *
 * A hand-rolled scan rather than a regex because the marks nest: `***both***`
 * is bold and italic, and a regex that finds `**` first leaves a stray `*` at
 * each end. Walking it once with a small stack gets that right and is easier to
 * follow than the alternation that would not.
 */
function runsOf(text: string): TextRun[] {
	const runs: TextRun[] = [];
	let bold = false;
	let italic = false;
	let buffer = '';

	const flush = () => {
		if (buffer) runs.push({ text: buffer, bold, italic });
		buffer = '';
	};

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];

		// A backslash is how you write a mark you meant literally.
		if (ch === '\\' && i + 1 < text.length && '*_\\'.includes(text[i + 1])) {
			buffer += text[i + 1];
			i += 1;
			continue;
		}

		if (ch === '*' && text[i + 1] === '*') {
			flush();
			bold = !bold;
			i += 1;
			continue;
		}

		if (ch === '*' || ch === '_') {
			// `_` only marks at a word boundary, so snake_case survives intact.
			if (ch === '_' && !boundary(text, i)) {
				buffer += ch;
				continue;
			}
			flush();
			italic = !italic;
			continue;
		}

		buffer += ch;
	}

	flush();
	return runs.length ? runs : [{ text: '', bold: false, italic: false }];
}

/** True when the character sits at the edge of a word rather than inside one. */
function boundary(text: string, at: number): boolean {
	const before = at > 0 ? text[at - 1] : ' ';
	const after = at + 1 < text.length ? text[at + 1] : ' ';
	return !/\w/.test(before) || !/\w/.test(after);
}

/** Splits a block of text into lines, each with its marks and bullet read off. */
export function parseRich(text: string): RichLine[] {
	return text.split(/\r?\n/).map((raw) => {
		const bullet = BULLET_AT.test(raw);
		return { runs: runsOf(bullet ? raw.replace(BULLET_AT, '') : raw), bullet };
	});
}

/** The text with every mark removed: what gets measured, and what Mermaid gets. */
export function plainText(text: string): string {
	return parseRich(text)
		.map((line) => (line.bullet ? BULLET : '') + line.runs.map((run) => run.text).join(''))
		.join('\n');
}

/** True if the text carries any markup at all, marks or bullets. */
export function hasMarkup(text: string): boolean {
	return plainText(text) !== text;
}

/**
 * Greedy wrap over runs.
 *
 * The same rule as plain text — count characters, never break a word — but
 * carrying the marks across, so a bold phrase that straddles a line break stays
 * bold on both halves. A bullet takes its marker on the first line and an
 * indent on the rest, baked into the runs rather than left as a flag, because
 * the canvas and the export must not each work out their own hanging indent.
 */
export function wrapRich(text: string, limit: number): TextRun[][] {
	const out: TextRun[][] = [];

	for (const line of parseRich(text)) {
		const prefix = line.bullet ? BULLET : '';
		const room = Math.max(4, limit - prefix.length);
		const words = wordsOf(line.runs);

		let current: TextRun[] = [];
		let length = 0;
		// Whether this is still the first wrapped line of *this* source line. The
		// marker belongs on that one and the indent on the rest; asking whether
		// anything has been pushed at all would put a marker on the first line of
		// the block and an indent on every bullet after it.
		let first = true;

		const push = () => {
			const indent = first ? prefix : line.bullet ? CONTINUATION : '';
			out.push(indent ? [{ text: indent, bold: false, italic: false }, ...current] : current);
			first = false;
			current = [];
			length = 0;
		};

		for (const word of words) {
			const width = word.reduce((n, run) => n + run.text.length, 0);
			if (current.length && length + 1 + width > room) push();
			if (current.length) {
				// The joining space takes the marks of what it follows, so a bold
				// phrase stays one run instead of three with a plain gap in it.
				const previous = current[current.length - 1];
				length += 1;
				append(current, { text: ' ', bold: previous.bold, italic: previous.italic });
			}
			for (const run of word) append(current, run);
			length += width;
		}

		if (current.length || !out.length || line.bullet) push();
		else out.push(prefix ? [{ text: prefix, bold: false, italic: false }] : []);
	}

	// A trailing blank from a final newline is a line the writer is about to
	// use; one on its own is just an empty box.
	while (out.length > 1 && isBlank(out[out.length - 1])) out.pop();
	return out.length ? out : [[]];
}

/** Splits runs into words, keeping each word's marks with it. */
function wordsOf(runs: TextRun[]): TextRun[][] {
	const words: TextRun[][] = [];
	let current: TextRun[] = [];

	for (const run of runs) {
		const pieces = run.text.split(/(\s+)/);
		for (const piece of pieces) {
			if (!piece) continue;
			if (/^\s+$/.test(piece)) {
				if (current.length) words.push(current);
				current = [];
				continue;
			}
			append(current, { ...run, text: piece });
		}
	}

	if (current.length) words.push(current);
	return words;
}

/** Adds a run, merging it into the last one when the marks match. */
function append(runs: TextRun[], run: TextRun): void {
	const last = runs[runs.length - 1];
	if (last && last.bold === run.bold && last.italic === run.italic) last.text += run.text;
	else runs.push({ ...run });
}

function isBlank(runs: TextRun[]): boolean {
	return runs.every((run) => run.text.trim() === '');
}

/** The plain text of a wrapped line, for measuring and for tests. */
export function runsToText(runs: TextRun[]): string {
	return runs.map((run) => run.text).join('');
}
