// The editor's state: the presentation as the presenter has it, what is
// selected, and the saving of it. Every change is the presenter's at once and
// the server's half a second later; the server is told the slide whole, as it
// is now, so a save that is late is never a save that is wrong.

import { nextColour } from '$lib/answers';
import { api, ApiError, message, upload } from '$lib/api';
import { bytes } from '$lib/format';
import { session } from './session.svelte';
import { nextAnswer, type Box } from '$lib/geometry';
import type { LiveState, Media, Option, Presentation, Slide, SlideElement, VoteEvent } from '$lib/types';

export type Selection = { kind: 'element' | 'option'; id: string } | null;
export type Status = 'saved' | 'saving' | 'unsaved' | 'error';

type Snapshot = Pick<Slide, 'title' | 'background' | 'elements' | 'options'>;

export const uid = (prefix: string) => prefix + Math.random().toString(36).slice(2, 10);

function snapshot(s: Slide): Snapshot {
	return $state.snapshot({ title: s.title, background: s.background, elements: s.elements, options: s.options });
}

/** The biggest text on a slide: its heading, which is the question if it has one. */
export function heading(s: Slide): string {
	const texts = s.elements.filter((e) => e.type === 'text' && e.text?.trim());
	texts.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
	return texts[0]?.text?.trim().slice(0, 300) ?? '';
}

export class Editor {
	p: Presentation = $state({} as Presentation);
	current = $state(0);
	selection = $state<Selection>(null);
	/** The text element being typed in on the canvas. */
	typing = $state<string | null>(null);
	status = $state<Status>('saved');
	problem = $state('');
	/** Something to tell the presenter that is not about saving: an upload that failed. */
	notice = $state('');
	phones = $state(0);
	uploads = $state<{ id: string; name: string; done: number }[]>([]);
	/** Answers whose count has just moved, as on the display. */
	moving = $state<Record<string, boolean>>({});

	private timers = new Map<string, ReturnType<typeof setTimeout>>();
	private dirty = new Set<string>();
	private inflight = new Map<string, Promise<void>>();
	private undos = new Map<string, Snapshot[]>();
	private redos = new Map<string, Snapshot[]>();
	private lastMark = { key: '', at: 0 };
	private settle = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(p: Presentation, phones = 0) {
		this.p = p;
		this.phones = phones;
	}

	get slides(): Slide[] {
		return this.p.slides ?? [];
	}

	get slide(): Slide | undefined {
		return this.slides[this.current];
	}

	get media(): Media[] {
		return this.p.media ?? [];
	}

	get selected(): SlideElement | Option | undefined {
		const s = this.slide;
		const sel = this.selection;
		if (!s || !sel) return undefined;
		return sel.kind === 'element' ? s.elements.find((e) => e.id === sel.id) : s.options.find((o) => o.id === sel.id);
	}

	/** Every vote in the presentation, every question together. */
	get totalVotes(): number {
		return this.slides.reduce((n, s) => n + s.total, 0);
	}

	get liveIndex(): number {
		return this.slides.findIndex((s) => s.id === this.p.liveSlideId);
	}

	get canUndo(): boolean {
		return !!this.slide && (this.undos.get(this.slide.id)?.length ?? 0) > 0 && this.version >= 0;
	}

	get canRedo(): boolean {
		return !!this.slide && (this.redos.get(this.slide.id)?.length ?? 0) > 0 && this.version >= 0;
	}

	// The stacks are not state; this is, so that what reads them updates.
	private version = $state(0);

	select(kind: 'element' | 'option', id: string) {
		this.selection = { kind, id };
		if (this.typing && this.typing !== id) this.typing = null;
	}

	clearSelection() {
		this.selection = null;
		this.typing = null;
	}

	goTo(index: number) {
		if (index < 0 || index >= this.slides.length) return;
		this.current = index;
		this.clearSelection();
	}

	// Changes.

	/**
	 * Every change to a slide goes through here: a step to undo first, unless
	 * [mark] is false (the moves of a drag after its first) or names a run of
	 * changes that make one step (the keys typed into one field).
	 */
	edit(fn: (s: Slide) => void, mark: boolean | string = true) {
		const s = this.slide;
		if (!s) return;
		if (mark !== false) this.mark(s, typeof mark === 'string' ? mark : '');
		fn(s);
		this.schedule(s.id);
	}

	/** Remembers the slide as it is, to come back to. */
	mark(s = this.slide, key = '') {
		if (!s) return;
		const now = Date.now();
		if (key && key === this.lastMark.key && now - this.lastMark.at < 1500) {
			this.lastMark.at = now;
			return;
		}
		this.lastMark = { key, at: now };
		const stack = this.undos.get(s.id) ?? [];
		stack.push(snapshot(s));
		if (stack.length > 200) stack.shift();
		this.undos.set(s.id, stack);
		this.redos.set(s.id, []);
		this.version++;
	}

	undo() {
		this.travel(this.undos, this.redos);
	}

	redo() {
		this.travel(this.redos, this.undos);
	}

	private travel(from: Map<string, Snapshot[]>, to: Map<string, Snapshot[]>) {
		const s = this.slide;
		const back = s && from.get(s.id)?.pop();
		if (!s || !back) return;
		to.set(s.id, [...(to.get(s.id) ?? []), snapshot(s)]);
		// Counts are the room's, not the presenter's: an answer coming back
		// keeps the count it has now.
		const counts = new Map(s.options.map((o) => [o.id, o.count]));
		s.title = back.title;
		s.background = back.background;
		s.elements = back.elements;
		s.options = back.options.map((o) => ({ ...o, count: counts.get(o.id) ?? 0 }));
		s.total = s.options.reduce((n, o) => n + o.count, 0);
		this.lastMark = { key: '', at: 0 };
		if (!this.selected) this.clearSelection();
		this.version++;
		this.schedule(s.id);
	}

	setText(el: SlideElement, text: string) {
		this.edit((s) => {
			// The question on the phones follows the text on the slide for as
			// long as they say the same thing.
			if (s.title && s.title === el.text) s.title = text.trim().slice(0, 300);
			el.text = text;
		}, 'text:' + el.id);
	}

	addText() {
		const el: SlideElement = {
			id: uid('t'),
			type: 'text',
			x: 9.38,
			y: 38.89,
			w: 50,
			h: 16.67,
			text: 'Tekst',
			size: 5,
			weight: 400,
			align: 'left',
			color: ''
		};
		this.edit((s) => s.elements.push(el));
		this.select('element', el.id);
		this.typing = el.id;
	}

	/** A picture or a video, in a box shaped like it, in the middle of the stage. */
	addMedia(m: Media, aspect: number | null, at?: { x: number; y: number }) {
		if (m.kind === 'audio') return;
		const box = fitBox(aspect ?? 16 / 9, at);
		const el: SlideElement = {
			id: uid(m.kind === 'image' ? 'i' : 'v'),
			type: m.kind,
			...box,
			media: m.id,
			fit: 'contain',
			...(m.kind === 'video' ? { autoplay: true, loop: false, muted: false } : {})
		};
		this.edit((s) => s.elements.push(el));
		this.select('element', el.id);
	}

	addQr() {
		const el: SlideElement = { id: uid('q'), type: 'qr', x: 77, y: 8, w: 17, h: 44 };
		this.edit((s) => s.elements.push(el));
		this.select('element', el.id);
	}

	addOption() {
		const s = this.slide;
		if (!s) return;
		if (s.options.length >= 40) {
			this.notice = 'Et spørsmål kan ha høyst 40 svar.';
			return;
		}
		const { x, y, w, h } = nextAnswer(s.options);
		const option: Option = {
			id: uid('new-'),
			label: `Svar ${s.options.length + 1}`,
			color: nextColour(s.options.map((o) => o.color)),
			x,
			y,
			w,
			h,
			count: 0
		};
		this.edit((s) => {
			if (!s.title) s.title = heading(s);
			s.options.push(option);
		});
		this.select('option', option.id);
	}

	/** Places every answer at once, as [boxes] says, in order. */
	placeOptions(boxes: Box[]) {
		this.edit((s) => s.options.forEach((o, i) => boxes[i] && Object.assign(o, boxes[i])));
	}

	duplicateSelected() {
		const item = this.selected;
		const sel = this.selection;
		if (!item || !sel) return;
		const shifted = { x: Math.min(item.x + 3.13, 100 - item.w), y: Math.min(item.y + 5.56, 100 - item.h) };
		if (sel.kind === 'element') {
			const copy = { ...$state.snapshot(item as SlideElement), id: uid('e'), ...shifted };
			this.edit((s) => s.elements.push(copy));
			this.select('element', copy.id);
		} else {
			const copy = {
				...$state.snapshot(item as Option),
				id: uid('new-'),
				count: 0,
				color: nextColour(this.slide?.options.map((o) => o.color) ?? []),
				...shifted
			};
			this.edit((s) => s.options.push(copy));
			this.select('option', copy.id);
		}
	}

	/** Takes the selection off the slide; an answer with votes asks first, since they go with it. */
	removeSelected(ask = true): boolean {
		const sel = this.selection;
		const item = this.selected;
		if (!sel || !item) return false;
		if (sel.kind === 'option') {
			const n = (item as Option).count;
			if (ask && n > 0 && !confirm(`Slette svaret og de ${n} stemmene på det?`)) return false;
			this.edit((s) => {
				s.options = s.options.filter((o) => o.id !== sel.id);
				s.total = s.options.reduce((t, o) => t + o.count, 0);
			});
		} else this.edit((s) => (s.elements = s.elements.filter((e) => e.id !== sel.id)));
		this.clearSelection();
		return true;
	}

	/** Moves the selected element to the front or the back of the slide. */
	restack(front: boolean) {
		const sel = this.selection;
		if (sel?.kind !== 'element') return;
		this.edit((s) => {
			const el = s.elements.find((e) => e.id === sel.id);
			if (!el) return;
			const rest = s.elements.filter((e) => e.id !== sel.id);
			s.elements = front ? [...rest, el] : [el, ...rest];
		});
	}

	// Saving.

	private schedule(id: string, delay = 450) {
		this.dirty.add(id);
		this.refresh();
		clearTimeout(this.timers.get(id));
		this.timers.set(
			id,
			setTimeout(() => this.save(id), delay)
		);
	}

	private refresh() {
		if (this.inflight.size > 0) this.status = 'saving';
		else if (this.problem) this.status = 'error';
		else if (this.dirty.size > 0) this.status = 'unsaved';
		else this.status = 'saved';
	}

	/** Writes a slide now. One save at a time per slide, and one more after if it changed meanwhile. */
	async save(id: string): Promise<void> {
		clearTimeout(this.timers.get(id));
		this.timers.delete(id);
		while (this.inflight.has(id)) await this.inflight.get(id);
		if (!this.dirty.has(id)) return;
		const slide = this.slides.find((s) => s.id === id);
		if (!slide) {
			this.dirty.delete(id);
			this.refresh();
			return;
		}
		this.dirty.delete(id);
		const sent = $state.snapshot(slide);
		const job = (async () => {
			try {
				const res = await api<{ slide: Slide }>('PUT', `/api/admin/slides/${id}`, {
					title: sent.title,
					background: sent.background,
					elements: sent.elements,
					options: sent.options.map(({ count: _, ...o }) => o)
				});
				this.reconcile(slide, sent, res.slide);
				this.problem = '';
			} catch (err) {
				this.dirty.add(id);
				this.problem = message(err);
				// Offline or a server restarting: try again in a while. A slide the
				// server refused waits for the presenter to change it.
				if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
					this.timers.set(
						id,
						setTimeout(() => this.save(id), 3000)
					);
				}
			}
		})();
		this.inflight.set(id, job);
		this.refresh();
		await job;
		this.inflight.delete(id);
		this.refresh();
	}

	/**
	 * Takes in what the server made of a save: the answers it has just made
	 * have ids of its own now, which replace the editor's own wherever the old
	 * one is still in use, the undo steps included.
	 */
	private reconcile(slide: Slide, sent: Slide, saved: Slide) {
		sent.options.forEach((o, i) => {
			const id = saved.options[i]?.id;
			if (!id || id === o.id) return;
			const local = slide.options.find((x) => x.id === o.id);
			if (local) local.id = id;
			if (this.selection?.kind === 'option' && this.selection.id === o.id) this.selection = { kind: 'option', id };
			for (const stack of [this.undos.get(slide.id), this.redos.get(slide.id)])
				for (const snap of stack ?? []) for (const x of snap.options) if (x.id === o.id) x.id = id;
		});
		for (const o of slide.options) {
			const s = saved.options.find((x) => x.id === o.id);
			if (s) o.count = s.count;
		}
		slide.total = slide.options.reduce((n, o) => n + o.count, 0);
	}

	/** Every pending change, saved. */
	async flush() {
		await Promise.all([...new Set([...this.dirty, ...this.timers.keys()])].map((id) => this.save(id)));
	}

	get unsaved(): boolean {
		return this.status !== 'saved';
	}

	// The presentation itself.

	async reload(select?: string) {
		const res = await api<{ presentation: Presentation; phones: number }>('GET', `/api/admin/presentations/${this.p.id}`);
		this.p = res.presentation;
		this.phones = res.phones;
		if (select) this.current = Math.max(0, this.slides.findIndex((s) => s.id === select));
		this.current = Math.max(0, Math.min(this.current, this.slides.length - 1));
		if (!this.selected) this.clearSelection();
	}

	async rename(title: string) {
		this.p.title = title;
		try {
			await api('PATCH', `/api/admin/presentations/${this.p.id}`, { title });
		} catch (err) {
			this.notice = message(err);
		}
	}

	async setMarks(marks: 'letters' | 'numbers') {
		const before = this.p.marks;
		this.p.marks = marks;
		try {
			await api('PATCH', `/api/admin/presentations/${this.p.id}`, { marks });
		} catch (err) {
			this.p.marks = before;
			this.notice = message(err);
		}
	}

	async setSound(mediaId: string) {
		try {
			const res = await api<{ presentation: Presentation }>('PATCH', `/api/admin/presentations/${this.p.id}`, {
				soundMediaId: mediaId
			});
			this.p.soundMediaId = res.presentation.soundMediaId;
		} catch (err) {
			this.notice = message(err);
		}
	}

	async addSlide(kind: 'content' | 'question') {
		await this.flush();
		try {
			const made = await api<{ id: string }>('POST', `/api/admin/presentations/${this.p.id}/slides`, {
				after: this.slide?.id ?? '',
				kind
			});
			await this.reload(made.id);
			this.clearSelection();
		} catch (err) {
			this.notice = message(err);
		}
	}

	async duplicateSlide(id: string) {
		await this.flush();
		try {
			const made = await api<{ id: string }>('POST', `/api/admin/slides/${id}/duplicate`);
			await this.reload(made.id);
		} catch (err) {
			this.notice = message(err);
		}
	}

	async deleteSlide(id: string) {
		const s = this.slides.find((x) => x.id === id);
		if (!s || this.slides.length <= 1) return;
		if (s.total > 0 && !confirm(`Slette siden og de ${s.total} stemmene på den?`)) return;
		await this.flush();
		try {
			await api('DELETE', `/api/admin/slides/${id}`);
			this.dirty.delete(id);
			this.undos.delete(id);
			this.redos.delete(id);
			const index = this.slides.indexOf(s);
			await this.reload();
			this.current = Math.min(index, this.slides.length - 1);
		} catch (err) {
			this.notice = message(err);
		}
	}

	async moveSlide(from: number, to: number) {
		const slides = this.slides;
		if (from === to || to < 0 || to >= slides.length) return;
		await this.flush();
		const moved = slides[from];
		const order = slides.filter((_, i) => i !== from);
		order.splice(to, 0, moved);
		this.p.slides = order;
		this.current = to;
		try {
			const res = await api<{ presentation: Presentation }>('PUT', `/api/admin/presentations/${this.p.id}/order`, {
				slideIds: order.map((s) => s.id)
			});
			this.p = res.presentation;
			this.current = Math.max(0, this.slides.findIndex((s) => s.id === moved.id));
		} catch (err) {
			this.notice = message(err);
			await this.reload(moved.id);
		}
	}

	async resetVotes() {
		const s = this.slide;
		if (!s || s.total === 0) return;
		if (!confirm(`Nullstille de ${s.total} stemmene på spørsmålet? Telefonene kan stemme på nytt.`)) return;
		try {
			await api('DELETE', `/api/admin/slides/${s.id}/votes`);
			for (const o of s.options) o.count = 0;
			s.total = 0;
		} catch (err) {
			this.notice = message(err);
		}
	}

	/**
	 * Takes every vote off every question, so the presentation starts again
	 * at nothing: after a rehearsal, say. [ask] asks first; the start dialog
	 * has already asked. The phones can vote again at once.
	 */
	async resetAllVotes(ask = true): Promise<boolean> {
		const total = this.totalVotes;
		if (total === 0) return true;
		if (ask && !confirm(`Nullstille alle ${total} stemmene i presentasjonen? Telefonene kan stemme på nytt på hvert spørsmål.`))
			return false;
		try {
			await api('DELETE', `/api/admin/presentations/${this.p.id}/votes`);
			for (const s of this.slides) {
				for (const o of s.options) o.count = 0;
				s.total = 0;
			}
			return true;
		} catch (err) {
			this.notice = message(err);
			return false;
		}
	}

	async upload(file: File): Promise<Media | null> {
		// Said before the upload rather than after it: a refused 400 MB video
		// is minutes of waiting for nothing.
		if (session.maxUpload && file.size > session.maxUpload) {
			this.notice = `«${file.name}» er ${bytes(file.size)}. Grensen er ${bytes(session.maxUpload)}; gjør filen mindre og prøv igjen.`;
			return null;
		}
		const job = { id: uid('u'), name: file.name, done: 0 };
		this.uploads.push(job);
		const entry = this.uploads[this.uploads.length - 1];
		try {
			const res = await upload<{ media: Media }>(`/api/admin/presentations/${this.p.id}/media`, file, (d) => {
				entry.done = d;
			});
			this.p.media = [...this.media, res.media];
			return res.media;
		} catch (err) {
			this.notice = `${file.name}: ${message(err)}`;
			return null;
		} finally {
			this.uploads = this.uploads.filter((u) => u.id !== job.id);
		}
	}

	async deleteMedia(m: Media) {
		const used = this.slides.filter((s) => s.elements.some((e) => e.media === m.id)).length;
		const where = used === 0 ? '' : used === 1 ? ' Den er i bruk på én side, og boksen der blir tom.' : ` Den er i bruk på ${used} sider, og boksene der blir tomme.`;
		if (!confirm(`Slette «${m.name}»?${where}`)) return;
		await this.flush();
		try {
			await api('DELETE', `/api/admin/media/${m.id}`);
			await this.reload(this.slide?.id);
		} catch (err) {
			this.notice = message(err);
		}
	}

	// Live.

	private async putLive(body: { slideId?: string; step?: number }) {
		await this.flush();
		try {
			const st = await api<LiveState>('PUT', `/api/admin/presentations/${this.p.id}/live`, body);
			this.p.liveSlideId = st.slide?.id ?? null;
		} catch (err) {
			this.notice = message(err);
		}
	}

	start() {
		return this.putLive({ slideId: this.slides[0]?.id });
	}

	show(slideId: string) {
		return this.putLive({ slideId });
	}

	step(n: number) {
		return this.putLive({ step: n });
	}

	async stop() {
		try {
			await api('DELETE', `/api/admin/presentations/${this.p.id}/live`);
			this.p.liveSlideId = null;
		} catch (err) {
			this.notice = message(err);
		}
	}

	/** What the stream says: the slide on screen and its counts. The presenter's edits stay theirs. */
	onState(s: LiveState) {
		if (s.ended) return;
		this.p.liveSlideId = s.slide?.id ?? null;
		const live = s.slide && this.slides.find((x) => x.id === s.slide!.id);
		if (live && s.slide) this.count(live, Object.fromEntries(s.slide.options.map((o) => [o.id, o.count])));
	}

	onVote(v: VoteEvent) {
		const slide = this.slides.find((s) => s.id === v.slideId);
		if (!slide) return;
		this.count(slide, v.counts);
		this.moving[v.optionId] = true;
		clearTimeout(this.settle.get(v.optionId));
		this.settle.set(
			v.optionId,
			setTimeout(() => (this.moving[v.optionId] = false), 1400)
		);
	}

	private count(slide: Slide, counts: Record<string, number>) {
		for (const o of slide.options) if (o.id in counts) o.count = counts[o.id];
		slide.total = slide.options.reduce((n, o) => n + o.count, 0);
	}

	dispose() {
		this.timers.forEach(clearTimeout);
		this.settle.forEach(clearTimeout);
	}
}

/**
 * A box of [aspect] (width over height, as the picture is), as big as sits
 * well on the stage: half its width, or most of its height for a tall one;
 * centred on [at] if given, or on the stage.
 */
export function fitBox(aspect: number, at?: { x: number; y: number }): Box {
	// In stage percent a box w by h is w·16 by h·9 in real proportion.
	let w = 50;
	let h = (w * 16) / (9 * aspect);
	if (h > 70) {
		h = 70;
		w = (h * 9 * aspect) / 16;
	}
	const cx = at?.x ?? 50;
	const cy = at?.y ?? 50;
	const x = Math.max(0, Math.min(100 - w, cx - w / 2));
	const y = Math.max(0, Math.min(100 - h, cy - h / 2));
	const r = (v: number) => Math.round(v * 100) / 100;
	return { x: r(x), y: r(y), w: r(w), h: r(h) };
}

/** A picture's or a video's proportions, read from the file itself. */
export function measure(m: Media): Promise<number | null> {
	return new Promise((resolve) => {
		if (m.kind === 'image') {
			const img = new Image();
			img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
			img.onerror = () => resolve(null);
			img.src = m.url;
		} else if (m.kind === 'video') {
			const v = document.createElement('video');
			v.preload = 'metadata';
			v.onloadedmetadata = () => resolve(v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : null);
			v.onerror = () => resolve(null);
			v.src = m.url;
		} else resolve(null);
	});
}
