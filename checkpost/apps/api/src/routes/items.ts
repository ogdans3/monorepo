import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createItemBodySchema, updateItemBodySchema } from '@checkpost/contract';
import { ApiError } from '../lib/errors.js';
import { linkOf, requireLink } from '../plugins/context.js';
import { parseBody } from './parse.js';

const itemParamsSchema = z.object({ itemId: z.string().uuid() });

export async function itemRoutes(app: FastifyInstance): Promise<void> {
  const service = app.listService;
  const authed = requireLink(app);

  app.post('/list/items', { preHandler: authed }, async (request, reply) => {
    const body = parseBody(createItemBodySchema, request.body);
    const item = await service.createItem(linkOf(request), body, request.actor);
    return reply.code(201).send(item);
  });

  app.patch('/list/items/:itemId', { preHandler: authed }, async (request) => {
    const params = itemParamsSchema.safeParse(request.params);
    if (!params.success) throw ApiError.notFound('No such item.');
    const body = parseBody(updateItemBodySchema, request.body);
    return service.updateItem(linkOf(request), params.data.itemId, body, request.actor);
  });

  app.delete('/list/items/:itemId', { preHandler: authed }, async (request, reply) => {
    const params = itemParamsSchema.safeParse(request.params);
    if (!params.success) throw ApiError.notFound('No such item.');
    await service.deleteItem(linkOf(request), params.data.itemId, request.actor);
    return reply.code(204).send();
  });

  /** Empties the "done" shelf in one round trip and one change event. */
  app.post('/list/items/clear-checked', { preHandler: authed }, async (request) => {
    const removed = await service.clearChecked(linkOf(request), request.actor);
    return { removed };
  });
}
