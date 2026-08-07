import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { SHARE_TOKEN_BYTES, SHARE_TOKEN_PATTERN } from '@checkpost/contract';

/**
 * A share token is the only credential Checkpost has. 32 random bytes,
 * base64url — 43 characters, ~192 bits. Long enough that a link can sit in a
 * group chat forever and that enumeration is not a threat model.
 */
export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

/**
 * Only the hash is persisted. A leaked database backup therefore contains no
 * usable links — which matters more here than in a password system, because the
 * token *is* the account.
 *
 * SHA-256 rather than a slow KDF is deliberate and safe: the input is 192 bits
 * of CSPRNG output, not a human-chosen secret, so there is nothing to brute
 * force, and lookups must stay a single indexed query.
 */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function isWellFormedToken(token: string): boolean {
  return SHARE_TOKEN_PATTERN.test(token);
}

/** Constant-time compare for the rare paths that compare two hashes directly. */
export function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Pulls the bearer token out of an Authorization header.
 * Returns null for anything malformed — callers answer 401 either way.
 */
export function bearerFrom(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1];
  if (!token || !isWellFormedToken(token)) return null;
  return token;
}
