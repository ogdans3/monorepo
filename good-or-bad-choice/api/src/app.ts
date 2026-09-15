import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { bearerFrom, hashPassword, hashToken, mintToken, verifyPassword } from './auth.js';
import { createDb, type Sql } from './db.js';
import type { Env } from './env.js';
import { ApiError } from './errors.js';
import { Attempts } from './attempts.js';

export interface BuiltApp {
  app: FastifyInstance;
  sql: Sql;
  close(): Promise<void>;
}

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'A name needs at least three characters.')
  .max(32, 'That name is too long.')
  .regex(/^[\p{L}\p{N}._-]+$/u, 'Letters, numbers, dots, dashes and underscores.');

// Eight characters, and nothing else. A rule about symbols would push people
// towards one memorable password with a 1 on the end, which is worse.
const passwordSchema = z.string().min(8, 'Eight characters or more.').max(200);

const credentialsSchema = z.object({ username: usernameSchema, password: passwordSchema });

const choiceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(['good', 'bad']),
  at: z.iso.datetime({ offset: true }),
});

/** One request carries a batch, because a device that has been offline has a pile. */
const MAX_BATCH = 500;
const syncSchema = z.object({ choices: z.array(choiceSchema).max(MAX_BATCH) });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const first = parsed.error.issues[0];
  throw ApiError.badRequest(first?.message ?? 'That request did not make sense.');
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function buildApp(env: Env): Promise<BuiltApp> {
  const sql = createDb(env.DATABASE_URL);
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.LOG_LEVEL },
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
  });

  /**
   * Nothing the API returns may be stored by a cache. Every answer here is
   * keyed by a bearer token rather than by anything in the URL, so a cache that
   * keys on the URL would serve one person's taps to the next one.
   */
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.header('cache-control', 'no-store');
      reply.header('vary', 'Authorization');
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      request.log.debug({ err: error, code: error.code }, 'api error');
      return reply.code(error.status).send(error.toResponse());
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply
        .code(status)
        .send({ error: { code: 'bad_request', message: 'That request did not make sense.' } });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply
      .code(500)
      .send({ error: { code: 'internal', message: 'Something broke on our side. Try again.' } });
  });

  // Sign-in attempts, per address. Guessing a password is the only thing here
  // worth doing at volume, and this is enough to make it pointless without a
  // dependency or a shared store.
  const signIns = new Attempts({ max: 20, windowMs: 10 * 60_000 });

  async function requireUser(request: FastifyRequest): Promise<string> {
    if (request.userId) return request.userId;
    const token = bearerFrom(request.headers.authorization);
    if (!token) throw ApiError.unauthorized();
    const hash = hashToken(token);
    const [row] = await sql<{ user_id: string }[]>`
      update sessions set last_seen_at = now()
      where token_hash = ${hash}
      returning user_id
    `;
    if (!row) throw ApiError.unauthorized('That sign-in has expired. Sign in again.');
    request.userId = row.user_id;
    return row.user_id;
  }

  async function startSession(userId: string): Promise<string> {
    const token = mintToken();
    await sql`insert into sessions (token_hash, user_id) values (${hashToken(token)}, ${userId})`;
    return token;
  }

  // -------------------------------------------------------------------------
  // Account
  // -------------------------------------------------------------------------

  app.get('/api/health', async () => {
    await sql`select 1`;
    return { ok: true };
  });

  app.post('/api/register', async (request, reply) => {
    const { username, password } = parse(credentialsSchema, request.body);
    if (!signIns.allow(request.ip)) throw ApiError.tooMany();

    const hash = await hashPassword(password);
    // The unique index decides, not a prior SELECT: two people registering the
    // same name at once would both pass the check and one would still fail.
    const [row] = await sql<{ id: string; username: string; created_at: Date }[]>`
      insert into users (username, password_hash)
      values (${username}, ${hash})
      on conflict do nothing
      returning id, username, created_at
    `;
    if (!row) throw ApiError.taken('That name is taken. Pick another.');

    const token = await startSession(row.id);
    return reply.code(201).send({
      token,
      user: { username: row.username, since: row.created_at.toISOString() },
    });
  });

  app.post('/api/login', async (request) => {
    const { username, password } = parse(credentialsSchema, request.body);
    if (!signIns.allow(request.ip)) throw ApiError.tooMany();

    const [row] = await sql<{ id: string; username: string; password_hash: string; created_at: Date }[]>`
      select id, username, password_hash, created_at
      from users where lower(username) = lower(${username})
    `;

    // The same answer either way, and the same amount of work either way: a
    // missing name that returns instantly tells an attacker which names exist.
    const ok = row
      ? await verifyPassword(password, row.password_hash)
      : await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
    if (!row || !ok) throw ApiError.unauthorized('That name and password do not match.');

    signIns.forget(request.ip);
    const token = await startSession(row.id);
    return { token, user: { username: row.username, since: row.created_at.toISOString() } };
  });

  app.post('/api/logout', async (request, reply) => {
    const token = bearerFrom(request.headers.authorization);
    // Signing out of a session that is already gone is a success, not a 401.
    if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
    return reply.code(204).send();
  });

  app.get('/api/me', async (request) => {
    const userId = await requireUser(request);
    const [row] = await sql<{ username: string; created_at: Date; taps: number }[]>`
      select u.username,
             u.created_at,
             (select count(*)::int from choices c where c.user_id = u.id) as taps
      from users u where u.id = ${userId}
    `;
    if (!row) throw ApiError.unauthorized();
    return { username: row.username, since: row.created_at.toISOString(), taps: row.taps };
  });

  /** Everything, gone. The taps go with the account, by cascade. */
  app.delete('/api/me', async (request, reply) => {
    const userId = await requireUser(request);
    await sql`delete from users where id = ${userId}`;
    return reply.code(204).send();
  });

  // -------------------------------------------------------------------------
  // Choices
  // -------------------------------------------------------------------------

  /**
   * Takes a batch and returns nothing but a count.
   *
   * An upsert on a client-minted id, so a device that lost the reply and sends
   * the batch again lands exactly where it did the first time. The server never
   * invents a choice and never edits one: a tap is a fact about a moment, and
   * the only honest thing to do with a repeat is ignore it.
   */
  app.post('/api/choices', async (request) => {
    const userId = await requireUser(request);
    const { choices } = parse(syncSchema, request.body);
    if (choices.length === 0) return { stored: 0 };

    const rows = choices.map((choice) => ({
      id: choice.id,
      user_id: userId,
      kind: choice.kind,
      at: new Date(choice.at),
    }));
    const stored = await sql`
      insert into choices ${sql(rows, 'id', 'user_id', 'kind', 'at')}
      on conflict (id) do nothing
      returning id
    `;
    return { stored: stored.length };
  });

  /**
   * Everything this account has, oldest first. There is no paging and there
   * does not need to be: a tap is 60 bytes and a very busy decade is under a
   * megabyte. This runs when somebody signs in on a second device, and almost
   * never again.
   */
  app.get('/api/choices', async (request) => {
    const userId = await requireUser(request);
    const since = z.iso.datetime({ offset: true }).optional().safeParse(
      (request.query as { since?: string } | undefined)?.since,
    );
    if (!since.success) throw ApiError.badRequest('`since` must be a timestamp.');

    const rows = since.data
      ? await sql<{ id: string; kind: string; at: Date }[]>`
          select id, kind, at from choices
          where user_id = ${userId} and at >= ${new Date(since.data)}
          order by at asc`
      : await sql<{ id: string; kind: string; at: Date }[]>`
          select id, kind, at from choices
          where user_id = ${userId}
          order by at asc`;

    return {
      choices: rows.map((row) => ({ id: row.id, kind: row.kind, at: row.at.toISOString() })),
    };
  });

  // -------------------------------------------------------------------------
  // The browser client
  // -------------------------------------------------------------------------

  if (env.PUBLIC_DIR && existsSync(env.PUBLIC_DIR)) {
    await app.register(fastifyStatic, { root: env.PUBLIC_DIR, cacheControl: false });

    /**
     * Flutter names three things without a content hash — index.html points at
     * flutter_bootstrap.js, which points at main.dart.js — and all three keep
     * their names across builds. Cached for a year behind a CDN, a deploy
     * becomes invisible: the origin has the new app and the edge goes on
     * serving the old one. Everything revalidates instead. The files carry
     * ETags, so an unchanged one still costs a 304 and no body.
     *
     * A hook rather than the plugin's `setHeaders`, because this is one rule
     * about every response that is not the API and it belongs in one place.
     */
    app.addHook('onSend', async (request, reply, payload) => {
      if (!request.url.startsWith('/api/')) reply.header('cache-control', 'no-cache');
      return payload;
    });

    // The client owns its own routing, so anything that is not a file and not
    // the API is the app itself.
    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: { code: 'not_found', message: 'No such endpoint.' } });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.setNotFoundHandler(async (_request, reply) =>
      reply.code(404).send({ error: { code: 'not_found', message: 'No such endpoint.' } }),
    );
  }

  return {
    app,
    sql,
    async close() {
      await app.close();
      await sql.end({ timeout: 5 });
    },
  };
}
