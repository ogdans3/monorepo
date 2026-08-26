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
let opened = $state<File | null>(null);

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

	/** What this page is working on: a carried file, or null for a fresh drop. */
	get openedType(): string {
		return opened?.type ?? '';
	},

	markOpened(file: File | null): void {
		opened = file;
	}
};
