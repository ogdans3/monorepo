import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createLinkBodySchema,
  createListBodySchema,
  updateListBodySchema,
} from '@checkpost/contract';
import { ApiError } from '../lib/errors.js';
import { linkOf, requireAccess, requireCopyLink } from '../plugins/context.js';
import { parseBody } from './parse.js';

const changesQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
});

const linkParamsSchema = z.object({ linkId: z.string().uuid() });

export async function listRoutes(app: FastifyInstance): Promise<void> {
  const service = app.listService;
  const canRead = requireAccess(app, 'read');
  const canWrite = requireAccess(app, 'write');
  const canAdmin = requireAccess(app, 'admin');

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

  app.get('/list', { preHandler: canRead }, async (request) => {
    const link = linkOf(request);
    service.touch(link.listId);
    return service.snapshot(link.listId, link.access);
  });

  app.get('/list/changes', { preHandler: canRead }, async (request) => {
    const link = linkOf(request);
    const query = changesQuerySchema.safeParse(request.query);
    if (!query.success) throw ApiError.badRequest('`since` must be a non-negative integer.');
    service.touch(link.listId);
    return service.changesSince(link.listId, query.data.since, link.access);
  });

  app.patch('/list', { preHandler: canWrite }, async (request) => {
    const link = linkOf(request);
    const body = parseBody(updateListBodySchema, request.body);
    return service.updateTitle(link, body.title, request.actor);
  });

  app.delete('/list', { preHandler: canAdmin }, async (request, reply) => {
    await service.deleteList(linkOf(request));
    return reply.code(204).send();
  });

  /**
   * Replaces the share link. Everyone holding the old one is disconnected and
   * gets a 410 on their next request. That is the entire point of the feature,
   * so it is a hard cut, not a grace period.
   */
  // ---------------------------------------------------------------------------
  // Links
  // ---------------------------------------------------------------------------

  /** Every live link on the list. Never their tokens, which are not stored. */
  app.get('/list/links', { preHandler: canAdmin }, async (request) =>
    service.links(linkOf(request)),
  );

  /**
   * Mints a link at a chosen level. The token comes back once, here, and is
   * never readable again.
   */
  app.post(
    '/list/links',
    { preHandler: canAdmin, config: { rateLimit: { max: 60, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const link = linkOf(request);
      const body = parseBody(createLinkBodySchema, request.body);
      const made = await service.createLink(link, body.access, body.label ?? '');
      return reply.code(201).send({
        link: made.link,
        token: made.token,
        url: service.urlFor(made.token),
      });
    },
  );

  app.delete('/list/links/:linkId', { preHandler: canAdmin }, async (request, reply) => {
    const params = linkParamsSchema.safeParse(request.params);
    if (!params.success) throw ApiError.notFound('No such link.');
    const link = linkOf(request);
    if (params.data.linkId === link.linkId) {
      // Revoking the link you are holding would lock you out mid-request.
      // Replacing it is the deliberate way to do that.
      throw ApiError.badRequest('That is the link you are using. Replace it instead.');
    }
    await service.revokeLink(link, params.data.linkId);
    return reply.code(204).send();
  });

  // ---------------------------------------------------------------------------
  // Copy links
  // ---------------------------------------------------------------------------

  /** What this copy link would make, without handing over the list itself. */
  app.get('/list/copy', { preHandler: requireCopyLink(app) }, async (request) =>
    service.copyPreview(linkOf(request)),
  );

  /**
   * Takes the copy. The caller gets admin on a list of their own, and still
   * cannot see the one it came from.
   */
  app.post(
    '/list/copy',
    {
      preHandler: requireCopyLink(app),
      config: { rateLimit: { max: app.rateLimits.create, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const made = await service.copyFromLink(linkOf(request));
      return reply.code(201).send({
        list: made.snapshot.list,
        items: made.snapshot.items,
        token: made.token,
        url: service.urlFor(made.token),
      });
    },
  );

  app.post(
    '/list/rotate',
    { preHandler: canAdmin, config: { rateLimit: { max: app.rateLimits.rotate, timeWindow: '1 hour' } } },
    async (request) => {
      const link = linkOf(request);
      const { token } = await service.rotateLink(link, request.actor);
      return { token, url: service.urlFor(token) };
    },
  );
}
