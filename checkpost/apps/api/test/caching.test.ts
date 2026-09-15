import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createHarness, newList, type Harness } from './helpers.js';

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

/**
 * Every list in this product answers at the same address. `GET /v1/list` is the
 * URL for all of them and the bearer token decides which one you get, so a
 * cache keying on the URL hands one link's answer to the next link that asks.
 *
 * This is not a hypothetical. A single rotation put a `410 Gone` in a browser's
 * cache, and every list that browser opened afterwards reported "this link was
 * replaced" — 410 is cacheable by default, and nothing in the response said
 * otherwise. The same hole would serve one list's contents to a token for
 * another, which is the version of this bug that matters.
 */
describe('nothing the API says may be cached', () => {
  async function headersFor(url: string, token?: string) {
    const response = await h.app.inject({
      method: 'GET',
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return { status: response.statusCode, headers: response.headers };
  }

  it('forbids storing a successful answer, and keys it on the credential', async () => {
    const list = await newList(h.app, 'Cabin', ['Firewood']);
    const { status, headers } = await headersFor('/v1/list', list.token);

    expect(status).toBe(200);
    expect(headers['cache-control']).toBe('no-store');
    expect(String(headers.vary).toLowerCase()).toContain('authorization');
  });

  it('forbids storing the 410 a replaced link gets', async () => {
    const list = await newList(h.app, 'Cabin');
    const rotated = await call(h.app, 'POST', '/v1/list/rotate', { token: list.token });
    expect(rotated.status).toBe(200);

    const { status, headers } = await headersFor('/v1/list', list.token);

    // The status is the product behaviour, and it is deliberate. What must
    // never happen is a cache keeping it and replaying it to the next list.
    expect(status).toBe(410);
    expect(headers['cache-control']).toBe('no-store');
    expect(String(headers.vary).toLowerCase()).toContain('authorization');
  });

  it('forbids storing a refusal or a miss', async () => {
    const unauthorized = await headersFor('/v1/list');
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers['cache-control']).toBe('no-store');

    const missing = await headersFor('/v1/nothing-here');
    expect(missing.status).toBe(404);
    expect(missing.headers['cache-control']).toBe('no-store');
  });

  it('forbids storing the change feed, which two lists also share a URL for', async () => {
    const list = await newList(h.app, 'Cabin');
    const { status, headers } = await headersFor('/v1/list/changes?since=0', list.token);

    expect(status).toBe(200);
    expect(headers['cache-control']).toBe('no-store');
    expect(String(headers.vary).toLowerCase()).toContain('authorization');
  });
});
