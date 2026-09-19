// Cut the key, from outside the building.
//
// `users.is_admin` has a trigger in front of it (see drizzle/0004_admin.sql)
// that refuses every write except one made inside a transaction that has set
// `swaply.admin_grant`. This file is the only thing in the repository that sets it —
// no route, no plugin, no job — which is what makes «admin cannot be granted
// through the API» a fact about the database rather than a promise about the
// handlers.
//
//   pnpm admin list
//   pnpm admin grant  gabrielbhansen@gmail.com
//   pnpm admin revoke gabrielbhansen@gmail.com
//   pnpm admin adopt  kari@epost.no --owner gabrielbhansen@gmail.com
//
// `adopt` is the other thing no endpoint may do: pointing `test_account_of` at
// an account that already exists. An account may be *born* a test account —
// `POST /admin/accounts` inserts it that way — but nothing reachable over HTTP
// may adopt one, or the tool could take ownership of a real person's account
// and then act as them.
//
// Unlike the seed, this is allowed to run against a remote database: granting
// has to work in production, and all it ever does is flip one boolean or set
// one uuid, then say exactly what it changed. On the live box:
//
//   docker compose exec api node dist/db/admin.js grant <e-post>
import { sql } from 'drizzle-orm'

import { connect } from './index.js'

const { client, db } = connect()

type Row = Record<string, any>

const [verb, ...rest] = process.argv.slice(2)
const args = rest.filter((a) => !a.startsWith('--'))
const ownerFlag = rest.indexOf('--owner')
const owner = ownerFlag === -1 ? null : (rest[ownerFlag + 1] ?? null)

async function byEmail(email: string): Promise<Row> {
  const [row] = await db.execute<Row>(
    sql`select id, display_name, email, is_admin, test_account_of
        from users where lower(email) = lower(${email}) and anonymised_at is null`,
  )
  if (!row) throw new Error(`No account with the e-mail ${email}.`)
  return row
}

/** The one statement in the codebase that opens the guard, and it closes with the transaction. */
async function granting<T>(run: (tx: { execute: typeof db.execute }) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local swaply.admin_grant = 'on'`)
    return run(tx as unknown as { execute: typeof db.execute })
  })
}

try {
  switch (verb) {
    case 'grant': {
      const user = await byEmail(args[0] ?? '')
      if (user['test_account_of']) {
        throw new Error(
          `${user['email']} is a test account of somebody else. An admin is never that.`,
        )
      }
      await granting((tx) => tx.execute(sql`update users set is_admin = true where id = ${user['id']}`))
      console.log(`${user['email']} is an admin.`)
      break
    }

    case 'revoke': {
      const user = await byEmail(args[0] ?? '')
      // Not through `granting`: taking the key away must never need a ceremony.
      await db.execute(sql`update users set is_admin = false where id = ${user['id']}`)
      console.log(`${user['email']} is no longer an admin. Their test accounts are untouched.`)
      break
    }

    case 'adopt': {
      if (!owner) throw new Error('adopt needs --owner <the admin’s e-mail>.')
      const admin = await byEmail(owner)
      if (!admin['is_admin']) throw new Error(`${admin['email']} is not an admin.`)

      const target = await byEmail(args[0] ?? '')
      if (target['is_admin']) throw new Error('An admin is never somebody’s test account.')
      if (target['id'] === admin['id']) throw new Error('An account cannot be its own test account.')

      await granting((tx) =>
        tx.execute(sql`update users set test_account_of = ${admin['id']} where id = ${target['id']}`),
      )
      console.log(`${target['email']} is now a test account of ${admin['email']}.`)
      break
    }

    case 'release': {
      const target = await byEmail(args[0] ?? '')
      // Also unguarded: letting go of an account is never the dangerous direction.
      await db.execute(sql`update users set test_account_of = null where id = ${target['id']}`)
      console.log(`${target['email']} is an ordinary account again.`)
      break
    }

    case 'list':
    case undefined: {
      const admins = await db.execute<Row>(
        sql`select email, display_name from users where is_admin and anonymised_at is null
            order by email`,
      )
      if (admins.length === 0) console.log('No admins.')
      for (const admin of admins) {
        console.log(`${admin['email']}  (${admin['display_name'] ?? 'uten navn'})`)
        const owned = await db.execute<Row>(
          sql`select u.email, u.display_name from users u
              join users a on a.id = u.test_account_of
              where lower(a.email) = lower(${admin['email']}) and u.anonymised_at is null
              order by u.created_at`,
        )
        for (const test of owned) {
          console.log(`    test  ${test['display_name'] ?? 'uten navn'}  ${test['email'] ?? '(uten e-post)'}`)
        }
        if (owned.length === 0) console.log('    no test accounts')
      }
      break
    }

    default:
      throw new Error(`Unknown verb "${verb}". Try: list | grant | revoke | adopt | release.`)
  }
} finally {
  await client.end()
}
