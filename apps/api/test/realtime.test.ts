import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { Item, ServerFrame } from '@checkpost/contract';
import { addItem, call, createHarness, newList, type Harness } from './helpers.js';

let h: Harness;
let origin: string;

beforeAll(async () => {
  h = await createHarness();
  await h.app.listen({ port: 0, host: '127.0.0.1' });
  const address = h.app.server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  origin = `ws://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await h.close();
});

beforeEach(async () => {
  await h.reset();
});

/** A socket that records every frame, so a test can await the one it wants. */
class TestSocket {
  readonly frames: ServerFrame[] = [];
  readonly #socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.on('message', (raw: Buffer) => {
      this.frames.push(JSON.parse(raw.toString('utf8')) as ServerFrame);
    });
  }

  static async connect(token: string, useSubprotocol = false): Promise<TestSocket> {
    const socket = useSubprotocol
      ? new WebSocket(`${origin}/v1/list/socket`, ['checkpost.bearer', token])
      : new WebSocket(`${origin}/v1/list/socket`, {
          headers: { authorization: `Bearer ${token}` },
        });
    const wrapper = new TestSocket(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => resolve());
      socket.once('error', reject);
    });
    return wrapper;
  }

  /** Resolves with the first frame matching `type`, or throws on timeout. */
  async next<T extends ServerFrame['type']>(
    type: T,
    timeoutMs = 3000,
  ): Promise<Extract<ServerFrame, { type: T }>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.frames.find((f) => f.type === type);
      if (found) {
        this.frames.splice(this.frames.indexOf(found), 1);
        return found as Extract<ServerFrame, { type: T }>;
      }
      if (Date.now() > deadline) throw new Error(`timed out waiting for "${type}"`);
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }

  async closed(timeoutMs = 3000): Promise<void> {
    if (this.#socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('socket never closed')), timeoutMs);
      this.#socket.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  send(data: unknown): void {
    this.#socket.send(JSON.stringify(data));
  }

  close(): void {
    this.#socket.close();
  }
}

describe('realtime change feed', () => {
  it('refuses a socket with no credential', async () => {
    await expect(TestSocket.connect('x'.repeat(43))).rejects.toThrow();
  });

  it('accepts the token as a subprotocol, for clients that cannot set headers', async () => {
    const list = await newList(h.app, 'Trip');
    const socket = await TestSocket.connect(list.token, true);
    const hello = await socket.next('hello');
    expect(hello.revision).toBe(0);
    socket.close();
  });

  it('greets a new socket with the current revision', async () => {
    const list = await newList(h.app, 'Trip', ['Tent']);
    const socket = await TestSocket.connect(list.token);
    const hello = await socket.next('hello');
    expect(hello.revision).toBe(0);
    expect(hello.presence).toBe(1);
    socket.close();
  });

  it('delivers one person’s edit to everybody else on the list', async () => {
    const list = await newList(h.app, 'Shopping');
    const a = await TestSocket.connect(list.token);
    const b = await TestSocket.connect(list.token);
    await a.next('hello');
    await b.next('hello');

    await addItem(h.app, list.token, { text: 'Milk' });

    for (const socket of [a, b]) {
      const frame = await socket.next('change');
      expect(frame.event.type).toBe('item.created');
      expect((frame.event.data.item as Item).text).toBe('Milk');
    }
    a.close();
    b.close();
  });

  it('tags the change with the device that made it, so it can skip its own echo', async () => {
    const list = await newList(h.app, 'Shopping');
    const socket = await TestSocket.connect(list.token);
    await socket.next('hello');
    await call(h.app, 'POST', '/v1/list/items', {
      token: list.token,
      actor: 'device-a',
      body: { text: 'Milk' },
    });
    const frame = await socket.next('change');
    expect(frame.event.actor).toBe('device-a');
    socket.close();
  });

  it('reports how many people are on the list', async () => {
    const list = await newList(h.app, 'Shopping');
    const a = await TestSocket.connect(list.token);
    await a.next('hello');

    const b = await TestSocket.connect(list.token);
    const presence = await a.next('presence');
    expect(presence.presence).toBe(2);

    b.close();
    const afterLeave = await a.next('presence');
    expect(afterLeave.presence).toBe(1);
    a.close();
  });

  it('keeps two lists’ feeds apart', async () => {
    const one = await newList(h.app, 'One');
    const two = await newList(h.app, 'Two');
    const socket = await TestSocket.connect(one.token);
    await socket.next('hello');

    await addItem(h.app, two.token, { text: 'not yours' });
    await addItem(h.app, one.token, { text: 'yours' });

    const frame = await socket.next('change');
    expect((frame.event.data.item as Item).text).toBe('yours');
    expect(socket.frames.filter((f) => f.type === 'change')).toHaveLength(0);
    socket.close();
  });

  it('answers a ping, so a client can prove the socket is alive', async () => {
    const list = await newList(h.app, 'Trip');
    const socket = await TestSocket.connect(list.token);
    await socket.next('hello');
    socket.send({ type: 'ping' });
    await socket.next('pong');
    socket.close();
  });

  it('ignores anything else a client sends', async () => {
    const list = await newList(h.app, 'Trip');
    const socket = await TestSocket.connect(list.token);
    await socket.next('hello');
    socket.send({ type: 'item.created', data: { text: 'nope' } });
    socket.send('not json');
    socket.send({ type: 'ping' });
    await socket.next('pong');
    expect((await call(h.app, 'GET', '/v1/list', { token: list.token })).status).toBe(200);
    socket.close();
  });

  it('disconnects everyone holding a link that just got replaced', async () => {
    const list = await newList(h.app, 'Secret');
    const socket = await TestSocket.connect(list.token);
    await socket.next('hello');

    await call(h.app, 'POST', '/v1/list/rotate', { token: list.token });

    const revoked = await socket.next('revoked');
    expect(revoked.reason).toBe('rotated');
    await socket.closed();
  });

  it('disconnects everyone when the list is deleted', async () => {
    const list = await newList(h.app, 'Temp');
    const socket = await TestSocket.connect(list.token);
    await socket.next('hello');

    await call(h.app, 'DELETE', '/v1/list', { token: list.token });

    const revoked = await socket.next('revoked');
    expect(revoked.reason).toBe('deleted');
    await socket.closed();
  });
});
