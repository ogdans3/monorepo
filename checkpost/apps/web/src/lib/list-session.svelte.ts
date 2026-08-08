import type {
  Access,
  ChangeEvent,
  CopyPreview,
  Item,
  List,
  ServerFrame,
  Snapshot,
} from '@checkpost/contract';
import { allows } from '@checkpost/contract';
import { ApiError, OfflineError, api, clientId } from './api';
import { Realtime } from './realtime';

export type Status = 'loading' | 'ready' | 'offline' | 'gone' | 'invalid' | 'copy';

/** How long a ticked row holds its place before drifting to the done shelf. */
const SETTLE_MS = 400;
/** How long a change somebody else made stays highlighted. */
const WASH_MS = 900;

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

  #token = $state('');
  #realtime: Realtime | null = null;
  #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #stopped = false;
  #me = '';

  constructor(token: string) {
    this.#token = token;
  }

  get token() {
    return this.#token;
  }

  get openItems() {
    return this.items.filter((item) => !this.#showAsDone(item));
  }

  get doneItems() {
    return this.items.filter((item) => this.#showAsDone(item));
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
  }

  #onVisible = () => {
    if (document.visibilityState === 'visible') void this.reconcile();
  };

  async load() {
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

  /** Takes the copy and returns where it lives. */
  async takeCopy(): Promise<string> {
    const made = await api.takeCopy(this.#token);
    return `/l/${made.token}`;
  }

  #connect() {
    if (this.status === 'copy') return;
    this.#realtime?.stop();
    this.#realtime = new Realtime(
      this.#token,
      (frame) => this.#onFrame(frame),
      () => {
        if (this.status === 'offline') this.status = 'ready';
        // A fresh socket proves nothing about what happened while it was down.
        void this.reconcile();
      },
      () => {
        if (this.status === 'ready') this.status = 'offline';
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
        this.#applyEvent(frame.event, frame.event.actor !== this.#me);
        break;
      case 'revoked':
        this.status = 'gone';
        this.goneReason = frame.reason;
        break;
    }
  }

  async reconcile() {
    if (this.#stopped || !this.list) return;
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
      () => api.updateItem(this.#token, item.id, { checked: next }),
      (fresh) => this.#replace(fresh),
      () => this.#replace(item),
    );
  }

  async add(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !this.list) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
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
      createdAt: now,
      updatedAt: now,
    };
    this.items = [...this.items, optimistic];

    await this.#write(
      () => api.createItem(this.#token, id, trimmed),
      (fresh) => this.#replace(fresh),
      () => this.#remove(id),
    );
  }

  async edit(item: Item, patch: { text?: string; note?: string }) {
    const text = patch.text?.trim();
    if (patch.text !== undefined && !text) return;
    this.#replace({ ...item, ...(text ? { text } : {}), ...(patch.note !== undefined ? { note: patch.note } : {}) });
    await this.#write(
      () => api.updateItem(this.#token, item.id, { ...(text ? { text } : {}), ...(patch.note !== undefined ? { note: patch.note } : {}) }),
      (fresh) => this.#replace(fresh),
      () => this.#replace(item),
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

  /** Replaces the link this tab is holding. Other links carry on. */
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
    this.access = snapshot.access;
  }

  #applyEvent(event: ChangeEvent, remote: boolean) {
    if (this.list && event.revision > this.list.revision) {
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
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    this.#realtime?.stop();
  }
}
