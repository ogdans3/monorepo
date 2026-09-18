import type { ServerFrame } from '@checkpost/contract';
import { apiOrigin } from './api';

/** How often we prod the server, so an idle socket still proves it is there. */
const PING_MS = 15_000;
/**
 * How long a socket may say nothing at all before we stop believing in it.
 *
 * Long enough for two pings to go missing, because one lost packet on a phone
 * is normal and tearing the connection down over it would be worse than the
 * silence.
 */
const SILENT_MS = 40_000;

/**
 * The change feed for one list.
 *
 * A browser cannot set headers on a WebSocket handshake, so the token travels
 * as the second entry of `Sec-WebSocket-Protocol`, which the API accepts for
 * exactly this reason. It is never put in the query string, because query
 * strings end up in access logs and proxy caches and this token is the whole
 * credential.
 *
 * The socket is a hint and never the source of truth. Every connect is followed
 * by the caller asking what it missed, which is what makes a dropped connection
 * a non-event.
 *
 * It also has to notice when it has stopped being a connection at all. A phone
 * that changes network, or sits behind a NAT that forgets the mapping, leaves
 * a socket the browser still reports as `OPEN` and through which nothing will
 * ever arrive again. Nobody is told: there is no close, no error, no event of
 * any kind, and a list watched in that state simply stops moving while looking
 * perfectly healthy. So every frame is a sign of life, we ask for one on a
 * timer, and a socket that produces none for `SILENT_MS` is replaced whether
 * it thinks it is open or not.
 */
export class Realtime {
  #socket: WebSocket | null = null;
  #retry: ReturnType<typeof setTimeout> | null = null;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #attempt = 0;
  #closed = false;
  #revoked = false;
  /** When this socket last proved it was carrying traffic. */
  #heard = 0;

  constructor(
    private readonly token: string,
    private readonly onFrame: (frame: ServerFrame) => void,
    private readonly onOpen: () => void,
    private readonly onDrop: () => void,
  ) {}

  start() {
    if (this.#closed || this.#revoked) return;
    const url = new URL('/v1/list/socket', apiOrigin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

    let socket: WebSocket;
    try {
      socket = new WebSocket(url, ['checkpost.bearer', this.token]);
    } catch {
      this.#scheduleRetry();
      return;
    }
    this.#socket = socket;

    socket.onopen = () => {
      this.#attempt = 0;
      this.#heard = Date.now();
      this.onOpen();
      this.#heartbeat = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (Date.now() - this.#heard > SILENT_MS) {
          this.#abandon(socket);
          return;
        }
        // Answered with a `pong`, which is the point: the reply is what proves
        // the socket still reaches the server.
        socket.send('{"type":"ping"}');
      }, PING_MS);
    };

    socket.onmessage = (event) => {
      this.#heard = Date.now();
      let frame: ServerFrame;
      try {
        frame = JSON.parse(event.data as string) as ServerFrame;
      } catch {
        return;
      }
      if (frame.type === 'revoked') {
        // This token is dead. Reconnecting with a credential the server just
        // retired helps nobody.
        this.#revoked = true;
      }
      this.onFrame(frame);
    };

    socket.onerror = () => socket.close();
    socket.onclose = () => {
      this.#clearTimers();
      this.#socket = null;
      if (this.#closed || this.#revoked) return;
      this.onDrop();
      this.#scheduleRetry();
    };
  }

  /**
   * Drops a socket that has gone quiet and starts again.
   *
   * Its handlers are cleared first and the drop is reported by hand, because a
   * socket whose network is gone can sit in `CLOSING` until the browser's own
   * timeout expires, minutes later. Waiting for `onclose` to arrive is waiting
   * for the very thing that is broken.
   */
  #abandon(socket: WebSocket) {
    if (this.#socket !== socket) return;
    this.#clearTimers();
    this.#socket = null;
    socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
    try {
      socket.close();
    } catch {
      /* already gone */
    }
    if (this.#closed || this.#revoked) return;
    this.onDrop();
    this.#scheduleRetry();
  }

  #scheduleRetry() {
    if (this.#closed || this.#revoked) return;
    const base = Math.min(1000 * 2 ** this.#attempt++, 30_000);
    const delay = base / 2 + Math.random() * (base / 2);
    this.#retry = setTimeout(() => this.start(), delay);
  }

  #clearTimers() {
    if (this.#heartbeat) clearInterval(this.#heartbeat);
    if (this.#retry) clearTimeout(this.#retry);
    this.#heartbeat = null;
    this.#retry = null;
  }

  stop() {
    this.#closed = true;
    this.#clearTimers();
    this.#socket?.close();
    this.#socket = null;
  }
}
