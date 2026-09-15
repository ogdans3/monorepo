import type { FastifyInstance } from 'fastify';
import { buildApp, type BuiltApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { TEST_DATABASE_URL } from './global-setup.js';

export interface Harness extends BuiltApp {
  reset(): Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    MIGRATE_ON_BOOT: '0',
  });
  const built = await buildApp(env);
  return {
    ...built,
    async reset() {
      // Sessions and choices go with it, by cascade.
      await built.sql`truncate table users cascade`;
    },
  };
}

type Json = Record<string, unknown>;

export async function call(
  app: FastifyInstance,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  options: { token?: string; body?: Json } = {},
) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const response = await app.inject({
    method,
    url,
    headers,
    ...(options.body === undefined ? {} : { payload: JSON.stringify(options.body) }),
  });
  return {
    status: response.statusCode,
    headers: response.headers,
    body: response.body ? (JSON.parse(response.body) as unknown) : undefined,
  };
}

/** Registers somebody and hands back their token. */
export async function signUp(
  app: FastifyInstance,
  username = 'gabriel',
  password = 'correct horse',
): Promise<string> {
  const made = await call(app, 'POST', '/api/register', { body: { username, password } });
  if (made.status !== 201) {
    throw new Error(`register failed: ${made.status} ${JSON.stringify(made.body)}`);
  }
  return (made.body as { token: string }).token;
}
