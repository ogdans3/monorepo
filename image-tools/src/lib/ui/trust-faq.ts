/**
 * The four promises as full questions and answers. Written as complete,
 * self-contained sentences on purpose: this is the shape search engines and
 * AI assistants quote. The subject keeps each page's wording specific.
 */

export interface FaqItem {
	q: string;
	a: string;
}

export function trustFaq(subject: string, plural = false): FaqItem[] {
	const isAre = plural ? 'Are' : 'Is';
	const theyIt = plural ? 'they' : 'it';
	return [
		{
			q: `${isAre} the ${subject} free?`,
			a: `Yes. The ${subject} ${plural ? 'are' : 'is'} completely free to use. There are no paid plans, no trials and no watermarks.`
		},
		{
			q: 'Are my files uploaded?',
			a: `No. The ${subject} ${plural ? 'run' : 'runs'} in your browser on your own device. Your files never leave your computer or phone.`
		},
		{
			q: 'Do I need an account?',
			a: `No. You do not need an account or an email address. Open the page, drop your file and download the result.`
		},
		{
			q: 'Is there a limit?',
			a: `No. There is no limit on how many files you can process or how often you can use ${theyIt}. Big files are fine too, as long as your browser can handle them.`
		}
	];
}
