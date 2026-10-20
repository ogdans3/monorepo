/**
 * What to log about a failure. Drizzle wraps a database error in a message
 * that spells out the query and its parameters (owner ids, whole project
 * JSON) and keeps the actual Postgres error in `cause`, so log the cause.
 */
export function describeError(err: unknown): string {
    const cause = (err as {cause?: {code?: string; message?: string}} | undefined)?.cause;
    if (cause && (cause.code || cause.message)) {
        return [cause.code, cause.message].filter(Boolean).join(" ");
    }
    return (err as Error | undefined)?.message ?? String(err ?? "");
}
