import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import type { ChangesResponse, ShareLink, Snapshot } from '@checkpost/contract';
import { TtlCache } from '../src/lib/ttl-cache.js';
import { ListCache } from '../src/services/list-cache.js';
import { addItem, call, createHarness, newList, snapshot, type Harness } from './helpers.js';

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Counts the reads the API actually makes.
 *
 * Every cached read path goes through `db.select`, and the services hold this
 * exact object, so a spy on it is the honest measure of "did this request reach
 * Postgres". Asserting on hit counters instead would only prove the cache
 * counts itself correctly.
 */
function countSelects() {
  return vi.spyOn(h.app.db, 'select');
}

async function lastActiveAt(listId: string): Promise<string> {
  const [row] = await h.app.db.execute<{ last_active_at: Date }>(
    sql`select last_active_at from lists where id = ${listId}`,
  );
  return new Date(row!.last_active_at).toISOString();
}

describe('reads that never reach the database', () => {
  it('answers a repeat read of the same list from memory', async () => {
    const list = await newList(h.app, 'Camping', ['Tent', 'Stove']);
    const first = await snapshot(h.app, list.token);

    const selects = countSelects();
    const again = await snapshot(h.app, list.token);
    expect(selects).not.toHaveBeenCalled();
    expect(again).toEqual(first);
  });

  it('answers "nothing new" to a polling client with no query at all', async () => {
    const list = await newList(h.app, 'Trip', ['Map']);
    const current = (await snapshot(h.app, list.token)).list.revision;

    const selects = countSelects();
    const response = await call(h.app, 'GET', `/v1/list/changes?since=${current}`, {
      token: list.token,
    });
    expect(selects).not.toHaveBeenCalled();
    const changes = response.body as ChangesResponse;
    expect(changes).toEqual({ kind: 'events', revision: current, events: [] });
  });

  it('greets a reconnecting socket without reading the list', async () => {
    const list = await newList(h.app, 'Shopping', ['Milk', 'Bread', 'Cheese']);
    await snapshot(h.app, list.token);

    const selects = countSelects();
    expect(await h.app.listService.revisionOf(list.list.id)).toBe(0);
    expect(selects).not.toHaveBeenCalled();
  });

  it('writes last_active_at once per interval, not once per read', async () => {
    const list = await newList(h.app, 'Kept');
    const stamped = await lastActiveAt(list.list.id);

    for (let i = 0; i < 5; i++) await snapshot(h.app, list.token);
    await new Promise((resolve) => setTimeout(resolve, 50)); // touch() is fire-and-forget
    expect(await lastActiveAt(list.list.id)).toBe(stamped);

    // Once the interval is up, the next read stamps it again. The reaper's
    // window is a year, so this is the whole of what the column has to promise.
    h.app.cache.forgetTouch(list.list.id);
    await snapshot(h.app, list.token);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await lastActiveAt(list.list.id)).not.toBe(stamped);
  });
});

describe('a cached read is never a stale one', () => {
  it('shows a write to the very next reader', async () => {
    const list = await newList(h.app, 'Camping', ['Tent']);
    await snapshot(h.app, list.token);

    const added = await addItem(h.app, list.token, { text: 'Stove' });
    const after = await snapshot(h.app, list.token);
    expect(after.items.map((item) => item.text)).toEqual(['Tent', 'Stove']);
    expect(after.list.revision).toBe(1);

    await call(h.app, 'DELETE', `/v1/list/items/${added.id}`, { token: list.token });
    expect((await snapshot(h.app, list.token)).items).toHaveLength(1);
  });

  it('shows a renamed list to a reader who saw the old name', async () => {
    const list = await newList(h.app, 'Untitled');
    await snapshot(h.app, list.token);
    await call(h.app, 'PATCH', '/v1/list', { token: list.token, body: { title: 'Cabin' } });
    expect((await snapshot(h.app, list.token)).list.title).toBe('Cabin');
  });

  it('hands a polling client the change it just missed', async () => {
    const list = await newList(h.app, 'Trip');
    await snapshot(h.app, list.token);
    await addItem(h.app, list.token, { text: 'Map' });

    const changes = (await call(h.app, 'GET', '/v1/list/changes?since=0', { token: list.token }))
      .body as ChangesResponse;
    expect(changes.kind).toBe('events');
    if (changes.kind !== 'events') throw new Error('expected events');
    expect(changes.events.map((event) => event.type)).toEqual(['item.created']);
  });

  it('refuses a torn read rather than caching it', () => {
    // A snapshot is two statements, so a write landing between them can produce
    // rows and a revision from different moments. Momentarily wrong is the
    // nature of a read; cached until the process restarts is a bug.
    const cache = new ListCache({
      enabled: true,
      ttlMs: 0,
      maxEntries: 10,
      maxSnapshots: 10,
      touchIntervalMs: 60_000,
    });
    const list = { id: 'a', title: 'Trip', revision: 4, createdAt: '', updatedAt: '' };
    cache.rememberRevision('a', 5);
    cache.rememberSnapshot('a', { list, items: [] });
    expect(cache.snapshot('a')).toBeUndefined();
    // And a revision never goes backwards, for the same reason.
    cache.rememberRevision('a', 3);
    expect(cache.revision('a')).toBe(5);
  });
});

describe('a link that stops working stops working at once', () => {
  it('refuses a replaced link from memory', async () => {
    const list = await newList(h.app, 'Secret', ['One']);
    await snapshot(h.app, list.token);
    await call(h.app, 'POST', '/v1/list/rotate', { token: list.token });

    const selects = countSelects();
    const response = await call(h.app, 'GET', '/v1/list', { token: list.token });
    expect(response.status).toBe(410);
    // The whole point of the cache is that an evicted client is cheap. A
    // reconnect loop holding a dead token must not become a query per attempt.
    expect(selects).not.toHaveBeenCalled();
  });

  it('refuses a revoked link from memory', async () => {
    const list = await newList(h.app, 'Shared', ['One']);
    const made = (
      await call(h.app, 'POST', '/v1/list/links', {
        token: list.token,
        body: { access: 'read', label: 'The group' },
      })
    ).body as { link: ShareLink; token: string };

    expect((await snapshot(h.app, made.token)).access).toBe('read');
    await call(h.app, 'DELETE', `/v1/list/links/${made.link.id}`, { token: list.token });

    const selects = countSelects();
    expect((await call(h.app, 'GET', '/v1/list', { token: made.token })).status).toBe(410);
    expect(selects).not.toHaveBeenCalled();
  });

  it('answers 410 on every link of a deleted list', async () => {
    const list = await newList(h.app, 'Gone', ['One']);
    const made = (
      await call(h.app, 'POST', '/v1/list/links', {
        token: list.token,
        body: { access: 'write', label: 'Flatmate' },
      })
    ).body as { link: ShareLink; token: string };
    await snapshot(h.app, made.token);

    await call(h.app, 'DELETE', '/v1/list', { token: list.token });

    const selects = countSelects();
    expect((await call(h.app, 'GET', '/v1/list', { token: made.token })).status).toBe(410);
    expect((await call(h.app, 'GET', '/v1/list', { token: list.token })).status).toBe(410);
    expect(selects).not.toHaveBeenCalled();
  });

  it('forgets a list the reaper deleted', async () => {
    const list = await newList(h.app, 'Abandoned', ['One']);
    await snapshot(h.app, list.token);
    await h.app.db.execute(
      sql`update lists set last_active_at = now() - interval '400 days' where id = ${list.list.id}`,
    );

    expect(await h.app.listService.pruneAbandonedLists(365)).toBe(1);
    expect((await call(h.app, 'GET', '/v1/list', { token: list.token })).status).toBe(410);
  });
});

describe('turning it off', () => {
  it('serves the same answers with the cache disabled', async () => {
    const { app, close } = await createHarness({ CACHE_ENABLED: '0' });
    try {
      await app.db.execute(sql`truncate table lists cascade`);
      const list = await newList(app, 'Camping', ['Tent']);
      const first = (await call(app, 'GET', '/v1/list', { token: list.token })).body as Snapshot;
      const second = (await call(app, 'GET', '/v1/list', { token: list.token })).body as Snapshot;
      expect(second).toEqual(first);
      expect(app.cache.stats().hits).toBe(0);
    } finally {
      await close();
    }
  });
});

describe('the cache itself', () => {
  it('drops the least recently used entry when it is full', () => {
    const cache = new TtlCache<number>({ maxEntries: 2, ttlMs: 60_000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // 'a' is now the young one, so 'b' is next out
    cache.set('c', 3);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('forgets an entry once its time is up, when it has one', async () => {
    const cache = new TtlCache<string>({ maxEntries: 8, ttlMs: 20 });
    cache.set('a', 'here');
    expect(cache.get('a')).toBe('here');
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('keeps an entry indefinitely when there is no lifetime', async () => {
    // The default. Nothing here is evicted by a clock, because a clock knows
    // nothing about whether an entry is still true.
    const cache = new TtlCache<string>({ maxEntries: 8, ttlMs: 0 });
    cache.set('a', 'here');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(cache.sweep()).toBe(0);
    expect(cache.get('a')).toBe('here');
  });

  it('still gives an unknown token a short life of its own', async () => {
    // The one answer that can go stale without this process doing anything, so
    // the one answer with a clock on it even when the cache has none.
    const cache = new ListCache({
      enabled: true,
      ttlMs: 0,
      maxEntries: 8,
      maxSnapshots: 8,
      touchIntervalMs: 60_000,
    });
    cache.rememberLink('hash-a', { kind: 'unknown' });
    cache.rememberLink('hash-b', { kind: 'gone', reason: 'deleted', linkId: 'k1', listId: null });
    expect(cache.link('hash-a')).toEqual({ kind: 'unknown' });

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    expect(cache.link('hash-a')).toBeUndefined();
    // Terminal answers have no clock: the row they describe is never coming back.
    expect(cache.link('hash-b')).toEqual({
      kind: 'gone',
      reason: 'deleted',
      linkId: 'k1',
      listId: null,
    });
  });

  it('keeps a terminal answer reachable by its own id', () => {
    // Until the reaper deletes the row for real, at which point 401 becomes the
    // honest answer and the entry has to be findable to be dropped.
    const cache = new ListCache({
      enabled: true,
      ttlMs: 0,
      maxEntries: 8,
      maxSnapshots: 8,
      touchIntervalMs: 60_000,
    });
    cache.rememberLink('hash-a', { kind: 'gone', reason: 'deleted', linkId: 'k1', listId: null });
    cache.forgetLink('k1');
    expect(cache.link('hash-a')).toBeUndefined();
  });

  it('bounds snapshots on their own, being much the largest entries', () => {
    const cache = new ListCache({
      enabled: true,
      ttlMs: 0,
      maxEntries: 100,
      maxSnapshots: 1,
      touchIntervalMs: 60_000,
    });
    const list = (id: string) => ({ id, title: id, revision: 0, createdAt: '', updatedAt: '' });
    cache.rememberSnapshot('a', { list: list('a'), items: [] });
    cache.rememberSnapshot('b', { list: list('b'), items: [] });
    expect(cache.snapshot('a')).toBeUndefined();
    expect(cache.snapshot('b')).toBeDefined();
    // The cheap entries are not affected by the snapshot ceiling.
    expect(cache.revision('a')).toBe(0);
    expect(cache.revision('b')).toBe(0);
  });

  it('tells its owner about every entry it lets go', () => {
    const gone: string[] = [];
    const cache = new TtlCache<string>({
      maxEntries: 1,
      ttlMs: 60_000,
      onEvict: (key) => gone.push(key),
    });
    cache.set('a', 'one');
    cache.set('b', 'two'); // evicts 'a'
    cache.set('b', 'three'); // replaces 'b'
    cache.delete('b');
    expect(gone).toEqual(['a', 'b', 'b']);
  });

  it('leaves no index behind when a link entry goes', () => {
    const cache = new ListCache({
      enabled: true,
      ttlMs: 0,
      maxEntries: 1,
      maxSnapshots: 1,
      touchIntervalMs: 60_000,
    });
    cache.rememberLink('hash-a', { kind: 'link', listId: 'l1', linkId: 'k1', access: 'admin' });
    cache.rememberLink('hash-b', { kind: 'link', listId: 'l2', linkId: 'k2', access: 'admin' });

    // 'hash-a' was evicted, so expiring its list must not resurrect it. If the
    // reverse index outlived the entry, this would put a 410 back in the cache
    // and hold it for the full lifetime.
    cache.expireLinks('l1', 'deleted');
    expect(cache.link('hash-a')).toBeUndefined();
    expect(cache.link('hash-b')).toEqual({
      kind: 'link',
      listId: 'l2',
      linkId: 'k2',
      access: 'admin',
    });
  });
});
