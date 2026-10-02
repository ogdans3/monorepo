// FLOW — Guessing a password gets slower with every wrong one
//
// The rule this exists to pin down: **after a few wrong passwords for one
// address, the next sign-in waits before its password is even looked at, and
// the wait doubles with every wrong one after it, up to a quarter of an hour —
// the same for an address with no account, so a wait says nothing about who is
// here.** The right password ends the run, and a day without a wrong one
// forgets it. `POST /auth/login` is also how a device is folded into the
// account signed in to, so the wait stands in front of that as well.
//
// The clock is the test's: `buildApp` takes one, and turning it by hand is how
// more than a day of waiting fits in a test.
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import { SignInBackoff } from '../../src/auth/backoff.js'
import { close, db, reset } from '../helpers.js'

let app: FastifyInstance
let clock = Date.parse('2026-10-02T12:00:00Z')
const later = (ms: number) => {
  clock += ms
}

type Json = Record<string, any>

async function signIn(email: string, password: string, token?: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: { email, password },
  })
  return {
    status: res.statusCode,
    body: res.json() as Json,
    retryAfter: res.headers['retry-after'],
  }
}

const tooMany = (wait: string) => ({
  code: 'too_many_attempts',
  message: `For mange forsøk med feil passord. Prøv igjen om ${wait}.`,
})

const seconds = (n: number) => n * 1000
const minutes = (n: number) => n * 60_000

describe('guessing a password', () => {
  beforeAll(async () => {
    await reset()
    app = await buildApp(db, { signIns: { now: () => clock } })

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { displayName: 'Ola N.', email: 'ola@epost.no', password: 'drillbits123' },
    })
    expect(res.statusCode).toBe(201)
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. the first few wrong passwords are only wrong', async () => {
    // Three cost nothing, and the fourth is still checked: a typo or two, and
    // then the one that was nearly right, is somebody remembering.
    for (let i = 0; i < 4; i++) {
      const res = await signIn('ola@epost.no', 'feil')
      expect(res.status, `attempt ${i + 1}`).toBe(401)
      expect(res.body['code']).toBe('wrong_credentials')
    }
  })

  test('2. after that the next one waits, and is not even checked', async () => {
    const res = await signIn('ola@epost.no', 'feil')
    expect(res.status).toBe(429)
    expect(res.body).toEqual(tooMany('2 sekunder'))
    expect(res.retryAfter).toBe('2')

    // The right password is not looked at either: a wait that let it through
    // would tell a guesser the moment they had it.
    const right = await signIn('ola@epost.no', 'drillbits123')
    expect(right.status).toBe(429)
    expect(right.body).toEqual(tooMany('2 sekunder'))
  })

  test('3. once the wait is over it is checked again, and every wrong one doubles it', async () => {
    later(seconds(2))
    expect((await signIn('ola@epost.no', 'feil')).status).toBe(401)
    // The two refused in step 2 were never checked, and are not counted.
    const four = await signIn('ola@epost.no', 'feil')
    expect(four.body).toEqual(tooMany('4 sekunder'))
    expect(four.retryAfter).toBe('4')

    // Part of the way is part of the wait: the rest of it is what is said.
    later(seconds(1))
    expect((await signIn('ola@epost.no', 'feil')).body).toEqual(tooMany('3 sekunder'))

    later(seconds(3))
    expect((await signIn('ola@epost.no', 'feil')).status).toBe(401)
    expect((await signIn('ola@epost.no', 'feil')).body).toEqual(tooMany('8 sekunder'))
  })

  test('4. a long wait is said in minutes, and it stops growing at a quarter of an hour', async () => {
    const said: string[] = []
    let wait = seconds(8)
    for (let i = 0; i < 7; i++) {
      later(wait)
      expect((await signIn('ola@epost.no', 'feil')).status).toBe(401)
      const refused = await signIn('ola@epost.no', 'feil')
      expect(refused.status).toBe(429)
      said.push(refused.body['message'])
      wait = Number(refused.retryAfter) * 1000
    }

    expect(said.map((message) => message.replace(/^.*Prøv igjen om (.*)\.$/, '$1'))).toEqual([
      '16 sekunder',
      '32 sekunder',
      // 64 seconds, said as the minutes it rounds up to: waiting as long as
      // the words say is always long enough.
      '2 minutter',
      '3 minutter',
      '5 minutter',
      '9 minutter',
      '15 minutter',
    ])
    expect(wait).toBe(minutes(15))

    later(minutes(15))
    expect((await signIn('ola@epost.no', 'feil')).status).toBe(401)
    const capped = await signIn('ola@epost.no', 'feil')
    expect(capped.body).toEqual(tooMany('15 minutter'))
    expect(capped.retryAfter).toBe('900')
  })

  test('5. the address is one address whatever its case', async () => {
    const shouted = await signIn(' OLA@Epost.no', 'feil')
    expect(shouted.status).toBe(429)
    expect(shouted.body).toEqual(tooMany('15 minutter'))
  })

  test('6. an address with no account waits the same way, in the same words', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await signIn('ingen@epost.no', 'feil')).status).toBe(401)
    }
    const nobody = await signIn('ingen@epost.no', 'feil')
    expect(nobody.status).toBe(429)
    expect(nobody.body).toEqual(tooMany('2 sekunder'))
    expect(nobody.retryAfter).toBe('2')
  })

  test('7. the right password, once it may be checked, ends the run', async () => {
    later(minutes(15))
    expect((await signIn('ola@epost.no', 'drillbits123')).status).toBe(200)

    // Back to the start: a few wrong ones are only wrong again.
    for (let i = 0; i < 4; i++) {
      expect((await signIn('ola@epost.no', 'feil')).status).toBe(401)
    }
    expect((await signIn('ola@epost.no', 'feil')).status).toBe(429)
  })

  test('8. and a day without a wrong one forgets it', async () => {
    // Ola is waiting two seconds again, after step 7; a day later the run is
    // gone, and four in a row are only wrong.
    later(minutes(24 * 60))
    for (let i = 0; i < 4; i++) {
      expect((await signIn('ola@epost.no', 'feil')).status, `attempt ${i + 1}`).toBe(401)
    }
    expect((await signIn('ola@epost.no', 'feil')).status).toBe(429)
  })

  test('9. a device is folded in only through a password that may be checked', async () => {
    const started = await app.inject({
      method: 'POST',
      url: '/auth/anonymous',
      payload: { deviceId: 'phone-backoff-0123456789' },
    })
    expect(started.statusCode).toBe(201)
    const device = started.json()['token'] as string

    // Ola's run from step 8 is still going, so even the right password waits,
    // and the device is left as it was.
    const waiting = await signIn('ola@epost.no', 'drillbits123', device)
    expect(waiting.status).toBe(429)
    const me = await app.inject({
      method: 'GET', url: '/me', headers: { authorization: `Bearer ${device}` },
    })
    expect(me.statusCode).toBe(200)
    expect(me.json()['anonymous']).toBe(true)

    later(seconds(2))
    const folded = await signIn('ola@epost.no', 'drillbits123', device)
    expect(folded.status).toBe(200)
    expect(folded.body['carried']).toEqual({ likes: 0 })
  })

  test('10. a burst sent all at once is checked no further than one sent in turn', async () => {
    // Each attempt is counted as it starts, not once its password has been
    // found wrong, or ten sent together would all be checked before the
    // first of them had failed.
    const burst = await Promise.all(
      Array.from({ length: 10 }, () => signIn('samtidig@epost.no', 'feil')),
    )
    expect(burst.map((res) => res.status).sort((a, b) => a - b)).toEqual([
      401, 401, 401, 401, 429, 429, 429, 429, 429, 429,
    ])
  })
})

describe('how much it remembers', () => {
  test('a flood of addresses tried once does not push out one somebody is working through', () => {
    let now = 0
    const signIns = new SignInBackoff({ maxAddresses: 3, now: () => now })
    for (let i = 0; i < 5; i++) signIns.attempt('ola@epost.no')
    expect(signIns.attempt('ola@epost.no')).toBe(2_000)

    for (let i = 0; i < 50; i++) {
      now += 1
      expect(signIns.attempt(`noen-${i}@epost.no`)).toBe(0)
    }
    expect(signIns.attempt('ola@epost.no')).toBeGreaterThan(0)
  })

  test('and the address just counted is kept, even among longer runs', () => {
    let now = 0
    const signIns = new SignInBackoff({ maxAddresses: 2, now: () => now })
    for (const address of ['a@epost.no', 'b@epost.no']) {
      for (let i = 0; i < 5; i++) signIns.attempt(address)
    }

    // Dropped as soon as it was counted, a new address would never wait.
    for (let i = 0; i < 4; i++) expect(signIns.attempt('ny@epost.no')).toBe(0)
    expect(signIns.attempt('ny@epost.no')).toBe(2_000)
  })
})
