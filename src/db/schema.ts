import { relations } from 'drizzle-orm';
import { chatMembersTable, chatsTable } from '../modules/chat/schema';
import { usersTable } from '../modules/user/schema';

export const usersRelations = relations(usersTable, ({ many }) => ({
    chatMemberships: many(chatMembersTable),
    createdChats: many(chatsTable),
}));

export const chatsRelations = relations(chatsTable, ({ one, many }) => ({
    creator: one(usersTable, {
        fields: [chatsTable.createdBy],
        references: [usersTable.id],
    }),
    members: many(chatMembersTable),
}));

export const chatMembersRelations = relations(chatMembersTable, ({ one }) => ({
    chat: one(chatsTable, {
        fields: [chatMembersTable.chatId],
        references: [chatsTable.id],
    }),
    user: one(usersTable, {
        fields: [chatMembersTable.userId],
        references: [usersTable.id],
    }),
}));

export { chatMembersTable, chatsTable, usersTable };

export const schema = {
    usersTable,
    chatsTable,
    chatMembersTable,
    usersRelations,
    chatsRelations,
    chatMembersRelations,
};

export type DatabaseSchema = typeof schema;
