import type { OnsetId, PainEntry, QualityId, TimingId } from './scale';

/**
 * The conditions, each defined by the features that characterise it.
 *
 * The score is deliberately not a probability. There is no honest way to get
 * one from a pain map: that needs validated likelihood ratios and population
 * priors this product does not have, and a percentage invented to look
 * confident is a fabricated number however good it looks on screen.
 *
 * So a condition is a list of features, and the score is how many of them the
 * answers matched, out of how many there are. Both the matched and the
 * unmatched features are shown, which makes the number checkable: anyone can
 * see what it was counting and disagree with it.
 *
 * Every entry here is a common musculoskeletal pattern, phrased the way a
 * physiotherapist would describe it on a first visit. None of it is a
 * diagnosis and the product says so where it matters.
 */

export type FeatureKind = 'structure' | 'quality' | 'timing' | 'onset' | 'level';

export interface Feature {
	kind: FeatureKind;
	/** A structure id, quality id, timing id, onset id, or a level threshold. */
	value: string;
	/** How this reads in the matched and unmatched lists. */
	text: string;
	/** Features that carry more weight than the rest of the list. */
	key?: boolean;
}

export interface Condition {
	id: string;
	name: string;
	/** The same thing in plain words. */
	plain: string;
	/** What it actually is, two sentences at most. */
	what: string;
	/** What people usually do about it. Not a treatment plan. */
	next: string;
	features: Feature[];
}

const f = (kind: FeatureKind, value: string, text: string, key = false): Feature => ({
	kind,
	value,
	text,
	key
});

export const CONDITIONS: Condition[] = [
	{
		id: 'glute-tendinopathy',
		name: 'Gluteal tendinopathy',
		plain: 'an irritated tendon on the outside of the hip',
		what: 'The tendons of the muscles on the outer hip get irritated where they pass over the bony point. It is the most common cause of pain on the outside of the hip in adults, and it used to be called trochanteric bursitis.',
		next: 'It responds to loading the tendon gradually rather than resting it, which is the opposite of what most people try first. A physiotherapist is the usual first stop.',
		features: [
			f('structure', 'glute-med', 'pain on the outer side of the hip', true),
			f('structure', 'trochanter-bursa', 'tender over the bony point of the hip', true),
			f('quality', 'ache', 'a dull ache rather than a sharp pain'),
			f('timing', 'worse-rest', 'worse after sitting still, and when lying on that side'),
			f('timing', 'worse-activity', 'worse after walking or climbing stairs'),
			f('onset', 'gradual-weeks', 'came on gradually')
		]
	},
	{
		id: 'hip-oa',
		name: 'Hip osteoarthritis',
		plain: 'wear in the hip joint itself',
		what: 'The cartilage in the ball and socket thins with time. It is felt in the groin rather than on the outside of the hip, and often referred down to the knee, which is why knee pain sometimes turns out to be a hip.',
		next: 'Strength and movement help more than rest. Worth seeing a doctor, since an X-ray settles it and there are real options if it is advanced.',
		features: [
			f('structure', 'hip-joint', 'pain deep in the groin', true),
			f('quality', 'stiff', 'stiff, especially first thing'),
			f('timing', 'worse-morning', 'stiffest in the morning and eases with movement'),
			f('timing', 'worse-activity', 'worse the more you walk'),
			f('onset', 'gradual-months', 'came on over months or longer', true),
			f('level', '3', 'a persistent ache rather than an acute pain')
		]
	},
	{
		id: 'hip-flexor-strain',
		name: 'Hip flexor strain',
		plain: 'a pulled muscle at the front of the hip',
		what: 'The muscle at the front of the hip is overstretched or torn, usually during something explosive: a sprint, a kick, or standing up fast from a deep position.',
		next: 'Settles in weeks with relative rest and then a gradual return. If it happened suddenly and you heard or felt a pop, get it looked at.',
		features: [
			f('structure', 'hip-flexor', 'pain at the front of the hip or groin', true),
			f('onset', 'sudden-injury', 'started suddenly during something specific', true),
			f('quality', 'sharp', 'sharp when you use it'),
			f('timing', 'worse-activity', 'worse when you lift the knee or sprint'),
			f('quality', 'catching', 'catches when you move it a certain way')
		]
	},
	{
		id: 'adductor-strain',
		name: 'Adductor strain',
		plain: 'a groin strain',
		what: 'The inner thigh muscles are strained where they attach near the pubic bone. Common in anything with sudden changes of direction.',
		next: 'Graded strengthening rather than rest. Groin pain that does not settle in a few weeks is worth a proper look, since several things there feel the same.',
		features: [
			f('structure', 'adductors', 'pain along the inner thigh', true),
			f('onset', 'sudden-injury', 'started during a specific movement', true),
			f('quality', 'sharp', 'sharp when you bring the leg inward'),
			f('timing', 'worse-activity', 'worse with activity, quiet at rest')
		]
	},
	{
		id: 'lumbar-radiculopathy',
		name: 'Lumbar radiculopathy',
		plain: 'a pinched nerve in the lower back, often called sciatica',
		what: 'A nerve root leaving the lower spine is compressed or irritated, usually by a disc. The pain travels down the leg, and the leg symptoms are often worse than the back itself.',
		next: 'Most cases settle over weeks to a few months without anything invasive. See a doctor if the leg is weak, and immediately for any of the red flags above.',
		features: [
			f('structure', 'lumbar-disc', 'pain in the lower back'),
			f('structure', 'sciatic', 'pain travelling down the leg', true),
			f('quality', 'radiating', 'it travels rather than staying put', true),
			f('quality', 'pins', 'pins and needles or numbness'),
			f('quality', 'burning', 'a burning quality'),
			f('timing', 'worse-rest', 'worse sitting, better standing or walking')
		]
	},
	{
		id: 'facet-pain',
		name: 'Facet joint pain',
		plain: 'irritation of the small joints at the back of the spine',
		what: 'The small paired joints at the back of each vertebra become painful. It stays local to the back or spreads only into the buttock, and it does not travel past the knee.',
		next: 'Movement and strengthening. It tends to come and go in episodes rather than resolving once.',
		features: [
			f('structure', 'facet-joint', 'pain to one side of the spine', true),
			f('structure', 'erector-spinae', 'the muscles either side feel tight'),
			f('quality', 'stiff', 'stiff, especially bending backward'),
			f('timing', 'worse-morning', 'stiff in the morning, better once moving'),
			f('timing', 'worse-rest', 'worse after standing still for a while')
		]
	},
	{
		id: 'si-joint',
		name: 'Sacroiliac joint pain',
		plain: 'pain from the joint between spine and pelvis',
		what: 'The joint where the base of the spine meets the pelvis, felt in the dimple just above the buttock, usually on one side only.',
		next: 'Often settles with targeted exercise. Very common in and after pregnancy.',
		features: [
			f('structure', 'si-joint', 'pain in the dimple above the buttock', true),
			f('quality', 'ache', 'a deep ache'),
			f('timing', 'worse-rest', 'worse standing on one leg or rolling over in bed'),
			f('onset', 'gradual-weeks', 'came on gradually')
		]
	},
	{
		id: 'rotator-cuff',
		name: 'Rotator cuff tendinopathy',
		plain: 'an irritated tendon in the shoulder',
		what: 'One of the four small tendons that hold the shoulder together is irritated, most often the one over the top. Reaching overhead and lying on that side are the two things people notice first.',
		next: 'Loading the tendon under guidance works better than rest. Weeks to months rather than days.',
		features: [
			f('structure', 'supraspinatus', 'pain over the top of the shoulder', true),
			f('structure', 'subacromial-bursa', 'pain in the space under the bony roof'),
			f('quality', 'ache', 'an ache, worse on reaching up'),
			f('timing', 'worse-night', 'worse at night, particularly lying on it'),
			f('timing', 'worse-activity', 'worse reaching overhead or behind you'),
			f('onset', 'gradual-weeks', 'came on gradually')
		]
	},
	{
		id: 'frozen-shoulder',
		name: 'Adhesive capsulitis',
		plain: 'a frozen shoulder',
		what: 'The capsule around the shoulder joint thickens and tightens. The defining feature is losing range of movement in every direction, not just the painful one, and it is much more common between 40 and 60 and in people with diabetes.',
		next: 'It runs a long course, often a year or more, and usually recovers. Worth seeing someone, because it is treated differently from a cuff problem.',
		features: [
			f('structure', 'glenohumeral', 'pain felt deep and all around the joint', true),
			f('quality', 'stiff', 'stiff in every direction, not just one', true),
			f('timing', 'worse-night', 'wakes you at night'),
			f('onset', 'gradual-weeks', 'came on gradually with no injury'),
			f('level', '5', 'painful enough to limit what you do')
		]
	},
	{
		id: 'ac-joint',
		name: 'Acromioclavicular joint pain',
		plain: 'pain at the bump on top of the shoulder',
		what: 'The small joint where the collarbone meets the shoulder blade. Very localised: people can usually put one fingertip on it.',
		next: 'Settles with load management. Worth a look if it followed a fall onto the shoulder.',
		features: [
			f('structure', 'ac-joint', 'pain right on the bump on top', true),
			f('quality', 'sharp', 'sharp rather than diffuse'),
			f('timing', 'worse-activity', 'worse reaching across your body or lying on it'),
			f('onset', 'sudden-injury', 'followed a fall or a knock')
		]
	},
	{
		id: 'cervical-referred',
		name: 'Neck-referred shoulder pain',
		plain: 'shoulder pain coming from the neck',
		what: 'The lower neck refers pain into the shoulder and upper arm convincingly enough that it is regularly mistaken for a shoulder problem. The giveaway is that neck movement changes it and shoulder movement may not.',
		next: 'Treating the neck is what helps. Worth mentioning both areas to whoever you see.',
		features: [
			f('structure', 'neck-c5', 'pain at the base of the neck', true),
			f('structure', 'levator', 'pain between neck and shoulder blade'),
			f('quality', 'radiating', 'it spreads rather than staying in one spot', true),
			f('quality', 'pins', 'pins and needles into the arm'),
			f('structure', 'brachial-plexus', 'symptoms running down the arm')
		]
	},
	{
		id: 'patellofemoral',
		name: 'Patellofemoral pain',
		plain: 'pain behind or around the kneecap',
		what: 'Pain from the surface where the kneecap runs on the thigh bone. Stairs, hills and sitting for a long time are the classic aggravators, and there is often nothing to see on a scan.',
		next: 'Strengthening the hip and thigh over a couple of months is what works. Rest alone tends not to.',
		features: [
			f('structure', 'patella', 'pain behind or around the kneecap', true),
			f('quality', 'ache', 'an ache rather than a sharp pain'),
			f('timing', 'worse-activity', 'worse on stairs, especially going down'),
			f('timing', 'worse-rest', 'stiff and sore after sitting a long while'),
			f('onset', 'gradual-weeks', 'came on gradually')
		]
	},
	{
		id: 'meniscus',
		name: 'Meniscal tear',
		plain: 'a tear in the cartilage cushion in the knee',
		what: 'One of the two cushions inside the knee is torn, either through a twist or, in people over about 40, through gradual wear. Catching, locking or a feeling of the knee giving way are the features that point here.',
		next: 'Many tears settle with rehabilitation and do not need surgery, degenerative ones especially. Worth seeing someone if the knee locks or gives way.',
		features: [
			f('structure', 'medial-meniscus', 'pain on the inner side of the joint line', true),
			f('quality', 'catching', 'it catches, locks or gives way', true),
			f('quality', 'sharp', 'sharp with twisting'),
			f('onset', 'sudden-injury', 'started with a twist'),
			f('timing', 'worse-activity', 'worse with twisting and squatting')
		]
	},
	{
		id: 'it-band',
		name: 'Iliotibial band syndrome',
		plain: 'pain on the outside of the knee, common in runners',
		what: 'The thick band down the outside of the thigh becomes painful where it passes the outer knee. Almost always a training-load problem rather than an injury.',
		next: 'Reduce the load, then build back gradually, and look at running volume. Usually settles in weeks.',
		features: [
			f('structure', 'it-band', 'pain along the outside of the thigh or knee', true),
			f('structure', 'lcl', 'pain on the outer side of the knee'),
			f('quality', 'burning', 'a burning or rubbing feeling'),
			f('timing', 'worse-activity', 'comes on a predictable way into a run'),
			f('onset', 'gradual-weeks', 'came on over weeks of training')
		]
	},
	{
		id: 'patellar-tendinopathy',
		name: 'Patellar tendinopathy',
		plain: 'jumper’s knee',
		what: 'The tendon just below the kneecap is irritated. Very localised, and it hurts on jumping and landing more than on walking.',
		next: 'Graded loading of the tendon. It takes months rather than weeks, and it does not respond to rest.',
		features: [
			f('structure', 'patellar-tendon', 'pain just below the kneecap', true),
			f('quality', 'sharp', 'sharp when you load it'),
			f('timing', 'worse-activity', 'worse jumping, landing or on stairs'),
			f('onset', 'gradual-weeks', 'came on gradually with training')
		]
	},
	{
		id: 'plantar-fasciitis',
		name: 'Plantar fasciopathy',
		plain: 'plantar fasciitis',
		what: 'The band along the sole is irritated where it attaches to the heel. The first steps out of bed being the worst part of the day is close to diagnostic.',
		next: 'Calf and foot strengthening, and something supportive underfoot. Slow, but it does resolve.',
		features: [
			f('structure', 'heel-insertion', 'pain at the inside front of the heel', true),
			f('structure', 'plantar-fascia', 'pain along the sole'),
			f('timing', 'worse-morning', 'worst on the first steps of the day', true),
			f('quality', 'sharp', 'sharp on standing, easing as you walk'),
			f('onset', 'gradual-weeks', 'came on gradually')
		]
	},
	{
		id: 'metatarsalgia',
		name: 'Metatarsalgia',
		plain: 'pain in the ball of the foot',
		what: 'Pain under the joints at the ball of the foot, from load rather than from any one injury. Often described as walking on a pebble.',
		next: 'Footwear and load are the two things that change it. Worth a look if one spot is sharply tender or numb between the toes.',
		features: [
			f('structure', 'metatarsal-heads', 'pain in the ball of the foot', true),
			f('quality', 'burning', 'burning underfoot'),
			f('quality', 'pins', 'numbness or tingling into the toes'),
			f('timing', 'worse-activity', 'worse the longer you are on your feet'),
			f('structure', 'interdigital-nerve', 'feels like a pebble under the foot')
		]
	},
	{
		id: 'achilles-tendinopathy',
		name: 'Achilles tendinopathy',
		plain: 'an irritated Achilles tendon',
		what: 'The cord above the heel is irritated, usually in the middle of it or where it meets the bone. Stiff on waking and warms up as you move.',
		next: 'Graded calf loading, over months. Sudden severe pain with a snap during activity is different and needs urgent assessment.',
		features: [
			f('structure', 'achilles', 'pain in the cord above the heel', true),
			f('quality', 'stiff', 'stiff first thing, warms up with movement', true),
			f('timing', 'worse-morning', 'worst in the morning'),
			f('timing', 'worse-activity', 'worse with running or hills'),
			f('onset', 'gradual-weeks', 'came on gradually')
		]
	}
];

export interface Match {
	condition: Condition;
	matched: Feature[];
	missed: Feature[];
	/** Matched key features, which is what breaks ties sensibly. */
	keysMatched: number;
	score: number;
}

/** Does one feature hold, given the answers for one region? */
function holds(feature: Feature, entry: PainEntry): boolean {
	switch (feature.kind) {
		case 'structure':
			return entry.structureIds.includes(feature.value);
		case 'quality':
			return entry.qualities.includes(feature.value as QualityId);
		case 'timing':
			return entry.timings.includes(feature.value as TimingId);
		case 'onset':
			return entry.onset === (feature.value as OnsetId);
		case 'level':
			return entry.level >= Number(feature.value);
	}
}

/**
 * Score every condition against one region's answers.
 *
 * A condition only appears at all if at least one of its key features holds.
 * Without that rule every condition scores something on every input, because
 * "worse with activity" is true of nearly all musculoskeletal pain, and a list
 * of eighteen weak matches is worse than no list.
 */
export function matchEntry(entry: PainEntry): Match[] {
	const results: Match[] = [];
	for (const condition of CONDITIONS) {
		const matched = condition.features.filter((feat) => holds(feat, entry));
		const missed = condition.features.filter((feat) => !holds(feat, entry));
		const keys = condition.features.filter((feat) => feat.key);
		const keysMatched = matched.filter((feat) => feat.key).length;
		if (keys.length > 0 && keysMatched === 0) continue;
		// A condition is about a place in the body, so nothing qualifies on
		// symptoms alone. Without this, "worse with activity" surfaced three
		// conditions from an answer that named no location at all.
		const defines = condition.features.some((feat) => feat.kind === 'structure');
		const located = matched.some((feat) => feat.kind === 'structure');
		if (defines && !located) continue;
		results.push({
			condition,
			matched,
			missed,
			keysMatched,
			score: matched.length / condition.features.length
		});
	}
	// Key features first, then the fraction, then the longer definition, so a
	// condition defined by eight features beats one defined by three at equal
	// proportions.
	return results.sort(
		(a, b) =>
			b.keysMatched - a.keysMatched ||
			b.score - a.score ||
			b.matched.length - a.matched.length ||
			a.condition.name.localeCompare(b.condition.name)
	);
}

/** How the fraction is written. Never a percentage. */
export function scoreText(match: Match): string {
	return `${match.matched.length} of ${match.condition.features.length}`;
}

/**
 * How much weight to put on the top result. This is about the quality of the
 * answers, not about the condition, so it is honest to state.
 */
export function confidence(matches: Match[], entry: PainEntry): 'narrow' | 'broad' | 'thin' {
	if (entry.structureIds.length === 0 || entry.onset === null) return 'thin';
	const top = matches[0];
	if (!top) return 'thin';
	const second = matches[1];
	if (top.score >= 0.6 && (!second || top.score - second.score >= 0.15)) return 'narrow';
	return 'broad';
}
