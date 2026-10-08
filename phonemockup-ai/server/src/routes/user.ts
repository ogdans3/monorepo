import {Router} from 'express';
import {currentUser, withAuth} from '../middleware/auth';
import {createUser, getUser} from '../db/queries';

const router = Router();

// Get the current authenticated user (and ensure they exist in DB)
router.get('/me', withAuth, async (req, res) => {
    try {
        const user = currentUser(res);

        // Ensure the user exists in our DB (id only per your schema)
        await createUser(user.id);
        const dbUser = await getUser(user.id);

        return res.status(200).json({
            id: dbUser?.id ?? null,
            createdAt: dbUser?.createdAt ?? null,
            workos: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
            },
        });
    } catch (err: any) {
        console.error(500, req.method, req.originalUrl, err?.message);
        return res.status(500).json({error: 'Failed to load user'});
    }
});

// Create user explicitly (optional; usually /me is enough)
router.post('/', withAuth, async (req, res) => {
    try {
        const created = await createUser(currentUser(res).id);
        return res.status(201).json(created);
    } catch (err: any) {
        console.error(500, req.method, req.originalUrl, err?.message);
        return res.status(500).json({error: 'Failed to create user'});
    }
});

export default router;
