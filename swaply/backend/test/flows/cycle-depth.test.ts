// FLOW — Four people who want each other's things, and nothing happens
//
// The rule this exists to pin down: **chains cap at three participants.** The
// many-way flow was cut in round 4, so a deeper search would find matches no
// screen can show — four names on 07i, four legs on 07j, four people to rate
// on 07l. Finding them and having nowhere to put them is worse than not
// finding them.
//
// So this is a test that asserts an absence, and it is written as a flow
// because the absence only exists at the end: each of the four wishes closes
// nothing, and the fourth one — which completes the ring — closes nothing too.
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { findCyclesThrough } from '../../src/trades/cycles.js'
import { sweepForCycles } from '../../src/trades/sweep.js'
import { close, db, like, makeItem, makeUser, reset } from '../helpers.js'

describe('a ring of four', () => {
  let ola: string, kari: string, per: string, anne: string
  let drill: string, tent: string, bike: string, rod: string

  beforeAll(async () => {
    await reset()
    ola = await makeUser('Ola')
    kari = await makeUser('Kari')
    per = await makeUser('Per')
    anne = await makeUser('Anne')

    drill = await makeItem(ola, 'Bosch drill 18V')
    tent = await makeItem(kari, 'Telt, 3 personer')
    bike = await makeItem(per, 'Bysykkel, dame')
    rod = await makeItem(anne, 'Fiskestang med snelle')
  })

  afterAll(close)

  test('1. three of the four wishes close nothing, which is ordinary', async () => {
    await like(ola, tent)
    await like(kari, bike)
    await like(per, rod)

    expect(await findCyclesThrough(db, ola, tent)).toEqual([])
    expect(await findCyclesThrough(db, kari, bike)).toEqual([])
    expect(await findCyclesThrough(db, per, rod)).toEqual([])
  })

  test('2. the fourth closes the ring, and we still find nothing', async () => {
    // Anne → Ola's drill completes it: Ola→Kari→Per→Anne→Ola. A four-cycle is
    // a real match and we do not take it, because no screen can show it.
    await like(anne, drill)

    expect(await findCyclesThrough(db, anne, drill)).toEqual([])
  })

  test('3. nor does the nightly sweep, looking at all of it at once', async () => {
    expect(await sweepForCycles(db)).toEqual([])

    const trades = await db.execute(sql`select 1 from trades`)
    expect(trades).toHaveLength(0)
  })

  test('4. shorten the ring to three, and it closes at once', async () => {
    // Per wants the drill as well, which makes Ola→Kari→Per→Ola a three-cycle
    // inside the same four wishes.
    await like(per, drill)

    const cycles = await findCyclesThrough(db, per, drill)

    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toHaveLength(3)
    expect(cycles[0]!.map((hop) => hop.userId)).toEqual([per, kari, ola])
  })
})
