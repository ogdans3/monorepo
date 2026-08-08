import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const now = sql`now()`;

/**
 * A list. It has no owner. Possession of an active share link is the entire
 * authorisation model.
 */
export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  /**
   * Monotonic change counter. Every mutation bumps it inside the same
   * transaction that writes the change, which is also what serialises
   * concurrent writers: `UPDATE ... SET revision = revision + 1` takes a row
   * lock, so two people checking two boxes at once get ordered, not merged.
   */
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  /** Touched by any read or write; drives TTL cleanup of abandoned lists. */
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().default(now),
});

/**
 * Share links, past and present. Only the SHA-256 of the token is stored, so a
 * database dump does not yield working links. Rotation revokes the current row
 * and inserts a new one. The history is kept so a rotated link can answer
 * `410 Gone` ("this link was replaced") instead of a bare 401.
 *
 * A list has many live links, at different levels. There is deliberately no
 * unique index forcing one: handing out a read link without disturbing the
 * write link you already sent is the entire point of access on links.
 */
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Null once the list is gone. The link row deliberately outlives its list
     * so a deleted list can answer "this list has been deleted" instead of the
     * useless "invalid link". See PRODUCT.md, "no dead ends".
     */
    listId: uuid('list_id').references(() => lists.id, { onDelete: 'set null' }),
    tokenHash: text('token_hash').notNull(),
    /**
     * 'read' | 'write' | 'admin' | 'copy'. Text rather than a Postgres enum so
     * adding a level later is a code change and not a migration that locks the
     * table. See `accessSchema` in packages/contract for what each one means.
     */
    access: text('access').notNull().default('admin'),
    /** Whoever made the link, to remind themselves who it went to. */
    label: text('label').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('share_links_token_hash_key').on(t.tokenHash),
    index('share_links_list_live_idx')
      .on(t.listId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    note: text('note').notNull().default(''),
    checked: boolean('checked').notNull().default(false),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    /**
     * Fractional index (see src/lib/fractional-index.ts). Compared as plain
     * text with the C collation so ordering is byte-wise and identical in
     * Postgres, Dart and JavaScript.
     */
    position: text('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    index('items_list_position_idx').on(t.listId, sql`${t.position} COLLATE "C"`),
    // Ties are impossible in practice but must still sort deterministically.
    uniqueIndex('items_list_position_key').on(t.listId, t.position),
  ],
);

/**
 * Per-list change log. Clients reconnect with `?since=<revision>` and replay
 * what they missed instead of refetching the whole list. Rows older than
 * EVENT_RETENTION_DAYS are reaped, and asking for something older gets a full
 * snapshot back instead.
 */
export const listEvents = pgTable(
  'list_events',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    revision: bigint('revision', { mode: 'number' }).notNull(),
    type: text('type').notNull(),
    /** Opaque device id of the writer, echoed so it can ignore its own change. */
    actor: text('actor'),
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.listId, t.revision] }),
    index('list_events_created_at_idx').on(t.createdAt),
  ],
);

export type ListRow = typeof lists.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type ShareLinkRow = typeof shareLinks.$inferSelect;
export type ListEventRow = typeof listEvents.$inferSelect;
