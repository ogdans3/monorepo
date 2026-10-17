import { Router } from 'express';
import { clerkClient } from '@clerk/express';
import { currentUser, withAuth } from '../middleware/auth.js';
import { getUser } from '../db/queries.js';

const router = Router();
router.get('/me', withAuth, async (_req, res, next) => {
    try {
        const identity = currentUser(res);
        const [user, profile] = await Promise.all([
            getUser(identity.id), clerkClient.users.getUser(identity.clerkId),
        ]);
        res.json({
            id: identity.id,
            createdAt: user?.createdAt ?? null,
            clerk: {
                id: profile.id,
                email: profile.emailAddresses.find((email) => email.id === profile.primaryEmailAddressId)?.emailAddress ?? null,
                firstName: profile.firstName, lastName: profile.lastName,
            },
        });
    } catch (error) { next(error); }
});

// withAuth provisions the stable identity on first authenticated use.
router.post('/', withAuth, async (_req, res, next) => {
    try { res.status(200).json(await getUser(currentUser(res).id)); }
    catch (error) { next(error); }
});
export default router;
