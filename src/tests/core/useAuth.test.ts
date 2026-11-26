process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';

import { config, signJwt } from '../../../core';
import { useAuth } from '../../../core/hooks';
import { NotAuthenticatedError, NotAuthorizedError, props } from '../../../lib/core';

const makeMockDb = (userRow: Record<string, unknown> | undefined) => ({
    orm: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: async () => (userRow ? [userRow] : []),
                }),
            }),
        }),
    },
});

describe('core/hooks/useAuth', () => {
    beforeAll(() => {
        config.jwt.secret = 'test-jwt-secret-key-at-least-32-chars-long';
    });

    it('throws NotAuthenticatedError when Authorization header is missing', async () => {
        const handler = useAuth()(async ({ args }) => args);
        const p = {
            ...props(),
            services: { db: makeMockDb(undefined) as any },
        };

        await expect(handler(p)).rejects.toBeInstanceOf(NotAuthenticatedError);
    });

    it('throws NotAuthenticatedError when JWT is invalid', async () => {
        const handler = useAuth()(async ({ args }) => args);
        const p = {
            ...props(),
            request: {
                ...props().request,
                headers: { authorization: 'Bearer invalid.jwt.token' },
            },
            services: { db: makeMockDb(undefined) as any },
        };

        await expect(handler(p)).rejects.toBeInstanceOf(NotAuthenticatedError);
    });

    it('throws NotAuthorizedError when authenticated user is not active', async () => {
        const token = signJwt({ userId: 'user-1', email: 'alice@example.com' });
        const handler = useAuth()(async ({ args }) => args);
        const p = {
            ...props(),
            request: {
                ...props().request,
                headers: { authorization: `Bearer ${token}` },
            },
            services: {
                db: makeMockDb({
                    id: 'user-1',
                    name: 'Alice',
                    email: 'alice@example.com',
                    username: 'alice',
                    passwordHash: 'secret-hash',
                    avatarUrl: null,
                    status: 'suspended',
                    lastActiveAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }) as any,
            },
        };

        await expect(handler(p)).rejects.toBeInstanceOf(NotAuthorizedError);
    });

    it('attaches sanitized currentUser and auth context on valid JWT', async () => {
        const token = signJwt({ userId: 'user-1', email: 'alice@example.com' });
        const handler = useAuth()(async ({ args, auth }) => ({ args, auth }));
        const p = {
            ...props(),
            request: {
                ...props().request,
                headers: { authorization: `Bearer ${token}` },
            },
            services: {
                db: makeMockDb({
                    id: 'user-1',
                    name: 'Alice',
                    email: 'alice@example.com',
                    username: 'alice',
                    passwordHash: 'secret-hash',
                    avatarUrl: null,
                    status: 'active',
                    lastActiveAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }) as any,
            },
        };

        const res = (await handler(p)) as { args: { currentUser: Record<string, unknown> }; auth: { userId: string } };
        expect(res.auth.userId).toBe('user-1');
        expect(res.args.currentUser.email).toBe('alice@example.com');
        expect(res.args.currentUser.passwordHash).toBeUndefined();
    });
});
