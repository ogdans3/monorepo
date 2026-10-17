import { Router } from 'express';
import { config } from '../config.js';

const router = Router();
// Retire old bookmarks without accepting or refreshing old provider sessions.
router.get(['/login', '/wos-callback'], (_req, res) => {
    res.clearCookie('wos-session', { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
    res.redirect(new URL('/sign-in', config.appUrl).href);
});
// A cross-site GET must not sign out the current Clerk session.
router.get('/logout', (_req, res) => {
    res.status(410).json({ error: 'Use Sign out in the account menu.' });
});
export default router;
