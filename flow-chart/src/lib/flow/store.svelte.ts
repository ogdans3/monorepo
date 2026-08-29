import { browser } from '$app/environment';
import { EMPTY, parseDoc, withRecent, type FlowDoc } from './model';

/**
 * The document, its history, and the copy that survives a reload.
 *
 * Undo is an index into a list of whole documents rather than a journal of
 * inverse operations. A document here is a few hundred small objects, so the
 * memory is nothing next to never having to write the inverse of an operation
 * and get it wrong. `commit` is the only way in, which is what keeps the two
 * in step.
 */

const KEY = 'flow-chart:doc';
const LIMIT = 100;

const COLOURS_KEY = 'flow-chart:colours';

/**
 * The colours picked lately. Kept in this browser like the diagram is, because
 * a palette somebody assembled while drawing is part of the drawing.
 */
class RecentColours {
	list = $state<string[]>([]);

	constructor() {
		if (!browser) return;
		try {
			const saved = JSON.parse(localStorage.getItem(COLOURS_KEY) ?? '[]');
			if (Array.isArray(saved)) this.list = saved.filter((item) => typeof item === 'string');
		} catch {
			// A corrupt entry is not worth a broken palette.
		}
	}

	remember(colour: string): void {
		this.list = withRecent(this.list, colour);
		if (!browser) return;
		try {
			localStorage.setItem(COLOURS_KEY, JSON.stringify(this.list));
		} catch {
			// Storage full or off, which costs a convenience and nothing else.
		}
	}
}

export const recentColours = new RecentColours();

export class Editor {
	#history = $state<FlowDoc[]>([EMPTY]);
	#at = $state(0);

	doc = $derived(this.#history[this.#at]);
	canUndo = $derived(this.#at > 0);
	canRedo = $derived(this.#at < this.#history.length - 1);

	/**
	 * Records a new state. `coalesce` folds this change into the previous one,
	 * which is what stops a drag from filling the history with a hundred steps
	 * that each moved a box four pixels.
	 */
	commit(next: FlowDoc, coalesce = false): void {
		if (next === this.doc) return;
		if (coalesce && this.#at > 0) {
			this.#history[this.#at] = next;
		} else {
			this.#history = [...this.#history.slice(0, this.#at + 1), next].slice(-LIMIT);
			this.#at = this.#history.length - 1;
		}
		this.save();
	}

	/** Replaces everything, keeping the history so an import can be undone. */
	replace(next: FlowDoc): void {
		this.commit(next);
	}

	undo(): void {
		if (this.canUndo) {
			this.#at -= 1;
			this.save();
		}
	}

	redo(): void {
		if (this.canRedo) {
			this.#at += 1;
			this.save();
		}
	}

	/**
	 * The diagram is kept in this browser and nowhere else. It is the visitor's
	 * own work on their own machine, which is the case device storage is for,
	 * and losing a diagram to a stray reload would be the tool's fault.
	 */
	save(): void {
		if (!browser) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.doc));
		} catch {
			// Full, or storage is off. Not worth interrupting the drawing over.
		}
	}

	restore(): void {
		if (!browser) return;
		try {
			const saved = localStorage.getItem(KEY);
			if (!saved) return;
			const doc = parseDoc(JSON.parse(saved));
			if (doc.nodes.length) {
				this.#history = [doc];
				this.#at = 0;
			}
		} catch {
			// A corrupt entry is not worth a blank page with an error on it.
		}
	}

	forget(): void {
		if (browser) localStorage.removeItem(KEY);
	}
}
