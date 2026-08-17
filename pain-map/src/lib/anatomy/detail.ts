/**
 * The zoomed diagrams: the muscles and structures of one region, plus what
 * sits above and below it.
 *
 * Each structure is a shape with a name in two registers, the anatomical one
 * and the plain one, because "gluteus medius" and "the muscle on the side of
 * your hip" are both needed and neither is enough alone.
 *
 * Above and below are included on purpose. Pain refers: a disc in the lower
 * back is felt in the buttock, a hip joint is felt in the groin and the knee.
 * A diagram cropped tightly to the sore spot cannot catch that, so every
 * region shows its neighbours and says so.
 *
 * Shapes are hand-authored on a 240 by 300 grid. Muscles are drawn as tapered
 * bands because that is what a muscle belly with its tendons looks like from
 * the outside, and a band reads as a muscle at this scale where an accurate
 * outline reads as a blob.
 */

export interface Structure {
	id: string;
	/** The anatomical name. */
	name: string;
	/** The same thing in words someone would use about their own body. */
	plain: string;
	/** What kind of thing it is, which drives how it is drawn. */
	kind: 'muscle' | 'tendon' | 'joint' | 'bone' | 'nerve' | 'bursa' | 'ligament';
	/** Where in this region it sits, for the copy and for the matcher. */
	zone: 'above' | 'here' | 'below';
	d: string;
	/** Where the label attaches. */
	label: { x: number; y: number };
}

export interface DetailView {
	id: string;
	title: string;
	/** One line orienting the visitor before they look. */
	intro: string;
	/** The outline of the body part, for context behind the structures. */
	outline: string;
	/** Bone drawn under the muscles, so the diagram has a skeleton to hang on. */
	skeleton: string[];
	structures: Structure[];
}

export const DETAIL_W = 240;
export const DETAIL_H = 300;

/**
 * A muscle band: rounded at both ends, fullest in the middle.
 *
 * The first version used two quadratic curves between the endpoints, which
 * produces a lens with two sharp points. On screen that read as scattered
 * leaves rather than as anatomy. A muscle has thickness all the way to its
 * attachment, so this walks out from the start, along one side, round the far
 * end and back, which gives the blunt ends a real muscle has.
 */
function belly(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	width: number,
	bulge = 1.35
): string {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy) || 1;
	// unit vectors along the muscle and across it
	const ux = dx / len;
	const uy = dy / len;
	const nx = -uy;
	const ny = uy === 0 && ux === 0 ? 1 : ux;
	const half = width / 2;
	// the ends keep some width, so they read as attachments rather than points
	const endW = half * 0.42;
	const midW = half * bulge;
	const r = (n: number) => Math.round(n * 10) / 10;

	const a = { x: x1 + nx * endW, y: y1 + ny * endW };
	const b = { x: x2 + nx * endW, y: y2 + ny * endW };
	const cpt = { x: x2 - nx * endW, y: y2 - ny * endW };
	const d0 = { x: x1 - nx * endW, y: y1 - ny * endW };
	const mid1 = { x: (x1 + x2) / 2 + nx * midW, y: (y1 + y2) / 2 + ny * midW };
	const mid2 = { x: (x1 + x2) / 2 - nx * midW, y: (y1 + y2) / 2 - ny * midW };
	// a small overshoot past each end, to round it off
	const capA = { x: x2 + ux * endW * 0.9, y: y2 + uy * endW * 0.9 };
	const capB = { x: x1 - ux * endW * 0.9, y: y1 - uy * endW * 0.9 };

	return [
		`M${r(a.x)},${r(a.y)}`,
		`Q${r(mid1.x)},${r(mid1.y)} ${r(b.x)},${r(b.y)}`,
		`Q${r(capA.x)},${r(capA.y)} ${r(cpt.x)},${r(cpt.y)}`,
		`Q${r(mid2.x)},${r(mid2.y)} ${r(d0.x)},${r(d0.y)}`,
		`Q${r(capB.x)},${r(capB.y)} ${r(a.x)},${r(a.y)}`,
		'Z'
	].join(' ');
}

/** A rounded blob, for joints, bursae and other things that are not bands. */
function blob(cx: number, cy: number, rx: number, ry: number): string {
	const r = (n: number) => Math.round(n * 10) / 10;
	return [
		`M${r(cx)},${r(cy - ry)}`,
		`C${r(cx + rx)},${r(cy - ry)} ${r(cx + rx)},${r(cy + ry)} ${r(cx)},${r(cy + ry)}`,
		`C${r(cx - rx)},${r(cy + ry)} ${r(cx - rx)},${r(cy - ry)} ${r(cx)},${r(cy - ry)}`,
		'Z'
	].join(' ');
}

/** A line, for nerves and long tendons. */
function strand(pts: [number, number][]): string {
	const r = (n: number) => Math.round(n * 10) / 10;
	const [first, ...rest] = pts;
	let d = `M${r(first[0])},${r(first[1])}`;
	for (let i = 0; i < rest.length; i++) {
		const prev = i === 0 ? first : rest[i - 1];
		const cur = rest[i];
		const cx = (prev[0] + cur[0]) / 2 + 6;
		d += ` Q${r(cx)},${r((prev[1] + cur[1]) / 2)} ${r(cur[0])},${r(cur[1])}`;
	}
	return d;
}

/** The torso and thigh silhouette used as context behind hip and back views. */
const PELVIS_OUTLINE =
	'M60,4 C48,40 44,80 46,110 C48,150 52,190 56,240 C58,270 60,290 62,298 ' +
	'L178,298 C180,290 182,270 184,240 C188,190 192,150 194,110 ' +
	'C196,80 192,40 180,4 Z';

const HIP: DetailView = {
	id: 'hip',
	title: 'Hip and groin',
	intro:
		'Hip pain is usually one of three things, and where exactly it sits tells them apart. Point at the spot you would press if someone asked you to show them.',
	outline: PELVIS_OUTLINE,
	skeleton: [
		// pelvis, as two curved wings and a socket
		'M62,60 C70,44 100,38 116,46 C124,50 124,66 118,78 C108,96 78,98 66,86 C60,78 58,68 62,60 Z',
		'M178,60 C170,44 140,38 124,46 C116,50 116,66 122,78 C132,96 162,98 174,86 C180,78 182,68 178,60 Z',
		// femur head and shaft on the near side
		'M96,116 C104,110 116,114 118,124 C120,136 112,146 104,148 L100,240 L86,240 L92,146 C84,142 88,122 96,116 Z'
	],
	structures: [
		{
			id: 'ql',
			name: 'Quadratus lumborum',
			plain: 'the deep muscle either side of your lower spine',
			kind: 'muscle',
			zone: 'above',
			d: belly(104, 12, 96, 52, 22),
			label: { x: 86, y: 26 }
		},
		{
			id: 'iliac-crest',
			name: 'Iliac crest',
			plain: 'the top rim of your hip bone, where a belt sits',
			kind: 'bone',
			zone: 'above',
			d: belly(66, 52, 118, 44, 9),
			label: { x: 70, y: 44 }
		},
		{
			id: 'glute-med',
			name: 'Gluteus medius',
			plain: 'the muscle on the outer side of your hip',
			kind: 'muscle',
			zone: 'here',
			d: belly(78, 62, 96, 116, 34),
			label: { x: 58, y: 90 }
		},
		{
			id: 'trochanter-bursa',
			name: 'Trochanteric bursa',
			plain: 'the cushion over the bony point of your hip',
			kind: 'bursa',
			zone: 'here',
			d: blob(94, 124, 15, 12),
			label: { x: 62, y: 128 }
		},
		{
			id: 'hip-joint',
			name: 'Hip joint',
			plain: 'the ball and socket deep inside, felt in the groin',
			kind: 'joint',
			zone: 'here',
			d: blob(112, 118, 17, 15),
			label: { x: 132, y: 112 }
		},
		{
			id: 'hip-flexor',
			name: 'Iliopsoas',
			plain: 'the hip flexor at the front of your groin',
			kind: 'muscle',
			zone: 'here',
			d: belly(140, 44, 122, 128, 24),
			label: { x: 160, y: 80 }
		},
		{
			id: 'adductors',
			name: 'Adductors',
			plain: 'the inner thigh muscles, the groin strain muscles',
			kind: 'muscle',
			zone: 'below',
			d: belly(126, 140, 138, 232, 30),
			label: { x: 158, y: 190 }
		},
		{
			id: 'it-band',
			name: 'Iliotibial band',
			plain: 'the thick cord down the outside of your thigh',
			kind: 'tendon',
			zone: 'below',
			d: belly(84, 130, 78, 250, 11),
			label: { x: 52, y: 200 }
		},
		{
			id: 'hamstring-origin',
			name: 'Hamstring origin',
			plain: 'where the hamstrings attach to your sitting bone',
			kind: 'tendon',
			zone: 'below',
			d: blob(108, 152, 13, 10),
			label: { x: 118, y: 160 }
		}
	]
};

const LOWER_BACK: DetailView = {
	id: 'lower-back',
	title: 'Lower back',
	intro:
		'The lower back refers pain downward more than almost anywhere else, so where it spreads to matters as much as where it starts.',
	outline: PELVIS_OUTLINE,
	skeleton: [
		// lumbar spine, five vertebrae and the sacrum
		'M112,10 h16 v18 h-16 Z',
		'M112,32 h16 v18 h-16 Z',
		'M112,54 h16 v18 h-16 Z',
		'M112,76 h16 v18 h-16 Z',
		'M112,98 h16 v18 h-16 Z',
		'M108,120 C120,118 132,120 134,124 C136,140 130,158 120,164 C110,158 104,140 106,124 Z'
	],
	structures: [
		{
			id: 'thoracic-junction',
			name: 'Thoracolumbar junction',
			plain: 'where the ribs stop and the lower back starts',
			kind: 'joint',
			zone: 'above',
			d: belly(100, 8, 140, 8, 16),
			label: { x: 150, y: 8 }
		},
		{
			id: 'erector-spinae',
			name: 'Erector spinae',
			plain: 'the two ropes of muscle running either side of your spine',
			kind: 'muscle',
			zone: 'here',
			d: belly(100, 14, 96, 116, 20),
			label: { x: 70, y: 60 }
		},
		{
			id: 'erector-spinae-r',
			name: 'Erector spinae, other side',
			plain: 'the same rope of muscle on the other side',
			kind: 'muscle',
			zone: 'here',
			d: belly(140, 14, 144, 116, 20),
			label: { x: 170, y: 60 }
		},
		{
			id: 'lumbar-disc',
			name: 'Lumbar disc',
			plain: 'the cushion between two vertebrae',
			kind: 'joint',
			zone: 'here',
			d: blob(120, 96, 14, 7),
			label: { x: 150, y: 96 }
		},
		{
			id: 'facet-joint',
			name: 'Facet joint',
			plain: 'the small joints at the back of the spine',
			kind: 'joint',
			zone: 'here',
			d: blob(106, 70, 8, 7),
			label: { x: 78, y: 74 }
		},
		{
			id: 'si-joint',
			name: 'Sacroiliac joint',
			plain: 'the joint between your spine and your pelvis, in the dimple',
			kind: 'joint',
			zone: 'here',
			d: belly(106, 122, 96, 158, 11),
			label: { x: 72, y: 142 }
		},
		{
			id: 'sciatic',
			name: 'Sciatic nerve',
			plain: 'the big nerve running down the back of your leg',
			kind: 'nerve',
			zone: 'below',
			d: strand([
				[112, 150],
				[104, 200],
				[100, 250],
				[98, 296]
			]),
			label: { x: 84, y: 250 }
		},
		{
			id: 'piriformis',
			name: 'Piriformis',
			plain: 'the deep buttock muscle the sciatic nerve passes under',
			kind: 'muscle',
			zone: 'below',
			d: belly(96, 146, 70, 166, 20),
			label: { x: 50, y: 164 }
		}
	]
};

const SHOULDER: DetailView = {
	id: 'shoulder',
	title: 'Shoulder',
	intro:
		'Almost all shoulder pain comes from the four small rotator cuff muscles or the space they run through. Which movement hurts tells them apart, and the next question asks that.',
	outline:
		'M40,20 C70,6 130,4 170,18 C196,28 210,60 206,96 C202,140 190,200 182,296 L96,296 C86,220 70,150 52,110 C38,80 34,42 40,20 Z',
	skeleton: [
		// collarbone, shoulder blade spine and the top of the humerus
		'M42,42 C80,32 128,34 160,44 L160,54 C126,44 80,42 42,52 Z',
		'M150,60 C170,66 182,84 180,104 C178,124 164,136 148,134 C132,132 124,116 128,98 C132,78 138,64 150,60 Z',
		'M140,140 L156,140 L166,296 L146,296 Z'
	],
	structures: [
		{
			id: 'neck-c5',
			name: 'Lower neck',
			plain: 'the base of your neck, which refers pain into the shoulder',
			kind: 'joint',
			zone: 'above',
			d: belly(60, 10, 96, 26, 20),
			label: { x: 52, y: 12 }
		},
		{
			id: 'trapezius',
			name: 'Trapezius',
			plain: 'the muscle along the top of your shoulder to your neck',
			kind: 'muscle',
			zone: 'above',
			d: belly(52, 34, 150, 56, 22),
			label: { x: 80, y: 34 }
		},
		{
			id: 'supraspinatus',
			name: 'Supraspinatus',
			plain: 'the cuff muscle over the top, the one that usually goes',
			kind: 'muscle',
			zone: 'here',
			d: belly(96, 66, 156, 88, 18),
			label: { x: 86, y: 74 }
		},
		{
			id: 'subacromial-bursa',
			name: 'Subacromial bursa',
			plain: 'the cushion under the bony roof of the shoulder',
			kind: 'bursa',
			zone: 'here',
			d: blob(160, 78, 18, 10),
			label: { x: 190, y: 70 }
		},
		{
			id: 'deltoid',
			name: 'Deltoid',
			plain: 'the cap of muscle over the point of your shoulder',
			kind: 'muscle',
			zone: 'here',
			d: belly(150, 68, 158, 150, 40),
			label: { x: 196, y: 120 }
		},
		{
			id: 'ac-joint',
			name: 'Acromioclavicular joint',
			plain: 'the small bump on top where the collarbone ends',
			kind: 'joint',
			zone: 'here',
			d: blob(158, 50, 11, 9),
			label: { x: 186, y: 42 }
		},
		{
			id: 'biceps-tendon',
			name: 'Long head of biceps',
			plain: 'the tendon at the front of the shoulder',
			kind: 'tendon',
			zone: 'here',
			d: belly(148, 96, 152, 170, 9),
			label: { x: 124, y: 150 }
		},
		{
			id: 'glenohumeral',
			name: 'Shoulder joint',
			plain: 'the ball and socket itself, felt deep and all round',
			kind: 'joint',
			zone: 'here',
			d: blob(146, 112, 16, 18),
			label: { x: 112, y: 112 }
		},
		{
			id: 'upper-arm-ref',
			name: 'Upper arm',
			plain: 'the arm below, where shoulder pain often spreads to',
			kind: 'muscle',
			zone: 'below',
			d: belly(150, 180, 156, 286, 30),
			label: { x: 190, y: 240 }
		}
	]
};

const KNEE: DetailView = {
	id: 'knee',
	title: 'Knee',
	intro:
		'The knee is mostly surface anatomy, so pointing at the exact spot narrows it a long way. Front, inside, outside and behind all mean different things.',
	outline:
		'M70,4 C64,50 62,90 66,120 C58,150 56,190 62,230 C66,266 70,288 72,298 L168,298 C170,288 174,266 178,230 C184,190 182,150 174,120 C178,90 176,50 170,4 Z',
	skeleton: [
		// femur, kneecap, shin and the outer bone
		'M92,4 L148,4 L152,112 L88,112 Z',
		blob(120, 138, 22, 26),
		'M94,170 L146,170 L150,298 L90,298 Z',
		'M156,176 L168,176 L170,250 L158,250 Z'
	],
	structures: [
		{
			id: 'quads',
			name: 'Quadriceps',
			plain: 'the big muscle on the front of your thigh',
			kind: 'muscle',
			zone: 'above',
			d: belly(120, 6, 120, 104, 46),
			label: { x: 76, y: 40 }
		},
		{
			id: 'patellar-tendon',
			name: 'Patellar tendon',
			plain: 'the cord below your kneecap',
			kind: 'tendon',
			zone: 'here',
			d: belly(120, 164, 120, 200, 16),
			label: { x: 146, y: 186 }
		},
		{
			id: 'patella',
			name: 'Patella',
			plain: 'the kneecap itself, and the surface behind it',
			kind: 'bone',
			zone: 'here',
			d: blob(120, 138, 20, 24),
			label: { x: 120, y: 136 }
		},
		{
			id: 'mcl',
			name: 'Medial collateral ligament',
			plain: 'the ligament on the inner side of the knee',
			kind: 'ligament',
			zone: 'here',
			d: belly(92, 116, 96, 176, 10),
			label: { x: 66, y: 148 }
		},
		{
			id: 'lcl',
			name: 'Lateral collateral ligament',
			plain: 'the ligament on the outer side of the knee',
			kind: 'ligament',
			zone: 'here',
			d: belly(150, 116, 158, 176, 10),
			label: { x: 178, y: 148 }
		},
		{
			id: 'medial-meniscus',
			name: 'Medial meniscus',
			plain: 'the inner cartilage cushion inside the joint',
			kind: 'joint',
			zone: 'here',
			d: blob(100, 150, 12, 7),
			label: { x: 68, y: 168 }
		},
		{
			id: 'lateral-meniscus',
			name: 'Lateral meniscus',
			plain: 'the outer cartilage cushion inside the joint',
			kind: 'joint',
			zone: 'here',
			d: blob(146, 150, 12, 7),
			label: { x: 176, y: 168 }
		},
		{
			id: 'pes-anserine',
			name: 'Pes anserine bursa',
			plain: 'a cushion just below the knee on the inside',
			kind: 'bursa',
			zone: 'below',
			d: blob(100, 190, 11, 8),
			label: { x: 70, y: 200 }
		},
		{
			id: 'calf-ref',
			name: 'Calf',
			plain: 'the muscle below, which pulls on the back of the knee',
			kind: 'muscle',
			zone: 'below',
			d: belly(120, 212, 120, 290, 40),
			label: { x: 120, y: 264 }
		}
	]
};

const NECK: DetailView = {
	id: 'neck',
	title: 'Neck',
	intro:
		'Neck pain very often shows up somewhere else, in a shoulder blade or down an arm. Mark the neck itself here, and mark the other places separately.',
	outline:
		'M84,4 C78,40 76,70 80,96 C60,110 40,130 30,160 C22,188 20,240 22,298 L218,298 C220,240 218,188 210,160 C200,130 180,110 160,96 C164,70 162,40 156,4 Z',
	skeleton: [
		'M112,10 h16 v16 h-16 Z',
		'M112,30 h16 v16 h-16 Z',
		'M112,50 h16 v16 h-16 Z',
		'M112,70 h16 v16 h-16 Z',
		'M112,90 h16 v16 h-16 Z',
		'M40,132 C90,116 150,116 200,132 L200,142 C150,126 90,126 40,142 Z'
	],
	structures: [
		{
			id: 'skull-base',
			name: 'Base of the skull',
			plain: 'where the neck meets the head, the headache spot',
			kind: 'joint',
			zone: 'above',
			d: belly(96, 8, 144, 8, 18),
			label: { x: 160, y: 8 }
		},
		{
			id: 'cervical-facet',
			name: 'Cervical facet joints',
			plain: 'the small joints at the back of your neck',
			kind: 'joint',
			zone: 'here',
			d: belly(106, 20, 106, 100, 12),
			label: { x: 80, y: 60 }
		},
		{
			id: 'cervical-disc',
			name: 'Cervical disc',
			plain: 'a cushion between two neck vertebrae',
			kind: 'joint',
			zone: 'here',
			d: blob(120, 88, 13, 6),
			label: { x: 150, y: 88 }
		},
		{
			id: 'levator',
			name: 'Levator scapulae',
			plain: 'the muscle from your neck to your shoulder blade',
			kind: 'muscle',
			zone: 'here',
			d: belly(134, 30, 172, 118, 16),
			label: { x: 176, y: 70 }
		},
		{
			id: 'upper-trap',
			name: 'Upper trapezius',
			plain: 'the slope between your neck and shoulder',
			kind: 'muscle',
			zone: 'here',
			d: belly(112, 96, 44, 148, 24),
			label: { x: 54, y: 118 }
		},
		{
			id: 'scm',
			name: 'Sternocleidomastoid',
			plain: 'the cord at the front side of your neck',
			kind: 'muscle',
			zone: 'here',
			d: belly(96, 20, 74, 122, 14),
			label: { x: 62, y: 66 }
		},
		{
			id: 'brachial-plexus',
			name: 'Nerve roots',
			plain: 'the nerves leaving your neck for your arm',
			kind: 'nerve',
			zone: 'below',
			d: strand([
				[132, 100],
				[164, 140],
				[186, 200],
				[196, 290]
			]),
			label: { x: 200, y: 220 }
		},
		{
			id: 'scapula-ref',
			name: 'Shoulder blade',
			plain: 'between the shoulder blades, where neck pain often lands',
			kind: 'bone',
			zone: 'below',
			d: blob(70, 200, 34, 44),
			label: { x: 40, y: 200 }
		}
	]
};

const SOLE: DetailView = {
	id: 'sole',
	title: 'Underneath the foot',
	intro:
		'The exact spot matters a great deal here. Heel, arch and the ball of the foot are three different problems that feel similar when you describe them in words.',
	outline:
		'M120,6 C86,10 66,34 62,74 C58,116 66,158 74,196 C82,236 88,270 96,296 L146,296 C154,270 160,236 166,196 C174,158 180,116 176,74 C172,34 152,10 120,6 Z',
	skeleton: [
		'M108,240 C120,232 132,238 136,254 C140,272 132,288 120,288 C108,288 100,272 102,256 Z',
		'M104,120 L136,120 L140,220 L100,220 Z'
	],
	structures: [
		{
			id: 'achilles',
			name: 'Achilles tendon',
			plain: 'the cord above your heel',
			kind: 'tendon',
			zone: 'above',
			d: belly(120, 292, 120, 250, 18),
			label: { x: 150, y: 278 }
		},
		{
			id: 'plantar-fascia',
			name: 'Plantar fascia',
			plain: 'the band along the sole from heel to toes',
			kind: 'ligament',
			zone: 'here',
			d: belly(114, 254, 118, 116, 22),
			label: { x: 78, y: 190 }
		},
		{
			id: 'heel-insertion',
			name: 'Plantar fascia insertion',
			plain: 'the inside front of the heel, the classic sore point',
			kind: 'tendon',
			zone: 'here',
			d: blob(112, 248, 14, 11),
			label: { x: 74, y: 252 }
		},
		{
			id: 'heel-pad',
			name: 'Heel fat pad',
			plain: 'the cushion right under the heel bone',
			kind: 'bursa',
			zone: 'here',
			d: blob(120, 272, 22, 16),
			label: { x: 156, y: 282 }
		},
		{
			id: 'metatarsal-heads',
			name: 'Metatarsal heads',
			plain: 'the ball of the foot, under the toe joints',
			kind: 'bone',
			zone: 'here',
			d: belly(90, 96, 152, 96, 20),
			label: { x: 168, y: 92 }
		},
		{
			id: 'interdigital-nerve',
			name: 'Interdigital nerve',
			plain: 'a nerve between the toe bones, felt as a pebble underfoot',
			kind: 'nerve',
			zone: 'here',
			d: strand([
				[122, 116],
				[124, 90],
				[126, 62]
			]),
			label: { x: 148, y: 66 }
		},
		{
			id: 'toe-joints',
			name: 'Toe joints',
			plain: 'the joints of the toes themselves',
			kind: 'joint',
			zone: 'below',
			d: belly(92, 40, 150, 40, 16),
			label: { x: 166, y: 34 }
		}
	]
};

/**
 * The views that exist. Regions whose detail is not drawn yet fall back to a
 * generic one, so the flow never dead-ends on a region nobody has illustrated.
 */
export const DETAIL_VIEWS: DetailView[] = [HIP, LOWER_BACK, SHOULDER, KNEE, NECK, SOLE];

export function detailById(id: string): DetailView | undefined {
	return DETAIL_VIEWS.find((v) => v.id === id);
}

export function structureById(id: string): Structure | undefined {
	for (const view of DETAIL_VIEWS) {
		const found = view.structures.find((s) => s.id === id);
		if (found) return found;
	}
	return undefined;
}

export function allStructures(): Structure[] {
	return DETAIL_VIEWS.flatMap((v) => v.structures);
}

/**
 * Which diagram a region opens.
 *
 * Several regions map onto a diagram drawn for a neighbour, and that is
 * anatomically right rather than a shortcut: buttock and hamstring pain is
 * read off the lower back diagram because the piriformis, the sciatic nerve
 * and the hamstring origin are all on it, and calf pain is read off the sole
 * because that is where the Achilles is drawn.
 *
 * Regions with no entry here have no detailed diagram yet. The flow still
 * records them, and says plainly that the close-up is missing rather than
 * pretending otherwise.
 */
const DETAIL_ALIASES: Record<string, string> = {
	buttock: 'lower-back',
	hamstring: 'lower-back',
	'upper-back': 'neck',
	'thigh-outer': 'hip',
	'thigh-front': 'hip',
	foot: 'sole',
	calf: 'sole'
};

export function detailFor(detailId: string): DetailView | undefined {
	return detailById(DETAIL_ALIASES[detailId] ?? detailId);
}

/** Region detail ids that have no diagram drawn for them yet. */
export function undrawnDetails(regionDetailIds: string[]): string[] {
	return [...new Set(regionDetailIds)].filter((id) => !detailFor(id)).sort();
}
