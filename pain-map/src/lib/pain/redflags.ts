import type { PainEntry } from './scale';

/**
 * The things that must not wait.
 *
 * Kept entirely apart from the matcher. A red flag is not a better-scoring
 * result, it is a different kind of statement, and letting the two compete for
 * position on a page is how someone with cauda equina symptoms ends up reading
 * about tendinopathy because it matched more features.
 *
 * This matters more here than it would in a tool people bring to a clinician.
 * The audience for this product is specifically people who are not going to see
 * anyone, so the one job that cannot be got wrong is noticing when they should.
 *
 * These are the standard musculoskeletal red flags. They are deliberately
 * phrased as questions someone can answer about themselves, and the urgency
 * wording is specific about where to go, because "seek medical attention" is
 * advice nobody can act on.
 */

export type Urgency = 'emergency' | 'same-day' | 'soon';

export interface RedFlag {
	id: string;
	/** Asked directly, as a yes or no. */
	question: string;
	/** Why it is being asked, in one sentence, without frightening anyone. */
	why: string;
	urgency: Urgency;
	/** What to actually do. */
	action: string;
	/** Only asked when the pain is in one of these areas. Empty means always. */
	regions: string[];
}

export const RED_FLAGS: RedFlag[] = [
	{
		id: 'cauda-equina',
		question:
			'Any numbness around your groin, buttocks or inner thighs, or trouble controlling your bladder or bowels?',
		why: 'Together with back pain, this small group of symptoms points at pressure on the nerves at the base of the spine.',
		urgency: 'emergency',
		action:
			'Go to an emergency department now, today, not tomorrow. This is the one thing in this whole tool that is genuinely time critical, because the nerves recover much better the sooner pressure comes off them.',
		regions: ['lower-back', 'buttock', 'hip', 'hamstring']
	},
	{
		id: 'chest',
		question: 'Any pressure, tightness or heaviness in your chest, jaw, or down your left arm?',
		why: 'Pain in the chest, shoulder or jaw can come from the heart rather than from muscle.',
		urgency: 'emergency',
		action:
			'Call emergency services. Do not drive yourself and do not wait to see whether it passes.',
		regions: ['chest', 'shoulder', 'neck', 'upper-back']
	},
	{
		id: 'trauma',
		question:
			'Did this start with a significant fall, a car accident, or a direct blow, and can you not put weight on it?',
		why: 'A fracture can feel like a strain, and the difference matters in the first days.',
		urgency: 'same-day',
		action: 'Get an X-ray today, at an urgent care centre or an emergency department.',
		regions: []
	},
	{
		id: 'night-pain',
		question: 'Does the pain wake you from sleep, rather than just making it hard to settle?',
		why: 'Pain that reliably wakes you behaves differently from mechanical pain, which usually eases when you stop loading it.',
		urgency: 'soon',
		action:
			'Book with a doctor rather than a physiotherapist first, and say specifically that it wakes you.',
		regions: []
	},
	{
		id: 'weight-loss',
		question: 'Have you lost weight without trying, or had fevers, night sweats or feeling unwell?',
		why: 'Musculoskeletal pain does not come with these, so they suggest something else is going on.',
		urgency: 'soon',
		action: 'Book with a doctor and mention these alongside the pain, not separately.',
		regions: []
	},
	{
		id: 'cancer-history',
		question: 'Have you been treated for cancer in the past?',
		why: 'It changes what new, unexplained bone pain should be checked for, and it is easy not to mention.',
		urgency: 'soon',
		action: 'Tell a doctor about the pain and the history together.',
		regions: []
	},
	{
		id: 'progressive-weakness',
		question:
			'Is a limb getting weaker, dropping things, catching a foot when you walk, or giving way?',
		why: 'Weakness that is getting worse is a different problem from pain, and it is followed up differently.',
		urgency: 'same-day',
		action:
			'See a doctor today. Describe the weakness first and the pain second, because the weakness is the part that changes what happens next.',
		regions: []
	},
	{
		id: 'hot-swollen-joint',
		question: 'Is a joint hot, badly swollen and painful to move even slightly, with a fever?',
		why: 'An infected joint is uncommon and needs treating within hours rather than days.',
		urgency: 'emergency',
		action: 'Go to an emergency department today.',
		regions: ['knee', 'shoulder', 'hip', 'elbow', 'ankle']
	},
	{
		id: 'calf-swelling',
		question: 'Is one calf swollen, warm and tender, particularly after a flight, illness or surgery?',
		why: 'A clot in a leg vein can look like a calf strain, and it can travel.',
		urgency: 'emergency',
		action: 'Get seen today, at an emergency department or urgent care.',
		regions: ['calf', 'lower-leg', 'knee']
	}
];

/** Which flags are worth asking about, given the regions someone marked. */
export function flagsFor(detailIds: string[]): RedFlag[] {
	return RED_FLAGS.filter(
		(flag) => flag.regions.length === 0 || flag.regions.some((r) => detailIds.includes(r))
	);
}

export const URGENCY_ORDER: Record<Urgency, number> = {
	emergency: 0,
	'same-day': 1,
	soon: 2
};

export function sortByUrgency(flags: RedFlag[]): RedFlag[] {
	return [...flags].sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]);
}

export const URGENCY_LABEL: Record<Urgency, string> = {
	emergency: 'Today, urgently',
	'same-day': 'Today',
	soon: 'Within a week or so'
};

/**
 * A very high pain score on its own is not a red flag, but it is worth saying
 * something about rather than filing it away in a profile.
 */
export function severeEntries(entries: PainEntry[]): PainEntry[] {
	return entries.filter((e) => e.level >= 9);
}
