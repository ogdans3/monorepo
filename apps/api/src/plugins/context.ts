import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { CLIENT_ID_HEADER } from '@checkpost/contract';
import { ApiError } from '../lib/errors.js';
import { bearerFrom } from '../lib/tokens.js';
import type { LinkContext } from '../services/list-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireLink`; the list this request is allowed to touch. */
    link?: LinkContext;
    /** Opaque per-device id, echoed on events so a client can skip its own. */
    actor: string | null;
  }
}

/** Trims the device id to something bounded and log-safe. */
function readActor(request: FastifyRequest): string | null {
  const raw = request.headers[CLIENT_ID_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const trimmed = value.trim().slice(0, 64);
  return /^[A-Za-z0-9_-]{4,64}$/.test(trimmed) ? trimmed : null;
}

export function registerContext(app: FastifyInstance): void {
  app.decorateRequest('link', undefined);
  app.decorateRequest('actor', null);
  app.addHook('onRequest', async (request) => {
    request.actor = readActor(request);
  });
}

/**
 * The whole authorisation model: a bearer share token resolves to exactly one
 * list, and nothing else is reachable.
 */
export function requireLink(app: FastifyInstance): preHandlerHookHandler {
  return async (request) => {
    const token = bearerFrom(request.headers.authorization);
    if (!token) throw ApiError.unauthorized('This request needs a valid share link.');
    request.link = await app.listService.resolveLink(token);
  };
}

export function linkOf(request: FastifyRequest): LinkContext {
  if (!request.link) throw ApiError.unauthorized('This request needs a valid share link.');
  return request.link;
}
