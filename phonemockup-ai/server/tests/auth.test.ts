import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { once } from 'node:events';
import express, { type RequestHandler } from 'express';
import { createAuthMiddleware } from '../src/middleware/auth.js';
import projectRoutes from '../src/routes/project.js';
import { resolveIdentity, type AppIdentity, type IdentityStore } from '../src/auth/identity.js';

const queries = vi.hoisted(() => ({
    getProject: vi.fn(), getProjects: vi.fn(), createProject: vi.fn(), updateProject: vi.fn(),
}));
vi.mock('../src/db/queries.js', () => queries);
vi.mock('../src/db/client.js', () => ({ db: {} }));
let authenticate: RequestHandler;
vi.mock('../src/middleware/auth.js', async (original) => ({
    ...await original<object>(),
    withAuth: (...args: Parameters<RequestHandler>) => authenticate(...args),
}));

const origin = 'https://phonemockup.test';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const id = 'f42d1a0c-1bba-4e79-8297-adba32490170';
const resolve = vi.fn(async (clerkId: string) => ({ clerkId, id: `legacy-${clerkId}` }));
let server: ReturnType<express.Express['listen']>;
let url: string;

function token(overrides: Record<string, unknown> = {}, key = privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = `${encode({ alg: 'RS256', typ: 'JWT', kid: 'local-fixture' })}.${encode({
        azp: origin, iss: 'https://clerk-fixture.clerk.accounts.dev', sub: 'user_alice',
        sid: 'sess_local', iat: now, nbf: now - 1, exp: now + 60, v: 2, sts: 'active',
        ...overrides,
    })}`;
    return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
}

beforeAll(async () => {
    authenticate = createAuthMiddleware({
        publishableKey: `pk_test_${Buffer.from('clerk-fixture.clerk.accounts.dev$').toString('base64')}`,
        secretKey: 'sk_test_local_fixture_not_a_real_secret',
        jwtKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        authorizedParties: [origin],
    }, resolve);
    const app = express();
    app.use(express.json());
    app.use('/api/project', projectRoutes);
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ error: String(error) });
    });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));
beforeEach(() => { vi.clearAllMocks(); });

async function request(path = '/api/project', bearer?: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
    return fetch(`${url}${path}`, { ...options, headers, redirect: 'manual' });
}

describe('real Clerk signature verification and existing project routes', () => {
    it('returns JSON 401 for unauthenticated reads, writes and uploads, without redirects', async () => {
        for (const [path, method] of [['/api/project','GET'], ['/api/project','POST'], [`/api/project/${id}/file`,'POST']]) {
            const response = await request(path, undefined, { method });
            expect(response.status).toBe(401);
            expect(response.headers.get('location')).toBeNull();
        }
        expect(resolve).not.toHaveBeenCalled();
    });
    it('does not accept old WorkOS cookies or ambient Clerk cookies', async () => {
        const response = await request('/api/project', undefined, { headers: { cookie: `wos-session=old; __session=${token()}` } });
        expect(response.status).toBe(401);
    });
    it.each([
        ['malformed', () => 'not.a.jwt'],
        ['forged', () => token({}, otherKey)],
        ['expired', () => token({ exp: Math.floor(Date.now()/1000) - 60 })],
        ['wrong origin', () => token({ azp: 'https://evil.test' })],
        ['pending session', () => token({ sts: 'pending' })],
    ])('rejects %s tokens before data access', async (_label, makeToken) => {
        expect((await request('/api/project', makeToken())).status).toBe(401);
        expect(resolve).not.toHaveBeenCalled();
        expect(queries.getProjects).not.toHaveBeenCalled();
    });
    it('lists only the stable, mapped owner and ignores query-supplied owner IDs', async () => {
        queries.getProjects.mockResolvedValue([]);
        expect((await request('/api/project?owner=legacy-user_bob', token())).status).toBe(200);
        expect(queries.getProjects).toHaveBeenCalledWith('legacy-user_alice', expect.any(Object));
    });
    it('keeps another user’s project and file routes private', async () => {
        queries.getProject.mockResolvedValue({ id, owner: 'legacy-user_bob' });
        for (const path of [`/api/project/${id}`, `/api/project/${id}/file`]) {
            expect((await request(path, token())).status).toBe(404);
        }
        expect((await request(`/api/project/${id}/file`, token(), { method: 'POST' })).status).toBe(404);
    });
    it('reads an existing migrated project using its original owner', async () => {
        queries.getProject.mockResolvedValue({ id, owner: 'legacy-user_alice', name: 'Existing project' });
        const response = await request(`/api/project/${id}`, token());
        expect(response.status).toBe(200);
        expect((await response.json()).name).toBe('Existing project');
    });
    it('creates and updates using the verified owner, never a body-supplied owner', async () => {
        queries.createProject.mockResolvedValue({ id, owner: 'legacy-user_alice' });
        const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Mockup', owner: 'legacy-user_bob' }) };
        expect((await request('/api/project', token(), options)).status).toBe(201);
        expect(queries.createProject).toHaveBeenCalledWith(expect.objectContaining({ owner: 'legacy-user_alice' }));
        queries.updateProject.mockResolvedValue(null);
        expect((await request(`/api/project/${id}`, token(), options)).status).toBe(404);
        expect(queries.updateProject).toHaveBeenCalledWith(expect.objectContaining({ owner: 'legacy-user_alice' }));
    });
});

describe('stable identity migration', () => {
    function fixture() {
        const users = new Set(['workos-alice']);
        const links = new Map<string, AppIdentity>();
        const store: IdentityStore = {
            find: async (id) => links.get(id) ?? null,
            userExists: async (id) => users.has(id),
            createUser: async (id) => { users.add(id); },
            link: async (identity) => {
                if ([...links.values()].some((link) => link.id === identity.id && link.clerkId !== identity.clerkId)) throw new Error('already linked');
                links.set(identity.clerkId, identity);
                return identity;
            },
        };
        return { users, links, store };
    }
    it('imports by trusted external ID without renaming owners or duplicating users', async () => {
        const { users, store } = fixture();
        const result = await resolveIdentity('user_new', store, async () => 'workos-alice');
        expect(result).toEqual({ id: 'workos-alice', clerkId: 'user_new' });
        expect(users.size).toBe(1);
    });
    it('namespaces new users and retains a link even if provider metadata later changes', async () => {
        const { store } = fixture();
        const first = await resolveIdentity('user_new', store, async () => null);
        const external = vi.fn(async () => 'workos-alice');
        expect(await resolveIdentity('user_new', store, external)).toEqual(first);
        expect(first.id).toBe('clerk:user_new');
        expect(external).not.toHaveBeenCalled();
    });
    it('fails closed on an unknown external ID or conflicting link', async () => {
        const { store } = fixture();
        await expect(resolveIdentity('user_one', store, async () => 'missing')).rejects.toThrow('no matching');
        await resolveIdentity('user_one', store, async () => 'workos-alice');
        await expect(resolveIdentity('user_two', store, async () => 'workos-alice')).rejects.toThrow('already linked');
    });
});
