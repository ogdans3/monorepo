import type { ServerFrame } from '@checkpost/contract';
import { apiOrigin } from './api';

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
 */
export class Realtime {
  #socket: WebSocket | null = null;
  #retry: ReturnType<typeof setTimeout> | null = null;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #attempt = 0;
  #closed = false;
  #revoked = false;

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
      this.onOpen();
      this.#heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send('{"type":"ping"}');
      }, 45_000);
    };

    socket.onmessage = (event) => {
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
