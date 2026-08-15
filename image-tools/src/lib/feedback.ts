/**
 * Composing a feature request into a message.
 *
 * Pure, and tested, because the whole point of this form is that the message
 * is assembled on the visitor's own device and handed straight to their mail
 * client. Nothing is posted anywhere, so there is no server to check the
 * output against and this is where correctness has to live.
 *
 * It also means the feedback form keeps the same promise as the rest of the
 * site: it does not send anything to us either. What arrives is an ordinary
 * email that the visitor chose to send.
 */

export type RequestKind = 'tool' | 'format' | 'bug' | 'other';

export const REQUEST_KINDS: { id: RequestKind; label: string; placeholder: string }[] = [
	{
		id: 'tool',
		label: 'A tool that is missing',
		placeholder: 'What would it do, and what are you trying to get done?'
	},
	{
		id: 'format',
		label: 'A format we do not handle',
		placeholder: 'Which format, and what are you converting it to or from?'
	},
	{
		id: 'bug',
		label: 'Something is broken',
		placeholder: 'What did you do, what happened, and what did you expect instead?'
	},
	{ id: 'other', label: 'Something else', placeholder: 'Go ahead.' }
];

export interface FeedbackDraft {
	kind: RequestKind;
	message: string;
	/** The page they came from, if they arrived from one. */
	fromPath?: string;
	/** Optional, and only used by their own mail client. */
	replyTo?: string;
}

const SUBJECTS: Record<RequestKind, string> = {
	tool: 'Tool request',
	format: 'Format request',
	bug: 'Bug report',
	other: 'imagetoolbox'
};

export function subjectFor(draft: FeedbackDraft): string {
	return SUBJECTS[draft.kind];
}

/**
 * The message body. The context lines go at the end rather than the top so
 * that the first thing read is what the person actually wanted to say.
 */
export function bodyFor(draft: FeedbackDraft, context: { browser?: string } = {}): string {
	const lines = [draft.message.trim()];

	const notes: string[] = [];
	if (draft.fromPath) notes.push(`Page: ${draft.fromPath}`);
	if (context.browser) notes.push(`Browser: ${context.browser}`);

	if (notes.length) lines.push('', '---', ...notes);
	return lines.join('\n');
}

/** The whole mailto URL, correctly escaped. */
export function mailtoFor(
	draft: FeedbackDraft,
	address: string,
	context: { browser?: string } = {}
): string {
	const params = new URLSearchParams({
		subject: subjectFor(draft),
		body: bodyFor(draft, context)
	});
	// URLSearchParams encodes a space as "+", which mail clients show literally
	// in the body rather than as a space.
	return `mailto:${address}?${params.toString().replace(/\+/g, '%20')}`;
}

/** Enough to be worth sending, without being fussy about it. */
export function isSendable(draft: FeedbackDraft): boolean {
	return draft.message.trim().length >= 10;
}
