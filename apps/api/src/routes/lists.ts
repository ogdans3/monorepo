import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createListBodySchema, updateListBodySchema } from '@checkpost/contract';
import { ApiError } from '../lib/errors.js';
import { linkOf, requireLink } from '../plugins/context.js';
import { parseBody } from './parse.js';

const changesQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
});

export async function listRoutes(app: FastifyInstance): Promise<void> {
  const service = app.listService;
  const authed = requireLink(app);

  /**
   * The only unauthenticated write in the product: making a list mints the
   * credential for it. Rate limited harder than everything else, because it is
   * the one endpoint that can grow the database from the outside.
   */
  app.post(
    '/lists',
    { config: { rateLimit: { max: app.rateLimits.create, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const body = parseBody(createListBodySchema, request.body);
      const created = await service.createList(body, request.actor);
      return reply.code(201).send({
        list: created.list,
        items: created.items,
        token: created.token,
        url: service.urlFor(created.token),
      });
    },
  );

  app.get('/list', { preHandler: authed }, async (request) => {
    const link = linkOf(request);
    service.touch(link.listId);
    return service.snapshot(link.listId);
  });

  app.get('/list/changes', { preHandler: authed }, async (request) => {
    const link = linkOf(request);
    const query = changesQuerySchema.safeParse(request.query);
    if (!query.success) throw ApiError.badRequest('`since` must be a non-negative integer.');
    service.touch(link.listId);
    return service.changesSince(link.listId, query.data.since);
  });

  app.patch('/list', { preHandler: authed }, async (request) => {
    const link = linkOf(request);
    const body = parseBody(updateListBodySchema, request.body);
    return service.updateTitle(link, body.title, request.actor);
  });

  app.delete('/list', { preHandler: authed }, async (request, reply) => {
    await service.deleteList(linkOf(request));
    return reply.code(204).send();
  });

  /**
   * Replaces the share link. Everyone holding the old one is disconnected and
   * gets a 410 on their next request — that is the entire point of the feature,
   * so it is a hard cut, not a grace period.
   */
  app.post(
    '/list/rotate',
    { preHandler: authed, config: { rateLimit: { max: app.rateLimits.rotate, timeWindow: '1 hour' } } },
    async (request) => {
      const link = linkOf(request);
      const { token } = await service.rotateLink(link, request.actor);
      return { token, url: service.urlFor(token) };
    },
  );
}
