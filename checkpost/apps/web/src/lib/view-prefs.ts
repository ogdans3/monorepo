/**
 * How this browser likes to look at each list: whether the done shelf is folded
 * away, and whether the rows are grouped by tag.
 *
 * A view, not the list. Nobody else on the list sees it or is changed by it, so
 * it lives here rather than on the server, and it is remembered per list
 * because one list is a shop you want grouped by aisle and another is a packing
 * list you want in your own order.
 *
 * Its own key rather than a field on `library.svelte.ts`. That index holds the
 * share tokens, and CLAUDE.md is plain about what goes wrong when something
 * reads it and writes it in the same breath. Two booleans are not worth the
 * risk. The tag filter is deliberately not here: a filter left on and forgotten
 * hides rows, which is the one thing a shared list must never do quietly.
 */
export interface ViewPrefs {
  doneFolded: boolean;
  byTag: boolean;
}

const KEY = 'checkpost.view.v1';
/** Enough for every list anyone keeps, bounded so a key cannot grow for ever. */
const KEEP = 200;

interface Stored {
  f?: 1;
  t?: 1;
  /** When it was last written, so the oldest go first. */
  at: number;
}

function load(): Record<string, Stored> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Stored>) : {};
  } catch {
    // Storage switched off, full, or holding something we did not write.
    return {};
  }
}

export function readViewPrefs(listId: string): ViewPrefs {
  const entry = load()[listId];
  return { doneFolded: entry?.f === 1, byTag: entry?.t === 1 };
}

export function writeViewPrefs(listId: string, prefs: ViewPrefs): void {
  const all = load();
  if (!prefs.doneFolded && !prefs.byTag) {
    // The default is what an absent entry already means.
    delete all[listId];
  } else {
    all[listId] = { ...(prefs.doneFolded ? { f: 1 } : {}), ...(prefs.byTag ? { t: 1 } : {}), at: Date.now() };
  }
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Not remembering a view is not worth telling anyone about.
  }
}
