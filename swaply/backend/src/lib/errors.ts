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
