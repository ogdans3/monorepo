import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { DEMO_LIST_ID, DEMO_ROWS, type DemoIntro, type Item, type Snapshot } from '@checkpost/contract';
import { lists } from '../src/db/schema.js';
import { call, createHarness, type Harness } from './helpers.js';

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

async function intro(): Promise<DemoIntro> {
  const response = await call(h.app, 'GET', '/v1/demo');
  expect(response.status).toBe(200);
  return response.body as DemoIntro;
}

/**
 * The list on the landing page.
 *
 * It is the one list in the product anybody can write to without holding a
 * link, so what it refuses matters more here than what it allows.
 */
describe('the demo list', () => {
  it('hands out the list and a link to watch it with', async () => {
    const { token, snapshot } = await intro();

    expect(snapshot.list.id).toBe(DEMO_LIST_ID);
    expect(snapshot.items.map((item) => item.text)).toEqual(DEMO_ROWS.map((row) => row.text));
    // Published in a page anyone can view source on, so it had better be read.
    expect(snapshot.access).toBe('read');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('seeds once, however many people arrive at the same moment', async () => {
    const [first, ...rest] = await Promise.all([intro(), intro(), intro()]);
    for (const other of rest) {
      expect(other.token).toBe(first!.token);
      expect(other.snapshot.items).toHaveLength(DEMO_ROWS.length);
    }

    const { status, body } = await call(h.app, 'GET', '/v1/list', { token: first!.token });
    expect(status).toBe(200);
    expect((body as Snapshot).items).toHaveLength(DEMO_ROWS.length);
  });

  it('takes a tick from anyone, with no link at all', async () => {
    const before = await intro();
    const row = DEMO_ROWS[0]!;

    const ticked = await call(h.app, 'POST', '/v1/demo/tick', {
      body: { id: row.id, checked: true },
      actor: 'somebody',
    });
    expect(ticked.status).toBe(200);
    expect((ticked.body as Item).checked).toBe(true);

    // And everybody else sees it, through the ordinary change feed.
    const changes = await call(
      h.app,
      'GET',
      `/v1/list/changes?since=${before.snapshot.list.revision}`,
      { token: before.token },
    );
    expect(changes.status).toBe(200);
    expect(JSON.stringify(changes.body)).toContain(row.id);
  });

  it('refuses everything except the tick', async () => {
    const { token, snapshot } = await intro();
    const itemId = snapshot.items[0]!.id;

    // The published link is read, so the ordinary write routes are shut to it.
    const renamed = await call(h.app, 'PATCH', '/v1/list', { token, body: { title: 'Mine now' } });
    expect(renamed.status).toBe(403);

    const added = await call(h.app, 'POST', '/v1/list/items', { token, body: { text: 'Beer' } });
    expect(added.status).toBe(403);

    const edited = await call(h.app, 'PATCH', `/v1/list/items/${itemId}`, {
      token,
      body: { text: 'Something else' },
    });
    expect(edited.status).toBe(403);

    const removed = await call(h.app, 'DELETE', `/v1/list/items/${itemId}`, { token });
    expect(removed.status).toBe(403);

    const cleared = await call(h.app, 'POST', '/v1/list/items/clear-checked', { token });
    expect(cleared.status).toBe(403);

    const deleted = await call(h.app, 'DELETE', '/v1/list', { token });
    expect(deleted.status).toBe(403);

    // Links are admin work, and nobody is admin here.
    const linked = await call(h.app, 'POST', '/v1/list/links', {
      token,
      body: { access: 'admin' },
    });
    expect(linked.status).toBe(403);

    // The list is exactly as it was found.
    const after = await call(h.app, 'GET', '/v1/list', { token });
    expect((after.body as Snapshot).items.map((item) => item.text)).toEqual(
      DEMO_ROWS.map((row) => row.text),
    );
  });

  it('is not a way into anyone else’s list', async () => {
    await intro();
    const made = await call(h.app, 'POST', '/v1/lists', { body: { title: 'Private' } });
    const token = (made.body as { token: string }).token;
    const item = await call(h.app, 'POST', '/v1/list/items', { token, body: { text: 'Secret' } });
    const itemId = (item.body as Item).id;

    // An item id is not a capability. The tick is scoped to the demo list, so
    // this is a 404 and never a free edit on somebody's real list.
    const poked = await call(h.app, 'POST', '/v1/demo/tick', {
      body: { id: itemId, checked: true },
    });
    expect(poked.status).toBe(404);

    const after = await call(h.app, 'GET', '/v1/list', { token });
    expect((after.body as Snapshot).items[0]!.checked).toBe(false);
  });

  it('tidies itself up once it has been left alone', async () => {
    const { token } = await intro();
    const row = DEMO_ROWS[0]!;
    await call(h.app, 'POST', '/v1/demo/tick', { body: { id: row.id, checked: true } });

    // Not while people are still on it.
    expect(await h.app.demoService.resetIfQuiet(60_000)).toBe(0);

    // Aged by hand, the way the reaper's tests do it. The cache holds a
    // snapshot for this list, so it has to be told the row moved.
    await h.app.db
      .update(lists)
      .set({ updatedAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(lists.id, DEMO_LIST_ID));
    h.app.cache.invalidateList(DEMO_LIST_ID);

    expect(await h.app.demoService.resetIfQuiet(60_000)).toBe(1);

    const after = await call(h.app, 'GET', '/v1/list', { token });
    expect((after.body as Snapshot).items.map((item) => item.checked)).toEqual(
      DEMO_ROWS.map((row) => row.checked),
    );

    // And having just written, it is no longer quiet.
    expect(await h.app.demoService.resetIfQuiet(60_000)).toBe(0);
  });

  it('comes back if the list is deleted out from under it', async () => {
    const first = await intro();
    // The admin console can delete any list, and to it the demo is just a list.
    await h.app.db.delete(lists).where(eq(lists.id, DEMO_LIST_ID));
    h.app.cache.forgetList(DEMO_LIST_ID);

    const second = await intro();
    expect(second.snapshot.items).toHaveLength(DEMO_ROWS.length);
    expect(second.token).not.toBe(first.token);
  });

  it('does nothing at all for a process nobody has asked', async () => {
    // `resetIfQuiet` must never be what creates the demo list: the keeper runs
    // on a timer in every deployment, including ones nobody has visited.
    expect(await h.app.demoService.resetIfQuiet(0)).toBe(0);
    expect(h.app.demoService.started).toBe(false);
  });
});
