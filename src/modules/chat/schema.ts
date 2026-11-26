import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { usersTable } from '../user/schema';
import {
    CHATS_TABLE,
    CHAT_MEMBER_ROLES,
    CHAT_MEMBERS_TABLE,
    CHAT_ROLE_MEMBER,
    CHAT_TYPES,
    CHAT_TYPE_DIRECT,
} from './constants';

export const chatsTable = pgTable(
    CHATS_TABLE,
    {
        id: uuid('id').defaultRandom().primaryKey(),
        type: varchar('type', { length: 20 }).$type<(typeof CHAT_TYPES)[number]>().notNull().default(CHAT_TYPE_DIRECT),
        directKey: varchar('direct_key', { length: 100 }).unique(),
        name: varchar('name', { length: 120 }),
        createdBy: uuid('created_by').references(() => usersTable.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index('idx_chats_type').on(table.type)],
);

export const chatMembersTable = pgTable(
    CHAT_MEMBERS_TABLE,
    {
        id: uuid('id').defaultRandom().primaryKey(),
        chatId: uuid('chat_id')
            .notNull()
            .references(() => chatsTable.id, { onDelete: 'cascade' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => usersTable.id, { onDelete: 'cascade' }),
        role: varchar('role', { length: 20 })
            .$type<(typeof CHAT_MEMBER_ROLES)[number]>()
            .notNull()
            .default(CHAT_ROLE_MEMBER),
        joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        uniqueIndex('uq_chat_members_chat_user').on(table.chatId, table.userId),
        index('idx_chat_members_user_id').on(table.userId),
        index('idx_chat_members_chat_id').on(table.chatId),
    ],
);

export type ChatRow = typeof chatsTable.$inferSelect;
export type NewChatRow = typeof chatsTable.$inferInsert;
export type ChatMemberRow = typeof chatMembersTable.$inferSelect;
export type NewChatMemberRow = typeof chatMembersTable.$inferInsert;

export const createDirectChatValidator = (zod: typeof z) => ({
    userAId: zod.string().uuid('userAId must be a valid UUID'),
    userBId: zod.string().uuid('userBId must be a valid UUID'),
});

export const createGroupChatValidator = (zod: typeof z) => ({
    name: zod.string().trim().min(1, 'Group name is required').max(120),
    memberIds: zod.array(zod.string().uuid('Each memberId must be a valid UUID')).min(1, 'At least 1 other member is required'),
});

export const updateGroupChatValidator = (zod: typeof z) => ({
    name: zod.string().trim().min(1, 'Group name cannot be empty').max(120),
});

export const addChatMembersValidator = (zod: typeof z) => ({
    memberIds: zod.array(zod.string().uuid('Each memberId must be a valid UUID')).min(1, 'Provide at least 1 memberId'),
});

export const chatIdParamValidator = (zod: typeof z) => ({
    chatId: zod.string().uuid('chatId must be a valid UUID'),
});

export const chatMemberParamValidator = (zod: typeof z) => ({
    chatId: zod.string().uuid('chatId must be a valid UUID'),
    userId: zod.string().uuid('userId must be a valid UUID'),
});
