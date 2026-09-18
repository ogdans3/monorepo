import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  DEMO_LIST_ID,
  DEMO_LIST_TITLE,
  DEMO_ROWS,
  type DemoIntro,
  type Item,
} from '@checkpost/contract';
import type { Database } from '../db/index.js';
import { items, lists, shareLinks } from '../db/schema.js';
import { ApiError } from '../lib/errors.js';
import { keysBetween } from '../lib/fractional-index.js';
import { generateShareToken, hashShareToken } from '../lib/tokens.js';
import type { ListCache } from './list-cache.js';
import type { LinkContext, ListService } from './list-service.js';

/**
 * The list on the landing page.
 *
 * It is a real list in the real database, on the real socket, and everyone who
 * opens the front page is on it at once. The page used to hold a mock with
 * local state, which made it a lie about the one thing the product is for.
 *
 * Two things keep a public list from being a public liability:
 *
 * **The published link is `read`.** It can fetch the list, its changes and its
 * socket, and that is the whole of it. It is in the page source on purpose —
 * a link is the access, and this one is meant for everybody.
 *
 * **The only write is a tick**, and it goes through the one route below rather
 * than through a credential anybody could reuse for something else. There is
 * no way in to add a row, rename the list, reorder it, empty it or delete it,
 * so the worst anyone can do to the front page is finish the shopping.
 *
 * This writes behind `ListService`'s back when it seeds and when it reissues
 * the link, for the same reason `AdminService` does, and it takes the cache as
 * a constructor argument for the same reason too: a write here that does not
 * invalidate is a revoked link that keeps working until the process restarts.
 * Every *change to the list itself* goes back through `ListService`, so the
 * revision bump, the change log and the broadcast happen exactly as they do
 * for any other list.
 */
export class DemoService {
  /** Resolved once the demo exists and this process has a link for it. */
  #ready: Promise<{ token: string; ctx: LinkContext }> | null = null;

  constructor(
    private readonly db: Database,
    private readonly listService: ListService,
    private readonly cache: ListCache,
  ) {}

  /** True once something has asked for the demo in this process. */
  get started(): boolean {
    return this.#ready !== null;
  }

  /**
   * Drops what this process knows about the demo, so the next ask seeds again.
   *
   * For the test suite, which truncates the tables between cases. Everything
   * this service holds — the list id's rows, the link it minted — is gone by
   * then, and remembering it would mean answering with a link to a list that no
   * longer exists. Same reasoning as clearing the read cache, next to which it
   * is called.
   */
  forget(): void {
    this.#ready = null;
  }

  /**
   * The list and the link to watch it with.
   *
   * Seeded on the first ask rather than at boot, so a test or a one-off script
   * that never touches the landing page never grows a demo list. The promise is
   * kept, not the result, so two first visitors at once seed it once.
   */
  async intro(): Promise<DemoIntro> {
    try {
      return await this.#intro();
    } catch (error) {
      // To the admin console the demo is an ordinary list, so it can be deleted
      // there like any other. Seed it again rather than leave the front page
      // holding a link to something that is gone.
      if (error instanceof ApiError && error.status === 410) {
        this.forget();
        return this.#intro();
      }
      throw error;
    }
  }

  async #intro(): Promise<DemoIntro> {
    const { token } = await this.#ensure();
    // Same liveness stamp any other read leaves. Without it a quiet year would
    // hand the demo list to the reaper while the front page was still serving
    // it, since only a tick counts as a write.
    this.listService.touch(DEMO_LIST_ID);
    return { token, snapshot: await this.listService.snapshot(DEMO_LIST_ID, 'read') };
  }

  /** The only change anyone may make to this list. */
  async tick(itemId: string, checked: boolean, actor: string | null): Promise<Item> {
    const { ctx } = await this.#ensure();
    // `updateItem` scopes by list id, so an item id from somebody else's list
    // is a 404 here and never a way to reach it.
    return this.listService.updateItem(ctx, itemId, { checked }, actor);
  }

  /**
   * Puts the demo back the way it was found, if it has been left alone.
   *
   * Run on a timer. The reset is an ordinary change like any other, so anybody
   * still watching sees the list tidy itself rather than finding it different
   * on their next visit — and because it is ordinary, it lands on the clients
   * folded into one update instead of one row at a time.
   */
  async resetIfQuiet(quietMs: number): Promise<number> {
    // Never seeds. A demo nobody has asked for has nothing to tidy.
    if (!this.#ready) return 0;
    const { ctx } = await this.#ready;

    const [list] = await this.db
      .select({ updatedAt: lists.updatedAt })
      .from(lists)
      .where(eq(lists.id, DEMO_LIST_ID))
      .limit(1);
    if (!list) return 0;
    if (Date.now() - list.updatedAt.getTime() < quietMs) return 0;

    const rows = await this.db.select().from(items).where(eq(items.listId, DEMO_LIST_ID));
    const wanted = new Map<string, boolean>(DEMO_ROWS.map((row) => [row.id, row.checked]));
    const drifted = rows.filter((row) => {
      const want = wanted.get(row.id);
      return want !== undefined && want !== row.checked;
    });

    for (const row of drifted) {
      await this.listService.updateItem(ctx, row.id, { checked: wanted.get(row.id)! }, 'demo');
    }
    return drifted.length;
  }

  #ensure(): Promise<{ token: string; ctx: LinkContext }> {
    // Kept as the promise rather than the value, so the second caller during a
    // cold start waits for the first one's seed instead of racing it.
    this.#ready ??= this.#seed().catch((error: unknown) => {
      // A failed seed must not be remembered as the answer for ever.
      this.#ready = null;
      throw error;
    });
    return this.#ready;
  }

  /**
   * Makes sure the list and its rows exist, and mints this process a link.
   *
   * The link is new every boot and the old ones are revoked, because only the
   * SHA-256 of a token is ever stored and so no raw token survives a restart
   * to be handed out again. That is the invariant doing its job rather than an
   * inconvenience: the published token is short-lived by construction, and the
   * page asks for a fresh one whenever the one it holds stops working.
   *
   * The rows are refreshed from the contract, minus what anybody has ticked.
   */
  async #seed(): Promise<{ token: string; ctx: LinkContext }> {
    const token = generateShareToken();
    const positions = keysBetween(null, null, DEMO_ROWS.length);

    const linkId = await this.db.transaction(async (tx) => {
      await tx
        .insert(lists)
        .values({ id: DEMO_LIST_ID, title: DEMO_LIST_TITLE })
        .onConflictDoNothing({ target: lists.id });

      await tx
        .insert(items)
        .values(
          DEMO_ROWS.map((row, i) => ({
            id: row.id,
            listId: DEMO_LIST_ID,
            text: row.text,
            checked: row.checked,
            checkedAt: row.checked ? new Date() : null,
            position: positions[i]!,
          })),
        )
        // The rows themselves come from the contract and are refreshed from it,
        // so changing the copy there changes the front page. `checked` is
        // deliberately not in the set: a restart in the middle of a Friday
        // afternoon leaves whatever people had ticked exactly as it was.
        .onConflictDoUpdate({
          target: items.id,
          set: { text: sql`excluded.text`, position: sql`excluded.position` },
        });

      await tx
        .update(shareLinks)
        .set({ revokedAt: new Date() })
        .where(and(eq(shareLinks.listId, DEMO_LIST_ID), isNull(shareLinks.revokedAt)));

      const [link] = await tx
        .insert(shareLinks)
        .values({
          listId: DEMO_LIST_ID,
          tokenHash: hashShareToken(token),
          access: 'read',
          label: 'The landing page',
        })
        .returning({ id: shareLinks.id });
      if (!link) throw ApiError.badRequest('Could not open the demo list.');
      return link.id;
    });

    // Behind `ListService`'s back, so by hand: every token this process has
    // just retired has to stop working now rather than at the next restart,
    // and the rows it just wrote have to be readable.
    this.cache.expireLinks(DEMO_LIST_ID, 'revoked');
    this.cache.invalidateList(DEMO_LIST_ID);
    this.cache.rememberLink(hashShareToken(token), {
      kind: 'link',
      listId: DEMO_LIST_ID,
      linkId,
      access: 'read',
    });

    return {
      token,
      // Held here and never handed out. The published link is the `read` one
      // above; this is the service's own way in, and it exists because every
      // write in the product goes through a link context.
      ctx: { listId: DEMO_LIST_ID, linkId, token: '', access: 'admin' },
    };
  }
}
