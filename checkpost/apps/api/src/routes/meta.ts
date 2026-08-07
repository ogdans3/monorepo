import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { API_VERSION } from '@checkpost/contract';
import { VERSION } from '../version.js';

export async function metaRoutes(app: FastifyInstance): Promise<void> {
  /** Liveness: is the process up. Never touches the database. */
  app.get('/health', async () => ({ status: 'ok', version: VERSION, api: API_VERSION }));

  /** Readiness: can we actually serve traffic. */
  app.get('/ready', async (_request, reply) => {
    try {
      await app.db.execute(sql`select 1`);
      return { status: 'ok' };
    } catch (error) {
      app.log.error({ error }, 'readiness check failed');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
}
