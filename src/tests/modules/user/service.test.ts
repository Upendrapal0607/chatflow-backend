import { config, hashPassword } from '../../../core';
import { ConflictError, NotAuthenticatedError, NotFoundError } from '../../../lib/core';
import { createUserService } from '../../../modules/user/service';
import type { UserEntity, UserRepository } from '../../../modules/user/types';

const makeUserEntity = (overrides: Partial<UserEntity> = {}): UserEntity => ({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Alice',
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: 'hashed',
    avatarUrl: null,
    status: 'active',
    lastActiveAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
});

const makeMockServices = () => ({
    db: {} as any,
    firestore: {} as any,
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        captureError: jest.fn(),
    },
});

const makeMockRepo = (overrides: Partial<UserRepository> = {}): UserRepository => ({
    findById: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    findByUsername: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
    create: jest.fn().mockImplementation(async (_db, data) => makeUserEntity({ ...data })),
    updateById: jest.fn().mockResolvedValue(null),
    ...overrides,
});

describe('modules/user/service', () => {
    beforeAll(() => {
        config.jwt.secret = 'test-jwt-secret-key-at-least-32-chars-long';
        config.bcrypt.saltRounds = 4;
    });

    it('registers a new user, hashes password, and returns JWT + sanitized user', async () => {
        const repo = makeMockRepo();
        const service = createUserService(repo);
        const services = makeMockServices();

        const result = await service.register({
            services,
            args: {
                name: 'Alice',
                email: 'ALICE@Example.com',
                username: 'alice',
                password: 'Password123!',
            },
        });

        expect(result.token).toBeTruthy();
        expect(result.user.email).toBe('alice@example.com');
        expect((result.user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
        expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictError if email is already registered', async () => {
        const repo = makeMockRepo({
            findByEmail: jest.fn().mockResolvedValue(makeUserEntity()),
        });
        const service = createUserService(repo);

        await expect(
            service.register({
                services: makeMockServices(),
                args: { name: 'Alice', email: 'alice@example.com', password: 'Password123!' },
            }),
        ).rejects.toBeInstanceOf(ConflictError);
    });

    it('logs in user with valid credentials and returns JWT', async () => {
        const passwordHash = await hashPassword('Password123!');
        const user = makeUserEntity({ passwordHash });
        const repo = makeMockRepo({
            findByEmail: jest.fn().mockResolvedValue(user),
            updateById: jest.fn().mockResolvedValue(user),
        });
        const service = createUserService(repo);

        const result = await service.login({
            services: makeMockServices(),
            args: { email: 'alice@example.com', password: 'Password123!' },
        });

        expect(result.token).toBeTruthy();
        expect(result.user.id).toBe(user.id);
    });

    it('throws NotAuthenticatedError on wrong password', async () => {
        const passwordHash = await hashPassword('Password123!');
        const repo = makeMockRepo({
            findByEmail: jest.fn().mockResolvedValue(makeUserEntity({ passwordHash })),
        });
        const service = createUserService(repo);

        await expect(
            service.login({
                services: makeMockServices(),
                args: { email: 'alice@example.com', password: 'WrongPassword' },
            }),
        ).rejects.toBeInstanceOf(NotAuthenticatedError);
    });

    it('throws NotFoundError when getById cannot find user', async () => {
        const repo = makeMockRepo({ findById: jest.fn().mockResolvedValue(null) });
        const service = createUserService(repo);

        await expect(
            service.getById({
                services: makeMockServices(),
                args: { userId: '11111111-1111-4111-8111-111111111111' },
            }),
        ).rejects.toBeInstanceOf(NotFoundError);
    });
});
