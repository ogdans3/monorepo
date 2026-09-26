import { sql } from 'drizzle-orm'

import type { Database } from '../db/index.js'

type Row = Record<string, any>

/**
 * What becomes of every column that points at a person, when a phone's account
 * is folded into the account its holder has just signed in to.
 *
 * Every foreign key to `users.id` is here, and `anonymous-login.test.ts` reads
 * the keys out of the database and compares. The delete at the end of the
 * merge fails on any reference nobody moved, so a table added next year has to
 * be decided in this list before the suite lets it in.
 *
 * - `carried` is re-pointed at the account being signed in to. It is the same
 *   person, and what they did while looking around is theirs.
 * - `dropped` goes with the phone's account, by the foreign key's own cascade.
 * - `refuses` is something an unclaimed device cannot do. If a row exists
 *   anyway, an assumption this file rests on is wrong, and the merge does not
 *   run: signing in as before is better than deleting somebody's record, and
 *   better than failing the sign-in.
 */
export const FATE_OF_REFERENCES = {
  // The heart, which is why any of this exists. Moved, less the ones the
  // account cannot hold: wishes for its own listings, wishes it already has,
  // and wishes across a block.
  'likes.from_user': 'carried',
  // Unioned, both ways. A block the phone made is the person's own; a block made
  // against the phone was made against the person, and dropping it would let
  // their wishes reach whoever blocked them the moment they signed in.
  'blocks.blocker': 'carried',
  'blocks.blocked': 'carried',
  // A report outlives the account it is about, or deleting is a free wash of
  // the record — and folding an account away is a delete. Less a report
  // between the two accounts, which would come out as one about oneself: an
  // open report against somebody is what erasure keeps a sealed record over,
  // and nobody reported this person.
  'reports.reporter': 'carried',
  'reports.target_user': 'carried',
  // Set null on delete, so it would survive regardless; carried because what
  // somebody told us about the app is still theirs.
  'app_feedback.user_id': 'carried',
  // The person who took the link is this person. A spent invitation naming
  // nobody reads as a link somebody used and then vanished with.
  'invites.used_by': 'carried',
  // Unreachable, since sending an invitation needs a profile. Carried rather
  // than refused because there is no doubt whose it would be.
  'invites.inviter_id': 'carried',

  // The phone's token has to stop working: the account it opened is gone.
  'sessions.user_id': 'dropped',
  // Push tokens. Nothing registers one yet, and when something does it will
  // register the phone against whoever is signed in, which a carried row would
  // only duplicate.
  'devices.user_id': 'dropped',
  // Addressed to the phone's account, which owns nothing and is in no trade, so
  // nothing sent to it is anything the account signed in to needs.
  'notifications.user_id': 'dropped',

  // Listing, writing the first message and accepting all need a profile, so a
  // device has none of these, and nor does it have the reviews and withdrawals
  // that only come after them.
  'items.owner_id': 'refuses',
  'trade_participants.user_id': 'refuses',
  'thread_participants.user_id': 'refuses',
  'messages.sender_id': 'refuses',
  'trade_offers.proposed_by': 'refuses',
  'trade_acceptances.user_id': 'refuses',
  'trade_withdrawals.requested_by': 'refuses',
  'reviews.rater': 'refuses',
  'reviews.ratee': 'refuses',
  // The test tooling's ring. An account that owns test accounts, has minted a
  // switch, has used the tool or has been acted as is not a phone somebody was
  // looking around on, and a sign-in must neither take a member out of the
  // ring nor delete its owner.
  'users.test_account_of': 'refuses',
  'sessions.issued_by': 'refuses',
  'admin_actions.admin_id': 'refuses',
  'admin_actions.acting_as': 'refuses',
} as const satisfies Record<string, 'carried' | 'dropped' | 'refuses'>

/**
 * Fold a phone's account into the account its holder has just signed in to.
 *
 * The app starts without asking anybody to make an account, so a person who
 * already has one elsewhere arrives on a new phone as a stranger, wishes for a
 * thing or two, and then finds «Logg inn». Signing in used to leave that
 * stranger behind with every wish in it. It is the same person, and the
 * password the caller has just checked is what says so.
 *
 * One transaction. The phone's row is locked first, so a heart pressed on its
 * old token while this runs waits for the lock and then fails on a row that is
 * gone, rather than landing after the likes have moved.
 *
 * The caller decides whether the session may be merged at all — unclaimed, and
 * not one the account switcher minted. This checks the rows, under the lock.
 * Returns the listings whose wishes moved, in the order they were pressed, or
 * null when no merge ran.
 */
export async function mergeDeviceAccount(
  db: Database,
  device: string,
  into: string,
): Promise<{ likes: string[] } | null> {
  if (device === into) return null

  return db.transaction(async (tx) => {
    // Still a device nobody has claimed, and nobody's test account: a test
    // account reached through `/auth/anonymous` with its device id holds an
    // ordinary session, so the switcher's mark alone would not catch it.
    const [source] = await tx.execute<Row>(
      sql`select id from users
          where id = ${device} and device_id is not null and email is null
            and test_account_of is null and not is_admin and anonymised_at is null
          for update`,
    )
    if (!source) return null

    // And never into a test account, which can have a password once it has
    // been claimed through the switcher. The admin's own account is not
    // refused: it is a person's own account, and the phone they were looking
    // around on is theirs. What the ring keeps out is somebody else.
    //
    // `no key update` rather than `update`, so the account's other phones can
    // go on pressing hearts while this runs.
    const [target] = await tx.execute<Row>(
      sql`select id from users
          where id = ${into} and test_account_of is null and anonymised_at is null
          for no key update`,
    )
    if (!target) return null

    const refused = Object.entries(FATE_OF_REFERENCES)
      .filter(([, fate]) => fate === 'refuses')
      .map(([ref]) => {
        const [table, column] = ref.split('.') as [string, string]
        return sql`exists (select 1 from ${sql.identifier(table)}
                           where ${sql.identifier(column)} = ${device})`
      })
    const [leftover] = await tx.execute<Row>(
      sql`select ${sql.join(refused, sql` or `)} as found`,
    )
    if (leftover?.['found']) return null

    // Blocks before likes, so the likes are judged against the blocks the
    // account is about to have. A block between the two accounts would be a
    // block on oneself, and goes with the phone's account.
    await tx.execute(
      sql`insert into blocks (blocker, blocked, created_at)
          select ${into}::uuid, blocked, created_at from blocks
          where blocker = ${device} and blocked <> ${into}
          on conflict do nothing`,
    )
    await tx.execute(
      sql`insert into blocks (blocker, blocked, created_at)
          select blocker, ${into}::uuid, created_at from blocks
          where blocked = ${device} and blocker <> ${into}
          on conflict do nothing`,
    )
    await tx.execute(sql`delete from blocks where blocker = ${device} or blocked = ${device}`)

    // Copied with their own dates, so «Likt» keeps its order, and then
    // removed with the phone's account. What stays behind is what
    // `expressWish` would have refused: the account's own listing, one across
    // a block, a listing that has since been retired — and a heart it has
    // already given, which `on conflict` finds even when it is being given at
    // this moment on the account's other phone. It waits for that heart and
    // then leaves this one out, where a check of its own would not see an
    // insert nobody has committed yet, and the sign-in failed on the unique
    // key. None of these is counted, because the number is what the app tells
    // the person was brought along.
    const moved = await tx.execute<Row>(
      sql`with moved as (
            insert into likes (from_user, target_item, created_at)
            select ${into}::uuid, l.target_item, l.created_at
            from likes l join items i on i.id = l.target_item
            where l.from_user = ${device}
              and i.deleted_at is null
              and i.owner_id <> ${into}
              and not exists (select 1 from blocks b
                              where (b.blocker = ${into} and b.blocked = i.owner_id)
                                 or (b.blocker = i.owner_id and b.blocked = ${into}))
            on conflict (from_user, target_item) do nothing
            returning target_item, created_at
          )
          select target_item from moved order by created_at`,
    )
    await tx.execute(sql`delete from likes where from_user = ${device}`)

    // Screen 02 is once per account. Somebody who has already been through it
    // chose what they chose; somebody who has not has just done it on this
    // phone, and should not be asked again.
    await tx.execute(
      sql`update users u set interests = d.interests
          from users d
          where u.id = ${into} and d.id = ${device}
            and cardinality(u.interests) = 0 and cardinality(d.interests) > 0`,
    )

    await tx.execute(
      sql`delete from reports
          where (reporter = ${device} and target_user = ${into})
             or (reporter = ${into} and target_user = ${device})`,
    )
    await tx.execute(sql`update reports set reporter = ${into} where reporter = ${device}`)
    await tx.execute(sql`update reports set target_user = ${into} where target_user = ${device}`)
    await tx.execute(sql`update app_feedback set user_id = ${into} where user_id = ${device}`)
    await tx.execute(sql`update invites set used_by = ${into} where used_by = ${device}`)
    await tx.execute(sql`update invites set inviter_id = ${into} where inviter_id = ${device}`)

    // Its sessions, its push tokens and its notifications go with it. Profile
    // fields a device may have filled in through PATCH /me go too: the account
    // signed in to has a profile of its own, and that one wins.
    await tx.execute(sql`delete from users where id = ${device}`)

    return { likes: moved.map((row) => row['target_item'] as string) }
  })
}
