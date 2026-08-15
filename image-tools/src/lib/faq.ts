/**
 * The promises as full questions and answers. Written as complete,
 * self-contained sentences on purpose: this is the shape search engines and
 * AI assistants quote. The subject keeps each page's wording specific.
 *
 * Two questions, not four. These sentences are identical on every page, and
 * they used to be the whole FAQ, which made roughly a third of every page
 * word for word the same as the other 162. All four promises are still here,
 * folded into two answers, and the visible trust line above the fold carries
 * them again. Everything after these two belongs to the page alone, which is
 * the part worth ranking.
 *
 * These are also the two most read sentences on the site, sitting on all 170
 * pages, so they are worth more care than anything else in here.
 */

export interface FaqItem {
	q: string;
	a: string;
}

export function trustFaq(subject: string, plural = false): FaqItem[] {
	const isAre = plural ? 'Are' : 'Is';
	const runs = plural ? 'run' : 'runs';
	const theyIt = plural ? 'them' : 'it';
	return [
		{
			q: `${isAre} the ${subject} free?`,
			a: `Yes, properly free. No paid tier, no trial, no watermark on the result and nothing to sign up for. Put as many files through ${theyIt} as you like, as often as you like.`
		},
		{
			q: 'Are my files uploaded to a server?',
			a: `No. The ${subject} ${runs} inside your browser, on your own machine, so your files never go anywhere. Big ones are fine too, up to whatever your browser can hold.`
		}
	];
}

/** The two trust questions, then whatever is true of this page alone. */
export function pageFaq(subject: string, specific: FaqItem[], plural = false): FaqItem[] {
	return [...trustFaq(subject, plural), ...specific];
}
