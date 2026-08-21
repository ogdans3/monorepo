import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import type { CreateListResponse, Item, Snapshot } from '@checkpost/contract';

export interface Harness {
  app: FastifyInstance;
  close(): Promise<void>;
  reset(): Promise<void>;
}

export async function createHarness(overrides: Record<string, string> = {}): Promise<Harness> {
  const env = loadEnv({ ...process.env, ...overrides });
  const built = await buildApp(env);
  return {
    app: built.app,
    close: built.close,
    async reset() {
      // Cascades take care of items, links and events.
      await built.app.db.execute(sql`truncate table lists cascade`);
      // The API did not make that happen, so nothing invalidated the read
      // cache. Every other way rows disappear goes through a service that does.
      built.app.cache.clear();
    },
  };
}

type Json = Record<string, unknown> | undefined;

export interface CallOptions {
  token?: string;
  actor?: string;
  body?: Json;
}

/** Thin wrapper over `app.inject` that speaks the product's auth scheme. */
export async function call(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  options: CallOptions = {},
) {
  // Only declare a JSON body when there is one: Fastify rejects an empty body
  // that claims to be application/json, which is exactly what a DELETE sends.
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.actor) headers['x-checkpost-client'] = options.actor;
  const response = await app.inject({
    method,
    url,
    headers,
    ...(options.body === undefined ? {} : { payload: JSON.stringify(options.body) }),
  });
  return {
    status: response.statusCode,
    body: response.body ? (JSON.parse(response.body) as unknown) : undefined,
  };
}

export async function newList(
  app: FastifyInstance,
  title = 'Test list',
  items?: string[],
): Promise<CreateListResponse> {
  const response = await call(app, 'POST', '/v1/lists', {
    body: items ? { title, items } : { title },
  });
  if (response.status !== 201) {
    throw new Error(`create list failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body as CreateListResponse;
}

export async function addItem(
  app: FastifyInstance,
  token: string,
  body: Record<string, unknown>,
): Promise<Item> {
  const response = await call(app, 'POST', '/v1/list/items', { token, body });
  if (response.status !== 201) {
    throw new Error(`add item failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body as Item;
}

export async function snapshot(app: FastifyInstance, token: string): Promise<Snapshot> {
  const response = await call(app, 'GET', '/v1/list', { token });
  if (response.status !== 200) {
    throw new Error(`snapshot failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body as Snapshot;
}

export const texts = (snap: Snapshot): string[] => snap.items.map((item) => item.text);
