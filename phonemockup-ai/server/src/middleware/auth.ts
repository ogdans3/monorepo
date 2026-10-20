import { clerkMiddleware, getAuth, type ClerkMiddlewareOptions } from '@clerk/express';
import type { RequestHandler, Response } from 'express';
import { config } from '../config.js';
import type { AppIdentity } from '../auth/identity.js';

/** Stable application identity, not the provider's ID. */
export function currentUser(res: Response): AppIdentity {
    return res.locals.user as AppIdentity;
}

const SESSION_BEARER = /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function createAuthMiddleware(
    options: ClerkMiddlewareOptions,
    resolveIdentity: (clerkUserId: string) => Promise<AppIdentity>,
): RequestHandler {
    const authenticate = clerkMiddleware({ ...options, acceptsToken: 'session_token' });
    return (req, res, next) => {
        // A session token is a JWT, sent as "Bearer <jwt>". Anything else stops
        // here, before Clerk sees it: its middleware verifies machine tokens
        // (ak_, mt_, oat_) against the Backend API with our secret key, and a
        // header it does not read (such as "bearer …") makes it fall back to the
        // browser's cookies. Ambient cookies must never authorize a request.
        if (!SESSION_BEARER.test(req.headers.authorization ?? '')) {
            res.status(401).json({ error: 'Not signed in' });
            return;
        }
        authenticate(req, res, (error?: unknown) => {
            if (error) return next(error);
            const session = getAuth(req, { acceptsToken: 'session_token' });
            if (!session.isAuthenticated || !session.userId) {
                res.status(401).json({ error: 'Not signed in' });
                return;
            }
            resolveIdentity(session.userId).then((identity) => {
                res.locals.user = identity;
                next();
            }).catch(next);
        });
    };
}

let middleware: RequestHandler | undefined;
export const withAuth: RequestHandler = (req, res, next) => {
    if (!req.headers.authorization) {
        res.status(401).json({ error: 'Not signed in' });
        return;
    }
    if (!process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY) {
        res.status(503).json({ error: 'Authentication is not configured' });
        return;
    }
    middleware ??= createAuthMiddleware({
        authorizedParties: [new URL(config.appUrl).origin],
    }, async (clerkId) => {
        const { resolveClerkIdentity } = await import('../auth/resolve-identity.js');
        return resolveClerkIdentity(clerkId);
    });
    return middleware(req, res, next);
};
