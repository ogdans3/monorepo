import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SHARE_TOKEN_PATTERN, type Access, type ShareLink, type Snapshot } from '@checkpost/contract';
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

/** Mints a link at a given level using the admin link that made the list. */
async function mint(admin: string, access: Access, label = ''): Promise<string> {
  const response = await call(h.app, 'POST', '/v1/list/links', {
    token: admin,
    body: { access, ...(label ? { label } : {}) },
  });
  if (response.status !== 201) {
    throw new Error(`mint ${access} failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return (response.body as { token: string }).token;
}

describe('what a link is allowed to do', () => {
  it('gives whoever made the list admin on it', async () => {
    const list = await newList(h.app, 'Cabin');
    expect((await snapshot(h.app, list.token)).access).toBe('admin');
  });

  it('lets a read link look and nothing else', async () => {
    const list = await newList(h.app, 'Cabin', ['Firewood']);
    const read = await mint(list.token, 'read');

    const seen = await snapshot(h.app, read);
    expect(texts(seen)).toEqual(['Firewood']);
    expect(seen.access).toBe('read');
    expect((await call(h.app, 'GET', '/v1/list/changes?since=0', { token: read })).status).toBe(200);

    // Every way of changing anything is closed.
    const denied = [
      await call(h.app, 'POST', '/v1/list/items', { token: read, body: { text: 'Nope' } }),
      await call(h.app, 'PATCH', `/v1/list/items/${list.items[0]!.id}`, {
        token: read,
        body: { checked: true },
      }),
      await call(h.app, 'DELETE', `/v1/list/items/${list.items[0]!.id}`, { token: read }),
      await call(h.app, 'POST', '/v1/list/items/clear-checked', { token: read }),
      await call(h.app, 'PATCH', '/v1/list', { token: read, body: { title: 'Hijacked' } }),
      await call(h.app, 'DELETE', '/v1/list', { token: read }),
      await call(h.app, 'POST', '/v1/list/rotate', { token: read }),
      await call(h.app, 'GET', '/v1/list/links', { token: read }),
      await call(h.app, 'POST', '/v1/list/links', { token: read, body: { access: 'admin' } }),
    ];
    for (const response of denied) expect(response.status).toBe(403);

    // And nothing actually changed.
    expect(texts(await snapshot(h.app, list.token))).toEqual(['Firewood']);
    expect((await snapshot(h.app, list.token)).list.title).toBe('Cabin');
  });

  it('lets a write link edit the list but not the links', async () => {
    const list = await newList(h.app, 'Cabin', ['Firewood']);
    const write = await mint(list.token, 'write');

    expect((await snapshot(h.app, write)).access).toBe('write');
    await addItem(h.app, write, { text: 'Coffee' });
    expect(
      (
        await call(h.app, 'PATCH', `/v1/list/items/${list.items[0]!.id}`, {
          token: write,
          body: { checked: true },
        })
      ).status,
    ).toBe(200);
    expect(
      (await call(h.app, 'PATCH', '/v1/list', { token: write, body: { title: 'Cabin, Friday' } }))
        .status,
    ).toBe(200);

    // Managing access is where it stops.
    expect((await call(h.app, 'GET', '/v1/list/links', { token: write })).status).toBe(403);
    expect(
      (await call(h.app, 'POST', '/v1/list/links', { token: write, body: { access: 'admin' } }))
        .status,
    ).toBe(403);
    expect((await call(h.app, 'DELETE', '/v1/list', { token: write })).status).toBe(403);
    expect((await call(h.app, 'POST', '/v1/list/rotate', { token: write })).status).toBe(403);
  });

  it('says which way it is refusing', async () => {
    const list = await newList(h.app, 'Cabin', ['Firewood']);
    const read = await mint(list.token, 'read');
    const denied = await call(h.app, 'POST', '/v1/list/items', {
      token: read,
      body: { text: 'Nope' },
    });
    const error = (denied.body as { error: { code: string; message: string } }).error;
    expect(error.code).toBe('forbidden');
    // A person reads this, so it has to say what to do next.
    expect(error.message).toContain('Ask for one');
  });
});

describe('managing links', () => {
  it('lists every live link without ever showing a token', async () => {
    const list = await newList(h.app, 'Cabin');
    await mint(list.token, 'read', 'The neighbours');
    await mint(list.token, 'write');

    const links = (await call(h.app, 'GET', '/v1/list/links', { token: list.token }))
      .body as ShareLink[];
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.access).sort()).toEqual(['admin', 'read', 'write']);
    expect(links.find((l) => l.access === 'read')?.label).toBe('The neighbours');
    expect(links.filter((l) => l.isCurrent)).toHaveLength(1);

    // Only the hash is stored, so there is nothing token-shaped to leak here.
    expect(JSON.stringify(links)).not.toMatch(SHARE_TOKEN_PATTERN);
  });

  it('revokes one link and leaves the rest working', async () => {
    const list = await newList(h.app, 'Cabin', ['Firewood']);
    const read = await mint(list.token, 'read');
    const write = await mint(list.token, 'write');

    const links = (await call(h.app, 'GET', '/v1/list/links', { token: list.token }))
      .body as ShareLink[];
    const readId = links.find((l) => l.access === 'read')!.id;

    expect(
      (await call(h.app, 'DELETE', `/v1/list/links/${readId}`, { token: list.token })).status,
    ).toBe(204);

    expect((await call(h.app, 'GET', '/v1/list', { token: read })).status).toBe(410);
    expect((await call(h.app, 'GET', '/v1/list', { token: write })).status).toBe(200);
    expect((await call(h.app, 'GET', '/v1/list', { token: list.token })).status).toBe(200);
  });

  it('refuses to revoke the link you are holding', async () => {
    const list = await newList(h.app, 'Cabin');
    const links = (await call(h.app, 'GET', '/v1/list/links', { token: list.token }))
      .body as ShareLink[];
    const mine = links.find((l) => l.isCurrent)!.id;

    // Locking yourself out mid-request is never what was meant.
    const response = await call(h.app, 'DELETE', `/v1/list/links/${mine}`, { token: list.token });
    expect(response.status).toBe(400);
    expect((await call(h.app, 'GET', '/v1/list', { token: list.token })).status).toBe(200);
  });

  it('replaces only the link doing the replacing, and keeps its level', async () => {
    const list = await newList(h.app, 'Cabin', ['Firewood']);
    const read = await mint(list.token, 'read');

    const rotated = await call(h.app, 'POST', '/v1/list/rotate', { token: list.token });
    const next = (rotated.body as { token: string }).token;

    expect((await call(h.app, 'GET', '/v1/list', { token: list.token })).status).toBe(410);
    expect((await snapshot(h.app, next)).access).toBe('admin');
    // The read link was somebody else's and is none of this operation's
    // business. Replacing one link used to kill them all.
    expect((await call(h.app, 'GET', '/v1/list', { token: read })).status).toBe(200);
  });

  it('caps how many links one list can have', async () => {
    const list = await newList(h.app, 'Cabin');
    // One admin link exists already.
    for (let i = 0; i < 19; i++) await mint(list.token, 'read');
    const tooMany = await call(h.app, 'POST', '/v1/list/links', {
      token: list.token,
      body: { access: 'read' },
    });
    expect(tooMany.status).toBe(409);
  });
});

describe('copy links', () => {
  it('cannot open the list it came from', async () => {
    const list = await newList(h.app, 'Packing', ['Passport', 'Charger']);
    const copy = await mint(list.token, 'copy');

    for (const path of ['/v1/list', '/v1/list/changes?since=0']) {
      const response = await call(h.app, 'GET', path, { token: copy });
      expect(response.status).toBe(403);
      expect((response.body as { error: { code: string } }).error.code).toBe('copy_link');
    }
    expect(
      (await call(h.app, 'POST', '/v1/list/items', { token: copy, body: { text: 'Nope' } })).status,
    ).toBe(403);
  });

  it('says what it would make, without handing the list over', async () => {
    const list = await newList(h.app, 'Packing', ['Passport', 'Charger']);
    const copy = await mint(list.token, 'copy');

    const preview = (await call(h.app, 'GET', '/v1/list/copy', { token: copy })).body as {
      title: string;
      itemCount: number;
    };
    expect(preview).toEqual({ title: 'Packing', itemCount: 2 });
    // The preview is a count and a name. The items themselves are not in it.
    expect(JSON.stringify(preview)).not.toContain('Passport');
  });

  it('hands over a private copy with nothing ticked off', async () => {
    const list = await newList(h.app, 'Packing', ['Passport', 'Charger', 'Toothbrush']);
    await call(h.app, 'PATCH', `/v1/list/items/${list.items[0]!.id}`, {
      token: list.token,
      body: { checked: true, note: 'in the drawer' },
    });
    const copy = await mint(list.token, 'copy');

    const made = await call(h.app, 'POST', '/v1/list/copy', { token: copy });
    expect(made.status).toBe(201);
    const mine = made.body as { list: { id: string }; token: string; url: string };

    const theirs = await snapshot(h.app, mine.token);
    expect(theirs.access).toBe('admin');
    expect(theirs.list.title).toBe('Packing');
    expect(texts(theirs)).toEqual(['Passport', 'Charger', 'Toothbrush']);
    // A template is a thing to work through, not a record of somebody else's
    // progress, so nothing arrives already done. Notes are worth keeping.
    expect(theirs.items.every((item) => !item.checked)).toBe(true);
    expect(theirs.items[0]!.note).toBe('in the drawer');
    expect(theirs.list.id).not.toBe(list.list.id);
  });

  it('leaves the two lists strangers', async () => {
    const list = await newList(h.app, 'Packing', ['Passport']);
    const copy = await mint(list.token, 'copy');
    const mine = (await call(h.app, 'POST', '/v1/list/copy', { token: copy })).body as {
      token: string;
    };

    await addItem(h.app, mine.token, { text: 'Only mine' });
    await addItem(h.app, list.token, { text: 'Only theirs' });

    expect(texts(await snapshot(h.app, mine.token))).toEqual(['Passport', 'Only mine']);
    expect(texts(await snapshot(h.app, list.token))).toEqual(['Passport', 'Only theirs']);

    // My admin link is mine alone and reaches nothing of theirs.
    const theirLinks = (await call(h.app, 'GET', '/v1/list/links', { token: mine.token }))
      .body as ShareLink[];
    expect(theirLinks).toHaveLength(1);
  });

  it('gives each person who opens it their own copy', async () => {
    const list = await newList(h.app, 'Packing', ['Passport']);
    const copy = await mint(list.token, 'copy');

    const first = (await call(h.app, 'POST', '/v1/list/copy', { token: copy })).body as {
      token: string;
      list: { id: string };
    };
    const second = (await call(h.app, 'POST', '/v1/list/copy', { token: copy })).body as {
      token: string;
      list: { id: string };
    };

    expect(first.list.id).not.toBe(second.list.id);
    await addItem(h.app, first.token, { text: 'Mine' });
    expect(texts(await snapshot(h.app, second.token))).toEqual(['Passport']);

    // And the template still works for the next person.
    expect((await call(h.app, 'GET', '/v1/list/copy', { token: copy })).status).toBe(200);
  });

  it('is refused by everything that is not a copy link', async () => {
    const list = await newList(h.app, 'Packing', ['Passport']);
    for (const token of [list.token, await mint(list.token, 'read')]) {
      expect((await call(h.app, 'POST', '/v1/list/copy', { token })).status).toBe(403);
      expect((await call(h.app, 'GET', '/v1/list/copy', { token })).status).toBe(403);
    }
  });

  it('stops working when the template is revoked', async () => {
    const list = await newList(h.app, 'Packing', ['Passport']);
    const copy = await mint(list.token, 'copy');
    const links = (await call(h.app, 'GET', '/v1/list/links', { token: list.token }))
      .body as ShareLink[];
    const copyId = links.find((l) => l.access === 'copy')!.id;

    await call(h.app, 'DELETE', `/v1/list/links/${copyId}`, { token: list.token });
    expect((await call(h.app, 'POST', '/v1/list/copy', { token: copy })).status).toBe(410);
  });
});

describe('the snapshot tells the client what it may do', () => {
  it('carries the level of the link it was fetched with', async () => {
    const list = await newList(h.app, 'Cabin', ['Firewood']);
    const levels: Access[] = ['read', 'write', 'admin'];
    for (const level of levels) {
      const token = await mint(list.token, level);
      const seen: Snapshot = await snapshot(h.app, token);
      expect(seen.access).toBe(level);
    }
  });
});
