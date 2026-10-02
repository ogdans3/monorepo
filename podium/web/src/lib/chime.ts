// The sound of a vote. The owner asked for the one in Dr Kawashima's Brain
// Training; that one is Nintendo's, so this is a chime in its spirit, made
// here: a short, bright bell. A presentation can carry a sound of its own.

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
 * One bell strike: a sine at the note with a glockenspiel's inharmonic
 * partials, each dying away faster than the one below it, and a fifth above
 * coming in just after for the lift.
 */
function strike(ctx: BaseAudioContext, out: AudioNode, at: number, freq: number) {
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
	private buffer: AudioBuffer | null = null;
	private url = '';
	private cadence = new Cadence();
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

	/** Use the uploaded sound at [url], or the chime when empty. */
	async use(url: string) {
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

	/** A vote landed. */
	vote() {
		const ctx = this.ctx;
		if (this.muted || !ctx || ctx.state !== 'running' || !this.out) return;
		const slot = this.cadence.take(ctx.currentTime);
		if (slot) this.play(ctx, this.out, slot.at, slot.step);
	}

	/** One sound now, to hear what a vote will sound like. */
	async preview(url = '') {
		this.unlock();
		const ctx = this.ctx;
		if (!ctx || !this.out) return;
		if (ctx.state !== 'running') await ctx.resume().catch(() => {});
		if (url) await this.use(url);
		else {
			this.url = '';
			this.buffer = null;
		}
		const now = ctx.currentTime + 0.02;
		if (this.buffer) this.play(ctx, this.out, now, 0);
		else for (let i = 0; i < 4; i++) this.play(ctx, this.out, now + i * 0.11, i);
	}

	private play(ctx: AudioContext, out: AudioNode, at: number, step: number) {
		if (this.buffer) {
			const src = ctx.createBufferSource();
			src.buffer = this.buffer;
			src.connect(out);
			src.start(at);
		} else strike(ctx, out, at, pitch(step));
	}
}

export const chime = new Chime();
