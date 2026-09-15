import type { ChangeEvent, ServerFrame } from '@checkpost/contract';

export interface Subscriber {
  /** Serialised frame out to one socket. Must never throw. */
  send(frame: ServerFrame): void;
  close(): void;
}

interface Room {
  subscribers: Set<Subscriber>;
  /** Live share-link id per subscriber, so rotation can evict the right ones. */
  linkIds: Map<Subscriber, string>;
}

/**
 * In-process fan-out of list changes to connected sockets.
 *
 * Deliberately not a cross-process bus. Checkpost writes go through Postgres
 * first and the socket is only a *hint*. Every client also reconciles with
 * `GET /changes?since=` on reconnect and on focus. That means a second API
 * instance costs correctness nothing: clients on the other instance find out a
 * beat later instead of instantly. When "a beat later" stops being good enough,
 * swap this class for one backed by Postgres `LISTEN/NOTIFY`. The interface is
 * the seam.
 */
export class RealtimeHub {
  readonly #rooms = new Map<string, Room>();

  subscribe(listId: string, linkId: string, subscriber: Subscriber): () => void {
    let room = this.#rooms.get(listId);
    if (!room) {
      room = { subscribers: new Set(), linkIds: new Map() };
      this.#rooms.set(listId, room);
    }
    room.subscribers.add(subscriber);
    room.linkIds.set(subscriber, linkId);
    // The joiner learns the count from its own `hello`. Telling it twice would
    // leave a stale presence frame queued ahead of the greeting.
    this.#announcePresence(listId, subscriber);
    return () => this.unsubscribe(listId, subscriber);
  }

  unsubscribe(listId: string, subscriber: Subscriber): void {
    const room = this.#rooms.get(listId);
    if (!room) return;
    room.subscribers.delete(subscriber);
    room.linkIds.delete(subscriber);
    if (room.subscribers.size === 0) {
      this.#rooms.delete(listId);
      return;
    }
    this.#announcePresence(listId);
  }

  presence(listId: string): number {
    return this.#rooms.get(listId)?.subscribers.size ?? 0;
  }

  broadcast(listId: string, event: ChangeEvent): void {
    const room = this.#rooms.get(listId);
    if (!room) return;
    const frame: ServerFrame = { type: 'change', event };
    for (const subscriber of room.subscribers) subscriber.send(frame);
  }

  /**
   * Disconnects everyone still holding a link that no longer works.
   * `revokedLinkId` spares the sockets on this list's *other* links, which is
   * what makes replacing one link a local act rather than a list-wide one.
   *
   * It cannot spare the device that did the rotating. That device is on the
   * link being retired like everyone else, and one link can legitimately be
   * open in several places at once, so there is nothing here to tell the
   * rotator apart from anyone else holding the token it just killed. It is
   * evicted too, and finds out it has a new one from the HTTP response. The
   * client is therefore required to ignore frames from a socket it is in the
   * middle of replacing — see `#connect` in the web and Flutter sessions.
   */
  evictLink(listId: string, revokedLinkId: string, reason: 'rotated' | 'deleted'): void {
    const room = this.#rooms.get(listId);
    if (!room) return;
    for (const subscriber of [...room.subscribers]) {
      if (reason === 'rotated' && room.linkIds.get(subscriber) !== revokedLinkId) continue;
      subscriber.send({ type: 'revoked', reason });
      subscriber.close();
    }
  }

  closeAll(): void {
    for (const room of this.#rooms.values()) {
      for (const subscriber of room.subscribers) subscriber.close();
    }
    this.#rooms.clear();
  }

  #announcePresence(listId: string, except?: Subscriber): void {
    const room = this.#rooms.get(listId);
    if (!room) return;
    const frame: ServerFrame = { type: 'presence', presence: room.subscribers.size };
    for (const subscriber of room.subscribers) {
      if (subscriber !== except) subscriber.send(frame);
    }
  }
}
