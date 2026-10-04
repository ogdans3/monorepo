import type {
  Access,
  ChangeEvent,
  CopyPreview,
  Item,
  List,
  ServerFrame,
  Snapshot,
  Tag,
  TagColor,
} from '@checkpost/contract';
import { LIMITS, allows, compareTags, nextTagColor, tagKey } from '@checkpost/contract';
import { ApiError, OfflineError, api, clientId } from './api';
import { Realtime } from './realtime';
import { readViewPrefs, writeViewPrefs } from './view-prefs';

export type Status = 'loading' | 'ready' | 'offline' | 'gone' | 'invalid' | 'copy';

/** Open rows under one tag's heading, or under no tag at all. */
export interface TagGroup {
  tag: Tag | null;
  items: Item[];
}

/** Trimmed and folded the way the API stores a name. */
const cleanTagName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, LIMITS.tagName);

/** How long a ticked row holds its place before drifting to the done shelf. */
const SETTLE_MS = 400;
/** How long a change somebody else made stays highlighted. */
const WASH_MS = 900;
/**
 * The most often the screen is allowed to move for a change from elsewhere.
 *
 * Two people working through a list, or one finger tapping a box on and off,
 * arrive here as a burst of frames, and redrawing on every one of them makes
 * the screen twitch for as long as the burst lasts. The first change after a
 * quiet moment still lands at once, because that is the one being waited for.
 * Anything following within the second is collected and folded in together.
 */
const FOLD_MS = 1000;
/**
 * How often an open list asks what it missed.
 *
 * The socket is the fast path and not the only one, because a socket can stop
 * working without anything saying so. This is the floor under it, and it is
 * close to free: the usual answer is "nothing since your revision", which the
 * API gives from a number it already has without reading the list.
 */
const POLL_MS = 15_000;

/**
 * One open list, and the same rules the Flutter client follows.
 *
 * Every edit lands on local state first and is sent afterwards. A refusal is
 * undone and said out loud. Being merely offline keeps the edit, because it is
 * still true in this tab, and reconcile settles it when the network is back.
 * Those are different failures and are not treated the same.
 */
export class ListSession {
  list = $state<List | null>(null);
  items = $state<Item[]>([]);
  /** The list's tags, in the order they were made. Show them as `sortedTags`. */
  tags = $state<Tag[]>([]);
  status = $state<Status>('loading');
  goneReason = $state<'rotated' | 'deleted' | null>(null);
  presence = $state(1);
  message = $state<string | null>(null);

  /** What this link may do. Assume the least until the server says otherwise. */
  access = $state<Access>('read');
  /** Set when the link turns out to be a template rather than a way in. */
  copy = $state<CopyPreview | null>(null);

  /** Ids whose move to the done shelf is deferred, so a tick stays visible. */
  settling = $state<string[]>([]);
  /** Ids somebody else changed recently, highlighted so the change is visible. */
  washing = $state<string[]>([]);

  /**
   * The tags the rows are filtered by, empty for every row. Several means rows
   * with any of them. This tab's view of the list and nobody else's, and never
   * written down: a filter left on and forgotten hides rows, which is the one
   * thing a shared list must not do quietly.
   */
  filter = $state<string[]>([]);
  /** Open rows under their tags' headings rather than in the list's own order. */
  byTag = $state(false);
  /** The done shelf folded down to its heading. */
  doneFolded = $state(false);
  /** The list the two view settings above were read for. */
  #viewFor: string | null = null;

  /** The one order tags are shown in: chips, filters, groups and the sheet. */
  readonly sortedTags = $derived([...this.tags].sort(compareTags));
  /**
   * The order a drag has put the open items in, before the server has said
   * what their real positions are.
   *
   * An override rather than invented positions, and deliberately so. Positions
   * are fractional indices, the algorithm for making one lives in the API and
   * the Flutter app, and CLAUDE.md says those two copies are the only two. A
   * third one here to guess at a placeholder would be a third copy to keep
   * byte-identical. This holds ids instead and is dropped the moment the real
   * positions land.
   */
  #pendingOrder = $state<string[] | null>(null);

  #token = $state('');
  /**
   * The landing page's list, which is the same list for everybody and takes
   * exactly one kind of change. See `DemoService` on the API side.
   */
  #demo = false;
  /** Guards the one thing a demo session does that an ordinary one cannot. */
  #reopening = false;
  #realtime: Realtime | null = null;
  /** Bumped on every connect, so a superseded socket's frames are ignored. */
  #generation = 0;
  #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #poll: ReturnType<typeof setInterval> | null = null;
  #stopped = false;
  #me = '';

  /** Changes that have arrived and are waiting for the next fold. */
  #incoming: ChangeEvent[] = [];
  /** The earliest moment the next fold may happen. */
  #foldAt = 0;

  constructor(token: string, options: { demo?: boolean } = {}) {
    this.#token = token;
    this.#demo = options.demo ?? false;
  }

  get token() {
    return this.#token;
  }

  get openItems() {
    const open = this.items.filter((item) => !this.#showAsDone(item));
    const pending = this.#pendingOrder;
    if (!pending) return open;
    // Anything that arrived mid-drag is not in the pending order, and goes
    // where its position says: at the end, since that is where an append lands.
    const known = new Set(pending);
    const byId = new Map(open.map((item) => [item.id, item]));
    return [
      ...pending.map((id) => byId.get(id)).filter((item): item is Item => Boolean(item)),
      ...open.filter((item) => !known.has(item.id)),
    ];
  }

  get doneItems() {
    return this.items.filter((item) => this.#showAsDone(item));
  }

  get filtering() {
    return this.filter.length > 0;
  }

  /** The filter's tags, in display order. */
  get filterTags() {
    return this.sortedTags.filter((tag) => this.filter.includes(tag.id));
  }

  /** The open rows the filter lets through, in the list's own order. */
  get visibleOpen() {
    return this.openItems.filter((item) => this.#passes(item));
  }

  /** The done rows the filter lets through. The shelf's count follows these. */
  get visibleDone() {
    return this.doneItems.filter((item) => this.#passes(item));
  }

  /**
   * The open rows under one heading per tag, in tag order, for the By tag view.
   *
   * A row sits under the first of its tags rather than under each of them. Two
   * copies of one row would be two boxes to tick for one thing, and ticking one
   * would move the other. Rows with no tag come last, under no heading's tag.
   * Within a group the list's own order holds.
   */
  get groups(): TagGroup[] {
    const order = this.sortedTags;
    const rank = new Map(order.map((tag, index) => [tag.id, index]));
    const buckets = new Map<string | null, Item[]>();
    for (const item of this.visibleOpen) {
      let first: string | null = null;
      let best = Infinity;
      for (const id of item.tagIds) {
        const at = rank.get(id);
        if (at !== undefined && at < best) {
          best = at;
          first = id;
        }
      }
      const bucket = buckets.get(first);
      if (bucket) bucket.push(item);
      else buckets.set(first, [item]);
    }
    const groups: TagGroup[] = order
      .filter((tag) => buckets.has(tag.id))
      .map((tag) => ({ tag, items: buckets.get(tag.id)! }));
    const untagged = buckets.get(null);
    if (untagged) groups.push({ tag: null, items: untagged });
    return groups;
  }

  /** A row's tags in display order, leaving out any the list no longer has. */
  tagsOf(item: Item): Tag[] {
    if (item.tagIds.length === 0) return [];
    const mine = new Set(item.tagIds);
    return this.sortedTags.filter((tag) => mine.has(tag.id));
  }

  /** How many rows wear a tag, for the Tags sheet and its confirm. */
  rowsWith(tagId: string) {
    return this.items.filter((item) => item.tagIds.includes(tagId)).length;
  }

  #passes(item: Item) {
    const filter = this.filter;
    return filter.length === 0 || item.tagIds.some((id) => filter.includes(id));
  }

  get doneCount() {
    return this.items.filter((item) => item.checked).length;
  }

  get canWrite() {
    return allows(this.access, 'write');
  }

  get canAdmin() {
    return allows(this.access, 'admin');
  }

  isWashing(id: string) {
    return this.washing.includes(id);
  }

  /** A just-toggled row keeps its old section until the grace period expires. */
  #showAsDone(item: Item) {
    return this.settling.includes(item.id) ? !item.checked : item.checked;
  }

  // ---------------------------------------------------------------------------

  async open() {
    this.#me = clientId();
    await this.load();
    if (this.status === 'ready' || this.status === 'offline') this.#connect();

    // Coming back to a backgrounded tab is exactly when the socket is most
    // likely to have died quietly, so this is where we ask what we missed.
    document.addEventListener('visibilitychange', this.#onVisible);

    // And while the list is being watched, ask anyway.
    //
    // `Realtime` notices a socket that has gone silent, but not for the best
    // part of a minute, and a list somebody is looking at should not be able
    // to be that far behind. This is the beat that bounds it. It runs only
    // while the tab is visible: a backgrounded one has the line above.
    this.#poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (this.status !== 'ready' && this.status !== 'offline') return;
      void this.reconcile();
    }, POLL_MS);
  }

  #onVisible = () => {
    if (document.visibilityState === 'visible') void this.reconcile();
  };

  async load() {
    if (this.#demo) return this.#openDemo(false);
    try {
      this.#apply(await api.snapshot(this.#token));
      this.status = 'ready';
    } catch (error) {
      if (error instanceof ApiError && error.isCopyLink) {
        // Not a failure. This link makes copies, so find out what of.
        await this.#loadCopyPreview();
        return;
      }
      this.#handle(error);
    }
  }

  async #loadCopyPreview() {
    try {
      this.copy = await api.copyPreview(this.#token);
      this.status = 'copy';
    } catch (error) {
      this.#handle(error);
    }
  }

  /**
   * Puts this session on the landing page's list, whatever link it is on today.
   *
   * The demo's link is reissued every time the API restarts, because only the
   * hash of a token is ever stored and so no raw one survives to be handed out
   * again. A page left open across a deploy is therefore holding a link that
   * has just been retired, and the right answer for somebody who came to read
   * about the product is to quietly ask for the current one — not to show them
   * the dead end an ordinary list would.
   */
  async #openDemo(reconnect: boolean): Promise<void> {
    if (this.#reopening || this.#stopped) return;
    this.#reopening = true;
    try {
      const intro = await api.demo();
      if (this.#stopped) return;
      this.#token = intro.token;
      this.#apply(intro.snapshot);
      this.status = 'ready';
      this.goneReason = null;
      if (reconnect) this.#connect();
    } catch (error) {
      if (error instanceof OfflineError) this.status = 'offline';
      // Anything else leaves what is on screen and waits for the next poll.
      // The landing page showing a slightly stale list is not worth an error.
    } finally {
      this.#reopening = false;
    }
  }

  /** Takes the copy and returns where it lives. */
  async takeCopy(): Promise<string> {
    const made = await api.takeCopy(this.#token);
    return `/l/${made.token}`;
  }

  #connect() {
    if (this.status === 'copy') return;
    this.#realtime?.stop();
    // Every callback checks it is still the live socket before it speaks.
    //
    // Rotation is why. The server evicts everyone on the link it retires, and
    // it cannot tell this tab from anyone else holding that token, so the
    // socket being replaced here has just been sent `revoked`. Acting on that
    // would put the one tab that *does* have the new link on the "this link
    // was replaced" dead end.
    const generation = ++this.#generation;
    const live = () => this.#generation === generation;
    this.#realtime = new Realtime(
      this.#token,
      (frame) => {
        if (live()) this.#onFrame(frame);
      },
      () => {
        if (!live()) return;
        if (this.status === 'offline') this.status = 'ready';
        // A fresh socket proves nothing about what happened while it was down.
        void this.reconcile();
      },
      () => {
        if (!live()) return;
        // A socket that goes is not by itself evidence of being offline. It
        // happens on a perfectly good network — a phone changing cell, a proxy
        // giving up on an idle connection, the watchdog above retiring one that
        // went quiet — and the banner is about whether this device can reach
        // the list at all. So ask, and let the answer say it: `reconcile` marks
        // us offline when the request cannot leave the device, and clears it
        // when one lands. Saying it on the drop alone made the banner flash on
        // every reconnect.
        if (this.list) void this.reconcile();
        else if (this.status === 'ready') this.status = 'offline';
      },
    );
    this.#realtime.start();
  }

  #onFrame(frame: ServerFrame) {
    switch (frame.type) {
      case 'hello':
        this.presence = frame.presence;
        if (this.list && frame.revision > this.list.revision) void this.reconcile();
        break;
      case 'presence':
        this.presence = frame.presence;
        break;
      case 'change':
        this.#collect(frame.event);
        break;
      case 'revoked':
        if (this.#demo) {
          void this.#openDemo(true);
          break;
        }
        this.status = 'gone';
        this.goneReason = frame.reason;
        break;
    }
  }

  async reconcile() {
    if (this.#stopped || !this.list) return;
    // Anything already in hand is applied before asking for more, so that the
    // revision we ask from is the one we have actually caught up to.
    this.#fold();
    try {
      const changes = await api.changesSince(this.#token, this.list.revision);
      if (changes.kind === 'resync') {
        this.#apply(changes.snapshot);
      } else {
        for (const event of changes.events) {
          this.#applyEvent(event, event.actor !== this.#me);
        }
      }
      if (this.status === 'offline') this.status = 'ready';
    } catch (error) {
      this.#handle(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Writes
  // ---------------------------------------------------------------------------

  async toggle(item: Item) {
    const next = !item.checked;
    this.#replace({ ...item, checked: next, checkedAt: next ? new Date().toISOString() : null });
    this.#hold(item.id);
    await this.#write(
      () =>
        this.#demo
          ? api.demoTick(item.id, next)
          : api.updateItem(this.#token, item.id, { checked: next }),
      (fresh) => this.#replace(fresh),
      () => this.#replace(item),
    );
  }

  async add(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !this.list) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Looking at the list through a tag filter, a new row takes the filter's
    // tags. Otherwise it would vanish from the view the moment it landed, and
    // look lost rather than added.
    const tagIds = this.filterTags.map((tag) => tag.id).slice(0, LIMITS.tagsPerItem);
    const optimistic: Item = {
      id,
      listId: this.list.id,
      text: trimmed,
      note: '',
      checked: false,
      checkedAt: null,
      // A sort-last sentinel. Real positions are base62, so nothing can sort
      // above a '~', and the server's answer replaces this before it matters.
      // The client never sends a position, so this string never leaves the tab.
      position: `${this.items.at(-1)?.position ?? 'a0'}~`,
      tagIds,
      createdAt: now,
      updatedAt: now,
    };
    this.items = [...this.items, optimistic];

    await this.#write(
      () => api.createItem(this.#token, id, trimmed, tagIds),
      (fresh) => this.#replace(fresh),
      () => this.#remove(id),
    );
  }

  /**
   * Move an item to a new place among the unchecked ones.
   *
   * The client cannot work out the new position itself, because a position is
   * a fractional index and that algorithm lives in the API. So it sends the
   * neighbours and lets the server answer with the real key, holding the new
   * arrangement in `#pendingOrder` in the meantime. That is what makes a drag
   * feel like it landed rather than like it was submitted.
   *
   * Only the open items reorder. The done shelf is ordered by the fact of
   * being done, and arranging it would be arranging a pile already finished
   * with.
   */
  async move(item: Item, toIndex: number) {
    // Indices are into what is on screen, which under a tag filter is not the
    // whole list.
    const shown = this.visibleOpen;
    const from = shown.findIndex((candidate) => candidate.id === item.id);
    const to = Math.max(0, Math.min(shown.length - 1, toIndex));
    if (from < 0 || from === to) return;

    const reordered = [...shown];
    reordered.splice(to, 0, ...reordered.splice(from, 1));

    // The neighbours in the new arrangement, not the old one. Naming the item
    // it used to sit after would put it straight back where it started.
    const before = reordered[to - 1];
    const after = reordered[to + 1];
    const patch = before ? { afterId: before.id } : { beforeId: after?.id ?? null };

    // The whole open list as the server is about to have it: straight after the
    // neighbour it was dropped below, or straight before the one it was dropped
    // above, wherever the rows the filter is hiding happen to be. Without a
    // filter this is exactly the arrangement on screen.
    const order = this.openItems.map((candidate) => candidate.id).filter((id) => id !== item.id);
    const at = before ? order.indexOf(before.id) + 1 : after ? order.indexOf(after.id) : 0;
    order.splice(Math.max(0, at), 0, item.id);
    this.#pendingOrder = order;

    await this.#write(
      () => api.updateItem(this.#token, item.id, patch),
      (fresh) => {
        // The real fractional index has landed, so sorting by position now
        // produces the arrangement the drag asked for and the override has
        // nothing left to say.
        this.#replace(fresh);
        this.#pendingOrder = null;
      },
      () => {
        this.#pendingOrder = null;
      },
    );
  }

  /** One place up or down, for the sheet's buttons and for a keyboard. */
  async step(item: Item, direction: -1 | 1) {
    const at = this.visibleOpen.findIndex((candidate) => candidate.id === item.id);
    if (at < 0) return;
    await this.move(item, at + direction);
  }

  async edit(item: Item, patch: { text?: string; note?: string }) {
    const text = patch.text?.trim();
    if (patch.text !== undefined && !text) return;
    const change = { ...(text ? { text } : {}), ...(patch.note !== undefined ? { note: patch.note } : {}) };
    // Nothing changed is nothing to send: the server refuses an empty update.
    if (Object.keys(change).length === 0) return;
    // Written over the row as it is now, not as the sheet saw it when it
    // opened. A tag tapped on in the sheet has landed since, and writing the
    // old row back would take it off again.
    const before = this.items.find((candidate) => candidate.id === item.id) ?? item;
    this.#replace({ ...before, ...change });
    await this.#write(
      () => api.updateItem(this.#token, item.id, change),
      (fresh) => this.#replace(fresh),
      () => {
        // Only what this edit changed goes back.
        const now = this.items.find((candidate) => candidate.id === item.id);
        if (now) this.#replace({ ...now, text: before.text, note: before.note });
      },
    );
  }

  async remove(item: Item) {
    const index = this.items.findIndex((candidate) => candidate.id === item.id);
    this.#remove(item.id);
    await this.#write(
      () => api.deleteItem(this.#token, item.id),
      undefined,
      () => {
        // Put it back where it was, not at the end.
        const restored = [...this.items];
        restored.splice(Math.max(0, index), 0, item);
        this.items = this.#sorted(restored);
      },
    );
  }

  async rename(title: string) {
    const trimmed = title.trim();
    const previous = this.list;
    if (!previous || !trimmed || trimmed === previous.title) return;
    this.list = { ...previous, title: trimmed };
    await this.#write(
      () => api.renameList(this.#token, trimmed),
      (fresh) => (this.list = fresh),
      () => (this.list = previous),
    );
  }

  async clearChecked() {
    const previous = this.items;
    if (!this.doneCount) return;
    this.items = this.items.filter((item) => !item.checked);
    await this.#write(
      () => api.clearChecked(this.#token),
      undefined,
      () => (this.items = previous),
    );
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------

  /** Puts a tag on a row or takes it off, at a tap, like a tick. */
  async toggleItemTag(item: Item, tagId: string) {
    const row = this.items.find((candidate) => candidate.id === item.id);
    if (!row) return;
    const on = row.tagIds.includes(tagId);
    if (!on && row.tagIds.length >= LIMITS.tagsPerItem) {
      this.message = `A row holds ${LIMITS.tagsPerItem} tags.`;
      return;
    }
    const next = on ? row.tagIds.filter((id) => id !== tagId) : [...row.tagIds, tagId];
    await this.#sendItemTags({ ...row, tagIds: next }, row);
  }

  /**
   * Puts a tag on a row by name: the one the list already has by that name, or
   * a new one.
   *
   * A new tag shows on the row at once, but the row is only told about it once
   * the server has said which id the tag goes by. Somebody else may have made
   * the same name a moment earlier, in which case the answer is their tag, and
   * a row sent with this tab's id would be sent with an id the list does not
   * have, and quietly come back untagged.
   */
  async tagRowByName(item: Item, name: string) {
    const clean = cleanTagName(name);
    const row = this.items.find((candidate) => candidate.id === item.id);
    if (!clean || !row) return;

    const known = this.tags.find((tag) => tagKey(tag.name) === tagKey(clean));
    if (known) {
      if (!row.tagIds.includes(known.id)) await this.toggleItemTag(row, known.id);
      return;
    }
    if (row.tagIds.length >= LIMITS.tagsPerItem) {
      this.message = `A row holds ${LIMITS.tagsPerItem} tags.`;
      return;
    }

    // `createTag` puts its optimistic tag in place before its first await, so
    // it is already there to put on the row.
    const made = this.createTag(clean);
    const draft = this.tags.find((tag) => tagKey(tag.name) === tagKey(clean));
    if (draft) this.#replace({ ...row, tagIds: [...row.tagIds, draft.id] });

    const tag = await made;
    const now = this.items.find((candidate) => candidate.id === item.id);
    if (!now) return;
    if (!tag) {
      if (draft) this.#replace({ ...now, tagIds: now.tagIds.filter((id) => id !== draft.id) });
      return;
    }
    // By now the row carries the server's id for the tag, whichever it was.
    await this.#sendItemTags(now, { ...now, tagIds: now.tagIds.filter((id) => id !== tag.id) });
  }

  /**
   * Makes a tag, or finds the one the list already has by that name. Resolves
   * with the tag to use, under the id the server knows it by, or null when
   * there is no tag to use.
   */
  async createTag(name: string, color?: TagColor): Promise<Tag | null> {
    const clean = cleanTagName(name);
    if (!clean || !this.list) return null;
    const known = this.tags.find((tag) => tagKey(tag.name) === tagKey(clean));
    if (known) return known;
    if (this.tags.length >= LIMITS.tagsPerList) {
      this.message = `This list holds ${LIMITS.tagsPerList} tags. Delete one in Edit tags to make room.`;
      return null;
    }

    const now = new Date().toISOString();
    const draft: Tag = {
      id: crypto.randomUUID(),
      listId: this.list.id,
      name: clean,
      // Worked out here and sent, so the chip has its colour before the server
      // has answered and keeps it when it does.
      color: color ?? nextTagColor(this.tags.map((tag) => tag.color)),
      createdAt: now,
      updatedAt: now,
    };
    this.tags = [...this.tags, draft];

    let settled: Tag | null = null;
    let refused = false;
    await this.#write(
      () => api.createTag(this.#token, { id: draft.id, name: draft.name, color: draft.color }),
      (fresh) => {
        settled = fresh;
        this.#settleTag(draft.id, fresh);
      },
      () => {
        refused = true;
        this.#dropTag(draft.id);
      },
    );
    if (refused) return null;
    // Offline keeps the draft, the same as every other edit made offline.
    return settled ?? draft;
  }

  /** Renames a tag. False, having said why, when another tag has that name. */
  async renameTag(tag: Tag, name: string): Promise<boolean> {
    const clean = cleanTagName(name);
    if (!clean || clean === tag.name) return true;
    const clash = this.tags.find((other) => other.id !== tag.id && tagKey(other.name) === tagKey(clean));
    if (clash) {
      this.message = `There is already a tag called “${clash.name}”.`;
      return false;
    }
    await this.#updateTag(tag, { name: clean });
    return true;
  }

  async recolorTag(tag: Tag, color: TagColor) {
    if (tag.color === color) return;
    await this.#updateTag(tag, { color });
  }

  /** Deletes a tag for everyone, and takes it off every row that wore it. */
  async deleteTag(tag: Tag) {
    const wore = this.items.filter((item) => item.tagIds.includes(tag.id)).map((item) => item.id);
    this.#dropTag(tag.id);
    await this.#write(
      () => api.deleteTag(this.#token, tag.id),
      undefined,
      () => {
        // Put back exactly what went: the tag, and its id on the rows that are
        // still here. Anything else that changed in the meantime stays changed.
        this.#upsertTag(tag);
        const back = new Set(wore);
        this.items = this.items.map((item) =>
          back.has(item.id) && !item.tagIds.includes(tag.id)
            ? { ...item, tagIds: [...item.tagIds, tag.id] }
            : item,
        );
      },
    );
  }

  toggleFilter(tagId: string) {
    this.filter = this.filter.includes(tagId)
      ? this.filter.filter((id) => id !== tagId)
      : [...this.filter, tagId];
  }

  clearFilter() {
    this.filter = [];
  }

  setByTag(on: boolean) {
    this.byTag = on;
    this.#saveView();
  }

  setDoneFolded(on: boolean) {
    this.doneFolded = on;
    this.#saveView();
  }

  async #updateTag(tag: Tag, patch: { name?: string; color?: TagColor }) {
    const before = this.tags.find((candidate) => candidate.id === tag.id) ?? tag;
    this.#upsertTag({ ...before, ...patch });
    await this.#write(
      () => api.updateTag(this.#token, tag.id, patch),
      (fresh) => this.#upsertTag(fresh),
      () => this.#upsertTag(before),
    );
  }

  async #sendItemTags(next: Item, before: Item) {
    this.#replace(next);
    await this.#write(
      () => api.updateItem(this.#token, next.id, { tagIds: next.tagIds }),
      (fresh) => this.#replace(fresh),
      () => {
        const row = this.items.find((candidate) => candidate.id === next.id);
        if (row) this.#replace({ ...row, tagIds: before.tagIds });
      },
    );
  }

  /**
   * The server's answer to a create. Usually the draft itself, confirmed. When
   * the list already had the name under another id, the draft goes and the
   * rows this tab tagged with it move to the tag that was there.
   */
  #settleTag(draftId: string, fresh: Tag) {
    this.tags = [...this.tags.filter((tag) => tag.id !== draftId && tag.id !== fresh.id), fresh];
    if (draftId === fresh.id) return;
    const swap = (ids: string[]) => [...new Set(ids.map((id) => (id === draftId ? fresh.id : id)))];
    this.items = this.items.map((item) =>
      item.tagIds.includes(draftId) ? { ...item, tagIds: swap(item.tagIds) } : item,
    );
    if (this.filter.includes(draftId)) this.filter = swap(this.filter);
  }

  #upsertTag(tag: Tag) {
    const index = this.tags.findIndex((candidate) => candidate.id === tag.id);
    if (index === -1) {
      this.tags = [...this.tags, tag];
      return;
    }
    const next = [...this.tags];
    next[index] = tag;
    this.tags = next;
  }

  /** A tag gone, from the list, from every row, and from the filter. */
  #dropTag(id: string) {
    this.tags = this.tags.filter((tag) => tag.id !== id);
    this.items = this.items.map((item) =>
      item.tagIds.includes(id) ? { ...item, tagIds: item.tagIds.filter((tagId) => tagId !== id) } : item,
    );
    if (this.filter.includes(id)) this.filter = this.filter.filter((tagId) => tagId !== id);
  }

  /** Reads how this browser last looked at the list, once per list. */
  #loadView(listId: string) {
    if (this.#viewFor === listId) return;
    this.#viewFor = listId;
    if (this.#demo) return;
    const prefs = readViewPrefs(listId);
    this.byTag = prefs.byTag;
    this.doneFolded = prefs.doneFolded;
  }

  #saveView() {
    if (!this.list || this.#demo) return;
    writeViewPrefs(this.list.id, { byTag: this.byTag, doneFolded: this.doneFolded });
  }

  links() {
    return api.links(this.#token);
  }

  async createLink(access: Access, label: string) {
    const made = await api.createLink(this.#token, access, label);
    return { url: made.url, access: made.link.access };
  }

  revokeLink(linkId: string) {
    return api.revokeLink(this.#token, linkId);
  }

  /**
   * Replaces the link this tab is holding. Other links carry on.
   *
   * The order below is load-bearing. The server evicts the old socket while
   * this request is in flight, so a `revoked` frame can land before the
   * response does and set the status to `gone`; clearing it afterwards is what
   * undoes that, and `#connect` then retires the generation that sent it. The
   * caller is expected to put the new token in the address bar — this object
   * holds it, the URL does not, and a refresh reads the URL.
   */
  async rotate(): Promise<string> {
    const rotated = await api.rotateLink(this.#token);
    this.#token = rotated.token;
    this.status = 'ready';
    this.goneReason = null;
    this.#connect();
    return rotated.url;
  }

  async deleteList() {
    await api.deleteList(this.#token);
    this.status = 'gone';
    this.goneReason = 'deleted';
  }

  // ---------------------------------------------------------------------------

  async #write<T>(
    send: () => Promise<T>,
    onResult?: (result: T) => void,
    onFailure?: () => void,
  ) {
    try {
      const result = await send();
      if (this.#stopped) return;
      onResult?.(result);
      if (this.status === 'offline') this.status = 'ready';
    } catch (error) {
      if (this.#stopped) return;
      if (error instanceof OfflineError) {
        // The edit is still true in this tab. Reconcile settles it later.
        this.status = 'offline';
        return;
      }
      onFailure?.();
      this.#handle(error);
    }
  }

  #handle(error: unknown) {
    if (error instanceof OfflineError) {
      this.status = 'offline';
      return;
    }
    if (error instanceof ApiError) {
      // The demo's link goes stale by design rather than by accident.
      if (this.#demo && (error.isGone || error.isInvalidLink)) {
        void this.#openDemo(true);
        return;
      }
      if (error.isGone) {
        this.status = 'gone';
        this.goneReason ??= 'rotated';
      } else if (error.isInvalidLink) {
        this.status = 'invalid';
      } else {
        this.message = error.message;
      }
      return;
    }
    this.message = 'Something broke on our side. Try again.';
  }

  #apply(snapshot: Snapshot) {
    this.list = snapshot.list;
    this.items = this.#sorted(snapshot.items);
    // `?? []` for the moment a deploy is rolling: an API from before tags
    // answers without them, and a list with no tags is exactly what that is.
    this.tags = snapshot.tags ?? [];
    this.access = snapshot.access;
    const known = new Set(this.tags.map((tag) => tag.id));
    if (this.filter.some((id) => !known.has(id))) this.filter = this.filter.filter((id) => known.has(id));
    this.#loadView(snapshot.list.id);
  }

  /**
   * Takes a change off the socket and decides when to show it.
   *
   * Leading edge, then a trailing fold: the first arrival after a quiet moment
   * is applied immediately, and a burst behind it is collected and applied in
   * one go a beat later. Nothing is dropped and the order is kept, so the fold
   * is only ever about how often the screen moves.
   */
  #collect(event: ChangeEvent) {
    this.#incoming.push(event);
    const now = Date.now();
    // A list that has just been deleted has nothing to wait for.
    if (event.type === 'list.deleted' || now >= this.#foldAt) {
      this.#fold();
      return;
    }
    this.#restart('fold', this.#foldAt - now, () => this.#fold());
  }

  #fold() {
    const pending = this.#timers.get('fold');
    if (pending) {
      clearTimeout(pending);
      this.#timers.delete('fold');
    }
    // Only a fold that had something to show starts a new quiet window. A
    // reconcile draining an empty queue must not delay the next arrival.
    if (!this.#incoming.length) return;
    this.#foldAt = Date.now() + FOLD_MS;
    const events = this.#incoming;
    this.#incoming = [];
    for (const event of events) this.#applyEvent(event, event.actor !== this.#me);
  }

  #applyEvent(event: ChangeEvent, remote: boolean) {
    if (this.list) {
      // Already seen. Revisions are one per change and strictly increasing, so
      // anything at or below where the list has reached has been applied
      // already, by an earlier frame or by a reconcile that overtook it. This
      // is what makes holding events back safe: a reconcile can pass the queue
      // at any moment, and what it leaves behind is dropped rather than
      // replayed over the top of a newer answer.
      if (event.revision <= this.list.revision) return;
      this.list = { ...this.list, revision: event.revision };
    }
    switch (event.type) {
      case 'list.updated': {
        const title = event.data.title as string | undefined;
        if (title && this.list) this.list = { ...this.list, title };
        break;
      }
      case 'item.created':
      case 'item.updated': {
        const item = event.data.item as Item | undefined;
        if (!item) break;
        this.#replace(item);
        if (remote) this.#wash(item.id);
        break;
      }
      case 'item.deleted': {
        const one = event.data.id as string | undefined;
        const many = event.data.ids as string[] | undefined;
        if (one) this.#remove(one);
        for (const id of many ?? []) this.#remove(id);
        break;
      }
      case 'tag.created':
      case 'tag.updated': {
        const tag = event.data.tag as Tag | undefined;
        if (tag) this.#upsertTag(tag);
        break;
      }
      case 'tag.deleted': {
        // The server has taken it off every row already, and says so once
        // rather than once per row. Taking it off ours locally is the same end.
        const id = event.data.id as string | undefined;
        if (id) this.#dropTag(id);
        break;
      }
      case 'list.deleted':
        this.status = 'gone';
        this.goneReason = 'deleted';
        break;
    }
  }

  #replace(item: Item) {
    const index = this.items.findIndex((candidate) => candidate.id === item.id);
    if (index === -1) {
      this.items = this.#sorted([...this.items, item]);
      return;
    }
    const next = [...this.items];
    next[index] = item;
    this.items = this.#sorted(next);
  }

  #remove(id: string) {
    this.items = this.items.filter((item) => item.id !== id);
    this.settling = this.settling.filter((candidate) => candidate !== id);
    this.washing = this.washing.filter((candidate) => candidate !== id);
    const timer = this.#timers.get(id);
    if (timer) clearTimeout(timer);
    this.#timers.delete(id);
  }

  #hold(id: string) {
    if (!this.settling.includes(id)) this.settling = [...this.settling, id];
    this.#restart(`settle:${id}`, SETTLE_MS, () => {
      this.settling = this.settling.filter((candidate) => candidate !== id);
    });
  }

  #wash(id: string) {
    if (!this.washing.includes(id)) this.washing = [...this.washing, id];
    this.#restart(`wash:${id}`, WASH_MS, () => {
      this.washing = this.washing.filter((candidate) => candidate !== id);
    });
  }

  #restart(key: string, ms: number, run: () => void) {
    const existing = this.#timers.get(key);
    if (existing) clearTimeout(existing);
    this.#timers.set(
      key,
      setTimeout(() => {
        this.#timers.delete(key);
        run();
      }, ms),
    );
  }

  /** Byte-wise, exactly like the server's `COLLATE "C"` index. */
  #sorted(items: Item[]) {
    return [...items].sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
  }

  stop() {
    this.#stopped = true;
    document.removeEventListener('visibilitychange', this.#onVisible);
    if (this.#poll) clearInterval(this.#poll);
    this.#poll = null;
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    this.#realtime?.stop();
  }
}
