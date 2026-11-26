import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { config, hashPassword, signJwt } from '../../../core';
import type { UserEntity } from '../../../modules/user/types';

const mockUsers = new Map<string, UserEntity>();

const mockDb = {
    ping: jest.fn().mockResolvedValue(true),
    query: jest.fn(),
    pool: {},
    orm: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: async () => {
                        const first = Array.from(mockUsers.values())[0];
                        return first ? [first] : [];
                    },
                }),
            }),
        }),
    },
};

const mockFirestore = {
    ping: jest.fn().mockResolvedValue(true),
    db: {},
};

jest.mock('../../../core/database', () => ({
    makeDatabase: () => mockDb,
    disconnectDatabase: jest.fn(),
}));

jest.mock('../../../core/firestore', () => ({
    makeFirestore: () => mockFirestore,
    disconnectFirestore: jest.fn(),
}));

jest.mock('../../../modules/user/repository', () => ({
    userRepository: {
        findById: async (_db: unknown, id: string) => mockUsers.get(id) ?? null,
        findByEmail: async (_db: unknown, email: string) =>
            Array.from(mockUsers.values()).find((u) => u.email === email) ?? null,
        findByUsername: async (_db: unknown, username: string) =>
            Array.from(mockUsers.values()).find((u) => u.username === username) ?? null,
        findMany: async () => {
            const rows = Array.from(mockUsers.values());
            return { rows, total: rows.length };
        },
        create: async (_db: unknown, data: any) => {
            const entity: UserEntity = {
                id: '11111111-1111-4111-8111-111111111111',
                name: data.name,
                email: data.email,
                username: data.username ?? null,
                passwordHash: data.passwordHash,
                avatarUrl: data.avatarUrl ?? null,
                status: data.status ?? 'active',
                lastActiveAt: data.lastActiveAt ?? null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockUsers.set(entity.id, entity);
            return entity;
        },
        updateById: async (_db: unknown, id: string, data: any) => {
            const existing = mockUsers.get(id);
            if (!existing) {
                return null;
            }
            const updated: UserEntity = { ...existing, ...data, updatedAt: new Date() };
            mockUsers.set(id, updated);
            return updated;
        },
    },
}));

import { createApp } from '../../../app';

/**
 * Dispatches a request through Koa's middleware stack in-memory without binding a TCP port.
 */
async function invokeApp(
    app: ReturnType<typeof createApp>,
    opts: {
        method: string;
        url: string;
        body?: Record<string, unknown>;
        headers?: Record<string, string>;
    },
): Promise<{ status: number; body: any }> {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = opts.method;
    req.url = opts.url;
    req.headers = {
        'content-type': 'application/json',
        ...(opts.headers ?? {}),
    };

    if (opts.body !== undefined) {
        const raw = Buffer.from(JSON.stringify(opts.body));
        req.headers['content-length'] = String(raw.length);
        req.push(raw);
    }
    req.push(null);

    const res = new ServerResponse(req);
    const ctx = app.createContext(req, res);
    if (opts.body !== undefined) {
        (ctx.request as any).body = opts.body;
    }

    const runStack = (idx: number): Promise<void> => {
        const fn = app.middleware[idx];
        if (!fn) {
            return Promise.resolve();
        }
        return Promise.resolve(fn(ctx, () => runStack(idx + 1)));
    };

    await runStack(0);
    return { status: ctx.status, body: ctx.body };
}

describe('User & Health HTTP endpoints', () => {
    const app = createApp();

    beforeAll(() => {
        config.jwt.secret = 'test-jwt-secret-key-at-least-32-chars-long';
        config.bcrypt.saltRounds = 4;
    });

    beforeEach(() => {
        mockUsers.clear();
    });

    it('GET /health/status returns 200 with service status', async () => {
        const res = await invokeApp(app, { method: 'GET', url: '/health/status' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ok');
        expect(res.body.data.services).toEqual({
            postgresql: 'connected',
            firestore: 'connected',
        });
    });

    it('POST /user/register creates user, returns 201 + JWT token', async () => {
        const res = await invokeApp(app, {
            method: 'POST',
            url: '/user/register',
            body: {
                name: 'Alice Smith',
                email: 'alice@example.com',
                username: 'alice',
                password: 'Password123!',
            },
        });

        expect(res.status).toBe(201);
        expect(res.body.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeTruthy();
        expect(res.body.data.user.email).toBe('alice@example.com');
        expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('POST /user/register returns 400 validation error on invalid payload', async () => {
        const res = await invokeApp(app, {
            method: 'POST',
            url: '/user/register',
            body: { name: 'A', email: 'bad-email', password: '123' },
        });

        expect(res.status).toBe(400);
        expect(res.body.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.key).toBe('err.json-body.failed');
    });

    it('POST /user/login returns 200 + JWT token for valid user', async () => {
        const passwordHash = await hashPassword('Password123!');
        mockUsers.set('11111111-1111-4111-8111-111111111111', {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Alice',
            email: 'alice@example.com',
            username: 'alice',
            passwordHash,
            avatarUrl: null,
            status: 'active',
            lastActiveAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const res = await invokeApp(app, {
            method: 'POST',
            url: '/user/login',
            body: { email: 'alice@example.com', password: 'Password123!' },
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBeTruthy();
    });

    it('GET /user/me enforces JWT authentication and returns current user', async () => {
        const unauthRes = await invokeApp(app, { method: 'GET', url: '/user/me' });
        expect(unauthRes.status).toBe(401);

        mockUsers.set('11111111-1111-4111-8111-111111111111', {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Alice',
            email: 'alice@example.com',
            username: 'alice',
            passwordHash: 'hash',
            avatarUrl: null,
            status: 'active',
            lastActiveAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const token = signJwt({
            userId: '11111111-1111-4111-8111-111111111111',
            email: 'alice@example.com',
        });

        const res = await invokeApp(app, {
            method: 'GET',
            url: '/user/me',
            headers: { authorization: `Bearer ${token}` },
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe('alice@example.com');
    });

    it('GET /user/:userId validates UUID path param and returns user', async () => {
        mockUsers.set('11111111-1111-4111-8111-111111111111', {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Alice',
            email: 'alice@example.com',
            username: 'alice',
            passwordHash: 'hash',
            avatarUrl: null,
            status: 'active',
            lastActiveAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const token = signJwt({
            userId: '11111111-1111-4111-8111-111111111111',
            email: 'alice@example.com',
        });

        const badParamRes = await invokeApp(app, {
            method: 'GET',
            url: '/user/not-a-uuid',
            headers: { authorization: `Bearer ${token}` },
        });
        expect(badParamRes.status).toBe(400);

        const okRes = await invokeApp(app, {
            method: 'GET',
            url: '/user/11111111-1111-4111-8111-111111111111',
            headers: { authorization: `Bearer ${token}` },
        });
        expect(okRes.status).toBe(200);
        expect(okRes.body.data.user.id).toBe('11111111-1111-4111-8111-111111111111');
    });
});
