import { type SQL, sql } from 'drizzle-orm'

/**
 * «Ikke vis meg slike» as a predicate on a listing, for every surface that
 * puts listings in front of somebody unasked: Oppdag, its rows and its search.
 *
 * Not on the item page, and not on a profile: those are reached by a link or
 * a tap somebody chose, and hiding what a person went looking for would be the
 * product second-guessing them. The subcategory is compared case-blind for the
 * reason the unique index is — see `hiddenListings` in db/schema.ts.
 */
export function notHiddenFrom(viewer: string | null, alias: string) {
  const i = sql.raw(alias)
  return sql`not exists (
    select 1 from hidden_listings h
    where h.user_id = ${viewer}
      and (h.item_id = ${i}.id
           or (h.subcategory is not null
               and h.category = ${i}.category
               and lower(h.subcategory) = lower(${i}.subcategory)))
  )`
}

/**
 * How much «Ikke vis meg slike» is keeping off [user]'s Oppdag, as the
 * `hidden_count` column every answer that carries the account's own profile
 * reads (see `publicMe`).
 *
 * On every one of them, not only `GET /me`: the app decides from this number
 * whether «vis alt igjen» can be offered, and a sign-in or a claim that
 * answered without it read as nothing hidden — so undoing one kind showed
 * every kind the account had hidden before.
 *
 * A listing hidden on its own counts only while it could still be shown. It
 * is never deleted — retiring, trading and erasing all keep the row — so its
 * hidden row outlives it, and «2 skjult» about a lamp that is gone for good
 * is nothing «vis alt igjen» could bring back. A reserved one still counts:
 * the trade holding it can end.
 */
export function hiddenCountOf(user: SQL) {
  return sql`(select count(*) from hidden_listings h
    where h.user_id = ${user}
      and (h.item_id is null
           or exists (select 1 from items li
                      where li.id = h.item_id
                        and li.deleted_at is null and li.status <> 'traded')))`
}

/**
 * [hiddenCountOf] as a column beside `users.*`, for a select or a `returning`
 * on `users` that feeds `publicMe`.
 */
export const hiddenCountColumn = sql`${hiddenCountOf(sql`users.id`)} as hidden_count`
