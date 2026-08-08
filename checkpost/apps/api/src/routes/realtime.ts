import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ServerFrame } from '@checkpost/contract';
import { clientFrameSchema } from '@checkpost/contract';
import { ApiError } from '../lib/errors.js';
import { bearerFrom, isWellFormedToken } from '../lib/tokens.js';
import type { Subscriber } from '../realtime/hub.js';
import type { LinkContext } from '../services/list-service.js';

/** How often we ping an idle socket to notice half-open connections. */
const HEARTBEAT_MS = 30_000;

const SUBPROTOCOL = 'checkpost.bearer';

/**
 * Browsers cannot set headers on a WebSocket handshake, so the token may also
 * arrive as the second entry of `Sec-WebSocket-Protocol`. It is never accepted
 * in the query string: query strings end up in access logs and proxy caches,
 * and this token is the entire credential.
 */
function tokenFrom(request: FastifyRequest): string | null {
  const fromHeader = bearerFrom(request.headers.authorization);
  if (fromHeader) return fromHeader;

  const raw = request.headers['sec-websocket-protocol'];
  const value = Array.isArray(raw) ? raw.join(',') : raw;
  if (!value) return null;
  const parts = value.split(',').map((p) => p.trim());
  if (parts[0] !== SUBPROTOCOL) return null;
  const candidate = parts[1];
  return candidate && isWellFormedToken(candidate) ? candidate : null;
}

export async function realtimeRoutes(app: FastifyInstance): Promise<void> {
  const service = app.listService;

  app.get(
    '/list/socket',
    {
      websocket: true,
      preValidation: async (request) => {
        const token = tokenFrom(request);
        if (!token) throw ApiError.unauthorized('This socket needs a valid share link.');
        const link = await service.resolveLink(token);
        // A copy link has nothing to watch. It cannot see the list it came
        // from, only mint a new one.
        if (link.access === 'copy') throw ApiError.copyLink();
        request.link = link;
      },
    },
    (socket, request) => {
      const link = request.link as LinkContext;
      let open = true;

      const subscriber: Subscriber = {
        send(frame: ServerFrame) {
          if (!open) return;
          try {
            socket.send(JSON.stringify(frame));
          } catch (error) {
            request.log.debug({ error }, 'dropped realtime frame');
          }
        },
        close() {
          open = false;
          try {
            socket.close(1000, 'revoked');
          } catch {
            /* already gone */
          }
        },
      };

      const unsubscribe = service.subscribeTo(link, subscriber);

      void service
        .snapshot(link.listId)
        .then(({ list }) => {
          subscriber.send({
            type: 'hello',
            revision: list.revision,
            presence: Math.max(1, app.hub.presence(link.listId)),
          });
        })
        .catch(() => subscriber.close());

      const heartbeat = setInterval(() => {
        if (!open) return;
        try {
          socket.ping();
        } catch {
          /* the close handler will clean up */
        }
      }, HEARTBEAT_MS);
      heartbeat.unref?.();

      socket.on('message', (raw: Buffer) => {
        // The socket is a read path. Every mutation goes over HTTP, where it is
        // idempotent, retryable and rate limited, so the only frame we accept
        // is a liveness ping.
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.toString('utf8'));
        } catch {
          return;
        }
        const frame = clientFrameSchema.safeParse(parsed);
        if (frame.success && frame.data.type === 'ping') subscriber.send({ type: 'pong' });
      });

      socket.on('close', () => {
        open = false;
        clearInterval(heartbeat);
        unsubscribe();
      });

      socket.on('error', (error: Error) => {
        request.log.debug({ error }, 'realtime socket error');
      });
    },
  );
}
