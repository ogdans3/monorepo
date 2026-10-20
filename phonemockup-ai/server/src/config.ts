import 'dotenv/config';

export const config = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: parseInt(process.env.PORT ?? "3000", 10),
    corsOrigin: process.env.CORS_ORIGIN ?? process.env.APP_URL ?? "http://localhost:5173",
    /** Also the allowed Clerk token authorized party (azp). */
    appUrl: process.env.APP_URL ?? "http://localhost:5173",
    trustProxy: process.env.TRUST_PROXY === "true",
};

/**
 * Checked once at startup. Errors stop the API there, rather than as every
 * token being refused because APP_URL quietly fell back to localhost.
 * Uploads are the only part that needs B2, so missing B2 settings are a
 * warning: the API still runs, and uploads answer 502 until they are set.
 */
export function checkConfig(env: NodeJS.ProcessEnv = process.env): {errors: string[]; warnings: string[]} {
    const errors: string[] = [];
    if (!env.DATABASE_URL) errors.push("DATABASE_URL is not set");
    if ((env.NODE_ENV ?? "development") === "production") {
        if (!env.APP_URL) errors.push("APP_URL is not set");
        else if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.APP_URL)) {
            errors.push(`APP_URL is ${env.APP_URL}, which is not the browser origin in production`);
        }
    }
    const warnings = ["B2_KEY_ID", "B2_APP_KEY", "B2_BUCKET_ID", "B2_BUCKET_NAME"]
        .filter((name) => !env[name])
        .map((name) => `${name} is not set, so uploads will fail`);
    return {errors, warnings};
}
