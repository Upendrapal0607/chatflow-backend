import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DatabaseClient } from '../../core';
import { USER_STATUS_ACTIVE } from '../user/constants';
import { usersTable } from '../user/schema';
import { CHAT_ROLE_ADMIN, CHAT_ROLE_MEMBER, CHAT_TYPE_DIRECT, CHAT_TYPE_GROUP } from './constants';
import { chatMembersTable, chatsTable } from './schema';
import type { ChatEntity, ChatMemberEntity, ChatRepository } from './types';

export const chatRepository: ChatRepository = {
    async findById(db: DatabaseClient, chatId: string): Promise<ChatEntity | null> {
        const rows = await db.orm.select().from(chatsTable).where(eq(chatsTable.id, chatId)).limit(1);
        return rows[0] ?? null;
    },

    async findByDirectKey(db: DatabaseClient, directKey: string): Promise<ChatEntity | null> {
        const rows = await db.orm.select().from(chatsTable).where(eq(chatsTable.directKey, directKey)).limit(1);
        return rows[0] ?? null;
    },

    async findMembersByChatId(db: DatabaseClient, chatId: string): Promise<ChatMemberEntity[]> {
        return await db.orm
            .select()
            .from(chatMembersTable)
            .where(eq(chatMembersTable.chatId, chatId))
            .orderBy(asc(chatMembersTable.joinedAt));
    },

    async findMember(db: DatabaseClient, chatId: string, userId: string): Promise<ChatMemberEntity | null> {
        const rows = await db.orm
            .select()
            .from(chatMembersTable)
            .where(and(eq(chatMembersTable.chatId, chatId), eq(chatMembersTable.userId, userId)))
            .limit(1);
        return rows[0] ?? null;
    },

    async findActiveUserIds(db: DatabaseClient, userIds: string[]): Promise<string[]> {
        if (userIds.length === 0) {
            return [];
        }
        const rows = await db.orm
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(and(inArray(usersTable.id, userIds), eq(usersTable.status, USER_STATUS_ACTIVE)));
        return rows.map((r) => r.id);
    },

    async createDirectChat(
        db: DatabaseClient,
        params: { directKey: string; userAId: string; userBId: string; createdBy: string },
    ): Promise<{ chat: ChatEntity; members: ChatMemberEntity[]; created: boolean }> {
        return await db.orm.transaction(async (tx) => {
            const insertedChats = await tx
                .insert(chatsTable)
                .values({
                    type: CHAT_TYPE_DIRECT,
                    directKey: params.directKey,
                    createdBy: params.createdBy,
                })
                .onConflictDoNothing({ target: chatsTable.directKey })
                .returning();

            const created = insertedChats.length > 0;
            let chat = insertedChats[0];

            if (!chat) {
                const existing = await tx
                    .select()
                    .from(chatsTable)
                    .where(eq(chatsTable.directKey, params.directKey))
                    .limit(1);
                chat = existing[0];
            }

            if (!chat) {
                throw new Error('Failed to create or retrieve direct chat');
            }

            if (created) {
                await tx
                    .insert(chatMembersTable)
                    .values([
                        { chatId: chat.id, userId: params.userAId, role: CHAT_ROLE_MEMBER },
                        { chatId: chat.id, userId: params.userBId, role: CHAT_ROLE_MEMBER },
                    ])
                    .onConflictDoNothing();
            }

            const members = await tx
                .select()
                .from(chatMembersTable)
                .where(eq(chatMembersTable.chatId, chat.id))
                .orderBy(asc(chatMembersTable.joinedAt));

            return { chat, members, created };
        });
    },

    async createGroupChat(
        db: DatabaseClient,
        params: { name: string; memberIds: string[]; createdBy: string },
    ): Promise<{ chat: ChatEntity; members: ChatMemberEntity[] }> {
        return await db.orm.transaction(async (tx) => {
            const insertedChats = await tx
                .insert(chatsTable)
                .values({
                    type: CHAT_TYPE_GROUP,
                    name: params.name,
                    createdBy: params.createdBy,
                })
                .returning();

            const chat = insertedChats[0];
            if (!chat) {
                throw new Error('Failed to create group chat');
            }

            const memberRows = params.memberIds.map((userId) => ({
                chatId: chat.id,
                userId,
                role: userId === params.createdBy ? CHAT_ROLE_ADMIN : CHAT_ROLE_MEMBER,
            }));

            const members = await tx.insert(chatMembersTable).values(memberRows).returning();
            return { chat, members };
        });
    },

    async listChatsByUserId(
        db: DatabaseClient,
        userId: string,
    ): Promise<Array<{ chat: ChatEntity; members: ChatMemberEntity[] }>> {
        const userChatIdsSubquery = db.orm
            .select({ chatId: chatMembersTable.chatId })
            .from(chatMembersTable)
            .where(eq(chatMembersTable.userId, userId));

        const rows = await db.orm
            .select({
                chat: chatsTable,
                member: chatMembersTable,
            })
            .from(chatsTable)
            .innerJoin(chatMembersTable, eq(chatMembersTable.chatId, chatsTable.id))
            .where(inArray(chatsTable.id, userChatIdsSubquery))
            .orderBy(desc(chatsTable.updatedAt), asc(chatMembersTable.joinedAt));

        const grouped = new Map<string, { chat: ChatEntity; members: ChatMemberEntity[] }>();
        for (const row of rows) {
            const existing = grouped.get(row.chat.id);
            if (existing) {
                existing.members.push(row.member);
            } else {
                grouped.set(row.chat.id, { chat: row.chat, members: [row.member] });
            }
        }

        return Array.from(grouped.values());
    },

    async updateName(db: DatabaseClient, chatId: string, name: string): Promise<ChatEntity | null> {
        const rows = await db.orm
            .update(chatsTable)
            .set({ name, updatedAt: new Date() })
            .where(eq(chatsTable.id, chatId))
            .returning();
        return rows[0] ?? null;
    },

    async addMembers(db: DatabaseClient, chatId: string, userIds: string[]): Promise<ChatMemberEntity[]> {
        if (userIds.length > 0) {
            await db.orm
                .insert(chatMembersTable)
                .values(userIds.map((userId) => ({ chatId, userId, role: CHAT_ROLE_MEMBER })))
                .onConflictDoNothing();

            await db.orm
                .update(chatsTable)
                .set({ updatedAt: new Date() })
                .where(eq(chatsTable.id, chatId));
        }

        return await this.findMembersByChatId(db, chatId);
    },

    async removeMember(db: DatabaseClient, chatId: string, userId: string): Promise<boolean> {
        const deleted = await db.orm
            .delete(chatMembersTable)
            .where(and(eq(chatMembersTable.chatId, chatId), eq(chatMembersTable.userId, userId)))
            .returning({ id: chatMembersTable.id });

        if (deleted.length > 0) {
            await db.orm
                .update(chatsTable)
                .set({ updatedAt: new Date() })
                .where(eq(chatsTable.id, chatId));
        }

        return deleted.length > 0;
    },

    async touchUpdatedAt(db: DatabaseClient, chatId: string): Promise<void> {
        await db.orm
            .update(chatsTable)
            .set({ updatedAt: new Date() })
            .where(eq(chatsTable.id, chatId));
    },
};
