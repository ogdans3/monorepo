/**
 * Every number the site shows, and where each one came from.
 *
 * Design principle 2 in PRODUCT.md: a figure without a source is not
 * displayed. That is enforced by the types here rather than by discipline,
 * because this is a site about politics and "where did you get that" is the
 * first question any reader is entitled to ask.
 *
 * The salary side is real and fetched from SSB. The budget side is not yet:
 * statsbudsjettet.no and regjeringen.no both sit behind bot protection, and
 * the parties publish their alternative budgets as PDFs only. Those numbers
 * are marked `foreløpig` and the interface says so in as many words. Do not
 * remove that flag until the figures beside it have been replaced by ones
 * read out of the actual documents.
 */

export interface Kilde {
	/** What a reader would call it, e.g. "SSB tabell 11418". */
	navn: string;
	url: string;
	/** ISO date the figure was read. Budget numbers age in a known way. */
	hentet: string;
}

export interface Post {
	id: string;
	navn: string;
	/** Kroner. Always the full figure, never millions or billions. */
	beløp: number;
	/** One plain sentence a reader without any background can follow. */
	forklaring: string;
}

export interface Budsjett {
	id: string;
	/** "Vedtatt budsjett" or a party name. Never a slogan. */
	navn: string;
	år: number;
	type: 'vedtatt' | 'alternativt';
	poster: Post[];
	kilde: Kilde;
	/**
	 * True while the figures are stand-ins rather than read from the source
	 * document. The interface must render this visibly, not as a footnote.
	 */
	foreløpig: boolean;
}

/**
 * The average wage, and the one number the whole translation rests on.
 *
 * SSB publishes a monthly figure, not an annual one, so this is that figure
 * times twelve. That is the ordinary approximation and it is slightly rough:
 * SSB's "månedslønn" already averages in irregular supplements and bonuses,
 * but it excludes overtime. The site says this out loud rather than
 * presenting the product of a multiplication as a measured quantity.
 */
export const ÅRSLØNN = {
	månedslønn: 62_070,
	årslønn: 62_070 * 12,
	år: 2025,
	beskrivelse: 'gjennomsnitt for alle yrker, alle sektorer, begge kjønn, heltid og deltid samlet',
	kilde: {
		navn: 'SSB tabell 11418',
		url: 'https://www.ssb.no/statbank/table/11418',
		hentet: '2026-09-04'
	} satisfies Kilde
};

/**
 * Stand-in figures, deliberately round and deliberately flagged.
 *
 * These exist so the interface can be built and judged before the real
 * documents are in hand. They are the right order of magnitude and the right
 * shape, and they are not accurate. Nothing here may be published.
 */
export const VEDTATT: Budsjett = {
	id: 'vedtatt-2026',
	navn: 'Vedtatt budsjett',
	år: 2026,
	type: 'vedtatt',
	foreløpig: true,
	kilde: {
		navn: 'Ikke hentet ennå',
		url: 'https://www.statsbudsjettet.no/',
		hentet: '—'
	},
	poster: [
		{
			id: 'alderspensjon',
			navn: 'Alderspensjon',
			beløp: 350e9,
			forklaring: 'Utbetalinger fra folketrygden til alle som har gått av med pensjon.'
		},
		{
			id: 'helse',
			navn: 'Sykehus og helse',
			beløp: 250e9,
			forklaring: 'Driften av sykehusene, og staten sin del av helsetjenesten ellers.'
		},
		{
			id: 'kommuner',
			navn: 'Overføringer til kommunene',
			beløp: 200e9,
			forklaring: 'Pengene kommunene får av staten for å drive skole, barnehage og omsorg.'
		},
		{
			id: 'trygd',
			navn: 'Sykepenger og uføretrygd',
			beløp: 180e9,
			forklaring: 'Til folk som ikke kan jobbe, midlertidig eller varig.'
		},
		{
			id: 'forsvar',
			navn: 'Forsvar',
			beløp: 110e9,
			forklaring: 'Forsvaret, materiell og Norges bidrag til NATO.'
		},
		{
			id: 'samferdsel',
			navn: 'Vei og jernbane',
			beløp: 90e9,
			forklaring: 'Bygging og vedlikehold av veier, jernbane og kollektivtransport.'
		},
		{
			id: 'utdanning',
			navn: 'Høyere utdanning og forskning',
			beløp: 60e9,
			forklaring: 'Universiteter, høyskoler, studiestøtte og forskning.'
		},
		{
			id: 'bistand',
			navn: 'Bistand',
			beløp: 45e9,
			forklaring: 'Norsk utviklingshjelp og humanitær bistand i andre land.'
		}
	]
};

/** Sum of every line in a budget, in kroner. */
export function sum(budsjett: Budsjett): number {
	return budsjett.poster.reduce((total, post) => total + post.beløp, 0);
}

/** Lines biggest first. The rule is stated on the page, not just applied. */
export function sortertePoster(budsjett: Budsjett): Post[] {
	return [...budsjett.poster].sort((a, b) => b.beløp - a.beløp);
}
