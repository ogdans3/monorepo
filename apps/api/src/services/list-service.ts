import { and, asc, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import {
  LIMITS,
  shareUrl,
  type ChangeEvent,
  type CreateItemBody,
  type CreateListBody,
  type Item,
  type List,
  type Snapshot,
  type UpdateItemBody,
} from '@checkpost/contract';
import type { Database } from '../db/index.js';
import { items, listEvents, lists, shareLinks } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { FIRST_KEY, keyBetween, keysBetween } from '../lib/fractional-index.js';
import { generateShareToken, hashShareToken } from '../lib/tokens.js';
import type { RealtimeHub, Subscriber } from '../realtime/hub.js';
import { toChangeEvent, toItem, toList } from '../serialize.js';

/** Byte-wise ordering, so Postgres agrees with the clients' local sort. */
const POSITION_ORDER = sql`${items.position} COLLATE "C"`;

export interface LinkContext {
  listId: string;
  linkId: string;
  token: string;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

interface PendingEvent {
  type: ChangeEvent['type'];
  data: Record<string, unknown>;
}

export interface ServiceOptions {
  webOrigin: string;
  eventRetentionDays: number;
}

export class ListService {
  constructor(
    private readonly db: Database,
    private readonly hub: RealtimeHub,
    private readonly options: ServiceOptions,
  ) {}

  // -------------------------------------------------------------------------
  // Links
  // -------------------------------------------------------------------------

  urlFor(token: string): string {
    return shareUrl(this.options.webOrigin, token);
  }

  /**
   * Turns a bearer token into a list. A token we have never seen is a 401; a
   * token we *have* seen but revoked is a 410, so the app can say "this link
   * was replaced" instead of the useless "invalid link".
   */
  async resolveLink(token: string): Promise<LinkContext> {
    const [row] = await this.db
      .select({
        id: shareLinks.id,
        listId: shareLinks.listId,
        revokedAt: shareLinks.revokedAt,
      })
      .from(shareLinks)
      .where(eq(shareLinks.tokenHash, hashShareToken(token)))
      .limit(1);

    if (!row) throw ApiError.unauthorized('That link is not valid.');
    if (row.revokedAt) {
      throw ApiError.gone('This link was replaced. Ask whoever shared it for the new one.');
    }
    // The link outlives its list, so "deleted" is distinguishable from "never
    // existed" — the app can say which, instead of a shrug.
    if (!row.listId) throw ApiError.gone('This list has been deleted.');
    return { listId: row.listId, linkId: row.id, token };
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async snapshot(listId: string): Promise<Snapshot> {
    const [listRow] = await this.db.select().from(lists).where(eq(lists.id, listId)).limit(1);
    if (!listRow) throw ApiError.gone('This list has been deleted.');
    const itemRows = await this.db
      .select()
      .from(items)
      .where(eq(items.listId, listId))
      .orderBy(asc(POSITION_ORDER));
    return { list: toList(listRow), items: itemRows.map(toItem) };
  }

  /**
   * Everything that happened after `since`. If `since` predates event
   * retention we cannot prove what was missed, so we hand back a whole
   * snapshot instead of silently losing a change.
   */
  async changesSince(
    listId: string,
    since: number,
  ): Promise<
    | { kind: 'events'; revision: number; events: ChangeEvent[] }
    | { kind: 'resync'; snapshot: Snapshot }
  > {
    const [listRow] = await this.db
      .select({ revision: lists.revision })
      .from(lists)
      .where(eq(lists.id, listId))
      .limit(1);
    if (!listRow) throw ApiError.gone('This list has been deleted.');
    if (since >= listRow.revision) {
      return { kind: 'events', revision: listRow.revision, events: [] };
    }

    const [oldest] = await this.db
      .select({ revision: listEvents.revision })
      .from(listEvents)
      .where(eq(listEvents.listId, listId))
      .orderBy(asc(listEvents.revision))
      .limit(1);

    // `since + 1` is the first revision the client needs. If the log no longer
    // reaches back that far, replaying it would leave a hole.
    if (!oldest || oldest.revision > since + 1) {
      return { kind: 'resync', snapshot: await this.snapshot(listId) };
    }

    const rows = await this.db
      .select()
      .from(listEvents)
      .where(and(eq(listEvents.listId, listId), gt(listEvents.revision, since)))
      .orderBy(asc(listEvents.revision))
      .limit(LIMITS.changesPage);

    const events = rows.map(toChangeEvent);
    const highest = events.at(-1)?.revision ?? since;
    return { kind: 'events', revision: highest, events };
  }

  /**
   * Attaches a socket to a list's change feed. Registered against the *link*
   * id, not the list id, so rotating a link can evict exactly the sockets that
   * authenticated with the link being replaced.
   */
  subscribeTo(ctx: LinkContext, subscriber: Subscriber): () => void {
    this.touch(ctx.listId);
    return this.hub.subscribe(ctx.listId, ctx.linkId, subscriber);
  }

  /** Cheap best-effort liveness stamp; failures are never worth a 500. */
  touch(listId: string): void {
    void this.db
      .update(lists)
      .set({ lastActiveAt: new Date() })
      .where(eq(lists.id, listId))
      .catch(() => {});
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async createList(body: CreateListBody, actor: string | null): Promise<{
    list: List;
    items: Item[];
    token: string;
  }> {
    const token = generateShareToken();
    return this.db.transaction(async (tx) => {
      const [listRow] = await tx.insert(lists).values({ title: body.title }).returning();
      if (!listRow) throw ApiError.badRequest('Could not create the list.');

      await tx.insert(shareLinks).values({ listId: listRow.id, tokenHash: hashShareToken(token) });

      let itemRows: Item[] = [];
      const seeds = body.items ?? [];
      if (seeds.length > 0) {
        const positions = keysBetween(null, null, seeds.length);
        const inserted = await tx
          .insert(items)
          .values(
            seeds.map((text, i) => ({
              listId: listRow.id,
              text,
              position: positions[i]!,
            })),
          )
          .returning();
        itemRows = inserted
          .map(toItem)
          .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));
      }

      // Creation itself is revision 0: nobody can be listening yet, and there
      // is no earlier state for anyone to diff against.
      void actor;
      return { list: toList(listRow), items: itemRows, token };
    });
  }

  async updateTitle(ctx: LinkContext, title: string, actor: string | null): Promise<List> {
    const { result } = await this.#mutate(ctx.listId, actor, async (tx) => {
      const [row] = await tx
        .update(lists)
        .set({ title, updatedAt: new Date() })
        .where(eq(lists.id, ctx.listId))
        .returning();
      if (!row) throw ApiError.gone('This list has been deleted.');
      return {
        result: toList(row),
        event: { type: 'list.updated' as const, data: { title } },
      };
    });
    return result;
  }

  async deleteList(ctx: LinkContext): Promise<void> {
    const deleted = await this.db.delete(lists).where(eq(lists.id, ctx.listId)).returning({
      id: lists.id,
    });
    if (deleted.length === 0) throw ApiError.gone('This list has already been deleted.');
    this.hub.evictLink(ctx.listId, ctx.linkId, 'deleted');
  }

  async createItem(ctx: LinkContext, body: CreateItemBody, actor: string | null): Promise<Item> {
    const { result, event } = await this.#mutate(ctx.listId, actor, async (tx) => {
      const [counted] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(items)
        .where(eq(items.listId, ctx.listId));
      if ((counted?.count ?? 0) >= LIMITS.itemsPerList) {
        throw ApiError.limitReached(
          `A list holds ${LIMITS.itemsPerList} items. Tick some off and clear them to make room.`,
        );
      }

      const position = await this.#positionFor(tx, ctx.listId, body);
      const values = {
        listId: ctx.listId,
        text: body.text,
        note: body.note ?? '',
        position,
        ...(body.id ? { id: body.id } : {}),
      };

      // The client supplies the id so its optimistic row and the server row are
      // the same row. A retried request therefore updates nothing and returns
      // the item that already exists, instead of creating a duplicate.
      const [row] = await tx
        .insert(items)
        .values(values)
        .onConflictDoNothing({ target: items.id })
        .returning();

      if (!row) {
        const [existing] = await tx.select().from(items).where(eq(items.id, body.id!)).limit(1);
        if (!existing) throw ApiError.badRequest('That item id is already in use elsewhere.');
        return { result: toItem(existing), event: null };
      }

      const item = toItem(row);
      return { result: item, event: { type: 'item.created' as const, data: { item } } };
    });
    void event;
    return result;
  }

  async updateItem(
    ctx: LinkContext,
    itemId: string,
    body: UpdateItemBody,
    actor: string | null,
  ): Promise<Item> {
    const { result } = await this.#mutate(ctx.listId, actor, async (tx) => {
      const [current] = await tx
        .select()
        .from(items)
        .where(and(eq(items.id, itemId), eq(items.listId, ctx.listId)))
        .limit(1);
      if (!current) throw ApiError.notFound('That item is gone — someone else removed it.');

      const patch: Partial<typeof items.$inferInsert> = { updatedAt: new Date() };
      if (body.text !== undefined) patch.text = body.text;
      if (body.note !== undefined) patch.note = body.note;
      if (body.checked !== undefined) {
        patch.checked = body.checked;
        patch.checkedAt = body.checked ? new Date() : null;
      }
      if (body.afterId !== undefined || body.beforeId !== undefined) {
        patch.position = await this.#positionFor(tx, ctx.listId, body, itemId);
      }

      const [row] = await tx.update(items).set(patch).where(eq(items.id, itemId)).returning();
      if (!row) throw ApiError.notFound('That item is gone — someone else removed it.');
      const item = toItem(row);
      return {
        result: item,
        event: { type: 'item.updated' as const, data: { item } },
      };
    });
    return result;
  }

  async deleteItem(ctx: LinkContext, itemId: string, actor: string | null): Promise<void> {
    await this.#mutate(ctx.listId, actor, async (tx) => {
      const deleted = await tx
        .delete(items)
        .where(and(eq(items.id, itemId), eq(items.listId, ctx.listId)))
        .returning({ id: items.id });
      if (deleted.length === 0) {
        // Deleting something already deleted is what two people tapping the
        // same row looks like. It is not an error; the end state is correct.
        return { result: undefined, event: null };
      }
      return {
        result: undefined,
        event: { type: 'item.deleted' as const, data: { id: itemId } },
      };
    });
  }

  async clearChecked(ctx: LinkContext, actor: string | null): Promise<string[]> {
    const { result } = await this.#mutate(ctx.listId, actor, async (tx) => {
      const deleted = await tx
        .delete(items)
        .where(and(eq(items.listId, ctx.listId), eq(items.checked, true)))
        .returning({ id: items.id });
      const ids = deleted.map((d) => d.id);
      if (ids.length === 0) return { result: ids, event: null };
      return { result: ids, event: { type: 'item.deleted' as const, data: { ids } } };
    });
    return result;
  }

  /**
   * Issues a new link and kills the old one. Everyone else's socket is closed
   * with `revoked: rotated`; the device that rotated keeps working because its
   * socket is registered against a different (now current) link.
   */
  async rotateLink(ctx: LinkContext, actor: string | null): Promise<{ token: string }> {
    const token = generateShareToken();
    const newLinkId = await this.db.transaction(async (tx) => {
      const [bumped] = await tx
        .update(lists)
        .set({ revision: sql`${lists.revision} + 1`, updatedAt: new Date(), lastActiveAt: new Date() })
        .where(eq(lists.id, ctx.listId))
        .returning({ revision: lists.revision });
      if (!bumped) throw ApiError.gone('This list has been deleted.');

      await tx
        .update(shareLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(shareLinks.listId, ctx.listId), isNull(shareLinks.revokedAt)));

      const [link] = await tx
        .insert(shareLinks)
        .values({ listId: ctx.listId, tokenHash: hashShareToken(token) })
        .returning({ id: shareLinks.id });
      if (!link) throw ApiError.badRequest('Could not replace the link.');

      await tx.insert(listEvents).values({
        listId: ctx.listId,
        revision: bumped.revision,
        type: 'link.rotated',
        actor,
        data: {},
      });
      return link.id;
    });

    // Evict holders of the link that was just revoked. The rotating device is
    // still registered under `ctx.linkId`, which is exactly the one we revoked,
    // so it is disconnected too — and reconnects with the token it just got.
    this.hub.evictLink(ctx.listId, ctx.linkId, 'rotated');
    void newLinkId;
    return { token };
  }

  // -------------------------------------------------------------------------
  // Housekeeping
  // -------------------------------------------------------------------------

  /**
   * Finally forgets links whose list is long gone. Until this runs they answer
   * "this list has been deleted"; afterwards they are simply invalid, which is
   * the honest answer once nobody could reasonably still be looking.
   */
  async pruneOrphanLinks(graceDays = 30): Promise<number> {
    const cutoff = new Date(Date.now() - graceDays * 86_400_000);
    const deleted = await this.db
      .delete(shareLinks)
      .where(and(isNull(shareLinks.listId), lt(shareLinks.createdAt, cutoff)))
      .returning({ id: shareLinks.id });
    return deleted.length;
  }

  /** Drops change-log rows past retention. Snapshots cover anyone left behind. */
  async pruneEvents(): Promise<number> {
    const cutoff = new Date(Date.now() - this.options.eventRetentionDays * 86_400_000);
    const deleted = await this.db
      .delete(listEvents)
      .where(lt(listEvents.createdAt, cutoff))
      .returning({ revision: listEvents.revision });
    return deleted.length;
  }

  /**
   * Deletes lists nobody has touched in `ttlDays`. Without owners there is no
   * other point at which a list stops existing, and an unbounded table of
   * orphaned shopping lists is a liability, not a feature.
   */
  async pruneAbandonedLists(ttlDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - ttlDays * 86_400_000);
    const deleted = await this.db
      .delete(lists)
      .where(lt(lists.lastActiveAt, cutoff))
      .returning({ id: lists.id });
    return deleted.length;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Runs a mutation, stamps it with the next revision, records it in the change
   * log and broadcasts it after commit.
   *
   * The `UPDATE lists SET revision = revision + 1` is the first statement on
   * purpose. It takes the list's row lock, so concurrent writers to the same
   * list queue up here rather than racing over item positions — and because
   * READ COMMITTED gives each subsequent statement a fresh snapshot, the second
   * writer sees the first writer's rows once it acquires the lock.
   */
  async #mutate<T>(
    listId: string,
    actor: string | null,
    fn: (tx: Tx, revision: number) => Promise<{ result: T; event: PendingEvent | null }>,
  ): Promise<{ result: T; event: ChangeEvent | null }> {
    const outcome = await this.db.transaction(async (tx) => {
      const [bumped] = await tx
        .update(lists)
        .set({
          revision: sql`${lists.revision} + 1`,
          updatedAt: new Date(),
          lastActiveAt: new Date(),
        })
        .where(eq(lists.id, listId))
        .returning({ revision: lists.revision });
      if (!bumped) throw ApiError.gone('This list has been deleted.');

      const { result, event } = await fn(tx, bumped.revision);
      if (!event) return { result, change: null };

      const [row] = await tx
        .insert(listEvents)
        .values({
          listId,
          revision: bumped.revision,
          type: event.type,
          actor,
          data: event.data,
        })
        .returning();
      return { result, change: row ? toChangeEvent(row) : null };
    });

    if (outcome.change) this.hub.broadcast(listId, outcome.change);
    return { result: outcome.result, event: outcome.change };
  }

  /**
   * Picks an ordering key from the requested neighbours. `afterId`/`beforeId`
   * name the item you dropped next to; we look up what is currently on the
   * other side of it and land in between.
   */
  async #positionFor(
    tx: Tx,
    listId: string,
    body: { afterId?: string | null; beforeId?: string | null },
    excludeId?: string,
  ): Promise<string> {
    const anchorId = body.afterId ?? body.beforeId ?? null;

    if (!anchorId) {
      // No anchor: append. `beforeId: null` explicitly means "send to the top".
      if (body.beforeId === null && body.afterId === undefined) {
        const first = await this.#edgePosition(tx, listId, 'first', excludeId);
        return keyBetween(null, first);
      }
      const last = await this.#edgePosition(tx, listId, 'last', excludeId);
      return keyBetween(last, null);
    }

    const [anchor] = await tx
      .select({ position: items.position })
      .from(items)
      .where(and(eq(items.id, anchorId), eq(items.listId, listId)))
      .limit(1);

    if (!anchor) {
      // The neighbour was deleted out from under us mid-drag. Appending is the
      // least surprising recovery; the item still lands in the list.
      const last = await this.#edgePosition(tx, listId, 'last', excludeId);
      return keyBetween(last, null);
    }

    if (body.afterId) {
      const next = await this.#neighbourPosition(tx, listId, anchor.position, 'after', excludeId);
      return keyBetween(anchor.position, next);
    }
    const prev = await this.#neighbourPosition(tx, listId, anchor.position, 'before', excludeId);
    return keyBetween(prev, anchor.position);
  }

  async #edgePosition(
    tx: Tx,
    listId: string,
    edge: 'first' | 'last',
    excludeId?: string,
  ): Promise<string | null> {
    const rows = await tx
      .select({ position: items.position })
      .from(items)
      .where(
        excludeId
          ? and(eq(items.listId, listId), sql`${items.id} <> ${excludeId}`)
          : eq(items.listId, listId),
      )
      .orderBy(edge === 'first' ? asc(POSITION_ORDER) : desc(POSITION_ORDER))
      .limit(1);
    return rows[0]?.position ?? null;
  }

  async #neighbourPosition(
    tx: Tx,
    listId: string,
    position: string,
    side: 'before' | 'after',
    excludeId?: string,
  ): Promise<string | null> {
    const comparison =
      side === 'after'
        ? sql`${items.position} COLLATE "C" > ${position} COLLATE "C"`
        : sql`${items.position} COLLATE "C" < ${position} COLLATE "C"`;
    const rows = await tx
      .select({ position: items.position })
      .from(items)
      .where(
        excludeId
          ? and(eq(items.listId, listId), comparison, sql`${items.id} <> ${excludeId}`)
          : and(eq(items.listId, listId), comparison),
      )
      .orderBy(side === 'after' ? asc(POSITION_ORDER) : desc(POSITION_ORDER))
      .limit(1);
    return rows[0]?.position ?? null;
  }
}

export { FIRST_KEY };
