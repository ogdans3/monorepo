import type { z } from 'zod';
import { ApiError } from '../lib/errors.js';

/**
 * Validates a request body and turns failures into the product's error voice
 * rather than leaking Zod's. Callers get a typed value or a 400.
 */
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  const where = issue?.path.join('.');
  throw ApiError.badRequest(
    where ? `${where}: ${issue?.message ?? 'invalid'}` : (issue?.message ?? 'Invalid request body.'),
  );
}
