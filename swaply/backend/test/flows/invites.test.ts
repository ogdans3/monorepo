// FLOW — A link out of a closed app, and the way back in
//
// The app is invite-only, so a listing sent to somebody almost always lands with
// somebody who does not have it. Either the link carries an invitation and the
// share button is the growth channel, or the recipient meets a wall and the
// button is worth nothing. This is that path, end to end: share, look, wish,
// make a profile, keep the wish.
//
// Two rules it exists to pin down. **Looking is not joining** — reading the page
// behind a link never spends the invitation, and the page keeps working after
// somebody else has used it. And **an unclaimed device may look and wish, but
// nothing that puts it in front of another person**: no listing, no first
// message, no acceptance.
import { sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { close, db, reset } from '../helpers.js'

let app: FastifyInstance
// The same API with the wall up. `INVITE_ONLY` is parsed once at boot, so the
// two sides of it are two instances rather than two runs.
let closedApp: FastifyInstance

type Json = Record<string, any>

const call = (
  instance: FastifyInstance,
  method: string,
  url: string,
  opts: { token?: string; body?: Json } = {},
) =>
  instance
    .inject({
      method: method as 'GET',
      url,
      headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
      ...(opts.body ? { payload: opts.body } : {}),
    })
    .then((res) => ({ status: res.statusCode, body: res.body ? (res.json() as Json) : null }))

describe('sharing a listing with someone who is not here yet', () => {
  let ola = '', kari = ''
  let kariId = ''
  let drill = '', board = ''
  let shared = '', plain = ''

  const kariDevice = 'device-kari-0123456789abcdef'

  beforeAll(async () => {
    await reset()
    app = await buildApp(db)
    closedApp = await buildApp(db, { inviteOnly: true })
  })

  afterAll(async () => {
    await app.close()
    await closedApp.close()
    await close()
  })

  test('1. Ola has an account and a drill to give', async () => {
    const signup = await call(app, 'POST', '/auth/register', {
      body: { displayName: 'Ola N.', email: 'ola@epost.no', password: 'drillbits123',
              town: 'Trondheim' },
    })
    expect(signup.status).toBe(201)
    expect(signup.body!['user']['anonymous']).toBe(false)
    ola = signup.body!['token']

    const listing = await call(app, 'POST', '/items', {
      token: ola,
      body: { title: 'Bosch drill 18V', category: 'verktoy', condition: 'good',
              estimatedValueNok: 600, media: ['https://img/drill.webp'] },
    })
    drill = listing.body!['id']
  })

  test('2. the share button hands back a link and the line that travels with it', async () => {
    const res = await call(app, 'POST', `/items/${drill}/share`, { token: ola })

    expect(res.status).toBe(201)
    shared = res.body!['token']
    expect(res.body!['url']).toBe(`http://localhost:5174/i/${shared}`)
    expect(res.body!['text']).toBe(
      `Se denne på Swaply: Bosch drill 18V, verdi 600 kr. ${res.body!['url']}`,
    )
  })

  test('3. the page behind the link needs no account, which is the whole point', async () => {
    const page = await call(app, 'GET', `/invites/${shared}`)

    expect(page.status).toBe(200)
    expect(page.body!['item']).toMatchObject({
      title: 'Bosch drill 18V',
      estimatedValueNok: 600,
      ownerName: 'Ola N.',
      media: ['https://img/drill.webp'],
    })
    expect(page.body!['inviter']).toMatchObject({ displayName: 'Ola N.' })
    expect(page.body!['used']).toBe(false)
  })

  test('4. reading it does not spend it', async () => {
    expect((await call(app, 'GET', `/invites/${shared}`)).body!['used']).toBe(false)
  })

  test('5. Kari looks around on her phone without making anything', async () => {
    const res = await call(app, 'POST', '/auth/anonymous', {
      body: { deviceId: kariDevice, invite: shared },
    })

    expect(res.status).toBe(201)
    expect(res.body!['user']['anonymous']).toBe(true)
    expect(res.body!['user']['displayName']).toBe(null)
    kari = res.body!['token']
    kariId = res.body!['user']['id']

    // Spent now, and the page says so while still showing the drill.
    const page = await call(app, 'GET', `/invites/${shared}`)
    expect(page.body!['used']).toBe(true)
    expect(page.body!['item']['title']).toBe('Bosch drill 18V')
  })

  test('6. she may wish for the drill', async () => {
    const like = await call(app, 'POST', `/items/${drill}/like`, { token: kari })
    expect(like.status).toBe(200)
    expect(like.body!['liked']).toBe(true)
    // Nothing to give yet, so nothing closes.
    expect(like.body!['tradeId']).toBe(null)
  })

  test('7. but not list, not write to Ola, and not be verified', async () => {
    const listing = await call(app, 'POST', '/items', {
      token: kari,
      body: { title: 'Fiskestang', category: 'friluft', condition: 'good' },
    })
    expect(listing.status).toBe(403)
    expect(listing.body!['code']).toBe('account_required')

    const message = await call(app, 'POST', `/items/${drill}/message`, {
      token: kari,
      body: { body: 'Hei! Er drillen ledig?' },
    })
    expect(message.status).toBe(403)

    expect((await call(app, 'POST', '/me/bankid', { token: kari, body: { subject: 'x-1' } })).status)
      .toBe(403)
  })

  test('8. making the profile claims the account rather than starting a second one', async () => {
    const res = await call(app, 'POST', '/auth/register', {
      token: kari,
      body: { displayName: 'Kari N.', email: 'kari@epost.no', phone: '911 22 333',
              password: 'fiskestang1', town: 'Bergen' },
    })

    expect(res.status).toBe(201)
    expect(res.body!['user']['id']).toBe(kariId)
    expect(res.body!['user']['anonymous']).toBe(false)

    // The wish she made while looking around is still hers.
    const liked = await call(app, 'GET', '/me/likes', { token: res.body!['token'] })
    expect(liked.body!['items'].map((i: Json) => i['id'])).toEqual([drill])

    // The token she had belonged to a device. The account now has a password,
    // and the old token does not outlive that.
    expect((await call(app, 'GET', '/me', { token: kari })).status).toBe(401)
    kari = res.body!['token']
  })

  test('9. and the wish counts: Ola likes her rod, and the loop closes', async () => {
    const rod = await call(app, 'POST', '/items', {
      token: kari,
      body: { title: 'Fiskestang med snelle', category: 'friluft', condition: 'good',
              estimatedValueNok: 850 },
    })
    expect(rod.status).toBe(201)

    const like = await call(app, 'POST', `/items/${rod.body!['id']}/like`, { token: ola })
    expect(like.body!['tradeId']).not.toBe(null)
  })

  test('10. the same device cannot be handed the account again once it has a password', async () => {
    const res = await call(app, 'POST', '/auth/anonymous', { body: { deviceId: kariDevice } })

    expect(res.status).toBe(409)
    expect(res.body!['code']).toBe('device_claimed')
  })

  test('11. an invitation is used once, and the second person is told so', async () => {
    const res = await call(app, 'POST', '/auth/anonymous', {
      body: { deviceId: 'device-per-0123456789abcdef', invite: shared },
    })

    expect(res.status).toBe(400)
    expect(res.body!['code']).toBe('invite_used')

    // The account it would have made is not left standing.
    const orphan = await db.execute(
      sql`select 1 from users where device_id = 'device-per-0123456789abcdef'`,
    )
    expect(orphan).toHaveLength(0)
  })

  test('12. a plain invitation carries no listing, and an unknown one is not found', async () => {
    const res = await call(app, 'POST', '/invites', { token: ola })
    plain = res.body!['token']
    expect(res.body!['text']).toContain('Ola N. inviterer deg til Swaply')

    const page = await call(app, 'GET', `/invites/${plain}`)
    expect(page.body!['item']).toBe(null)
    expect(page.body!['inviter']['displayName']).toBe('Ola N.')

    expect((await call(app, 'GET', '/invites/aaaaaaaaaaaaaaaaaaaaaa')).status).toBe(404)
  })

  test('13. a listing retired after the link went out leaves the page standing', async () => {
    const listing = await call(app, 'POST', '/items', {
      token: ola,
      body: { title: 'Skateboard', category: 'sport', condition: 'worn', estimatedValueNok: 450 },
    })
    board = listing.body!['id']

    const link = await call(app, 'POST', `/items/${board}/share`, { token: ola })
    expect((await call(app, 'DELETE', `/items/${board}`, { token: ola })).status).toBe(204)

    const page = await call(app, 'GET', `/invites/${link.body!['token']}`)
    expect(page.status).toBe(200)
    expect(page.body!['item']).toBe(null)
    expect(page.body!['shareText']).toContain('inviterer deg til Swaply')
  })

  test('14. with the wall up there is no way in without a link', async () => {
    const refused = await call(closedApp, 'POST', '/auth/register', {
      body: { displayName: 'Per H.', email: 'per@epost.no', password: 'snomaking1' },
    })
    expect(refused.status).toBe(403)
    expect(refused.body!['code']).toBe('invite_required')

    const admitted = await call(closedApp, 'POST', '/auth/register', {
      body: { displayName: 'Per H.', email: 'per@epost.no', password: 'snomaking1',
              invite: plain },
    })
    expect(admitted.status).toBe(201)

    // And the same wall in front of looking around.
    expect(
      (await call(closedApp, 'POST', '/auth/anonymous', { body: { deviceId: 'device-x-0123456789' } }))
        .status,
    ).toBe(403)
  })
})
