import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { townFor, unknownPostalCode } from '../lib/postcodes.js'

export default async function postcodeRoutes(app: FastifyInstance) {
  // The town behind a postcode, so a form can show «Trondheim» under «7030»
  // while it is typed rather than after the listing or the profile is saved.
  //
  // No session: it is public reference data read out of a register carried in
  // the build, and it says nothing about anybody — which is also why the
  // lookup is here and not with a third party, who would learn where a person
  // lives from every question.
  app.get('/postcodes/:code', async (request) => {
    const { code } = z
      .object({ code: z.string().regex(/^\d{4}$/, 'Et postnummer har fire sifre.') })
      .parse(request.params)

    const town = townFor(code)
    if (!town) throw unknownPostalCode(code, 404)
    return { postalCode: code, town }
  })
}
