import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { shareUrl } from '@checkpost/contract';
import { generateShareToken, hashShareToken } from '../lib/tokens.js';
import { renderAdmin } from '../admin/page.js';
import { AdminService } from '../services/admin-service.js';

const paramsSchema = z.object({ listId: z.string().uuid() });

/**
 * The operator console.
 *
 * It exists only when ADMIN_USER and ADMIN_PASSWORD are both set. There is no
 * fallback password, because an admin surface that appears by default is a way
 * to hand somebody your database.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const { adminUser, adminPassword, webOrigin, databaseHost } = app.adminConfig;
  if (!adminUser || !adminPassword) {
    app.log.info('admin console disabled: ADMIN_USER or ADMIN_PASSWORD is unset');
    return;
  }

  const service = new AdminService(app.db);

  /**
   * Basic auth. Compared in constant time so the response cannot be used to
   * learn the password one character at a time.
   */
  function authorised(request: FastifyRequest, reply: FastifyReply): boolean {
    const header = request.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');
    if (scheme?.toLowerCase() === 'basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const index = decoded.indexOf(':');
      const user = decoded.slice(0, index);
      const password = decoded.slice(index + 1);
      if (equal(user, adminUser) && equal(password, adminPassword)) return true;
    }
    reply
      .code(401)
      .header('www-authenticate', 'Basic realm="Checkpost admin", charset="UTF-8"')
      .type('text/plain')
      .send('Not today.');
    return false;
  }

  /**
   * Basic credentials are attached by the browser to any request to this
   * origin, including one triggered by another site, so the destructive actions
   * carry a token tied to both the password and the row they act on.
   */
  const csrf = (listId: string) =>
    createHmac('sha256', adminPassword).update(`admin:${listId}`).digest('base64url');

  function csrfOk(listId: string, presented: unknown): boolean {
    return typeof presented === 'string' && equal(presented, csrf(listId));
  }

  app.get('/admin', async (request, reply) => {
    if (!authorised(request, reply)) return reply;
    const [totals, lists, orphanLinks] = await Promise.all([
      service.totals(),
      service.recentLists(200),
      service.orphanLinkCount(),
    ]);
    const query = request.query as { notice?: string };
    return reply
      .type('text/html; charset=utf-8')
      .header('cache-control', 'no-store')
      .send(
        renderAdmin({
          totals,
          lists,
          orphanLinks,
          databaseHost,
          webOrigin,
          csrf,
          notice: query.notice === 'deleted' ? 'List deleted. It is gone for everyone.' : null,
        }),
      );
  });

  app.post(
    '/admin/lists/:listId/reissue',
    { config: { rateLimit: { max: 60, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!authorised(request, reply)) return reply;
      const params = paramsSchema.safeParse(request.params);
      if (!params.success) return reply.code(400).type('text/plain').send('No such list.');
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (!csrfOk(params.data.listId, body.csrf)) {
        return reply.code(403).type('text/plain').send('Stale page. Reload and try again.');
      }
      if (!(await service.listExists(params.data.listId))) {
        return reply.code(404).type('text/plain').send('That list is gone.');
      }

      const token = generateShareToken();
      await service.reissueLink(params.data.listId, hashShareToken(token));

      const [totals, lists, orphanLinks] = await Promise.all([
        service.totals(),
        service.recentLists(200),
        service.orphanLinkCount(),
      ]);
      // Rendered rather than redirected, because the token exists in memory for
      // this one response and nowhere else. A redirect would either lose it or
      // put it in a URL, and a token in a URL is a token in a log.
      return reply
        .type('text/html; charset=utf-8')
        .header('cache-control', 'no-store')
        .send(
          renderAdmin({
            totals,
            lists,
            orphanLinks,
            databaseHost,
            webOrigin,
            csrf,
            revealed: { listId: params.data.listId, url: shareUrl(webOrigin, token) },
          }),
        );
    },
  );

  app.post('/admin/lists/:listId/delete', async (request, reply) => {
    if (!authorised(request, reply)) return reply;
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).type('text/plain').send('No such list.');
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (!csrfOk(params.data.listId, body.csrf)) {
      return reply.code(403).type('text/plain').send('Stale page. Reload and try again.');
    }
    await service.deleteList(params.data.listId);
    return reply.redirect('/v1/admin?notice=deleted', 303);
  });
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    // Still compare something, so the timing does not leak the length.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
