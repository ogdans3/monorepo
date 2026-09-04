/**
 * Turning kroner into something a person can hold in their head.
 *
 * Pure and tested, because this is where the site's one claim lives. If the
 * translation from a budget line to "so many people's wages" is wrong, every
 * sentence on the page is wrong with it, and it fails silently: a plausible
 * number looks exactly like a correct one.
 *
 * Norwegian conventions throughout, and they are not the same as English:
 * a non-breaking space groups thousands, the decimal mark is a comma, and a
 * "billion" is a milliard. Getting that last one wrong is the classic way to
 * be off by a factor of a thousand in public.
 */

/**
 * Non-breaking space, written as an escape on purpose. As a literal character
 * it is indistinguishable from a normal space in every editor and diff, and it
 * silently became one when this file was first written.
 */
const NBSP = '\u00A0';

/** Full kroner with thousands grouped: 1 823 400 000 000. */
export function kroner(value: number): string {
	return Math.round(value).toLocaleString('nb-NO').replace(/\s/g, NBSP);
}

/**
 * The short form a headline wants: "1 823 milliarder", "42,5 milliarder",
 * "980 millioner".
 *
 * Decimals appear only where they carry information. "1 823,0 milliarder"
 * claims a precision the underlying budget does not have, and "0,04
 * milliarder" is a number nobody can picture.
 */
export function storBeløp(value: number): string {
	const abs = Math.abs(value);
	if (abs >= 1e9) {
		const milliarder = value / 1e9;
		const decimals = Math.abs(milliarder) >= 100 ? 0 : 1;
		return `${format(milliarder, decimals)}${NBSP}milliarder`;
	}
	if (abs >= 1e6) {
		const millioner = value / 1e6;
		return `${format(millioner, Math.abs(millioner) >= 100 ? 0 : 1)}${NBSP}millioner`;
	}
	return `${kroner(value)}${NBSP}kroner`;
}

function format(value: number, decimals: number): string {
	return value
		.toLocaleString('nb-NO', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		})
		.replace(/\s/g, NBSP);
}

/**
 * How many average annual salaries a sum is worth.
 *
 * The whole site is this one division. It is a separate function so it can be
 * tested against hand-worked examples, and so the rounding rule lives in one
 * place: never round to zero, because "0 lønninger" is false for any positive
 * amount and reads as a bug.
 */
export function iLønninger(kroner: number, årslønn: number): number {
	if (årslønn <= 0) throw new Error('Årslønn må være positiv');
	return kroner / årslønn;
}

/**
 * The same division, said out loud.
 *
 * Above a thousand the exact count stops meaning anything, so it rounds hard
 * and says so with the wording rather than with a decimal nobody reads.
 */
export function lønningerTekst(antall: number): string {
	if (antall < 1) return 'under én årslønn';
	if (antall < 10) return `${format(antall, 1)} årslønner`;
	if (antall < 1000) return `${format(Math.round(antall), 0)} årslønner`;
	return `${format(Math.round(antall), 0)} årslønner`;
}

/**
 * What one mark stands for when there are too many to draw.
 *
 * A field of two million squares is not a picture, it is a grey rectangle, so
 * the field draws a sample and states the scale. The scale is always a round
 * power of ten: "ett merke er 1 000 årslønner" is a sentence someone can hold,
 * "ett merke er 1 374 årslønner" is not.
 */
export function merkeskala(antallLønninger: number, maksMerker: number): number {
	if (antallLønninger <= maksMerker) return 1;
	const rå = antallLønninger / maksMerker;
	const eksponent = Math.ceil(Math.log10(rå));
	return 10 ** eksponent;
}

/** Andel av en helhet, som "12,4 %". Norsk har mellomrom foran prosenttegnet. */
export function andel(del: number, helhet: number): string {
	if (helhet === 0) return '–';
	// One decimal everywhere rather than a threshold. A column that reads
	// "9,8 %" then "12 %" is a column with a wobble in it, and budget shares
	// are exactly the kind of number people read down rather than across.
	const prosent = (del / helhet) * 100;
	return `${format(prosent, 1)}${NBSP}%`;
}
