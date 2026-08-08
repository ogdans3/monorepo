import { and, asc, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import {
  LIMITS,
  shareUrl,
  type Access,
  type ChangeEvent,
  type CreateItemBody,
  type CreateListBody,
  type Item,
  type List,
  type ShareLink,
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
  access: Access;
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
   * Turns a bearer token into a list. A token we have never seen is a 401. A
   * token we *have* seen but revoked is a 410, so the app can say "this link
   * was replaced" instead of the useless "invalid link".
   */
  async resolveLink(token: string): Promise<LinkContext> {
    const [row] = await this.db
      .select({
        id: shareLinks.id,
        listId: shareLinks.listId,
        revokedAt: shareLinks.revokedAt,
        access: shareLinks.access,
      })
      .from(shareLinks)
      .where(eq(shareLinks.tokenHash, hashShareToken(token)))
      .limit(1);

    if (!row) throw ApiError.unauthorized('That link is not valid.');
    if (row.revokedAt) {
      throw ApiError.gone('This link was replaced. Ask whoever shared it for the new one.');
    }
    // The link outlives its list, so "deleted" is distinguishable from "never
    // existed". The app can say which, instead of a shrug.
    if (!row.listId) throw ApiError.gone('This list has been deleted.');
    return {
      listId: row.listId,
      linkId: row.id,
      token,
      access: row.access as Access,
    };
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async snapshot(listId: string, access: Access = 'admin'): Promise<Snapshot> {
    const [listRow] = await this.db.select().from(lists).where(eq(lists.id, listId)).limit(1);
    if (!listRow) throw ApiError.gone('This list has been deleted.');
    const itemRows = await this.db
      .select()
      .from(items)
      .where(eq(items.listId, listId))
      .orderBy(asc(POSITION_ORDER));
    // The client renders what it is allowed to do, so it is told.
    return { list: toList(listRow), items: itemRows.map(toItem), access };
  }

  /**
   * Everything that happened after `since`. If `since` predates event
   * retention we cannot prove what was missed, so we hand back a whole
   * snapshot instead of silently losing a change.
   */
  async changesSince(
    listId: string,
    since: number,
    access: Access = 'admin',
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
      return { kind: 'resync', snapshot: await this.snapshot(listId, access) };
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

      // Whoever makes a list gets admin on it. Every other level exists only
      // because an admin chose to hand it out.
      await tx.insert(shareLinks).values({
        listId: listRow.id,
        tokenHash: hashShareToken(token),
        access: 'admin',
        label: 'Made the list',
      });

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
      if (!current) throw ApiError.notFound('That item is gone. Someone else removed it.');

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
      if (!row) throw ApiError.notFound('That item is gone. Someone else removed it.');
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
        // same row looks like. It is not an error, and the end state is correct.
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

  // -------------------------------------------------------------------------
  // Links
  // -------------------------------------------------------------------------

  async links(ctx: LinkContext): Promise<ShareLink[]> {
    const rows = await this.db
      .select({
        id: shareLinks.id,
        access: shareLinks.access,
        label: shareLinks.label,
        createdAt: shareLinks.createdAt,
      })
      .from(shareLinks)
      .where(and(eq(shareLinks.listId, ctx.listId), isNull(shareLinks.revokedAt)))
      .orderBy(asc(shareLinks.createdAt));

    // No token here, and there cannot be one: only its hash was ever stored.
    return rows.map((row) => ({
      id: row.id,
      access: row.access as Access,
      label: row.label,
      createdAt: row.createdAt.toISOString(),
      isCurrent: row.id === ctx.linkId,
    }));
  }

  /** Mints a link at a chosen level. The token is returned once and forgotten. */
  async createLink(
    ctx: LinkContext,
    access: Access,
    label: string,
  ): Promise<{ link: ShareLink; token: string }> {
    const live = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(shareLinks)
      .where(and(eq(shareLinks.listId, ctx.listId), isNull(shareLinks.revokedAt)));
    if (Number(live[0]?.count ?? 0) >= LIMITS.linksPerList) {
      throw ApiError.limitReached(
        `A list holds ${LIMITS.linksPerList} live links. Revoke one you are not using.`,
      );
    }

    const token = generateShareToken();
    const [row] = await this.db
      .insert(shareLinks)
      .values({
        listId: ctx.listId,
        tokenHash: hashShareToken(token),
        access,
        label: label.slice(0, 60),
      })
      .returning();
    if (!row) throw ApiError.badRequest('Could not make the link.');

    return {
      token,
      link: {
        id: row.id,
        access: row.access as Access,
        label: row.label,
        createdAt: row.createdAt.toISOString(),
        isCurrent: false,
      },
    };
  }

  /**
   * Revokes one link. Whoever holds it is disconnected and gets a 410 on their
   * next request, which is the point of the feature, so it is a hard cut.
   */
  async revokeLink(ctx: LinkContext, linkId: string): Promise<void> {
    const revoked = await this.db
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(shareLinks.id, linkId),
          eq(shareLinks.listId, ctx.listId),
          isNull(shareLinks.revokedAt),
        ),
      )
      .returning({ id: shareLinks.id });
    if (revoked.length === 0) throw ApiError.notFound('That link is already gone.');
    this.hub.evictLink(ctx.listId, linkId, 'rotated');
  }

  /**
   * Replaces the link this request was made with, keeping its level, and leaves
   * every other link on the list alone.
   *
   * That last part is what access changed. When a list could only have one
   * link, replacing it meant replacing all of them. Now that you can hand out a
   * read link and keep an admin one, quietly killing the others would be the
   * surprising behaviour rather than the safe one.
   */
  async rotateLink(ctx: LinkContext, actor: string | null): Promise<{ token: string }> {
    const token = generateShareToken();
    await this.db.transaction(async (tx) => {
      const [bumped] = await tx
        .update(lists)
        .set({
          revision: sql`${lists.revision} + 1`,
          updatedAt: new Date(),
          lastActiveAt: new Date(),
        })
        .where(eq(lists.id, ctx.listId))
        .returning({ revision: lists.revision });
      if (!bumped) throw ApiError.gone('This list has been deleted.');

      const [old] = await tx
        .update(shareLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(shareLinks.id, ctx.linkId), isNull(shareLinks.revokedAt)))
        .returning({ access: shareLinks.access, label: shareLinks.label });

      const [link] = await tx
        .insert(shareLinks)
        .values({
          listId: ctx.listId,
          tokenHash: hashShareToken(token),
          access: old?.access ?? ctx.access,
          label: old?.label ?? '',
        })
        .returning({ id: shareLinks.id });
      if (!link) throw ApiError.badRequest('Could not replace the link.');

      await tx.insert(listEvents).values({
        listId: ctx.listId,
        revision: bumped.revision,
        type: 'link.rotated',
        actor,
        data: {},
      });
    });

    // Evicts holders of the link just revoked, including the caller, which
    // reconnects with the token it has just been handed.
    this.hub.evictLink(ctx.listId, ctx.linkId, 'rotated');
    return { token };
  }

  // -------------------------------------------------------------------------
  // Copy links
  // -------------------------------------------------------------------------

  /** What a copy link is about to make, without exposing the list itself. */
  async copyPreview(ctx: LinkContext): Promise<{ title: string; itemCount: number }> {
    const [row] = await this.db
      .select({
        title: lists.title,
        itemCount: sql<number>`(select count(*)::int from items i where i.list_id = lists.id)`,
      })
      .from(lists)
      .where(eq(lists.id, ctx.listId))
      .limit(1);
    if (!row) throw ApiError.gone('This list has been deleted.');
    return { title: row.title, itemCount: Number(row.itemCount) };
  }

  /**
   * Takes a copy of the list behind a copy link and hands the caller admin on
   * it. Nothing is ticked off, because a template is a thing to work through
   * rather than a record of somebody else's progress.
   *
   * The two lists are strangers afterwards. No shared rows, no shared links,
   * and no events crossing between them.
   */
  async copyFromLink(ctx: LinkContext): Promise<{ snapshot: Snapshot; token: string }> {
    const token = generateShareToken();
    const listId = await this.db.transaction(async (tx) => {
      const [source] = await tx
        .select({ title: lists.title })
        .from(lists)
        .where(eq(lists.id, ctx.listId))
        .limit(1);
      if (!source) throw ApiError.gone('This list has been deleted.');

      const [copy] = await tx.insert(lists).values({ title: source.title }).returning();
      if (!copy) throw ApiError.badRequest('Could not make the copy.');

      const sourceItems = await tx
        .select()
        .from(items)
        .where(eq(items.listId, ctx.listId))
        .orderBy(asc(POSITION_ORDER));

      if (sourceItems.length > 0) {
        await tx.insert(items).values(
          sourceItems.map((item) => ({
            listId: copy.id,
            text: item.text,
            note: item.note,
            // Positions carry over so the copy reads in the same order, and
            // nothing carries over ticked.
            position: item.position,
            checked: false,
            checkedAt: null,
          })),
        );
      }

      await tx.insert(shareLinks).values({
        listId: copy.id,
        tokenHash: hashShareToken(token),
        access: 'admin',
        label: 'Made from a copy link',
      });

      return copy.id;
    });

    return { snapshot: await this.snapshot(listId, 'admin'), token };
  }

  // -------------------------------------------------------------------------
  // Housekeeping
  // -------------------------------------------------------------------------

  /**
   * Finally forgets links whose list is long gone. Until this runs they answer
   * "this list has been deleted". Afterwards they are simply invalid, which is
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
   * list queue up here rather than racing over item positions. And because
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
   * name the item you dropped next to. We look up what is currently on the
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
      // least surprising recovery, and the item still lands in the list.
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
