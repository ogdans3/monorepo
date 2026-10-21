// FLOW — The list on 11 costs the same however long it gets
//
// The rule this exists to pin down: **what one person does cannot make
// somebody else's Bytter slower and slower.** Screen 11 lists every trade a
// person has ever been in, the finished ones included, and anybody can put a
// trade on somebody else's list: write about one of their listings, decline,
// write again. Built one trade at a time, eleven statements each, three
// hundred rounds of that — half a minute with a script — made Kari's Bytter
// take five seconds on every visit, and nothing she could do would take the
// trades away again. The list is built with the same statements however
// many trades are on it, and each trade in it is exactly what its own screen
// shows.
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { buildApp } from '../../src/app.js'
import type { Database } from '../../src/db/index.js'
import { close, db, reset } from '../helpers.js'

let app: FastifyInstance
let statements = 0

type Json = Record<string, any>

/** The database, counting every statement sent through it. */
const counted = new Proxy(db, {
  get(target, prop, receiver) {
    if (prop === 'execute') {
      return (...args: Parameters<Database['execute']>) => {
        statements++
        return target.execute(...args)
      }
    }
    return Reflect.get(target, prop, receiver)
  },
}) as Database

async function call(method: string, url: string, token?: string, body?: Json) {
  const res = await app.inject({
    method: method as 'GET',
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body ? { payload: body } : {}),
  })
  return { status: res.statusCode, body: res.body ? (res.json() as Json) : null }
}

/** How many statements one GET /trades takes for [token]. */
async function costOfTheList(token: string) {
  statements = 0
  const res = await call('GET', '/trades', token)
  expect(res.status).toBe(200)
  return { statements, list: res.body! }
}

describe('the list of trades', () => {
  let kari = '', mallory = '', ola = ''
  let drill = '', tent = ''
  let first = 0

  beforeAll(async () => {
    await reset()
    app = await buildApp(counted)
    const register = async (name: string) =>
      (
        await call('POST', '/auth/register', undefined, {
          displayName: name,
          email: `${name.toLowerCase()}@epost.no`,
          password: 'byttehandel1',
        })
      ).body!['token'] as string
    kari = await register('Kari')
    mallory = await register('Mallory')
    ola = await register('Ola')
    const list = async (token: string, title: string) =>
      (
        await call('POST', '/items', token, {
          title,
          category: 'verktoy',
          condition: 'good',
          estimatedValueNok: 600,
        })
      ).body!['id'] as string
    drill = await list(kari, 'Bosch drill 18V')
    tent = await list(ola, 'Telt')
  })

  afterAll(async () => {
    await app.close()
    await close()
  })

  test('1. Kari has one trade: a ring with Ola, opened by two hearts', async () => {
    await call('POST', `/items/${tent}/like`, kari)
    const heart = await call('POST', `/items/${drill}/like`, ola)
    expect(heart.body!['tradeId']).toBeTruthy()

    const { statements: n, list } = await costOfTheList(kari)
    expect(list['waiting']).toHaveLength(1)
    first = n
  })

  test('2. Mallory writes about the drill and declines, twenty times over', async () => {
    for (let i = 0; i < 20; i++) {
      const opened = await call('POST', `/items/${drill}/message`, mallory, { body: `Hei ${i}` })
      expect(opened.status).toBe(201)
      expect((await call('POST', `/trades/${opened.body!['tradeId']}/decline`, mallory)).status).toBe(200)
    }
  })

  test('3. every one of them is on Kari’s list, newest first', async () => {
    const { list } = await costOfTheList(kari)
    expect(list['done']).toHaveLength(20)
    expect(list['done'].every((t: Json) => t['closeCode'] === 'declined')).toBe(true)
    expect(list['done'][0]['lastMessage']['body']).toBe('Hei 19')
    expect(list['done'][19]['lastMessage']['body']).toBe('Hei 0')
  })

  test('4. and the list takes the same statements it took for one', async () => {
    const { statements: n } = await costOfTheList(kari)
    expect(n).toBe(first)
  })

  test('5. each trade on it is what its own screen shows', async () => {
    const { list } = await costOfTheList(kari)
    for (const trade of [...list['waiting'], ...list['done']]) {
      const own = await call('GET', `/trades/${trade['id']}`, kari)
      expect(trade).toEqual(own.body)
    }
  })
})
