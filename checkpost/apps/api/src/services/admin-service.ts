import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { items, listEvents, lists, shareLinks } from '../db/schema.js';
import type { ListCache } from './list-cache.js';

export interface AdminTotals {
  lists: number;
  items: number;
  done: number;
  activeLinks: number;
  revokedLinks: number;
  events: number;
  listsThisWeek: number;
  activeThisWeek: number;
  emptyLists: number;
}

export interface AdminList {
  id: string;
  title: string;
  revision: number;
  items: number;
  done: number;
  createdAt: Date;
  lastActiveAt: Date;
  activeLinks: number;
  revokedLinks: number;
}

/**
 * Read-only views for the operator console, plus the two destructive actions it
 * offers. Kept apart from ListService because everything here deliberately
 * ignores the share-token model and reaches lists by id, which nothing else in
 * the product is allowed to do.
 */
export class AdminService {
  /**
   * The cache is not optional here. This class reaches lists by id and writes
   * behind `ListService`'s back, so it is the one place where forgetting to
   * invalidate would leave a revoked link working.
   */
  constructor(
    private readonly db: Database,
    private readonly cache: ListCache,
  ) {}

  /**
   * Deliberately uncached, unlike everything a client asks for. This runs once
   * per page load by one person, and an operator looking at a number to decide
   * whether to delete something should be looking at the real one.
   */
  async totals(): Promise<AdminTotals> {
    const week = sql`now() - interval '7 days'`;
    const [row] = await this.db.execute<{
      lists: number;
      items: number;
      done: number;
      active_links: number;
      revoked_links: number;
      events: number;
      lists_this_week: number;
      active_this_week: number;
      empty_lists: number;
    }>(sql`
      select
        (select count(*)::int from ${lists})                                   as lists,
        (select count(*)::int from ${items})                                   as items,
        (select count(*)::int from ${items} where ${items.checked})            as done,
        (select count(*)::int from ${shareLinks}
           where ${shareLinks.revokedAt} is null
             and ${shareLinks.listId} is not null)                             as active_links,
        (select count(*)::int from ${shareLinks}
           where ${shareLinks.revokedAt} is not null)                          as revoked_links,
        (select count(*)::int from ${listEvents})                              as events,
        (select count(*)::int from ${lists}
           where ${lists.createdAt} > ${week})                                 as lists_this_week,
        (select count(*)::int from ${lists}
           where ${lists.lastActiveAt} > ${week})                              as active_this_week,
        (select count(*)::int from ${lists} l
           where not exists (select 1 from ${items} i where i.list_id = l.id)) as empty_lists
    `);

    return {
      lists: Number(row?.lists ?? 0),
      items: Number(row?.items ?? 0),
      done: Number(row?.done ?? 0),
      activeLinks: Number(row?.active_links ?? 0),
      revokedLinks: Number(row?.revoked_links ?? 0),
      events: Number(row?.events ?? 0),
      listsThisWeek: Number(row?.lists_this_week ?? 0),
      activeThisWeek: Number(row?.active_this_week ?? 0),
      emptyLists: Number(row?.empty_lists ?? 0),
    };
  }

  async recentLists(limit = 100): Promise<AdminList[]> {
    const rows = await this.db
      .select({
        id: lists.id,
        title: lists.title,
        revision: lists.revision,
        createdAt: lists.createdAt,
        lastActiveAt: lists.lastActiveAt,
        // Written as literal SQL with explicit aliases, not with interpolated
        // Drizzle columns. Interpolating them renders the references
        // unqualified inside the subquery, so `where list_id = id` compares
        // items.list_id to items.id, which is never true. It does not error.
        // It just quietly reports zero for every list.
        items: sql<number>`(select count(*)::int from items i where i.list_id = lists.id)`,
        done: sql<number>`(select count(*)::int from items i where i.list_id = lists.id and i.checked)`,
        activeLinks: sql<number>`(select count(*)::int from share_links s where s.list_id = lists.id and s.revoked_at is null)`,
        revokedLinks: sql<number>`(select count(*)::int from share_links s where s.list_id = lists.id and s.revoked_at is not null)`,
      })
      .from(lists)
      .orderBy(desc(lists.lastActiveAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      items: Number(row.items),
      done: Number(row.done),
      activeLinks: Number(row.activeLinks),
      revokedLinks: Number(row.revokedLinks),
    }));
  }

  /** Links whose list is gone, waiting on the reaper. */
  async orphanLinkCount(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(shareLinks)
      .where(isNull(shareLinks.listId));
    return Number(row?.count ?? 0);
  }

  async listExists(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.id, id))
      .limit(1);
    return Boolean(row);
  }

  /**
   * Mints a new link for a list and revokes whatever came before.
   *
   * The console cannot *show* an existing link, because only the SHA-256 of a
   * token is ever stored. Reissuing is the only honest way to get a working
   * URL out of here, and it costs the old one, which the page says plainly
   * before you press the button.
   */
  async reissueLink(listId: string, tokenHash: string): Promise<void> {
    const revision = await this.db.transaction(async (tx) => {
      const [bumped] = await tx
        .update(lists)
        .set({ revision: sql`${lists.revision} + 1`, updatedAt: new Date() })
        .where(eq(lists.id, listId))
        .returning({ revision: lists.revision });
      if (!bumped) throw new Error('list is gone');

      await tx
        .update(shareLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(shareLinks.listId, listId), isNull(shareLinks.revokedAt)));

      await tx.insert(shareLinks).values({ listId, tokenHash });

      await tx.insert(listEvents).values({
        listId,
        revision: bumped.revision,
        type: 'link.rotated',
        actor: 'admin',
        data: {},
      });

      return bumped.revision;
    });

    // Every link on the list was just revoked, so every cached token for it has
    // to start answering 410 immediately. This is a hard cut like any other.
    this.cache.expireLinks(listId, 'revoked');
    this.cache.invalidateList(listId, revision);
  }

  async deleteList(listId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(lists)
      .where(eq(lists.id, listId))
      .returning({ id: lists.id });
    this.cache.forgetList(listId);
    return deleted.length > 0;
  }
}
