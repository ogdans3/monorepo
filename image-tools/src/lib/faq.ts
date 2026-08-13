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
 */

export interface FaqItem {
	q: string;
	a: string;
}

export function trustFaq(subject: string, plural = false): FaqItem[] {
	const isAre = plural ? 'Are' : 'Is';
	const runs = plural ? 'run' : 'runs';
	const theyIt = plural ? 'they' : 'it';
	return [
		{
			q: `${isAre} the ${subject} free?`,
			a: `Yes. The ${subject} ${plural ? 'are' : 'is'} completely free, with no paid plans, no trials and no watermarks. You do not need an account or an email address, and there is no limit on how many files you can put through ${theyIt}.`
		},
		{
			q: 'Are my files uploaded to a server?',
			a: `No. The ${subject} ${runs} in your browser on your own device, so your files never leave your computer or phone. That also means big files are fine, as long as your browser can handle them.`
		}
	];
}

/** The two trust questions, then whatever is true of this page alone. */
export function pageFaq(subject: string, specific: FaqItem[], plural = false): FaqItem[] {
	return [...trustFaq(subject, plural), ...specific];
}
