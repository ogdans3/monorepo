import { expect, test } from 'vitest'

import { buildApp } from '../src/app.js'
import { db } from './helpers.js'

test('health answers ok', async () => {
  const app = await buildApp(db)
  const res = await app.inject({ method: 'GET', url: '/health' })

  expect(res.statusCode).toBe(200)
  expect(res.json()).toEqual({ ok: true })

  await app.close()
})
