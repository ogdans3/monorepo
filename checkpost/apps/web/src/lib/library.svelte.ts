import { browser } from '$app/environment';
import type { Access } from '@checkpost/contract';

/**
 * The lists this browser knows a link to.
 *
 * There are no accounts, so this index is the only record that a list exists.
 * The Flutter app keeps the same one on the device; this is the browser's copy
 * of that idea, and it follows the same rules: losing it does not lose the
 * list, but it does lose the way in, which is why forgetting one asks first.
 *
 * It holds share tokens, because a token is the only way back to a list. That
 * is the same trade the address bar and the browser's own history already
 * make, and the page that shows this index says so out loud rather than
 * leaving somebody to work it out.
 */

const KEY = 'checkpost.lists.v1';
const SORT_KEY = 'checkpost.lists.sort.v1';

/** Writes are coalesced: an open list reports itself on every tick of a box. */
const WRITE_DELAY = 400;
/**
 * How often an open list is allowed to move to the top of "last opened".
 *
 * Without it every change to a list is a write, and the index churns for as
 * long as somebody is working through one. The column says which list you were
 * on last, and one stamp per half minute says exactly that.
 */
const TOUCH_MS = 30_000;

export type Sort = 'opened' | 'added';

/** Why a link stopped working. The page says which, because they differ. */
export type Gone = 'rotated' | 'deleted' | 'invalid';

export interface SavedList {
  id: string;
  /** The share token. The whole of the way back in. */
  token: string;
  title: string;
  /** Cached counts, so a row is true before the network answers. */
  done: number;
  total: number;
  access: Access;
  addedAt: string;
  openedAt: string;
  favourite: boolean;
  gone: Gone | null;
}

export interface Visit {
  id: string;
  token: string;
  title: string;
  done: number;
  total: number;
  access: Access;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Reads one stored entry, or nothing.
 *
 * Deliberately forgiving about everything except the two fields that make a
 * row useful. A corrupt index must cost you the rows that are broken, never
 * the page: this is the only record of these links, and refusing to render it
 * because one entry is malformed would be the worst possible response.
 */
function parse(value: unknown): SavedList | null {
  if (!isRecord(value)) return null;
  const { id, token } = value;
  if (typeof id !== 'string' || typeof token !== 'string') return null;
  if (!id || !token) return null;

  const text = (key: string, fallback: string) =>
    typeof value[key] === 'string' && value[key] ? (value[key] as string) : fallback;
  const count = (key: string) =>
    typeof value[key] === 'number' && Number.isFinite(value[key])
      ? Math.max(0, Math.trunc(value[key] as number))
      : 0;

  const now = new Date().toISOString();
  const openedAt = text('openedAt', now);
  const gone = value.gone;
  return {
    id,
    token,
    title: text('title', 'Untitled list'),
    done: count('done'),
    total: count('total'),
    access: (['read', 'write', 'admin', 'copy'] as const).includes(value.access as Access)
      ? (value.access as Access)
      : 'read',
    // An index written before this field existed still has an opened stamp,
    // and "added then" is a better guess than "added just now".
    addedAt: text('addedAt', openedAt),
    openedAt,
    favourite: value.favourite === true,
    gone: gone === 'rotated' || gone === 'deleted' || gone === 'invalid' ? gone : null,
  };
}

/** Everything about one entry except when it was last seen. */
function same(a: SavedList, b: Visit): boolean {
  return (
    a.token === b.token &&
    a.title === b.title &&
    a.done === b.done &&
    a.total === b.total &&
    a.access === b.access &&
    a.gone === null
  );
}

class Library {
  lists = $state<SavedList[]>([]);
  sort = $state<Sort>('opened');
  /** False until the browser has actually read storage, so rows can wait. */
  loaded = $state(false);

  #timer: ReturnType<typeof setTimeout> | null = null;
  #listening = false;

  /**
   * Reads the index. Safe to call from every page that wants it: the second
   * call is free, and the first one is the only place storage is touched
   * before a user does something.
   */
  load(): void {
    if (!browser || this.#listening) return;
    this.#listening = true;
    this.#read();
    this.loaded = true;

    // Two tabs are ordinary here — a list open in one, the index in the other —
    // and the one that did not write is the one holding the stale copy.
    window.addEventListener('storage', (event) => {
      if (event.key === KEY || event.key === SORT_KEY) this.#read();
    });
    // A tab can go away without ever running another timer.
    window.addEventListener('pagehide', () => this.#write());
  }

  get favourites(): SavedList[] {
    return this.#ordered().filter((list) => list.favourite);
  }

  get rest(): SavedList[] {
    return this.#ordered().filter((list) => !list.favourite);
  }

  byToken(token: string): SavedList | undefined {
    return this.lists.find((list) => list.token === token);
  }

  /**
   * Files an open list away, or brings what we know about it up to date.
   *
   * Called from an effect on the list page, so it runs on every change to an
   * open list and has to be silent when nothing has actually changed.
   */
  visit(entry: Visit): void {
    // Every way in reads first. The page that files a list away and the page
    // that shows the index are different pages, and a write that landed before
    // the read would overwrite the whole index with one row.
    this.load();
    const now = Date.now();
    const existing = this.lists.find((list) => list.id === entry.id);

    if (existing) {
      const stale = now - Date.parse(existing.openedAt) > TOUCH_MS;
      if (same(existing, entry) && !stale) return;
      this.#replace({
        ...existing,
        ...entry,
        openedAt: stale ? new Date(now).toISOString() : existing.openedAt,
        // It works, so whatever we thought had happened to the link did not.
        gone: null,
      });
      // A token that has changed is the one thing here that cannot wait: losing
      // it locks this browser out of a list it was just looking at.
      this.#persist(existing.token !== entry.token);
      return;
    }

    const stamp = new Date(now).toISOString();
    this.lists = [
      { ...entry, addedAt: stamp, openedAt: stamp, favourite: false, gone: null },
      ...this.lists,
    ];
    this.#persist(true);
  }

  setFavourite(id: string, favourite: boolean): void {
    this.load();
    const existing = this.lists.find((list) => list.id === id);
    if (!existing || existing.favourite === favourite) return;
    this.#replace({ ...existing, favourite });
    this.#persist(true);
  }

  /** Records that this link no longer works, so the row can say which way. */
  markGone(token: string, reason: Gone): void {
    this.load();
    const existing = this.byToken(token);
    if (!existing || existing.gone === reason) return;
    this.#replace({ ...existing, gone: reason });
    this.#persist(true);
  }

  /** Removes the list from this browser. The list itself is untouched. */
  forget(id: string): void {
    this.load();
    this.lists = this.lists.filter((list) => list.id !== id);
    this.#persist(true);
  }

  forgetAll(): void {
    this.lists = [];
    this.#persist(true);
  }

  setSort(sort: Sort): void {
    this.sort = sort;
    if (!browser) return;
    try {
      localStorage.setItem(SORT_KEY, sort);
    } catch {
      // Storage can be full or blocked outright. A sort order is not worth an
      // error, and the page works perfectly well without remembering it.
    }
  }

  #ordered(): SavedList[] {
    const key = this.sort === 'added' ? 'addedAt' : 'openedAt';
    return [...this.lists].sort((a, b) => b[key].localeCompare(a[key]));
  }

  #replace(list: SavedList): void {
    this.lists = this.lists.map((candidate) => (candidate.id === list.id ? list : candidate));
  }

  #read(): void {
    try {
      const raw = localStorage.getItem(KEY);
      const decoded: unknown = raw ? JSON.parse(raw) : [];
      this.lists = Array.isArray(decoded)
        ? decoded.map(parse).filter((list): list is SavedList => list !== null)
        : [];
      const sort = localStorage.getItem(SORT_KEY);
      if (sort === 'added' || sort === 'opened') this.sort = sort;
    } catch {
      // Unreadable, or storage is blocked. An empty index is wrong but usable;
      // a page that will not render is neither.
      this.lists = [];
    }
  }

  #persist(immediate: boolean): void {
    if (!browser) return;
    if (this.#timer) clearTimeout(this.#timer);
    if (immediate) {
      this.#timer = null;
      this.#write();
      return;
    }
    this.#timer = setTimeout(() => this.#write(), WRITE_DELAY);
  }

  #write(): void {
    if (!browser) return;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.lists));
    } catch {
      // Full, or blocked. Nothing here is worth breaking the page over, and
      // the lists themselves are on the server either way.
    }
  }
}

/**
 * One index per browser, so the list page filing something away and the page
 * showing the index are looking at the same thing without passing it around.
 */
export const library = new Library();
