import type {NextFunction, Request, Response} from "express";
import type {User} from "@workos-inc/node";
import workos from "../workos";

const SESSION_COOKIE = "wos-session";

export const sessionCookieOptions = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
};

/** The signed-in WorkOS user, set on `res.locals` by `withAuth`. */
export function currentUser(res: Response): User {
    return res.locals.user as User;
}

function notSignedIn(res: Response) {
    return res.status(401).json({error: "Not signed in"});
}

/**
 * Lets a request through only with a valid WorkOS session, and puts the
 * user on `res.locals.user`.
 *
 * These are API routes, so a missing or dead session is a 401 the client can
 * act on, not a redirect to a page. An expired access token is refreshed in
 * place: the new cookie goes out with this response and the request carries
 * on, rather than being redirected, which would turn a POST into a GET and
 * drop its body.
 */
export async function withAuth(req: Request, res: Response, next: NextFunction) {
    const sessionData = req.cookies?.[SESSION_COOKIE];
    if (!sessionData) return notSignedIn(res);

    try {
        const session = workos.userManagement.loadSealedSession({
            sessionData,
            cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
        });

        const auth = await session.authenticate();
        if (auth.authenticated) {
            res.locals.user = auth.user;
            return next();
        }

        const refreshed = await session.refresh();
        if (!refreshed.authenticated || !refreshed.sealedSession) {
            res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
            return notSignedIn(res);
        }
        res.cookie(SESSION_COOKIE, refreshed.sealedSession, sessionCookieOptions);
        res.locals.user = refreshed.user;
        return next();
    } catch {
        res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
        return notSignedIn(res);
    }
}
