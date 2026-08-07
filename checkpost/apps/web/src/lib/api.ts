import { env } from '$env/dynamic/public';
import type { ChangesResponse, Item, List, Snapshot } from '@checkpost/contract';

/**
 * Baked at build time, and the same value the Content Security Policy names in
 * `svelte.config.js`. If these two ever disagree the browser blocks every
 * request with no obvious cause, so they read one variable.
 */
export const apiOrigin = env.PUBLIC_API_ORIGIN || 'http://localhost:4000';

const apiBase = `${apiOrigin.replace(/\/+$/, '')}/v1`;

/** An error the user is meant to read. The API writes its messages for people. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** This link never worked. */
  get isInvalidLink() {
    return this.code === 'unauthorized';
  }

  /** This link was replaced, or the list was deleted. */
  get isGone() {
    return this.code === 'gone';
  }
}

/** The browser could not reach the server, as opposed to the server saying no. */
export class OfflineError extends Error {
  constructor() {
    super('offline');
    this.name = 'OfflineError';
  }
}

/**
 * An opaque per-tab id, echoed on every change event so this tab can skip the
 * echo of its own writes. It identifies nothing about the person, and it is
 * deliberately not the share token.
 *
 * Session storage rather than local storage, so two tabs on the same list get
 * different ids. Sharing one would make a change you made in the other tab look
 * like your own echo, and it would not be highlighted as somebody else's.
 */
export function clientId(): string {
  const key = 'checkpost.client.v1';
  let id = sessionStorage.getItem(key);
  if (!id || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    id = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '_');
    sessionStorage.setItem(key, id);
  }
  return id;
}

async function send<T>(
  method: string,
  path: string,
  { token, body }: { token?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'x-checkpost-client': clientId(),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    // fetch only rejects when the request never reached a server.
    throw new OfflineError();
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiError(
      error?.code ?? 'internal',
      error?.message ?? 'Something broke on our side. Try again.',
      response.status,
    );
  }
  return payload as T;
}

export const api = {
  createList: (title: string, items?: string[]) =>
    send<{ list: List; items: Item[]; token: string; url: string }>('POST', '/lists', {
      body: { title, ...(items?.length ? { items } : {}) },
    }),

  snapshot: (token: string) => send<Snapshot>('GET', '/list', { token }),

  changesSince: (token: string, since: number) =>
    send<ChangesResponse>('GET', `/list/changes?since=${since}`, { token }),

  renameList: (token: string, title: string) =>
    send<List>('PATCH', '/list', { token, body: { title } }),

  deleteList: (token: string) => send<void>('DELETE', '/list', { token }),

  rotateLink: (token: string) =>
    send<{ token: string; url: string }>('POST', '/list/rotate', { token }),

  createItem: (token: string, id: string, text: string) =>
    send<Item>('POST', '/list/items', { token, body: { id, text } }),

  updateItem: (
    token: string,
    itemId: string,
    patch: { text?: string; note?: string; checked?: boolean },
  ) => send<Item>('PATCH', `/list/items/${itemId}`, { token, body: patch }),

  deleteItem: (token: string, itemId: string) =>
    send<void>('DELETE', `/list/items/${itemId}`, { token }),

  clearChecked: (token: string) =>
    send<{ removed: string[] }>('POST', '/list/items/clear-checked', { token }),
};
