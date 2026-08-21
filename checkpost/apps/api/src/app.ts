import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { API_VERSION, SHARE_TOKEN_PATTERN } from '@checkpost/contract';
import { createDb, type Database } from './db/index.js';
import type { Env } from './env.js';
import { ApiError } from './lib/errors.js';
import { registerContext } from './plugins/context.js';
import { RealtimeHub } from './realtime/hub.js';
import { adminRoutes } from './routes/admin.js';
import { itemRoutes } from './routes/items.js';
import { listRoutes } from './routes/lists.js';
import { metaRoutes } from './routes/meta.js';
import { realtimeRoutes } from './routes/realtime.js';
import { ListCache } from './services/list-cache.js';
import { ListService } from './services/list-service.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    hub: RealtimeHub;
    cache: ListCache;
    listService: ListService;
    rateLimits: { create: number; rotate: number };
    adminConfig: {
      adminUser: string;
      adminPassword: string;
      webOrigin: string;
      databaseHost: string;
    };
  }
}

export interface BuiltApp {
  app: FastifyInstance;
  close(): Promise<void>;
}

export async function buildApp(env: Env): Promise<BuiltApp> {
  const { db, close: closeDb } = createDb(env.DATABASE_URL);
  const hub = new RealtimeHub();
  const cache = new ListCache({
    enabled: env.CACHE_ENABLED,
    // Zero seconds means no expiry at all. See `CACHE_TTL_SECONDS` in env.ts.
    ttlMs: env.CACHE_TTL_SECONDS * 1000,
    maxEntries: env.CACHE_MAX_ENTRIES,
    maxSnapshots: env.CACHE_MAX_SNAPSHOTS,
    touchIntervalMs: env.TOUCH_INTERVAL_SECONDS * 1000,
  });
  const listService = new ListService(
    db,
    hub,
    {
      webOrigin: env.PUBLIC_WEB_ORIGIN,
      eventRetentionDays: env.EVENT_RETENTION_DAYS,
    },
    cache,
  );

  const app = Fastify({
    logger: buildLogger(env),
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
  });

  app.decorate('adminConfig', {
    adminUser: env.ADMIN_USER,
    adminPassword: env.ADMIN_PASSWORD,
    webOrigin: env.PUBLIC_WEB_ORIGIN,
    // Shown on the console so it is obvious which database you are looking at.
    // Host only: a password must never reach a rendered page.
    databaseHost: safeHost(env.DATABASE_URL),
  });
  app.decorate('rateLimits', {
    create: env.RATE_LIMIT_CREATE_MAX,
    rotate: env.RATE_LIMIT_ROTATE_MAX,
  });
  app.decorate('db', db);
  app.decorate('hub', hub);
  app.decorate('cache', cache);
  app.decorate('listService', listService);
  registerContext(app);

  await app.register(cors, {
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : false,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type', 'x-checkpost-client'],
    maxAge: 86_400,
  });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    // Keyed by caller, not by token: rate limiting exists to stop abuse from
    // one source, and several people legitimately share one token.
    keyGenerator: (request) => request.ip,
    // The plugin throws whatever this returns, so it has to be a real error.
    // Otherwise the limit surfaces as an unhandled 500 instead of a 429.
    errorResponseBuilder: () =>
      new ApiError('too_many_requests', 'Slow down for a moment, then try again.'),
  });

  // The admin console posts plain HTML forms, which Fastify does not parse
  // without this. Nothing else in the API accepts form encoding.
  await app.register(formbody);

  await app.register(websocket, {
    options: { maxPayload: 4 * 1024 },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      // 4xx here are ordinary product events (a rotated link, a deleted item),
      // so they are logged at debug and never as server errors.
      request.log.debug({ err: error, code: error.code }, 'api error');
      return reply.code(error.status).send(error.toResponse());
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.code(statusCode).send({
        error: { code: 'bad_request', message: 'That request did not make sense.' },
      });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.code(500).send({
      error: { code: 'internal', message: 'Something broke on our side. Try again.' },
    });
  });

  app.setNotFoundHandler(async (_request, reply) =>
    reply.code(404).send({ error: { code: 'not_found', message: 'No such endpoint.' } }),
  );

  await app.register(
    async (scope) => {
      await scope.register(metaRoutes);
      await scope.register(listRoutes);
      await scope.register(itemRoutes);
      await scope.register(realtimeRoutes);
      await scope.register(adminRoutes);
    },
    { prefix: `/${API_VERSION}` },
  );

  return {
    app,
    async close() {
      cache.clear();
      hub.closeAll();
      await app.close();
      await closeDb();
    },
  };
}

/** Hostname of a connection string, never its credentials. */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown host';
  }
}

function buildLogger(env: Env) {
  if (env.NODE_ENV === 'test') return false;
  return {
    level: env.LOG_LEVEL,
    // A share token in a log line is a leaked list. Redact them wherever they
    // could plausibly appear, and strip anything token-shaped from URLs.
    redact: {
      paths: ['req.headers.authorization', 'req.headers["sec-websocket-protocol"]'],
      censor: '[redacted]',
    },
    serializers: {
      req(request: { method: string; url: string; ip: string; id: string }) {
        return {
          id: request.id,
          method: request.method,
          url: request.url.replace(SHARE_TOKEN_PATTERN, '[token]'),
          ip: request.ip,
        };
      },
    },
    ...(env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
      : {}),
  };
}
