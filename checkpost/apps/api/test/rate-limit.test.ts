import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { buildApp, type BuiltApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { call, newList } from './helpers.js';

/**
 * The limiter runs with production-shaped (tiny) ceilings here. Everywhere else
 * it is turned up, because a test suite is not a threat model.
 *
 * Each test gets its own instance: the counters live in that instance's memory,
 * so sharing one would make the tests depend on each other's call counts.
 */
let built: BuiltApp | null = null;

async function appWithLimits(limits: Record<string, string>): Promise<BuiltApp> {
  built = await buildApp(loadEnv({ ...process.env, RATE_LIMIT_MAX: '1000', ...limits }));
  await built.app.db.execute(sql`truncate table lists cascade`);
  return built;
}

afterEach(async () => {
  await built?.close();
  built = null;
});

describe('rate limiting', () => {
  it('caps how many lists one caller can create, in the product error shape', async () => {
    const { app } = await appWithLimits({ RATE_LIMIT_CREATE_MAX: '3' });
    for (let i = 0; i < 3; i++) {
      expect((await call(app, 'POST', '/v1/lists', { body: { title: `L${i}` } })).status).toBe(201);
    }
    const blocked = await call(app, 'POST', '/v1/lists', { body: { title: 'one too many' } });
    expect(blocked.status).toBe(429);
    expect((blocked.body as { error: { code: string } }).error.code).toBe('too_many_requests');
  });

  it('caps link replacement without capping ordinary editing', async () => {
    const { app } = await appWithLimits({ RATE_LIMIT_ROTATE_MAX: '2' });
    const list = await newList(app, 'Rotating');
    let token = list.token;
    for (let i = 0; i < 2; i++) {
      const response = await call(app, 'POST', '/v1/list/rotate', { token });
      expect(response.status).toBe(200);
      token = (response.body as { token: string }).token;
    }
    expect((await call(app, 'POST', '/v1/list/rotate', { token })).status).toBe(429);

    // Editing is on the generous global limit, so the list still works.
    const added = await call(app, 'POST', '/v1/list/items', { token, body: { text: 'still fine' } });
    expect(added.status).toBe(201);
  });

  it('lets a busy household keep editing well past the create limit', async () => {
    const { app } = await appWithLimits({ RATE_LIMIT_CREATE_MAX: '1', RATE_LIMIT_MAX: '400' });
    const list = await newList(app, 'Shopping');
    for (let i = 0; i < 60; i++) {
      const response = await call(app, 'POST', '/v1/list/items', {
        token: list.token,
        body: { text: `item ${i}` },
      });
      expect(response.status).toBe(201);
    }
  });
});
