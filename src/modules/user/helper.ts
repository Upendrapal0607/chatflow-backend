import type { PublicUser, UserEntity } from './types';

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const toPublicUser = (user: UserEntity): PublicUser => ({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username ?? null,
    avatarUrl: user.avatarUrl ?? null,
    status: user.status,
    lastActiveAt: user.lastActiveAt ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
