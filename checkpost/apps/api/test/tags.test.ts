import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Access, ChangeEvent, ChangesResponse, Item, Tag } from '@checkpost/contract';
import { LIMITS, TAG_COLOR_ORDER } from '@checkpost/contract';
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

async function tag(token: string, body: Record<string, unknown>): Promise<Tag> {
  const response = await call(h.app, 'POST', '/v1/list/tags', { token, body });
  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`tag failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body as Tag;
}

async function setTags(token: string, itemId: string, tagIds: string[]) {
  return call(h.app, 'PATCH', `/v1/list/items/${itemId}`, { token, body: { tagIds } });
}

async function events(token: string, since = 0): Promise<ChangeEvent[]> {
  const response = await call(h.app, 'GET', `/v1/list/changes?since=${since}`, { token });
  const body = response.body as ChangesResponse;
  if (body.kind !== 'events') throw new Error('expected events, got a resync');
  return body.events;
}

async function mint(admin: string, access: Access): Promise<string> {
  const response = await call(h.app, 'POST', '/v1/list/links', { token: admin, body: { access } });
  if (response.status !== 201) throw new Error(`mint ${access} failed: ${response.status}`);
  return (response.body as { token: string }).token;
}

describe('making a tag', () => {
  it('lands in the snapshot with a colour, and goes out as one event', async () => {
    const list = await newList(h.app, 'Shop');
    const made = await tag(list.token, { name: 'Dairy' });

    expect(made).toMatchObject({ name: 'Dairy', listId: list.list.id, color: TAG_COLOR_ORDER[0] });
    expect((await snapshot(h.app, list.token)).tags).toEqual([made]);
    const log = await events(list.token);
    expect(log.map((event) => event.type)).toEqual(['tag.created']);
    expect(log[0]!.data).toEqual({ tag: made });
  });

  it('hands the first eight tags eight different colours, then repeats the least used', async () => {
    const list = await newList(h.app, 'Colours');
    const colours: string[] = [];
    for (let i = 0; i < 9; i++) colours.push((await tag(list.token, { name: `Tag ${i}` })).color);
    expect(colours.slice(0, 8)).toEqual([...TAG_COLOR_ORDER]);
    expect(colours[8]).toBe(TAG_COLOR_ORDER[0]);
  });

  it('keeps a colour somebody picked', async () => {
    const list = await newList(h.app, 'Picked');
    expect((await tag(list.token, { name: 'Bathroom', color: 'plum' })).color).toBe('plum');
  });

  it('refuses a colour that is not one of the eight', async () => {
    const list = await newList(h.app, 'Colours');
    const response = await call(h.app, 'POST', '/v1/list/tags', {
      token: list.token,
      body: { name: 'Loud', color: 'fuchsia' },
    });
    expect(response.status).toBe(400);
  });

  it('answers a name the list already has with the tag it has, whatever the case or spacing', async () => {
    const list = await newList(h.app, 'Twice');
    const first = await tag(list.token, { name: 'Garden shed' });

    const again = await call(h.app, 'POST', '/v1/list/tags', {
      token: list.token,
      body: { id: randomUUID(), name: '  garden   SHED ' },
    });
    expect(again.status).toBe(200);
    expect((again.body as Tag).id).toBe(first.id);
    expect((await snapshot(h.app, list.token)).tags).toHaveLength(1);
    // Not a change, so nobody is told about it.
    expect((await events(list.token)).map((event) => event.type)).toEqual(['tag.created']);
  });

  it('folds letters outside ASCII the same way, which the database might not', async () => {
    const list = await newList(h.app, 'Norsk');
    const first = await tag(list.token, { name: 'Ønsker' });
    expect((await tag(list.token, { name: 'ønsker' })).id).toBe(first.id);
  });

  it('treats a retry with the same id as the same tag', async () => {
    const list = await newList(h.app, 'Retry');
    const id = randomUUID();
    const first = await call(h.app, 'POST', '/v1/list/tags', {
      token: list.token,
      body: { id, name: 'Frozen' },
    });
    const retried = await call(h.app, 'POST', '/v1/list/tags', {
      token: list.token,
      body: { id, name: 'Frozen' },
    });
    expect(first.status).toBe(201);
    expect(retried.status).toBe(200);
    expect((retried.body as Tag).id).toBe(id);
    expect((await snapshot(h.app, list.token)).tags).toHaveLength(1);
  });

  it('refuses an id another list already uses', async () => {
    const mine = await newList(h.app, 'Mine');
    const theirs = await newList(h.app, 'Theirs');
    const id = randomUUID();
    await tag(theirs.token, { id, name: 'Shared' });
    const response = await call(h.app, 'POST', '/v1/list/tags', {
      token: mine.token,
      body: { id, name: 'Shared' },
    });
    expect(response.status).toBe(400);
  });

  it('folds whitespace, and holds names to the limit', async () => {
    const list = await newList(h.app, 'Names');
    expect((await tag(list.token, { name: '  Cold \n  storage ' })).name).toBe('Cold storage');

    const exactly = 'x'.repeat(LIMITS.tagName);
    expect((await tag(list.token, { name: exactly })).name).toBe(exactly);
    for (const name of ['   ', 'y'.repeat(LIMITS.tagName + 1)]) {
      const response = await call(h.app, 'POST', '/v1/list/tags', { token: list.token, body: { name } });
      expect(response.status).toBe(400);
    }
  });

  it(`holds a list to ${LIMITS.tagsPerList} tags`, async () => {
    const list = await newList(h.app, 'Full');
    for (let i = 0; i < LIMITS.tagsPerList; i++) await tag(list.token, { name: `Tag ${i}` });
    const response = await call(h.app, 'POST', '/v1/list/tags', {
      token: list.token,
      body: { name: 'One more' },
    });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: { code: 'limit_reached' } });
    // Finding one it already has is still fine at the limit.
    expect((await tag(list.token, { name: 'tag 0' })).name).toBe('Tag 0');
  });

  it('needs a link that can write', async () => {
    const list = await newList(h.app, 'Looking');
    const read = await mint(list.token, 'read');
    const write = await mint(list.token, 'write');

    const refused = await call(h.app, 'POST', '/v1/list/tags', { token: read, body: { name: 'Nope' } });
    expect(refused.status).toBe(403);
    const made = await tag(write, { name: 'Yes' });

    for (const [method, url, body] of [
      ['PATCH', `/v1/list/tags/${made.id}`, { color: 'teal' }],
      ['DELETE', `/v1/list/tags/${made.id}`, undefined],
    ] as const) {
      expect((await call(h.app, method, url, { token: read, body })).status).toBe(403);
    }
    // And a link that can only look still sees them.
    expect((await snapshot(h.app, read)).tags.map((t) => t.name)).toEqual(['Yes']);
  });
});

describe('tagging a row', () => {
  it('sets the whole set at once, and says so in the item', async () => {
    const list = await newList(h.app, 'Rows');
    const dairy = await tag(list.token, { name: 'Dairy' });
    const cold = await tag(list.token, { name: 'Cold' });
    const milk = await addItem(h.app, list.token, { text: 'Milk' });

    const tagged = await setTags(list.token, milk.id, [dairy.id, cold.id]);
    expect(tagged.status).toBe(200);
    expect((tagged.body as Item).tagIds).toEqual([dairy.id, cold.id]);

    const untagged = await setTags(list.token, milk.id, [cold.id]);
    expect((untagged.body as Item).tagIds).toEqual([cold.id]);

    const snap = await snapshot(h.app, list.token);
    expect(snap.items.find((item) => item.id === milk.id)?.tagIds).toEqual([cold.id]);
    const last = (await events(list.token)).at(-1)!;
    expect(last.type).toBe('item.updated');
    expect((last.data.item as Item).tagIds).toEqual([cold.id]);
  });

  it('starts a new row with the tags it was made with', async () => {
    const list = await newList(h.app, 'Filtered');
    const dairy = await tag(list.token, { name: 'Dairy' });
    const made = await addItem(h.app, list.token, { text: 'Butter', tagIds: [dairy.id] });
    expect(made.tagIds).toEqual([dairy.id]);
  });

  it('drops ids the list does not have, rather than failing the edit', async () => {
    const list = await newList(h.app, 'Mine');
    const other = await newList(h.app, 'Theirs');
    const mine = await tag(list.token, { name: 'Mine' });
    const theirs = await tag(other.token, { name: 'Theirs' });
    const row = await addItem(h.app, list.token, { text: 'Row' });

    const response = await call(h.app, 'PATCH', `/v1/list/items/${row.id}`, {
      token: list.token,
      body: { tagIds: [theirs.id, mine.id, randomUUID(), mine.id], text: 'Row, renamed' },
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ text: 'Row, renamed', tagIds: [mine.id] });
  });

  it(`holds a row to ${LIMITS.tagsPerItem} tags`, async () => {
    const list = await newList(h.app, 'Busy');
    const ids: string[] = [];
    for (let i = 0; i <= LIMITS.tagsPerItem; i++) ids.push((await tag(list.token, { name: `T${i}` })).id);
    const row = await addItem(h.app, list.token, { text: 'Busy row' });
    expect((await setTags(list.token, row.id, ids)).status).toBe(400);
    expect((await setTags(list.token, row.id, ids.slice(0, LIMITS.tagsPerItem))).status).toBe(200);
  });
});

describe('changing a tag', () => {
  it('renames and recolours without touching the rows that wear it', async () => {
    const list = await newList(h.app, 'Rename');
    const made = await tag(list.token, { name: 'Veg' });
    const row = await addItem(h.app, list.token, { text: 'Leeks', tagIds: [made.id] });

    const renamed = await call(h.app, 'PATCH', `/v1/list/tags/${made.id}`, {
      token: list.token,
      body: { name: 'Vegetables', color: 'olive' },
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ id: made.id, name: 'Vegetables', color: 'olive' });

    const snap = await snapshot(h.app, list.token);
    expect(snap.tags).toMatchObject([{ name: 'Vegetables', color: 'olive' }]);
    expect(snap.items.find((item) => item.id === row.id)?.tagIds).toEqual([made.id]);
    expect((await events(list.token)).at(-1)).toMatchObject({
      type: 'tag.updated',
      data: { tag: { id: made.id, name: 'Vegetables' } },
    });
  });

  it('refuses a name another tag already has, and allows its own in another case', async () => {
    const list = await newList(h.app, 'Clash');
    await tag(list.token, { name: 'Bread' });
    const cakes = await tag(list.token, { name: 'cakes' });

    const clash = await call(h.app, 'PATCH', `/v1/list/tags/${cakes.id}`, {
      token: list.token,
      body: { name: 'BREAD' },
    });
    expect(clash.status).toBe(400);
    expect(clash.body).toMatchObject({ error: { message: 'There is already a tag called “Bread”.' } });

    const recased = await call(h.app, 'PATCH', `/v1/list/tags/${cakes.id}`, {
      token: list.token,
      body: { name: 'Cakes' },
    });
    expect(recased.body).toMatchObject({ name: 'Cakes' });
  });

  it('says a tag somebody deleted is gone', async () => {
    const list = await newList(h.app, 'Gone');
    const response = await call(h.app, 'PATCH', `/v1/list/tags/${randomUUID()}`, {
      token: list.token,
      body: { color: 'sage' },
    });
    expect(response.status).toBe(404);
  });
});

describe('deleting a tag', () => {
  it('takes it off every row in one event', async () => {
    const list = await newList(h.app, 'Delete');
    const doomed = await tag(list.token, { name: 'Doomed' });
    const kept = await tag(list.token, { name: 'Kept' });
    const a = await addItem(h.app, list.token, { text: 'A', tagIds: [doomed.id, kept.id] });
    const b = await addItem(h.app, list.token, { text: 'B', tagIds: [doomed.id] });
    const before = (await snapshot(h.app, list.token)).list.revision;

    const response = await call(h.app, 'DELETE', `/v1/list/tags/${doomed.id}`, { token: list.token });
    expect(response.status).toBe(204);

    const snap = await snapshot(h.app, list.token);
    expect(snap.tags.map((t) => t.name)).toEqual(['Kept']);
    expect(snap.items.find((item) => item.id === a.id)?.tagIds).toEqual([kept.id]);
    expect(snap.items.find((item) => item.id === b.id)?.tagIds).toEqual([]);
    expect(await events(list.token, before)).toMatchObject([
      { type: 'tag.deleted', data: { id: doomed.id } },
    ]);
  });

  it('is not an error the second time', async () => {
    const list = await newList(h.app, 'Twice');
    const made = await tag(list.token, { name: 'Once' });
    const url = `/v1/list/tags/${made.id}`;
    expect((await call(h.app, 'DELETE', url, { token: list.token })).status).toBe(204);
    expect((await call(h.app, 'DELETE', url, { token: list.token })).status).toBe(204);
    expect((await events(list.token)).filter((event) => event.type === 'tag.deleted')).toHaveLength(1);
  });

  it('goes with the list', async () => {
    const list = await newList(h.app, 'Short-lived');
    await tag(list.token, { name: 'Temporary' });
    expect((await call(h.app, 'DELETE', '/v1/list', { token: list.token })).status).toBe(204);
    const other = await newList(h.app, 'Next');
    // A fresh list starts with nothing, whatever the one before it had.
    expect((await snapshot(h.app, other.token)).tags).toEqual([]);
  });
});

describe('a copy of a tagged list', () => {
  it('brings its own copies of the tags, and the rows wear the copies', async () => {
    const source = await newList(h.app, 'Template');
    const room = await tag(source.token, { name: 'Bedroom', color: 'iris' });
    await addItem(h.app, source.token, { text: 'Sheets', tagIds: [room.id] });
    const copyLink = await mint(source.token, 'copy');

    const made = await call(h.app, 'POST', '/v1/list/copy', { token: copyLink });
    expect(made.status).toBe(201);
    const copy = made.body as { token: string; tags: Tag[]; items: Item[] };

    expect(copy.tags).toHaveLength(1);
    expect(copy.tags[0]).toMatchObject({ name: 'Bedroom', color: 'iris' });
    expect(copy.tags[0]!.id).not.toBe(room.id);
    expect(copy.items[0]!.tagIds).toEqual([copy.tags[0]!.id]);

    // Strangers afterwards: renaming on the copy leaves the template alone.
    await call(h.app, 'PATCH', `/v1/list/tags/${copy.tags[0]!.id}`, {
      token: copy.token,
      body: { name: 'Guest room' },
    });
    expect((await snapshot(h.app, source.token)).tags[0]!.name).toBe('Bedroom');
  });
});
