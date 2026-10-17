import 'dotenv/config';

export const config = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: parseInt(process.env.PORT ?? "3000", 10),
    corsOrigin: process.env.CORS_ORIGIN ?? process.env.APP_URL ?? "http://localhost:5173",
    /** Also the allowed Clerk token authorized party (azp). */
    appUrl: process.env.APP_URL ?? "http://localhost:5173",
    trustProxy: process.env.TRUST_PROXY === "true",
};
