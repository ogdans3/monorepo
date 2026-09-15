import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createHarness, signUp, type Harness } from './helpers.js';

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

const uuid = () => crypto.randomUUID();
const iso = (date: Date) => date.toISOString();

describe('an account', () => {
  it('is made, and hands back a session straight away', async () => {
    const made = await call(h.app, 'POST', '/api/register', {
      body: { username: 'Gabriel', password: 'correct horse' },
    });
    expect(made.status).toBe(201);
    const body = made.body as { token: string; user: { username: string } };
    // The casing typed is the casing kept, because it is the one they will see.
    expect(body.user.username).toBe('Gabriel');
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const me = await call(h.app, 'GET', '/api/me', { token: body.token });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ username: 'Gabriel', taps: 0 });
  });

  it('cannot be claimed twice, whatever the casing', async () => {
    await signUp(h.app, 'gabriel');
    const again = await call(h.app, 'POST', '/api/register', {
      body: { username: 'GABRIEL', password: 'another password' },
    });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ error: { code: 'taken' } });
  });

  it('signs in with the name in any casing, and refuses a wrong password', async () => {
    await signUp(h.app, 'gabriel', 'correct horse');

    const ok = await call(h.app, 'POST', '/api/login', {
      body: { username: 'GaBrIeL', password: 'correct horse' },
    });
    expect(ok.status).toBe(200);
    expect((ok.body as { token: string }).token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const wrong = await call(h.app, 'POST', '/api/login', {
      body: { username: 'gabriel', password: 'wrong horse' },
    });
    expect(wrong.status).toBe(401);
  });

  it('says the same thing about a wrong password and a name that does not exist', async () => {
    await signUp(h.app, 'gabriel', 'correct horse');

    const wrongPassword = await call(h.app, 'POST', '/api/login', {
      body: { username: 'gabriel', password: 'wrong horse' },
    });
    const noSuchName = await call(h.app, 'POST', '/api/login', {
      body: { username: 'nobody', password: 'wrong horse' },
    });

    // Telling them apart is how you find out which names exist.
    expect(noSuchName.status).toBe(wrongPassword.status);
    expect(noSuchName.body).toEqual(wrongPassword.body);
  });

  it('ends a session on sign-out, and signing out twice is still fine', async () => {
    const token = await signUp(h.app);

    expect((await call(h.app, 'POST', '/api/logout', { token })).status).toBe(204);
    expect((await call(h.app, 'GET', '/api/me', { token })).status).toBe(401);
    // Nothing to end is not a failure.
    expect((await call(h.app, 'POST', '/api/logout', { token })).status).toBe(204);
  });

  it('takes the taps with it when it is deleted', async () => {
    const token = await signUp(h.app);
    await call(h.app, 'POST', '/api/choices', {
      token,
      body: { choices: [{ id: uuid(), kind: 'good', at: iso(new Date()) }] },
    });

    expect((await call(h.app, 'DELETE', '/api/me', { token })).status).toBe(204);
    expect((await call(h.app, 'GET', '/api/me', { token })).status).toBe(401);

    const left = await h.sql`select count(*)::int as n from choices`;
    expect(left[0]!.n).toBe(0);
  });

  it('refuses a name or a password that is too short', async () => {
    const shortName = await call(h.app, 'POST', '/api/register', {
      body: { username: 'ab', password: 'long enough' },
    });
    expect(shortName.status).toBe(400);

    const shortPassword = await call(h.app, 'POST', '/api/register', {
      body: { username: 'gabriel', password: 'short' },
    });
    expect(shortPassword.status).toBe(400);
  });
});

describe('taps', () => {
  it('are stored, and come back oldest first', async () => {
    const token = await signUp(h.app);
    const older = new Date('2026-09-01T10:00:00.000Z');
    const newer = new Date('2026-09-02T10:00:00.000Z');

    // Sent newest first on purpose: the order they arrive in is not the order
    // they happened in, and the reader cares about the second one.
    const sent = await call(h.app, 'POST', '/api/choices', {
      token,
      body: {
        choices: [
          { id: uuid(), kind: 'bad', at: iso(newer) },
          { id: uuid(), kind: 'good', at: iso(older) },
        ],
      },
    });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ stored: 2 });

    const back = await call(h.app, 'GET', '/api/choices', { token });
    const choices = (back.body as { choices: { kind: string; at: string }[] }).choices;
    expect(choices.map((c) => c.kind)).toEqual(['good', 'bad']);
    expect(choices[0]!.at).toBe(iso(older));
  });

  it('land once however many times the same batch is sent', async () => {
    const token = await signUp(h.app);
    const batch = { choices: [{ id: uuid(), kind: 'good' as const, at: iso(new Date()) }] };

    const first = await call(h.app, 'POST', '/api/choices', { token, body: batch });
    const retry = await call(h.app, 'POST', '/api/choices', { token, body: batch });

    expect(first.body).toEqual({ stored: 1 });
    // The id was minted at the moment of the tap, so a retry after a dropped
    // reply is the same tap and not a second one.
    expect(retry.body).toEqual({ stored: 0 });

    const back = await call(h.app, 'GET', '/api/choices', { token });
    expect((back.body as { choices: unknown[] }).choices).toHaveLength(1);
  });

  it('belong to one account and are invisible to another', async () => {
    const mine = await signUp(h.app, 'gabriel');
    const theirs = await signUp(h.app, 'somebody');

    await call(h.app, 'POST', '/api/choices', {
      token: mine,
      body: { choices: [{ id: uuid(), kind: 'good', at: iso(new Date()) }] },
    });

    const back = await call(h.app, 'GET', '/api/choices', { token: theirs });
    expect((back.body as { choices: unknown[] }).choices).toEqual([]);
  });

  it('can be asked for from a moment onwards', async () => {
    const token = await signUp(h.app);
    const old = new Date('2026-01-01T00:00:00.000Z');
    const recent = new Date('2026-09-01T00:00:00.000Z');
    await call(h.app, 'POST', '/api/choices', {
      token,
      body: {
        choices: [
          { id: uuid(), kind: 'good', at: iso(old) },
          { id: uuid(), kind: 'bad', at: iso(recent) },
        ],
      },
    });

    const back = await call(h.app, 'GET', '/api/choices?since=2026-06-01T00:00:00.000Z', { token });
    const choices = (back.body as { choices: { at: string }[] }).choices;
    expect(choices).toHaveLength(1);
    expect(choices[0]!.at).toBe(iso(recent));
  });

  it('need a session', async () => {
    expect((await call(h.app, 'GET', '/api/choices')).status).toBe(401);
    expect(
      (
        await call(h.app, 'POST', '/api/choices', {
          body: { choices: [{ id: uuid(), kind: 'good', at: iso(new Date()) }] },
        })
      ).status,
    ).toBe(401);
  });

  it('refuse a kind that is not one of the two', async () => {
    const token = await signUp(h.app);
    const sent = await call(h.app, 'POST', '/api/choices', {
      token,
      body: { choices: [{ id: uuid(), kind: 'maybe', at: iso(new Date()) }] },
    });
    expect(sent.status).toBe(400);
  });
});

describe('caching', () => {
  /**
   * Every list answers at the same address: `GET /api/choices` is the URL for
   * everybody, and the bearer token decides whose taps come back. A cache keys
   * on the URL, so without this one account's history is served to the next one.
   */
  it('is forbidden on anything the API says', async () => {
    const token = await signUp(h.app);
    const back = await call(h.app, 'GET', '/api/choices', { token });
    expect(back.headers['cache-control']).toBe('no-store');
    expect(String(back.headers.vary).toLowerCase()).toContain('authorization');

    const refused = await call(h.app, 'GET', '/api/choices');
    expect(refused.status).toBe(401);
    expect(refused.headers['cache-control']).toBe('no-store');
  });
});
