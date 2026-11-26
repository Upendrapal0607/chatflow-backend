import type { ChatMemberRole, ChatType } from './constants';
import type { ChatMemberRow, ChatRow } from './schema';

export type ChatEntity = ChatRow;
export type ChatMemberEntity = ChatMemberRow;

export interface CreateDirectChatInput {
    userAId: string;
    userBId: string;
}

export interface CreateGroupChatInput {
    name: string;
    memberIds: string[];
    createdBy: string;
}

export interface ChatWithMembers {
    chatId: string;
    type: ChatType;
    name: string | null;
    memberIds: string[];
    members: Array<{
        userId: string;
        role: ChatMemberRole;
        joinedAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
