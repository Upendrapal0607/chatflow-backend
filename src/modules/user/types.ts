import type { CoreServices } from '../../core';
import type { UserStatus } from './constants';
import type { NewUserRow, UserRow } from './schema';

export type UserEntity = UserRow;
export type CreateUserRecord = NewUserRow;

export interface PublicUser {
    id: string;
    name: string;
    email: string;
    username: string | null;
    avatarUrl: string | null;
    status: UserStatus;
    lastActiveAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface RegisterUserInput {
    name: string;
    email: string;
    username?: string | null;
    password: string;
    avatarUrl?: string | null;
}

export interface LoginUserInput {
    email: string;
    password: string;
}

export interface UpdateUserInput {
    name?: string;
    username?: string | null;
    avatarUrl?: string | null;
}

export interface ListUsersInput {
    search?: string;
    status?: UserStatus;
    page: number;
    limit: number;
}

export interface AuthResult {
    token: string;
    user: PublicUser;
}

export interface PaginatedUsersResult {
    users: PublicUser[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        count: number;
    };
}

export interface UserRepository {
    findById: (db: CoreServices['db'], id: string) => Promise<UserEntity | null>;
    findByEmail: (db: CoreServices['db'], email: string) => Promise<UserEntity | null>;
    findByUsername: (db: CoreServices['db'], username: string) => Promise<UserEntity | null>;
    findMany: (
        db: CoreServices['db'],
        params: ListUsersInput,
    ) => Promise<{ rows: UserEntity[]; total: number }>;
    create: (db: CoreServices['db'], data: CreateUserRecord) => Promise<UserEntity>;
    updateById: (
        db: CoreServices['db'],
        id: string,
        data: Partial<Pick<UserEntity, 'name' | 'username' | 'avatarUrl' | 'lastActiveAt' | 'updatedAt'>>,
    ) => Promise<UserEntity | null>;
}

export interface UserService {
    register: (params: { services: CoreServices; args: RegisterUserInput }) => Promise<AuthResult>;
    login: (params: { services: CoreServices; args: LoginUserInput }) => Promise<AuthResult>;
    getById: (params: { services: CoreServices; args: { userId: string } }) => Promise<PublicUser>;
    list: (params: { services: CoreServices; args: ListUsersInput }) => Promise<PaginatedUsersResult>;
    updateProfile: (params: {
        services: CoreServices;
        args: UpdateUserInput & { currentUser: PublicUser };
    }) => Promise<PublicUser>;
}
