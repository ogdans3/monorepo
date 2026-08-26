import type { CarriedFile } from '$lib/tools/handoff';

/**
 * The one result being carried between tools, and the whole of its storage.
 *
 * A module-level value in the running tab: no cookie, no IndexedDB, no
 * sessionStorage, nothing that survives the tab being closed or outlives the
 * visit. That is not a limitation to work around later. Writing somebody's
 * photograph into device storage to save them a click would break a promise
 * this site makes in plain words on the privacy page.
 *
 * One slot rather than a history, because the useful question is "what am I
 * working on", and a chain of five intermediate PNGs held in memory is a
 * hundred megabytes nobody asked for. Each step replaces the last.
 */
let carried = $state<CarriedFile | null>(null);
/**
 * The file the page you are looking at opened, if it came from the slot rather
 * than from a drop. It is what lets the export bar keep the format you already
 * chose: convert to JPG and go on to crop, and the crop still saves a JPG.
 */
let opened = $state<CarriedFile | null>(null);
/**
 * Where the carried file has already been opened. A dropzone coming back after
 * that means the visitor pressed Start over, which is them saying they want a
 * different file, so the carried one is let go rather than loaded again.
 */
let openedAt: { path: string; file: File } | null = null;

export const carry = {
	get current(): CarriedFile | null {
		return carried;
	},

	/**
	 * Hands a result to the next tool. `to` is set when the visitor picked the
	 * destination, so that page opens it without asking.
	 */
	hand(file: File, from: string, to?: string): void {
		carried = { file, from, to };
	},

	/** The chosen destination has opened it, so it is no longer on its way. */
	arrived(): void {
		if (carried) carried = { ...carried, to: undefined };
	},

	forget(): void {
		carried = null;
	},

	/**
	 * True while a picker is deliberately handing a result over. The capture that
	 * runs when you navigate away checks it, so a result is never rendered twice
	 * for one journey.
	 */
	handing: false,


	/**
	 * What this page is working on, when it came from another tool rather than
	 * from a drop. Null the moment somebody drops a file of their own.
	 */
	get opened(): CarriedFile | null {
		return opened;
	},

	get openedType(): string {
		return opened?.file.type ?? '';
	},

	markOpened(held: CarriedFile | null): void {
		opened = held;
	},

	/**
	 * Whether this page should open the carried file by itself. It should, once:
	 * carrying on is the whole point, and a visitor who wanted an empty tool has
	 * Start over, which lands here a second time and gets the file dropped.
	 */
	shouldOpen(path: string, file: File): boolean {
		return !(openedAt?.path === path && openedAt.file === file);
	},

	noteOpened(path: string, file: File): void {
		openedAt = { path, file };
	}
};
