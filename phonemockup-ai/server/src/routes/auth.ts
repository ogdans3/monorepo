import {Router} from "express";
import workos from "../workos";
import {config} from "../config";
import {sessionCookieOptions} from "../middleware/auth";

const router = Router();

/**
 * Where to send the user after signing in. Only a path on this site: the
 * value comes back from the login round trip, so anything else would make
 * this an open redirect to wherever a crafted link says.
 */
function safeReturnPath(value: unknown): string {
    if (typeof value !== "string") return "/";
    if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
    return value;
}

router.get('/login', (req, res) => {
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
        provider: 'authkit',
        redirectUri: config.workosRedirectUri,
        clientId: config.workosClientId,
        state: safeReturnPath(req.query.redirect),
    });
    res.redirect(authorizationUrl);
});

router.get('/wos-callback', async (req, res) => {
    const code = req.query.code as string;

    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        const authenticateResponse =
            await workos.userManagement.authenticateWithCode({
                clientId: config.workosClientId,
                code,
                session: {
                    sealSession: true,
                    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
                },
            });

        // Store the session in a cookie
        res.cookie('wos-session', authenticateResponse.sealedSession, sessionCookieOptions);
        return res.redirect(safeReturnPath(req.query.state));
    } catch (error) {
        console.error("Sign-in failed", (error as Error)?.message);
        return res.redirect('/api/login');
    }
});

router.get('/logout', async (req, res) => {
    // Signing out always clears our cookie. Ending the WorkOS session too
    // needs a session that still decodes; an expired one throws here.
    let url = config.appUrl;
    try {
        const session = workos.userManagement.loadSealedSession({
            sessionData: req.cookies['wos-session'],
            cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
        });
        url = await session.getLogoutUrl({returnTo: config.appUrl});
    } catch {
        // Nothing to end on WorkOS' side; just drop the cookie.
    }

    res.clearCookie('wos-session', sessionCookieOptions);
    res.redirect(url);
});

export default router;
