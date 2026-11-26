import {
    comparePassword,
    hashPassword,
    signJwt,
    CoreServices,
} from '../../core';
import {
    AppError,
    ConflictError,
    InternalServerError,
    NotAuthenticatedError,
    NotAuthorizedError,
    NotFoundError,
} from '../../lib/core';
import { USER_ERROR_KEYS, USER_STATUS_ACTIVE } from './constants';
import { normalizeEmail, toPublicUser } from './helper';
import { userRepository } from './repository';
import type {
    AuthResult,
    ListUsersInput,
    LoginUserInput,
    PaginatedUsersResult,
    PublicUser,
    RegisterUserInput,
    UpdateUserInput,
    UserRepository,
    UserService,
} from './types';

export const createUserService = (repo: UserRepository = userRepository): UserService => ({
    async register({
        services,
        args,
    }: {
        services: CoreServices;
        args: RegisterUserInput;
    }): Promise<AuthResult> {
        const email = normalizeEmail(args.email);

        const existingByEmail = await repo.findByEmail(services.db, email);
        if (existingByEmail) {
            throw new ConflictError('An account with this email already exists', {
                key: USER_ERROR_KEYS.EMAIL_TAKEN,
            });
        }

        if (args.username) {
            const existingByUsername = await repo.findByUsername(services.db, args.username);
            if (existingByUsername) {
                throw new ConflictError('This username is already taken', {
                    key: USER_ERROR_KEYS.USERNAME_TAKEN,
                });
            }
        }

        try {
            const passwordHash = await hashPassword(args.password);
            const created = await repo.create(services.db, {
                name: args.name.trim(),
                email,
                username: args.username ?? null,
                passwordHash,
                avatarUrl: args.avatarUrl ?? null,
                status: USER_STATUS_ACTIVE,
                lastActiveAt: new Date(),
            });

            const user = toPublicUser(created);
            const token = signJwt({ userId: user.id, email: user.email });
            return { token, user };
        } catch (err) {
            if (err instanceof AppError) {
                throw err;
            }
            services.logger.captureError(err, { email, method: 'userService.register' });
            throw new InternalServerError('Failed to register user', {
                key: USER_ERROR_KEYS.CREATE_FAILED,
                cause: err,
            });
        }
    },

    async login({
        services,
        args,
    }: {
        services: CoreServices;
        args: LoginUserInput;
    }): Promise<AuthResult> {
        const email = normalizeEmail(args.email);
        const userRow = await repo.findByEmail(services.db, email);

        if (!userRow) {
            throw new NotAuthenticatedError('Invalid email or password', {
                key: USER_ERROR_KEYS.INVALID_CREDENTIALS,
            });
        }

        const validPassword = await comparePassword(args.password, userRow.passwordHash);
        if (!validPassword) {
            throw new NotAuthenticatedError('Invalid email or password', {
                key: USER_ERROR_KEYS.INVALID_CREDENTIALS,
            });
        }

        if (userRow.status !== USER_STATUS_ACTIVE) {
            throw new NotAuthorizedError('User account is not active', {
                key: USER_ERROR_KEYS.ACCOUNT_INACTIVE,
            });
        }

        const updated = await repo.updateById(services.db, userRow.id, {
            lastActiveAt: new Date(),
        });

        const user = toPublicUser(updated ?? userRow);
        const token = signJwt({ userId: user.id, email: user.email });
        return { token, user };
    },

    async getById({
        services,
        args,
    }: {
        services: CoreServices;
        args: { userId: string };
    }): Promise<PublicUser> {
        const userRow = await repo.findById(services.db, args.userId);
        if (!userRow) {
            throw new NotFoundError('User not found', {
                key: USER_ERROR_KEYS.NOT_FOUND,
            });
        }
        return toPublicUser(userRow);
    },

    async list({
        services,
        args,
    }: {
        services: CoreServices;
        args: ListUsersInput;
    }): Promise<PaginatedUsersResult> {
        const { rows, total } = await repo.findMany(services.db, args);
        const users = rows.map(toPublicUser);
        return {
            users,
            pagination: {
                page: args.page,
                limit: args.limit,
                total,
                count: users.length,
            },
        };
    },

    async updateProfile({
        services,
        args,
    }: {
        services: CoreServices;
        args: UpdateUserInput & { currentUser: PublicUser };
    }): Promise<PublicUser> {
        const { currentUser, name, username, avatarUrl } = args;

        if (username && username !== currentUser.username) {
            const existing = await repo.findByUsername(services.db, username);
            if (existing && existing.id !== currentUser.id) {
                throw new ConflictError('This username is already taken', {
                    key: USER_ERROR_KEYS.USERNAME_TAKEN,
                });
            }
        }

        const updated = await repo.updateById(services.db, currentUser.id, {
            ...(name !== undefined ? { name } : {}),
            ...(username !== undefined ? { username } : {}),
            ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        });

        if (!updated) {
            throw new NotFoundError('User not found', {
                key: USER_ERROR_KEYS.NOT_FOUND,
            });
        }

        return toPublicUser(updated);
    },
});

export const userService = createUserService();

export const useUserService = () => ({
    userService,
});
