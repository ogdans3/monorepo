// The API's shapes, as the Go server writes them.

export type ElementType = 'text' | 'image' | 'video' | 'qr';

/** One thing placed on a slide. Place and size are percent of the stage. */
export interface SlideElement {
	id: string;
	type: ElementType;
	x: number;
	y: number;
	w: number;
	h: number;
	/** Text, and its size in percent of the stage's height. */
	text?: string;
	size?: number;
	weight?: number;
	align?: 'left' | 'center' | 'right';
	color?: string;
	/** A picture's or a video's upload, and how it fills its box. */
	media?: string;
	fit?: 'contain' | 'cover';
	autoplay?: boolean;
	loop?: boolean;
	muted?: boolean;
}

/** An answer on a question slide, placed like any element, and counted. */
export interface Option {
	id: string;
	label: string;
	/** Its tile's colour on the phones, and its mark's on the slide. */
	color: string;
	x: number;
	y: number;
	w: number;
	h: number;
	count: number;
}

export interface Slide {
	id: string;
	position: number;
	/** The question as a phone shows it. */
	title: string;
	background: string;
	elements: SlideElement[];
	options: Option[];
	total: number;
}

export interface Media {
	id: string;
	kind: 'image' | 'video' | 'audio';
	mime: string;
	size: number;
	name: string;
	url: string;
}

export interface Presentation {
	id: string;
	title: string;
	code: string;
	/** What marks the answers besides their colour. */
	marks: 'letters' | 'numbers';
	liveSlideId: string | null;
	soundMediaId: string | null;
	updatedAt: string;
	slideCount: number;
	slides?: Slide[];
	media?: Media[];
}

/** What the display shows: the slide on screen, or none. */
export interface LiveState {
	id: string;
	title: string;
	code: string;
	marks?: 'letters' | 'numbers';
	/** The uploaded vote sound, or empty for the built-in chime. */
	sound: string;
	slide: Slide | null;
	index: number;
	count: number;
	/** The presentation is gone. */
	ended?: boolean;
}

export interface VoteEvent {
	slideId: string;
	optionId: string;
	counts: Record<string, number>;
	total: number;
}

export interface BallotQuestion {
	slideId: string;
	title: string;
	options: { id: string; label: string; color: string }[];
}

export interface Ballot {
	title: string;
	code: string;
	marks: 'letters' | 'numbers';
	live: boolean;
	question: BallotQuestion | null;
	voted: string | null;
}
