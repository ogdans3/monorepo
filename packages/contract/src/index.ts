/**
 * The wire contract between the Checkpost API, the web landing page and the
 * Flutter client.
 *
 * The Flutter client cannot import TypeScript, so this file is also the
 * human-readable spec it is written against. Anything added here must be
 * mirrored in `apps/app/lib/data/` and documented in `docs/API.md`.
 */
import { z } from 'zod';

export const API_VERSION = 'v1';

// ---------------------------------------------------------------------------
// Share tokens
// ---------------------------------------------------------------------------

/**
 * Share tokens are 32 random bytes, base64url-encoded — 43 characters, ~192
 * bits of entropy. They are the *only* credential in the system, so they are
 * long on purpose: a link must be safe to leave in a group chat forever, and
 * must be infeasible to enumerate. The server stores only their SHA-256, so a
 * database leak does not hand out working links.
 */
export const SHARE_TOKEN_BYTES = 32;
export const SHARE_TOKEN_LENGTH = 43;
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const shareTokenSchema = z.string().regex(SHARE_TOKEN_PATTERN, 'invalid share token');

/** `https://checkpost.app/l/<token>` — the canonical share URL. */
export const SHARE_PATH_PREFIX = '/l/';

export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}${SHARE_PATH_PREFIX}${token}`;
}

/** Custom-scheme fallback for platforms where app links are not verified. */
export function shareDeepLink(token: string): string {
  return `checkpost://l/${token}`;
}

/** Pulls a token out of any accepted form: bare token, https URL, or deep link. */
export function parseShareToken(input: string): string | null {
  const trimmed = input.trim();
  if (SHARE_TOKEN_PATTERN.test(trimmed)) return trimmed;
  const fromPath = /\/l\/([A-Za-z0-9_-]{43})/.exec(trimmed);
  return fromPath?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const LIMITS = {
  listTitle: 120,
  itemText: 500,
  itemNote: 4000,
  itemsPerList: 500,
  /** Max events returned by one `GET /changes` page. */
  changesPage: 500,
} as const;

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export const listSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  /**
   * Monotonic per-list counter, bumped by every mutation. Clients use it to ask
   * "what happened since N?" and to discard events they have already applied.
   */
  revision: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type List = z.infer<typeof listSchema>;

export const itemSchema = z.object({
  id: z.string().uuid(),
  listId: z.string().uuid(),
  text: z.string(),
  note: z.string(),
  checked: z.boolean(),
  checkedAt: z.string().datetime().nullable(),
  /**
   * Fractional index: an opaque lexicographically-sortable string. Inserting
   * between two items only writes the one new row, so two people inserting at
   * the same spot never fight over integer positions.
   */
  position: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Item = z.infer<typeof itemSchema>;

export const snapshotSchema = z.object({
  list: listSchema,
  items: z.array(itemSchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

// ---------------------------------------------------------------------------
// Change events
// ---------------------------------------------------------------------------

export const eventTypeSchema = z.enum([
  'list.updated',
  'list.deleted',
  'item.created',
  'item.updated',
  'item.deleted',
  'link.rotated',
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const changeEventSchema = z.object({
  type: eventTypeSchema,
  revision: z.number().int().positive(),
  /** Opaque per-device id, echoed back so the originator can skip its own echo. */
  actor: z.string().nullable(),
  at: z.string().datetime(),
  /** Shape depends on `type`; see docs/API.md. */
  data: z.record(z.unknown()),
});
export type ChangeEvent = z.infer<typeof changeEventSchema>;

export const changesResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('events'),
    revision: z.number().int().nonnegative(),
    events: z.array(changeEventSchema),
  }),
  /** The requested `since` is older than retention — take a fresh snapshot. */
  z.object({
    kind: z.literal('resync'),
    snapshot: snapshotSchema,
  }),
]);
export type ChangesResponse = z.infer<typeof changesResponseSchema>;

// ---------------------------------------------------------------------------
// Realtime frames (server -> client)
// ---------------------------------------------------------------------------

export const serverFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    revision: z.number().int().nonnegative(),
    /** Number of live connections on this list, including this one. */
    presence: z.number().int().positive(),
  }),
  z.object({ type: z.literal('change'), event: changeEventSchema }),
  z.object({ type: z.literal('presence'), presence: z.number().int().nonnegative() }),
  /** The link this socket authenticated with has been replaced or the list is gone. */
  z.object({ type: z.literal('revoked'), reason: z.enum(['rotated', 'deleted']) }),
  z.object({ type: z.literal('pong') }),
]);
export type ServerFrame = z.infer<typeof serverFrameSchema>;

export const clientFrameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping') }),
]);
export type ClientFrame = z.infer<typeof clientFrameSchema>;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const createListBodySchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.listTitle),
  /** Optional first items, so "new list from a template" is one round trip. */
  items: z.array(z.string().trim().min(1).max(LIMITS.itemText)).max(50).optional(),
});
export type CreateListBody = z.infer<typeof createListBodySchema>;

export const createListResponseSchema = z.object({
  list: listSchema,
  items: z.array(itemSchema),
  token: shareTokenSchema,
  url: z.string().url(),
});
export type CreateListResponse = z.infer<typeof createListResponseSchema>;

export const updateListBodySchema = z
  .object({ title: z.string().trim().min(1).max(LIMITS.listTitle) })
  .strict();

export const createItemBodySchema = z
  .object({
    /** Client-generated so the optimistic row and the server row are the same row. */
    id: z.string().uuid().optional(),
    text: z.string().trim().min(1).max(LIMITS.itemText),
    note: z.string().max(LIMITS.itemNote).optional(),
    /** Insert immediately after this item; omit to append. Mutually exclusive. */
    afterId: z.string().uuid().nullable().optional(),
    beforeId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => !(v.afterId && v.beforeId), {
    message: 'afterId and beforeId are mutually exclusive',
  });
export type CreateItemBody = z.infer<typeof createItemBodySchema>;

export const updateItemBodySchema = z
  .object({
    text: z.string().trim().min(1).max(LIMITS.itemText).optional(),
    note: z.string().max(LIMITS.itemNote).optional(),
    checked: z.boolean().optional(),
    afterId: z.string().uuid().nullable().optional(),
    beforeId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .refine((v) => !(v.afterId && v.beforeId), {
    message: 'afterId and beforeId are mutually exclusive',
  });
export type UpdateItemBody = z.infer<typeof updateItemBodySchema>;

export const rotateResponseSchema = z.object({
  token: shareTokenSchema,
  url: z.string().url(),
});
export type RotateResponse = z.infer<typeof rotateResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      'bad_request',
      'unauthorized',
      'not_found',
      'gone',
      'too_many_requests',
      'limit_reached',
      'internal',
    ]),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

/** `Authorization: Bearer <share token>` — the only auth there is. */
export const AUTH_HEADER = 'authorization';
/** Ephemeral per-device id used to suppress a client's echo of its own writes. */
export const CLIENT_ID_HEADER = 'x-checkpost-client';
