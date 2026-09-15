// One shape for every failure, so the app can switch on `code` instead of
// parsing prose. The message is Norwegian because it is shown to a person.
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const badRequest = (code: string, message: string) => new ApiError(400, code, message)
export const unauthorized = () => new ApiError(401, 'unauthorized', 'Du må logge inn.')
export const forbidden = (message = 'Du har ikke tilgang til dette.') =>
  new ApiError(403, 'forbidden', message)
export const notFound = (message = 'Fant ikke det du ba om.') =>
  new ApiError(404, 'not_found', message)
export const conflict = (code: string, message: string) => new ApiError(409, code, message)

/**
 * The name of the unique index a failed query walked into, or null.
 *
 * Checking a column is free of a value and then inserting it is two statements,
 * and the database is the only place that can decide the race between them. So
 * the check gives the good message in the ordinary case, and this gives the
 * same message when two requests arrive together — rather than a 500 that tells
 * the person nothing. Drizzle wraps the driver's error, so the chain is walked.
 */
export function uniqueViolation(error: unknown): string | null {
  for (let e: unknown = error, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const it = e as { code?: string; constraint_name?: string }
    if (it.code === '23505') return it.constraint_name ?? 'unknown'
  }
  return null
}
