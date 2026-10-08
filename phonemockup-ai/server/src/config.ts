import 'dotenv/config';

export const config = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: parseInt(process.env.PORT ?? "3000", 10),
    corsOrigin: process.env.CORS_ORIGIN ?? "*",
    workosApiKey: process.env.WORKOS_API_KEY ?? "",
    workosClientId: process.env.WORKOS_CLIENT_ID ?? "",
    /** Where WorkOS sends the user back after signing in; must be registered with WorkOS. */
    workosRedirectUri: process.env.WORKOS_REDIRECT_URI ?? "http://localhost:3000/api/wos-callback",
    /** The client app, where signing out lands. */
    appUrl: process.env.APP_URL ?? "http://localhost:5173",
    trustProxy: process.env.TRUST_PROXY === "true",
};
