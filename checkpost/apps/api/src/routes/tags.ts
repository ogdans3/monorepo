import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createTagBodySchema, updateTagBodySchema } from '@checkpost/contract';
import { ApiError } from '../lib/errors.js';
import { linkOf, requireAccess } from '../plugins/context.js';
import { parseBody } from './parse.js';

const tagParamsSchema = z.object({ tagId: z.string().uuid() });

/**
 * A list's tags. Reading them needs no route of its own: they come with the
 * snapshot and move through the change feed like everything else. Making,
 * renaming, recolouring and deleting one changes what everybody on the list
 * sees, so all of it needs a link that can write.
 */
export async function tagRoutes(app: FastifyInstance): Promise<void> {
  const service = app.listService;
  const authed = requireAccess(app, 'write');

  app.post('/list/tags', { preHandler: authed }, async (request, reply) => {
    const body = parseBody(createTagBodySchema, request.body);
    const { tag, created } = await service.createTag(linkOf(request), body, request.actor);
    // 200 rather than 201 when the list already had it, which is worth
    // knowing: the id that comes back is the one to tag rows with.
    return reply.code(created ? 201 : 200).send(tag);
  });

  app.patch('/list/tags/:tagId', { preHandler: authed }, async (request) => {
    const params = tagParamsSchema.safeParse(request.params);
    if (!params.success) throw ApiError.notFound('No such tag.');
    const body = parseBody(updateTagBodySchema, request.body);
    return service.updateTag(linkOf(request), params.data.tagId, body, request.actor);
  });

  app.delete('/list/tags/:tagId', { preHandler: authed }, async (request, reply) => {
    const params = tagParamsSchema.safeParse(request.params);
    if (!params.success) throw ApiError.notFound('No such tag.');
    await service.deleteTag(linkOf(request), params.data.tagId, request.actor);
    return reply.code(204).send();
  });
}
