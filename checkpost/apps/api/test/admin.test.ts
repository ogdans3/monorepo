import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { SHARE_TOKEN_PATTERN } from '@checkpost/contract';
import { buildApp, type BuiltApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { call, newList } from './helpers.js';

const USER = 'ogdans3';
const PASSWORD = 'a-test-password';
const basic = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;

let built: BuiltApp | null = null;

async function adminApp(overrides: Record<string, string> = {}): Promise<BuiltApp> {
  built = await buildApp(
    loadEnv({ ...process.env, ADMIN_USER: USER, ADMIN_PASSWORD: PASSWORD, ...overrides }),
  );
  await built.app.db.execute(sql`truncate table lists cascade`);
  return built;
}

afterEach(async () => {
  await built?.close();
  built = null;
});

/** Fastify's inject, speaking HTML forms rather than JSON. */
async function form(
  app: BuiltApp['app'],
  url: string,
  fields: Record<string, string>,
  auth = basic,
) {
  return app.inject({
    method: 'POST',
    url,
    headers: { authorization: auth, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams(fields).toString(),
  });
}

describe('the admin console', () => {
  it('does not exist unless a user and password are both set', async () => {
    const { app } = await adminApp({ ADMIN_USER: '', ADMIN_PASSWORD: '' });
    // Not 401, not a login prompt. There is nothing there at all.
    expect((await call(app, 'GET', '/v1/admin')).status).toBe(404);
  });

  it('asks for credentials, and refuses the wrong ones', async () => {
    const { app } = await adminApp();

    const anonymous = await app.inject({ method: 'GET', url: '/v1/admin' });
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.headers['www-authenticate']).toContain('Basic');

    const wrong = await app.inject({
      method: 'GET',
      url: '/v1/admin',
      headers: { authorization: `Basic ${Buffer.from(`${USER}:nope`).toString('base64')}` },
    });
    expect(wrong.statusCode).toBe(401);
  });

  it('counts what there is', async () => {
    const { app } = await adminApp();
    const list = await newList(app, 'Cabin, Friday', ['Firewood', 'Coffee']);
    await call(app, 'PATCH', `/v1/list/items/${list.items[0]!.id}`, {
      token: list.token,
      body: { checked: true },
    });

    const page = await app.inject({
      method: 'GET',
      url: '/v1/admin',
      headers: { authorization: basic },
    });
    expect(page.statusCode).toBe(200);
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.body).toContain('Cabin, Friday');
    expect(page.body).toMatch(/Ticked off<\/dt><dd>1/);
    expect(page.body).toMatch(/Items<\/dt><dd>2/);
  });

  it('counts each list, not just the totals', async () => {
    const { app } = await adminApp();
    const busy = await newList(app, 'Busy', ['One', 'Two', 'Three']);
    await newList(app, 'Untouched');
    await call(app, 'PATCH', `/v1/list/items/${busy.items[0]!.id}`, {
      token: busy.token,
      body: { checked: true },
    });

    const page = await app.inject({
      method: 'GET',
      url: '/v1/admin',
      headers: { authorization: basic },
    });

    // The per-row counts are correlated subqueries and were silently returning
    // zero for every list while the totals above them were right. A dashboard
    // that lies quietly is worse than one that is missing.
    const rows = page.body.split('<tr>').filter((row) => row.includes('class="title"'));
    const busyRow = rows.find((row) => row.includes('Busy'))!;
    const idleRow = rows.find((row) => row.includes('Untouched'))!;
    expect(busyRow).toMatch(/class="num">1<span class="of"> \/ 3</);
    expect(busyRow).toMatch(/class="num">1</);
    expect(idleRow).toMatch(/class="num">0<span class="of"> \/ 0</);
  });

  it('never renders a list title as markup', async () => {
    const { app } = await adminApp();
    // Anyone with a link can name a list, so the console renders hostile input.
    await newList(app, '<img src=x onerror=alert(1)>');

    const page = await app.inject({
      method: 'GET',
      url: '/v1/admin',
      headers: { authorization: basic },
    });
    expect(page.body).not.toContain('<img src=x');
    expect(page.body).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('never leaks the database password onto the page', async () => {
    const { app } = await adminApp();
    const page = await app.inject({
      method: 'GET',
      url: '/v1/admin',
      headers: { authorization: basic },
    });
    const password = new URL(process.env.DATABASE_URL!).password;
    if (password) expect(page.body).not.toContain(password);
  });

  it('issues a new link, shows it once, and kills the old one', async () => {
    const { app } = await adminApp();
    const list = await newList(app, 'Secret', ['One']);

    const page = await app.inject({
      method: 'GET',
      url: '/v1/admin',
      headers: { authorization: basic },
    });
    const csrf = /name="csrf" value="([^"]+)"/.exec(page.body)?.[1];
    expect(csrf).toBeTruthy();

    const reissued = await form(app, `/v1/admin/lists/${list.list.id}/reissue`, { csrf: csrf! });
    expect(reissued.statusCode).toBe(200);

    const shown = /\/l\/([A-Za-z0-9_-]{43})/.exec(reissued.body)?.[1];
    expect(shown).toMatch(SHARE_TOKEN_PATTERN);
    expect(shown).not.toBe(list.token);

    // The old link is Gone, and the new one works.
    expect((await call(app, 'GET', '/v1/list', { token: list.token })).status).toBe(410);
    expect((await call(app, 'GET', '/v1/list', { token: shown! })).status).toBe(200);
  });

  it('refuses a destructive action without the right token', async () => {
    const { app } = await adminApp();
    const list = await newList(app, 'Secret', ['One']);

    // Basic credentials ride along on any request the browser makes to this
    // origin, so the form token is what stops another site from posting here.
    const forged = await form(app, `/v1/admin/lists/${list.list.id}/delete`, { csrf: 'nope' });
    expect(forged.statusCode).toBe(403);
    expect((await call(app, 'GET', '/v1/list', { token: list.token })).status).toBe(200);
  });

  it('deletes a list for everyone', async () => {
    const { app } = await adminApp();
    const list = await newList(app, 'Temp', ['One']);

    const page = await app.inject({
      method: 'GET',
      url: '/v1/admin',
      headers: { authorization: basic },
    });
    const csrf = /name="csrf" value="([^"]+)"/.exec(page.body)?.[1];

    const deleted = await form(app, `/v1/admin/lists/${list.list.id}/delete`, { csrf: csrf! });
    expect(deleted.statusCode).toBe(303);
    expect((await call(app, 'GET', '/v1/list', { token: list.token })).status).toBe(410);
  });
});
