import { browser } from '$app/environment';
import {
	EMPTY,
	docAt,
	nextId,
	parseDoc,
	seedIds,
	setDocAt,
	titlesAlong,
	withRecent,
	type FlowDoc
} from './model';

/**
 * The documents, their history, and the copy that survives a reload.
 *
 * Undo is an index into a list of whole documents rather than a journal of
 * inverse operations. A document here is a few hundred small objects, so the
 * memory is nothing next to never having to write the inverse of an operation
 * and get it wrong. `commit` is the only way in, which is what keeps the two
 * in step.
 *
 * The history holds whole *root* documents even while you are editing a chart
 * nested inside one. Drilling into a box, changing something and coming back
 * out is one session's work, and a separate undo stack per level would strand
 * half of it behind a box the moment you left.
 */

/** Where a single diagram used to live, before there could be more than one. */
const LEGACY_KEY = 'flow-chart:doc';
const CHARTS_KEY = 'flow-chart:charts';
const CURRENT_KEY = 'flow-chart:current';
const COLOURS_KEY = 'flow-chart:colours';
const LIMIT = 100;

/**
 * The colours picked lately. Kept in this browser like the diagrams are,
 * because a palette somebody assembled while drawing is part of the drawing.
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

/** One saved diagram: what it is called, when it changed, and what is in it. */
export interface Chart {
	id: string;
	name: string;
	updated: number;
	doc: FlowDoc;
}

export const UNTITLED = 'Untitled chart';

function readCharts(): Chart[] {
	try {
		const raw = JSON.parse(localStorage.getItem(CHARTS_KEY) ?? 'null');
		if (!Array.isArray(raw)) return [];
		return raw
			.filter((item) => item && typeof item.id === 'string')
			.map((item) => ({
				id: item.id,
				name: typeof item.name === 'string' && item.name.trim() ? item.name : UNTITLED,
				updated: Number.isFinite(item.updated) ? Number(item.updated) : 0,
				doc: parseDoc(item.doc)
			}));
	} catch {
		// A corrupt list is not worth a blank page with an error on it.
		return [];
	}
}

export class Editor {
	/** Every saved diagram, newest first. The one being edited is in here too. */
	charts = $state<Chart[]>([]);
	currentId = $state<string>('');

	/**
	 * The nested chart being edited, as the node ids you went in through. Empty
	 * means the top level.
	 */
	path = $state<string[]>([]);

	#history = $state<FlowDoc[]>([EMPTY]);
	#at = $state(0);

	/** The whole diagram, including everything nested inside it. */
	root = $derived(this.#history[this.#at]);
	/** The level being edited, which is the root unless you have drilled in. */
	doc = $derived(docAt(this.root, this.path));

	canUndo = $derived(this.#at > 0);
	canRedo = $derived(this.#at < this.#history.length - 1);

	current = $derived(this.charts.find((chart) => chart.id === this.currentId));
	name = $derived(this.current?.name ?? UNTITLED);
	/** The titles of the boxes you opened to get here, for the trail. */
	trail = $derived(titlesAlong(this.root, this.path));

	/**
	 * Records a new state at the level being edited. `coalesce` folds this
	 * change into the previous one, which is what stops a drag from filling the
	 * history with a hundred steps that each moved a box four pixels.
	 */
	commit(next: FlowDoc, coalesce = false): void {
		if (next === this.doc) return;
		this.commitRoot(setDocAt(this.root, this.path, next), coalesce);
	}

	/** Records a whole document, path and all. Loading a file is the one caller. */
	commitRoot(next: FlowDoc, coalesce = false): void {
		if (next === this.root) return;
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
		this.path = [];
		this.commitRoot(next);
	}

	undo(): void {
		if (!this.canUndo) return;
		this.#at -= 1;
		this.reseat();
		this.save();
	}

	redo(): void {
		if (!this.canRedo) return;
		this.#at += 1;
		this.reseat();
		this.save();
	}

	/**
	 * Undo can step back past the box you are standing inside — the step being
	 * undone may be the one that created it. Climbing out to the deepest level
	 * that still exists beats showing an empty page with no way back.
	 */
	private reseat(): void {
		while (this.path.length && !docAt(this.root, this.path).nodes.length) {
			if (titlesAlong(this.root, this.path).length === this.path.length) return;
			this.path = this.path.slice(0, -1);
		}
	}

	/* ---- moving between levels ------------------------------------------ */

	/** Opens the diagram behind a node, creating an empty one if it has none. */
	enter(id: string): void {
		if (!this.doc.nodes.some((node) => node.id === id)) return;
		this.path = [...this.path, id];
	}

	/** Back out one level. */
	leave(): void {
		this.path = this.path.slice(0, -1);
	}

	/** Back out to a given depth: 0 is the top. */
	goTo(depth: number): void {
		this.path = this.path.slice(0, Math.max(0, depth));
	}

	/* ---- the library ----------------------------------------------------- */

	/**
	 * Loads the saved diagrams, bringing a single diagram saved by an older
	 * version along as the first one rather than leaving it stranded under a key
	 * nothing reads any more.
	 */
	restore(): void {
		if (!browser) return;
		let charts = readCharts();

		if (!charts.length) {
			const legacy = localStorage.getItem(LEGACY_KEY);
			if (legacy) {
				try {
					const doc = parseDoc(JSON.parse(legacy));
					if (doc.nodes.length) {
						charts = [{ id: nextId('c'), name: UNTITLED, updated: Date.now(), doc }];
					}
				} catch {
					// Nothing worth recovering, and nothing worth an error over.
				}
			}
		}

		if (!charts.length) charts = [this.blank()];
		for (const chart of charts) seedIds(chart.doc);

		this.charts = charts;
		const wanted = localStorage.getItem(CURRENT_KEY);
		const found = charts.find((chart) => chart.id === wanted) ?? charts[0];
		this.seat(found);
	}

	/**
	 * "Untitled chart", then "Untitled chart 2", and so on. Two rows with the
	 * same name in the list is a list you cannot use, and naming a diagram is
	 * not something anybody wants to be made to do before drawing one.
	 */
	private freshName(): string {
		const taken = new Set(this.charts.map((chart) => chart.name));
		if (!taken.has(UNTITLED)) return UNTITLED;
		let n = 2;
		while (taken.has(`${UNTITLED} ${n}`)) n += 1;
		return `${UNTITLED} ${n}`;
	}

	private blank(): Chart {
		return { id: nextId('c'), name: UNTITLED, updated: Date.now(), doc: EMPTY };
	}

	/** Makes the given chart the one being edited, with a fresh history. */
	private seat(chart: Chart): void {
		this.currentId = chart.id;
		this.path = [];
		this.#history = [chart.doc];
		this.#at = 0;
		if (browser) localStorage.setItem(CURRENT_KEY, chart.id);
	}

	/** Starts a new diagram and switches to it. */
	create(name = this.freshName()): string {
		const chart = { ...this.blank(), name };
		this.charts = [chart, ...this.charts];
		this.seat(chart);
		this.persist();
		return chart.id;
	}

	/** Switches to a saved diagram. The one being left is already saved. */
	open(id: string): void {
		const chart = this.charts.find((item) => item.id === id);
		if (!chart || chart.id === this.currentId) return;
		this.save();
		this.seat(chart);
	}

	rename(id: string, name: string): void {
		const clean = name.trim() || UNTITLED;
		this.charts = this.charts.map((chart) => (chart.id === id ? { ...chart, name: clean } : chart));
		this.persist();
	}

	/** A copy, so somebody can try a change without losing what they had. */
	duplicate(id: string): string | null {
		const chart = this.charts.find((item) => item.id === id);
		if (!chart) return null;
		const copy: Chart = {
			id: nextId('c'),
			name: `${chart.name} copy`,
			updated: Date.now(),
			doc: parseDoc(JSON.parse(JSON.stringify(chart.doc)))
		};
		const at = this.charts.findIndex((item) => item.id === id);
		this.charts = [...this.charts.slice(0, at + 1), copy, ...this.charts.slice(at + 1)];
		this.persist();
		return copy.id;
	}

	/** Removes a diagram. The last one is emptied rather than left with none. */
	remove(id: string): void {
		const rest = this.charts.filter((chart) => chart.id !== id);
		if (!rest.length) {
			const fresh = this.blank();
			this.charts = [fresh];
			this.seat(fresh);
			this.persist();
			return;
		}
		this.charts = rest;
		if (id === this.currentId) this.seat(rest[0]);
		this.persist();
	}

	/**
	 * The diagram is kept in this browser and nowhere else. It is the visitor's
	 * own work on their own machine, which is the case device storage is for,
	 * and losing a diagram to a stray reload would be the tool's fault.
	 */
	save(): void {
		if (!browser || !this.currentId) return;
		this.charts = this.charts.map((chart) =>
			chart.id === this.currentId ? { ...chart, doc: this.root, updated: Date.now() } : chart
		);
		this.persist();
	}

	private persist(): void {
		if (!browser) return;
		try {
			localStorage.setItem(CHARTS_KEY, JSON.stringify(this.charts));
			localStorage.setItem(CURRENT_KEY, this.currentId);
			// The old single-diagram key would otherwise be restored from on the
			// next empty start, bringing back a diagram somebody deleted.
			localStorage.removeItem(LEGACY_KEY);
		} catch {
			// Full, or storage is off. Not worth interrupting the drawing over.
		}
	}

	forget(): void {
		if (!browser) return;
		localStorage.removeItem(CHARTS_KEY);
		localStorage.removeItem(CURRENT_KEY);
		localStorage.removeItem(LEGACY_KEY);
	}
}
