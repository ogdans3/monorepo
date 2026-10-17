export type AppIdentity = { id: string; clerkId: string };

export type IdentityStore = {
    find: (clerkId: string) => Promise<AppIdentity | null>;
    userExists: (id: string) => Promise<boolean>;
    createUser: (id: string) => Promise<unknown>;
    link: (identity: AppIdentity) => Promise<AppIdentity>;
};

/** externalId comes only from Clerk's authenticated Backend API, never the browser. */
export async function resolveIdentity(
    clerkId: string,
    store: IdentityStore,
    getExternalId: (clerkId: string) => Promise<string | null>,
): Promise<AppIdentity> {
    const linked = await store.find(clerkId);
    if (linked) return linked;
    const externalId = await getExternalId(clerkId);
    if (externalId && !await store.userExists(externalId)) {
        throw new Error('Imported Clerk user has no matching application user');
    }
    const id = externalId || `clerk:${clerkId}`;
    if (!externalId) await store.createUser(id);
    const identity = await store.link({ id, clerkId });
    if (identity.id !== id || identity.clerkId !== clerkId) {
        throw new Error('Conflicting authentication identity');
    }
    return identity;
}
