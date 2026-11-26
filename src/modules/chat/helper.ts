import type { ChatEntity, ChatMemberEntity, ChatWithMembers } from './types';

export const buildDirectKey = (userAId: string, userBId: string): string => {
    const [first, second] = [userAId, userBId].sort();
    return `${first}:${second}`;
};

export const formatChatWithMembers = (chat: ChatEntity, members: ChatMemberEntity[]): ChatWithMembers => ({
    chatId: chat.id,
    type: chat.type,
    name: chat.name ?? null,
    createdBy: chat.createdBy ?? null,
    memberIds: members.map((m) => m.userId),
    members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
    })),
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
});
