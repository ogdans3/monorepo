/**
 * An error the user is meant to read. Messages are written for people, in the
 * product's voice: what happened, and what to do, with no apology.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toResponse() {
    return { error: { code: this.code, message: this.message } };
  }

  static badRequest(message: string) {
    return new ApiError(400, 'bad_request', message);
  }

  static unauthorized(message = 'Sign in first.') {
    return new ApiError(401, 'unauthorized', message);
  }

  static taken(message: string) {
    return new ApiError(409, 'taken', message);
  }

  static tooMany(message = 'Too many attempts. Wait a minute and try again.') {
    return new ApiError(429, 'too_many_requests', message);
  }
}
