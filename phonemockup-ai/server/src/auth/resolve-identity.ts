import { clerkClient } from '@clerk/express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { authIdentity } from '../db/schema.js';
import { createUser, getUser } from '../db/queries.js';
import { resolveIdentity, type AppIdentity, type IdentityStore } from './identity.js';

async function find(clerkId: string): Promise<AppIdentity | null> {
    const [row] = await db.select({ id: authIdentity.userId, clerkId: authIdentity.clerkId })
        .from(authIdentity).where(eq(authIdentity.clerkId, clerkId)).limit(1);
    return row ?? null;
}

const store: IdentityStore = {
    find,
    userExists: async (id) => Boolean(await getUser(id)),
    createUser,
    async link(identity) {
        // Unique on both columns: one identity per owner, including concurrent requests.
        await db.insert(authIdentity).values({ clerkId: identity.clerkId, userId: identity.id })
            .onConflictDoNothing();
        const linked = await find(identity.clerkId);
        if (!linked) throw new Error('Application user is already linked to another Clerk account');
        return linked;
    },
};

export function resolveClerkIdentity(clerkId: string) {
    return resolveIdentity(clerkId, store, async (id) => (await clerkClient.users.getUser(id)).externalId);
}
