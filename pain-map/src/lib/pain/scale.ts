/**
 * The 0 to 10 scale, with each step described.
 *
 * A bare slider produces meaningless numbers. Ask ten people to rate the same
 * ache and you get 3 through 8, because nobody agrees what 6 means. The
 * anchors are the whole value of the scale: they are what makes one person's 7
 * comparable to their own 4 last week, which is the comparison that matters
 * here.
 *
 * The wording is behavioural rather than emotional. "You notice it when you
 * move" can be checked against your own day. "Moderate" cannot.
 */

export interface PainStop {
	level: number;
	label: string;
	/** What this level means in terms of what you can still do. */
	meaning: string;
	/** The ramp colour. Never shown without the number. */
	colour: string;
}

const RAMP = [
	'var(--pain-1)',
	'var(--pain-1)',
	'var(--pain-3)',
	'var(--pain-3)',
	'var(--pain-5)',
	'var(--pain-5)',
	'var(--pain-7)',
	'var(--pain-7)',
	'var(--pain-9)',
	'var(--pain-9)'
];

export const PAIN_STOPS: PainStop[] = [
	{ level: 0, label: 'None', meaning: 'Nothing at all right now.', colour: 'var(--surface)' },
	{
		level: 1,
		label: 'Barely there',
		meaning: 'You have to go looking for it to notice it.',
		colour: RAMP[0]
	},
	{
		level: 2,
		label: 'Noticeable',
		meaning: 'You notice it now and then, and it does not stop you doing anything.',
		colour: RAMP[1]
	},
	{
		level: 3,
		label: 'Annoying',
		meaning: 'There in the background most of the time. You can still forget about it when busy.',
		colour: RAMP[2]
	},
	{
		level: 4,
		label: 'Distracting',
		meaning: 'It interrupts you. You catch yourself shifting position to get away from it.',
		colour: RAMP[3]
	},
	{
		level: 5,
		label: 'Hard to ignore',
		meaning: 'You think about it often and you have started avoiding certain movements.',
		colour: RAMP[4]
	},
	{
		level: 6,
		label: 'Intruding',
		meaning: 'It gets in the way of concentrating, and you would take something for it.',
		colour: RAMP[5]
	},
	{
		level: 7,
		label: 'Limiting',
		meaning: 'It stops you doing things you would otherwise do. Sleep is affected.',
		colour: RAMP[6]
	},
	{
		level: 8,
		label: 'Dominating',
		meaning: 'Most of your attention is on it. You are planning your day around it.',
		colour: RAMP[7]
	},
	{
		level: 9,
		label: 'Overwhelming',
		meaning: 'You can barely think about anything else and you cannot get comfortable.',
		colour: RAMP[8]
	},
	{
		level: 10,
		label: 'The worst you can imagine',
		meaning: 'Nothing helps and you would go to hospital for it.',
		colour: RAMP[9]
	}
];

export function stopFor(level: number): PainStop {
	const clamped = Math.max(0, Math.min(10, Math.round(level)));
	return PAIN_STOPS[clamped];
}

/**
 * How the pain behaves. These are the features the matcher actually reasons
 * over, so they are phrased as things a person can answer about themselves
 * rather than as clinical categories.
 */
export const QUALITIES = [
	{ id: 'sharp', label: 'Sharp or stabbing' },
	{ id: 'ache', label: 'A dull ache' },
	{ id: 'burning', label: 'Burning' },
	{ id: 'pins', label: 'Pins and needles, or numb' },
	{ id: 'stiff', label: 'Stiff, especially at first' },
	{ id: 'throb', label: 'Throbbing' },
	{ id: 'catching', label: 'Catches or gives way' },
	{ id: 'radiating', label: 'Travels somewhere else' }
] as const;

export const TIMINGS = [
	{ id: 'worse-morning', label: 'Worst in the morning, eases as you move' },
	{ id: 'worse-evening', label: 'Builds through the day' },
	{ id: 'worse-night', label: 'Worst at night or wakes you' },
	{ id: 'worse-activity', label: 'Worse during or straight after activity' },
	{ id: 'worse-rest', label: 'Worse after sitting or lying still' },
	{ id: 'constant', label: 'Much the same all the time' }
] as const;

export const ONSETS = [
	{ id: 'sudden-injury', label: 'Suddenly, and I know what did it' },
	{ id: 'sudden-no-cause', label: 'Suddenly, with no obvious cause' },
	{ id: 'gradual-weeks', label: 'Gradually, over weeks' },
	{ id: 'gradual-months', label: 'Gradually, over months or longer' }
] as const;

export type QualityId = (typeof QUALITIES)[number]['id'];
export type TimingId = (typeof TIMINGS)[number]['id'];
export type OnsetId = (typeof ONSETS)[number]['id'];

/** One region's worth of answers. */
export interface PainEntry {
	/** The general region chosen on the body map. */
	regionId: string;
	/** The precise structures chosen in the detail view. */
	structureIds: string[];
	level: number;
	qualities: QualityId[];
	timings: TimingId[];
	onset: OnsetId | null;
}

export function emptyEntry(regionId: string): PainEntry {
	return { regionId, structureIds: [], level: 5, qualities: [], timings: [], onset: null };
}

/** Enough answered to be worth interpreting. */
export function isComplete(entry: PainEntry): boolean {
	return entry.structureIds.length > 0 && entry.onset !== null && entry.level > 0;
}
