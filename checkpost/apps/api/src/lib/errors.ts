import type { ErrorResponse } from '@checkpost/contract';

type Code = ErrorResponse['error']['code'];

const STATUS: Record<Code, number> = {
  bad_request: 400,
  unauthorized: 401,
  not_found: 404,
  gone: 410,
  limit_reached: 409,
  too_many_requests: 429,
  internal: 500,
};

/**
 * Errors the client is meant to read. Messages are written for a person, in the
 * product's voice: what happened and what to do, no apology, no jargon.
 */
export class ApiError extends Error {
  readonly code: Code;
  readonly status: number;

  constructor(code: Code, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS[code];
  }

  toResponse(): ErrorResponse {
    return { error: { code: this.code, message: this.message } };
  }

  static badRequest(message = 'That request did not make sense.') {
    return new ApiError('bad_request', message);
  }

  static unauthorized(message = 'That link is not valid.') {
    return new ApiError('unauthorized', message);
  }

  static notFound(message = 'Not found.') {
    return new ApiError('not_found', message);
  }

  /** Used when a *previously valid* link has been rotated or its list deleted. */
  static gone(message = 'This link was replaced. Ask for the new one.') {
    return new ApiError('gone', message);
  }

  static limitReached(message = 'This list is full.') {
    return new ApiError('limit_reached', message);
  }
}
