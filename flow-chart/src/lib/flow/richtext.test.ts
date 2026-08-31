import { describe, expect, it } from 'vitest';
import { BULLET, hasMarkup, parseRich, plainText, runsToText, wrapRich } from './richtext';

describe('parseRich', () => {
	it('leaves plain text alone', () => {
		expect(parseRich('hello')).toEqual([
			{ runs: [{ text: 'hello', bold: false, italic: false }], bullet: false }
		]);
	});

	it('reads bold and italic', () => {
		const [line] = parseRich('a **b** c *d*');
		expect(line.runs).toEqual([
			{ text: 'a ', bold: false, italic: false },
			{ text: 'b', bold: true, italic: false },
			{ text: ' c ', bold: false, italic: false },
			{ text: 'd', bold: false, italic: true }
		]);
	});

	it('nests bold and italic', () => {
		const [line] = parseRich('***both***');
		expect(line.runs).toEqual([{ text: 'both', bold: true, italic: true }]);
	});

	it('takes a bullet from any of the three markers', () => {
		for (const marker of ['- ', '* ', '• ']) {
			const [line] = parseRich(`${marker}item`);
			expect(line.bullet, marker).toBe(true);
			expect(runsToText(line.runs)).toBe('item');
		}
	});

	it('does not read an italic mark as a bullet', () => {
		const [line] = parseRich('*italic* start');
		expect(line.bullet).toBe(false);
		expect(line.runs[0]).toEqual({ text: 'italic', bold: false, italic: true });
	});

	it('leaves snake_case alone', () => {
		const [line] = parseRich('order_id is set');
		expect(runsToText(line.runs)).toBe('order_id is set');
		expect(line.runs.every((run) => !run.italic)).toBe(true);
	});

	it('honours a backslash escape', () => {
		const [line] = parseRich('2 \\* 3');
		expect(runsToText(line.runs)).toBe('2 * 3');
		expect(line.runs.every((run) => !run.italic)).toBe(true);
	});
});

describe('plainText', () => {
	it('strips marks and spells the bullet out', () => {
		expect(plainText('- **do** it')).toBe(`${BULLET}do it`);
	});

	it('is a no-op on text with nothing in it', () => {
		expect(plainText('just words')).toBe('just words');
		expect(hasMarkup('just words')).toBe(false);
		expect(hasMarkup('**words**')).toBe(true);
	});
});

describe('wrapRich', () => {
	it('wraps on the character limit', () => {
		const lines = wrapRich('one two three four five', 9);
		expect(lines.map(runsToText)).toEqual(['one two', 'three', 'four five']);
	});

	it('carries marks across a wrap', () => {
		const lines = wrapRich('**alpha beta gamma**', 11);
		expect(lines.map(runsToText)).toEqual(['alpha beta', 'gamma']);
		expect(lines.every((line) => line.every((run) => run.bold))).toBe(true);
	});

	it('gives a bullet its marker and indents what wraps under it', () => {
		const lines = wrapRich('- alpha beta gamma delta', 12);
		expect(lines[0][0].text).toBe(BULLET);
		expect(runsToText(lines[0])).toBe(`${BULLET}alpha beta`);
		expect(runsToText(lines[1]).startsWith('  ')).toBe(true);
	});

	it('marks every bullet, not just the first line of the block', () => {
		const lines = wrapRich('Checks:\n- one\n- two\n- three', 40).map(runsToText);
		expect(lines).toEqual(['Checks:', `${BULLET}one`, `${BULLET}two`, `${BULLET}three`]);
	});

	it('indents only the lines a bullet wraps onto', () => {
		const lines = wrapRich('- alpha beta gamma\n- short', 12).map(runsToText);
		expect(lines[0]).toBe(`${BULLET}alpha beta`);
		expect(lines[1]).toBe('  gamma');
		expect(lines[2]).toBe(`${BULLET}short`);
	});

	it('keeps a line break the writer typed', () => {
		expect(wrapRich('one\ntwo', 40).map(runsToText)).toEqual(['one', 'two']);
	});

	it('never breaks a word longer than the line', () => {
		expect(wrapRich('supercalifragilistic', 8).map(runsToText)).toEqual(['supercalifragilistic']);
	});

	it('drops a lone trailing blank', () => {
		expect(wrapRich('one\n', 40).map(runsToText)).toEqual(['one']);
	});

	it('returns one empty line for empty text', () => {
		expect(wrapRich('', 40)).toEqual([[]]);
	});
});
