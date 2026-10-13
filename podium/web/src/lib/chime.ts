// The sound of a vote. The owner asked for the one in Dr Kawashima's Brain
// Training, the click as the boxes are counted; that one is Nintendo's, so
// these are made here, in its spirit: a short, bright bell, and the click of
// a tally counter whose tone climbs with the count. A presentation chooses
// one of the two, or carries a sound of its own.

/** The built-in sounds. */
export type Voice = 'bell' | 'click';

/**
 * When each vote sounds. Votes that land together are spaced into a quick
 * run instead of one loud clang, and each one in a run is a step higher on a
 * pentatonic scale, so a room voting at once is heard as a rising arpeggio.
 * A run that would take too long to play drops what will not fit: the count
 * on screen is the record, the sound only says it is happening.
 */
export class Cadence {
	private next = 0;
	private last = -Infinity;
	private step = -1;

	constructor(
		readonly gap = 0.06,
		readonly ahead = 0.9,
		readonly settle = 1.2,
		readonly steps = SCALE.length
	) {}

	/** When to sound a vote that came at [now] (seconds), and how high; or null. */
	take(now: number): { at: number; step: number } | null {
		this.step = now - this.last > this.settle ? 0 : Math.min(this.step + 1, this.steps - 1);
		this.last = now;
		const at = Math.max(now, this.next);
		if (at - now > this.ahead) return null;
		this.next = at + this.gap;
		return { at, step: this.step };
	}
}

/** Semitones above the first note: a major pentatonic, an octave and a bit. */
export const SCALE = [0, 2, 4, 7, 9, 12, 14];
const BASE = 1046.5; // C6

export function pitch(step: number): number {
	return BASE * 2 ** (SCALE[Math.min(step, SCALE.length - 1)] / 12);
}

/**
 * The click's tone is a Shepard tone, so the count only ever goes up. It is
 * one note sounded in eight octaves at once, under a loudness that is fixed by
 * frequency and not by note: loudest around 1.1 kHz, fading to nothing an
 * octave or three either side. Every vote moves every octave a step up a
 * major scale. The top octave fades out as it climbs and a new one fades in
 * at the bottom, so after seven steps the tone is back where it began, and
 * the ear never hears it come down. A ladder that started again at the
 * bottom was heard as a drop.
 */
export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SHEPARD_ROOT = 48.999; // G1, the lowest of the octaves
const SHEPARD_CENTRE = 1100; // Hz, where the tone is loudest
const SHEPARD_WIDTH = 1; // octaves, how wide the loudness is
// Eight: from G1 up to F♯9 at the top step, under any sound card's ceiling.
const SHEPARD_OCTAVES = 8;

/** The semitones above G of the [count]th vote's tone, counting from 1: up a major scale, round and round. */
export function tallyStep(count: number): number {
	return MAJOR[(Math.max(1, Math.floor(count)) - 1) % MAJOR.length];
}

/** The octaves of the tone [step] semitones above G, and how loud each is. */
export function shepard(step: number): { freq: number; gain: number }[] {
	return Array.from({ length: SHEPARD_OCTAVES }, (_, k) => {
		const freq = SHEPARD_ROOT * 2 ** (k + step / 12);
		const x = Math.log2(freq / SHEPARD_CENTRE) / SHEPARD_WIDTH;
		return { freq, gain: Math.exp(-0.5 * x * x) };
	});
}

/** What a click is made of, made once for an audio context: noise for the ticks, and a wave for each step of the tone. */
export interface ClickKit {
	noise: AudioBuffer;
	waves: PeriodicWave[];
}

export function clickKit(ctx: BaseAudioContext): ClickKit {
	// One oscillator plays all eight octaves: they are the 1st, 2nd, 4th …
	// 128th harmonics of the lowest, which the wave holds at their loudness.
	const waves = MAJOR.map((step) => {
		const imag = new Float32Array(2 ** (SHEPARD_OCTAVES - 1) + 1);
		shepard(step).forEach(({ gain }, k) => (imag[2 ** k] = gain));
		return ctx.createPeriodicWave(new Float32Array(imag.length), imag, { disableNormalization: true });
	});
	return { noise: noiseOf(ctx), waves };
}

/** A twentieth of a second of white noise, for the clicks to be cut from. */
export function noiseOf(ctx: BaseAudioContext): AudioBuffer {
	const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
	return buffer;
}

/**
 * How loud each part of a click is, measured against the bell by rendering
 * both offline. A click is over in 80 ms where a strike rings for 300, so it
 * peaks a little above the strike and carries about three quarters of the
 * strike's loudness over its first 20 ms.
 */
export const CLICK = { down: 3.2, wheel: 0.7, back: 1.5, tens: 1.6 };

/** When the lever comes back after it went down, in seconds. */
export const CLICK_BACK = 0.062;

/**
 * How far apart the clicks of a run are. Further than the lever takes to come
 * back, with room to spare: a tick landing a hair after another is not two
 * ticks to the ear but one harsh crack, which is what a room voting at once
 * used to make of the click.
 */
export const CLICK_GAP = 0.1;

/**
 * One press of a tally counter. The lever goes down, a hard tick of noise
 * high up, with the number wheel's small tone under it at the count's step;
 * then the lever comes back, a softer, lower tick, a moment after. Every
 * tenth count turns the tens wheel too: a lower tick between the two, and
 * not a tone, since an octave up on the top step is a piercing 4 kHz that
 * does not sound like the click at all.
 */
export function click(ctx: BaseAudioContext, out: AudioNode, at: number, count: number, kit: ClickKit) {
	const tick = (t: number, centre: number, gain: number, decay: number) => {
		const src = ctx.createBufferSource();
		src.buffer = kit.noise;
		const band = ctx.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.setValueAtTime(centre, t);
		band.Q.setValueAtTime(1.2, t);
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, t);
		env.gain.linearRampToValueAtTime(gain, t + 0.0007);
		env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
		src.connect(band).connect(env).connect(out);
		src.start(t);
		src.stop(t + decay + 0.01);
	};
	const tone = (t: number, step: number, gain: number, decay: number) => {
		const osc = ctx.createOscillator();
		osc.setPeriodicWave(kit.waves[MAJOR.indexOf(step)]);
		osc.frequency.setValueAtTime(SHEPARD_ROOT * 2 ** (step / 12), t);
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, t);
		env.gain.linearRampToValueAtTime(gain, t + 0.002);
		env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
		osc.connect(env).connect(out);
		osc.start(t);
		osc.stop(t + decay + 0.02);
	};
	tick(at, 4600, CLICK.down, 0.016);
	tone(at + 0.001, tallyStep(count), CLICK.wheel, 0.09);
	if (Math.floor(count) % TENS === 0) tick(at + 0.024, 1700, CLICK.tens, 0.016);
	tick(at + CLICK_BACK, 2400, CLICK.back, 0.012);
}

/** Every this many votes turns the tens wheel. */
const TENS = 10;


/**
 * One bell strike: a sine at the note with a glockenspiel's inharmonic
 * partials, each dying away faster than the one below it, and a fifth above
 * coming in just after for the lift.
 */
export function strike(ctx: BaseAudioContext, out: AudioNode, at: number, freq: number) {
	const partials: [ratio: number, gain: number, decay: number, delay: number][] = [
		[1, 0.9, 0.55, 0],
		[2.76, 0.22, 0.24, 0],
		[5.4, 0.07, 0.12, 0],
		[1.5, 0.3, 0.42, 0.028]
	];
	for (const [ratio, gain, decay, delay] of partials) {
		const t = at + delay;
		const osc = ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(freq * ratio, t);
		const env = ctx.createGain();
		env.gain.setValueAtTime(0, t);
		env.gain.linearRampToValueAtTime(gain, t + 0.004);
		env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
		osc.connect(env).connect(out);
		osc.start(t);
		osc.stop(t + decay + 0.05);
	}
}

class Chime {
	private ctx: AudioContext | null = null;
	private out: AudioNode | null = null;
	private kit: ClickKit | null = null;
	private buffer: AudioBuffer | null = null;
	private url = '';
	private voice: Voice = 'bell';
	private cadence = new Cadence();
	private clicks = new Cadence(CLICK_GAP);
	private listeners = new Set<() => void>();
	muted = false;

	private ensure(): AudioContext | null {
		if (this.ctx) return this.ctx;
		if (typeof AudioContext === 'undefined') return null;
		const ctx = new AudioContext({ latencyHint: 'interactive' });
		const level = ctx.createGain();
		level.gain.value = 0.34;
		const limit = ctx.createDynamicsCompressor();
		limit.threshold.value = -12;
		limit.ratio.value = 8;
		level.connect(limit).connect(ctx.destination);
		ctx.addEventListener('statechange', () => this.listeners.forEach((f) => f()));
		this.ctx = ctx;
		this.out = level;
		this.kit = clickKit(ctx);
		return ctx;
	}

	/** Whether a vote would be heard: the browser lets sound play only after a click or a key. */
	get ready(): boolean {
		return this.ctx?.state === 'running';
	}

	onchange(f: () => void): () => void {
		this.listeners.add(f);
		return () => this.listeners.delete(f);
	}

	/** Call from a click or a key press: that is what lets the sound start. */
	unlock() {
		const ctx = this.ensure();
		if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
	}

	/** Use the uploaded sound at [url], or the built-in [voice] when it is empty. */
	async use(url: string, voice: Voice = 'bell') {
		this.voice = voice;
		if (url === this.url) return;
		this.url = url;
		this.buffer = null;
		if (!url) return;
		const ctx = this.ensure();
		if (!ctx) return;
		try {
			const data = await (await fetch(url)).arrayBuffer();
			const buffer = await ctx.decodeAudioData(data);
			if (this.url === url) this.buffer = buffer;
		} catch {
			// A sound the browser cannot play leaves the chime, which can.
		}
	}

	/** A vote landed, the [count]th on its question. */
	vote(count = 0) {
		const ctx = this.ctx;
		if (this.muted || !ctx || ctx.state !== 'running' || !this.out) return;
		const clicking = !this.buffer && this.voice === 'click';
		const slot = (clicking ? this.clicks : this.cadence).take(ctx.currentTime);
		if (slot) this.play(ctx, this.out, slot.at, slot.step, count || slot.step + 1, this.voice);
	}

	/** A few votes now, to hear what they will sound like: an upload's, or a built-in [voice]. */
	async preview(url = '', voice: Voice = 'bell') {
		this.unlock();
		const ctx = this.ctx;
		if (!ctx || !this.out) return;
		if (ctx.state !== 'running') await ctx.resume().catch(() => {});
		if (url) await this.use(url, this.voice);
		else {
			this.url = '';
			this.buffer = null;
		}
		const now = ctx.currentTime + 0.02;
		if (this.buffer) this.play(ctx, this.out, now, 0, 1, voice);
		else if (voice === 'click') for (let i = 0; i < 15; i++) this.play(ctx, this.out, now + i * 0.16, i, i + 1, voice);
		else for (let i = 0; i < 4; i++) this.play(ctx, this.out, now + i * 0.11, i, i + 1, voice);
	}

	private play(ctx: AudioContext, out: AudioNode, at: number, step: number, count: number, voice: Voice) {
		if (this.buffer) {
			const src = ctx.createBufferSource();
			src.buffer = this.buffer;
			src.connect(out);
			src.start(at);
		} else if (voice === 'click' && this.kit) click(ctx, out, at, count, this.kit);
		else strike(ctx, out, at, pitch(step));
	}
}

export const chime = new Chime();
