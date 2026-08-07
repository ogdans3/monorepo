import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { ChangesResponse, Item, List } from '@checkpost/contract';
import { SHARE_TOKEN_PATTERN } from '@checkpost/contract';
import { addItem, call, createHarness, newList, snapshot, texts, type Harness } from './helpers.js';

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

describe('creating and reading a list', () => {
  it('mints a long, well-formed share token', async () => {
    const created = await newList(h.app, 'Camping');
    expect(created.token).toMatch(SHARE_TOKEN_PATTERN);
    expect(created.token).toHaveLength(43);
    expect(created.url).toBe(`https://checkpost.test/l/${created.token}`);
    expect(created.list.revision).toBe(0);
  });

  it('never issues the same token twice', async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 20; i++) tokens.add((await newList(h.app, `List ${i}`)).token);
    expect(tokens.size).toBe(20);
  });

  it('seeds items in the order they were given', async () => {
    const created = await newList(h.app, 'Packing', ['Passport', 'Charger', 'Toothbrush']);
    expect(created.items.map((i) => i.text)).toEqual(['Passport', 'Charger', 'Toothbrush']);
    expect(texts(await snapshot(h.app, created.token))).toEqual([
      'Passport',
      'Charger',
      'Toothbrush',
    ]);
  });

  it('rejects an empty title', async () => {
    const response = await call(h.app, 'POST', '/v1/lists', { body: { title: '   ' } });
    expect(response.status).toBe(400);
  });
});

describe('access control', () => {
  it('refuses requests with no link', async () => {
    const response = await call(h.app, 'GET', '/v1/list');
    expect(response.status).toBe(401);
  });

  it('refuses a token that was never issued', async () => {
    const response = await call(h.app, 'GET', '/v1/list', { token: 'x'.repeat(43) });
    expect(response.status).toBe(401);
  });

  it('refuses a malformed bearer value without touching the database', async () => {
    const response = await call(h.app, 'GET', '/v1/list', { token: 'too-short' });
    expect(response.status).toBe(401);
  });

  it('keeps two lists completely separate', async () => {
    const a = await newList(h.app, 'A', ['a1']);
    const b = await newList(h.app, 'B', ['b1']);
    expect(texts(await snapshot(h.app, a.token))).toEqual(['a1']);
    expect(texts(await snapshot(h.app, b.token))).toEqual(['b1']);
    // A token grants exactly one list, and there is no id to swap in a URL.
    const response = await call(h.app, 'PATCH', '/v1/list', {
      token: a.token,
      body: { title: 'hijack' },
    });
    expect(response.status).toBe(200);
    expect((await snapshot(h.app, b.token)).list.title).toBe('B');
  });
});

describe('items', () => {
  it('appends by default and keeps order stable', async () => {
    const list = await newList(h.app, 'Shopping');
    await addItem(h.app, list.token, { text: 'Milk' });
    await addItem(h.app, list.token, { text: 'Bread' });
    await addItem(h.app, list.token, { text: 'Coffee' });
    expect(texts(await snapshot(h.app, list.token))).toEqual(['Milk', 'Bread', 'Coffee']);
  });

  it('inserts after and before a named neighbour', async () => {
    const list = await newList(h.app, 'Shopping', ['Milk', 'Coffee']);
    const [milk, coffee] = list.items;
    await addItem(h.app, list.token, { text: 'Bread', afterId: milk!.id });
    await addItem(h.app, list.token, { text: 'Tea', beforeId: coffee!.id });
    expect(texts(await snapshot(h.app, list.token))).toEqual(['Milk', 'Bread', 'Tea', 'Coffee']);
  });

  it('treats a client-supplied id as idempotent, so a retry is not a duplicate', async () => {
    const list = await newList(h.app, 'Shopping');
    const id = crypto.randomUUID();
    const first = await addItem(h.app, list.token, { id, text: 'Milk' });
    const retry = await addItem(h.app, list.token, { id, text: 'Milk' });
    expect(retry.id).toBe(first.id);
    expect((await snapshot(h.app, list.token)).items).toHaveLength(1);
  });

  it('checks and unchecks, stamping checkedAt only while checked', async () => {
    const list = await newList(h.app, 'Chores', ['Bins']);
    const item = list.items[0]!;
    const checked = (
      await call(h.app, 'PATCH', `/v1/list/items/${item.id}`, {
        token: list.token,
        body: { checked: true },
      })
    ).body as Item;
    expect(checked.checked).toBe(true);
    expect(checked.checkedAt).not.toBeNull();

    const unchecked = (
      await call(h.app, 'PATCH', `/v1/list/items/${item.id}`, {
        token: list.token,
        body: { checked: false },
      })
    ).body as Item;
    expect(unchecked.checked).toBe(false);
    expect(unchecked.checkedAt).toBeNull();
  });

  it('reorders an existing item without disturbing the others', async () => {
    const list = await newList(h.app, 'Route', ['A', 'B', 'C', 'D']);
    const [a, , c] = list.items;
    await call(h.app, 'PATCH', `/v1/list/items/${c!.id}`, {
      token: list.token,
      body: { afterId: a!.id },
    });
    expect(texts(await snapshot(h.app, list.token))).toEqual(['A', 'C', 'B', 'D']);
  });

  it('sends an item to the top with an explicit null beforeId', async () => {
    const list = await newList(h.app, 'Route', ['A', 'B']);
    await addItem(h.app, list.token, { text: 'Zero', beforeId: null });
    expect(texts(await snapshot(h.app, list.token))).toEqual(['Zero', 'A', 'B']);
  });

  it('treats deleting an already-deleted item as success', async () => {
    const list = await newList(h.app, 'Chores', ['Bins']);
    const id = list.items[0]!.id;
    expect((await call(h.app, 'DELETE', `/v1/list/items/${id}`, { token: list.token })).status).toBe(
      204,
    );
    // Two people tapping the same row is not an error, and the end state is right.
    expect((await call(h.app, 'DELETE', `/v1/list/items/${id}`, { token: list.token })).status).toBe(
      204,
    );
  });

  it('clears the checked shelf in one call', async () => {
    const list = await newList(h.app, 'Shopping', ['Milk', 'Bread', 'Coffee']);
    for (const item of list.items.slice(0, 2)) {
      await call(h.app, 'PATCH', `/v1/list/items/${item.id}`, {
        token: list.token,
        body: { checked: true },
      });
    }
    const cleared = await call(h.app, 'POST', '/v1/list/items/clear-checked', { token: list.token });
    expect(cleared.status).toBe(200);
    expect((cleared.body as { removed: string[] }).removed).toHaveLength(2);
    expect(texts(await snapshot(h.app, list.token))).toEqual(['Coffee']);
  });

  it('rejects an item longer than the limit', async () => {
    const list = await newList(h.app, 'Shopping');
    const response = await call(h.app, 'POST', '/v1/list/items', {
      token: list.token,
      body: { text: 'x'.repeat(501) },
    });
    expect(response.status).toBe(400);
  });
});

describe('concurrent editing', () => {
  it('serialises simultaneous appends into a total order', async () => {
    const list = await newList(h.app, 'Party');
    const words = Array.from({ length: 25 }, (_, i) => `item-${i}`);
    await Promise.all(words.map((text) => addItem(h.app, list.token, { text })));

    const snap = await snapshot(h.app, list.token);
    expect(snap.items).toHaveLength(25);
    // No duplicate positions, and the server's order is the byte order the
    // clients will independently compute.
    const positions = snap.items.map((i) => i.position);
    expect(new Set(positions).size).toBe(25);
    expect([...positions].sort()).toEqual(positions);
    expect(new Set(texts(snap))).toEqual(new Set(words));
  });

  it('gives every mutation its own revision', async () => {
    const list = await newList(h.app, 'Party');
    await Promise.all(
      Array.from({ length: 15 }, (_, i) => addItem(h.app, list.token, { text: `x${i}` })),
    );
    const changes = (
      await call(h.app, 'GET', '/v1/list/changes?since=0', { token: list.token })
    ).body as ChangesResponse;
    if (changes.kind !== 'events') throw new Error('expected events');
    const revisions = changes.events.map((e) => e.revision);
    expect(new Set(revisions).size).toBe(revisions.length);
    expect([...revisions].sort((a, b) => a - b)).toEqual(revisions);
  });

  it('lets two people check two different boxes at once', async () => {
    const list = await newList(h.app, 'Chores', ['Bins', 'Dishes']);
    const [bins, dishes] = list.items;
    await Promise.all([
      call(h.app, 'PATCH', `/v1/list/items/${bins!.id}`, {
        token: list.token,
        actor: 'device-a',
        body: { checked: true },
      }),
      call(h.app, 'PATCH', `/v1/list/items/${dishes!.id}`, {
        token: list.token,
        actor: 'device-b',
        body: { checked: true },
      }),
    ]);
    const snap = await snapshot(h.app, list.token);
    expect(snap.items.every((i) => i.checked)).toBe(true);
  });
});

describe('incremental sync', () => {
  it('replays only what the client missed, tagged with the writer', async () => {
    const list = await newList(h.app, 'Trip');
    await addItem(h.app, list.token, { text: 'Tent' });
    const afterFirst = (await snapshot(h.app, list.token)).list.revision;
    await addItem(h.app, list.token, { text: 'Stove' });

    const changes = (
      await call(h.app, 'GET', `/v1/list/changes?since=${afterFirst}`, {
        token: list.token,
        actor: 'device-b',
      })
    ).body as ChangesResponse;
    if (changes.kind !== 'events') throw new Error('expected events');
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]!.type).toBe('item.created');
    expect((changes.events[0]!.data.item as Item).text).toBe('Stove');
  });

  it('echoes the actor so a device can ignore its own change', async () => {
    const list = await newList(h.app, 'Trip');
    await addItem(h.app, list.token, { text: 'Tent' });
    const changes = (
      await call(h.app, 'GET', '/v1/list/changes?since=0', { token: list.token })
    ).body as ChangesResponse;
    if (changes.kind !== 'events') throw new Error('expected events');
    expect(changes.events[0]!.actor).toBeNull();

    await call(h.app, 'POST', '/v1/list/items', {
      token: list.token,
      actor: 'device-a',
      body: { text: 'Stove' },
    });
    const next = (
      await call(h.app, 'GET', '/v1/list/changes?since=1', { token: list.token })
    ).body as ChangesResponse;
    if (next.kind !== 'events') throw new Error('expected events');
    expect(next.events.at(-1)!.actor).toBe('device-a');
  });

  it('returns nothing when the client is already current', async () => {
    const list = await newList(h.app, 'Trip', ['Tent']);
    const current = (await snapshot(h.app, list.token)).list.revision;
    const changes = (
      await call(h.app, 'GET', `/v1/list/changes?since=${current}`, { token: list.token })
    ).body as ChangesResponse;
    if (changes.kind !== 'events') throw new Error('expected events');
    expect(changes.events).toEqual([]);
  });

  it('falls back to a full snapshot when the change log no longer reaches back', async () => {
    const list = await newList(h.app, 'Trip');
    await addItem(h.app, list.token, { text: 'Tent' });
    await addItem(h.app, list.token, { text: 'Stove' });
    // Simulate retention having swept the earliest events away.
    await h.app.db.execute(sql`delete from list_events where revision <= 1`);
    const changes = (
      await call(h.app, 'GET', '/v1/list/changes?since=0', { token: list.token })
    ).body as ChangesResponse;
    expect(changes.kind).toBe('resync');
    if (changes.kind !== 'resync') throw new Error('expected resync');
    expect(texts(changes.snapshot)).toEqual(['Tent', 'Stove']);
  });
});

describe('replacing the link', () => {
  it('issues a new link and kills the old one', async () => {
    const list = await newList(h.app, 'Secret', ['One']);
    const rotated = await call(h.app, 'POST', '/v1/list/rotate', { token: list.token });
    expect(rotated.status).toBe(200);
    const { token: next, url } = rotated.body as { token: string; url: string };

    expect(next).not.toBe(list.token);
    expect(next).toMatch(SHARE_TOKEN_PATTERN);
    expect(url).toBe(`https://checkpost.test/l/${next}`);

    // The old link is Gone, not Unauthorized, so the app can say why.
    const old = await call(h.app, 'GET', '/v1/list', { token: list.token });
    expect(old.status).toBe(410);

    expect(texts(await snapshot(h.app, next))).toEqual(['One']);
  });

  it('can be replaced repeatedly, revoking each previous link', async () => {
    const list = await newList(h.app, 'Secret');
    const tokens = [list.token];
    let current = list.token;
    for (let i = 0; i < 3; i++) {
      const response = await call(h.app, 'POST', '/v1/list/rotate', { token: current });
      current = (response.body as { token: string }).token;
      tokens.push(current);
    }
    for (const dead of tokens.slice(0, -1)) {
      expect((await call(h.app, 'GET', '/v1/list', { token: dead })).status).toBe(410);
    }
    expect((await call(h.app, 'GET', '/v1/list', { token: current })).status).toBe(200);
  });
});

describe('deleting a list', () => {
  it('removes the list and makes the link Gone', async () => {
    const list = await newList(h.app, 'Temp', ['One']);
    expect((await call(h.app, 'DELETE', '/v1/list', { token: list.token })).status).toBe(204);
    expect((await call(h.app, 'GET', '/v1/list', { token: list.token })).status).toBe(410);
  });
});

describe('titles', () => {
  it('renames a list', async () => {
    const list = await newList(h.app, 'Untitled');
    const response = await call(h.app, 'PATCH', '/v1/list', {
      token: list.token,
      body: { title: 'Weekend in Bergen' },
    });
    expect(response.status).toBe(200);
    expect((response.body as List).title).toBe('Weekend in Bergen');
    expect((await snapshot(h.app, list.token)).list.title).toBe('Weekend in Bergen');
  });

  it('rejects unknown fields rather than silently ignoring them', async () => {
    const list = await newList(h.app, 'Untitled');
    const response = await call(h.app, 'PATCH', '/v1/list', {
      token: list.token,
      body: { title: 'Fine', revision: 99 },
    });
    expect(response.status).toBe(400);
  });
});

describe('meta', () => {
  it('reports health and readiness', async () => {
    expect((await call(h.app, 'GET', '/v1/health')).status).toBe(200);
    expect((await call(h.app, 'GET', '/v1/ready')).status).toBe(200);
  });

  it('404s unknown endpoints in the product error shape', async () => {
    const response = await call(h.app, 'GET', '/v1/nope');
    expect(response.status).toBe(404);
    expect((response.body as { error: { code: string } }).error.code).toBe('not_found');
  });
});

describe('housekeeping', () => {
  it('deletes lists nobody has touched within the TTL', async () => {
    const fresh = await newList(h.app, 'Fresh');
    const stale = await newList(h.app, 'Stale');
    await h.app.db.execute(
      sql`update lists set last_active_at = now() - interval '400 days' where id = ${stale.list.id}`,
    );

    const removed = await h.app.listService.pruneAbandonedLists(365);
    expect(removed).toBe(1);
    expect((await call(h.app, 'GET', '/v1/list', { token: stale.token })).status).toBe(410);
    expect((await call(h.app, 'GET', '/v1/list', { token: fresh.token })).status).toBe(200);
  });

  it('reading a list keeps it alive', async () => {
    const list = await newList(h.app, 'Kept');
    await h.app.db.execute(
      sql`update lists set last_active_at = now() - interval '400 days' where id = ${list.list.id}`,
    );
    await snapshot(h.app, list.token);
    await new Promise((resolve) => setTimeout(resolve, 50)); // touch() is fire-and-forget
    expect(await h.app.listService.pruneAbandonedLists(365)).toBe(0);
  });
});
