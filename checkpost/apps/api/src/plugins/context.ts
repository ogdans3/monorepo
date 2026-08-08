import type { FastifyInstance, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { CLIENT_ID_HEADER, allows, type DirectAccess } from '@checkpost/contract';
import { ApiError } from '../lib/errors.js';
import { bearerFrom } from '../lib/tokens.js';
import type { LinkContext } from '../services/list-service.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireAccess`; the list this request is allowed to touch. */
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
 * list, at exactly one level, and nothing else is reachable.
 *
 * The level is checked here rather than inside handlers so that adding a route
 * without deciding who may call it is not possible. Every list route names the
 * access it needs.
 */
export function requireAccess(
  app: FastifyInstance,
  needed: DirectAccess,
): preHandlerHookHandler {
  return async (request) => {
    const token = bearerFrom(request.headers.authorization);
    if (!token) throw ApiError.unauthorized('This request needs a valid share link.');
    const link = await app.listService.resolveLink(token);

    if (link.access === 'copy') {
      // A copy link is not a weak read link. It cannot see the list it came
      // from at all, only mint a new one, so this is a different answer.
      throw ApiError.copyLink();
    }
    if (!allows(link.access, needed)) throw ApiError.forbidden(deniedMessage(needed));

    request.link = link;
  };
}

/** Only a copy link may pass, and it may do exactly one thing. */
export function requireCopyLink(app: FastifyInstance): preHandlerHookHandler {
  return async (request) => {
    const token = bearerFrom(request.headers.authorization);
    if (!token) throw ApiError.unauthorized('This request needs a valid share link.');
    const link = await app.listService.resolveLink(token);
    if (link.access !== 'copy') {
      throw ApiError.forbidden('This link is not a copy link.');
    }
    request.link = link;
  };
}

function deniedMessage(needed: DirectAccess): string {
  if (needed === 'write') {
    return 'This link can only look at the list. Ask for one that can make changes.';
  }
  return 'This link cannot manage the list. Ask whoever set it up.';
}

export function linkOf(request: FastifyRequest): LinkContext {
  if (!request.link) throw ApiError.unauthorized('This request needs a valid share link.');
  return request.link;
}
