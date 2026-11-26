import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { USER_STATUSES, USER_STATUS_ACTIVE, USER_TABLE } from './constants';

export const usersTable = pgTable(
    USER_TABLE,
    {
        id: uuid('id').defaultRandom().primaryKey(),
        name: varchar('name', { length: 120 }).notNull(),
        email: varchar('email', { length: 255 }).notNull().unique(),
        username: varchar('username', { length: 60 }).unique(),
        passwordHash: text('password_hash').notNull(),
        avatarUrl: text('avatar_url'),
        status: varchar('status', { length: 20 }).$type<(typeof USER_STATUSES)[number]>().notNull().default(USER_STATUS_ACTIVE),
        lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index('idx_users_email').on(table.email),
        index('idx_users_status').on(table.status),
    ],
);

export type UserRow = typeof usersTable.$inferSelect;
export type NewUserRow = typeof usersTable.$inferInsert;

export const registerUserValidator = (zod: typeof z) => ({
    name: zod.string().trim().min(2, 'Name must be at least 2 characters').max(120),
    email: zod.string().trim().email('Invalid email address').max(255),
    username: zod
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters')
        .max(60)
        .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, underscores, dots, and hyphens')
        .optional()
        .nullable(),
    password: zod.string().min(8, 'Password must be at least 8 characters').max(128),
    avatarUrl: zod.string().url('Invalid avatar URL').optional().nullable(),
});

export const loginUserValidator = (zod: typeof z) => ({
    email: zod.string().trim().email('Invalid email address'),
    password: zod.string().min(1, 'Password is required'),
});

export const updateUserValidator = (zod: typeof z) => ({
    name: zod.string().trim().min(2).max(120).optional(),
    username: zod
        .string()
        .trim()
        .min(3)
        .max(60)
        .regex(/^[a-zA-Z0-9_.-]+$/)
        .optional()
        .nullable(),
    avatarUrl: zod.string().url().optional().nullable(),
});

export const userIdParamValidator = (zod: typeof z) => ({
    userId: zod.string().uuid('userId must be a valid UUID'),
});

export const listUsersQueryValidator = (zod: typeof z) => ({
    search: zod.string().trim().max(120).optional(),
    status: zod.enum(USER_STATUSES).optional(),
    page: zod.coerce.number().int().min(1).default(1),
    limit: zod.coerce.number().int().min(1).max(100).default(20),
});
