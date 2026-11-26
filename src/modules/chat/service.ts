import type { CoreServices } from '../../core';
import { BadRequestError, NotAuthorizedError, NotFoundError } from '../../lib/core';
import type { PublicUser } from '../user/types';
import { CHAT_ERROR_KEYS, CHAT_ROLE_ADMIN, CHAT_TYPE_GROUP } from './constants';
import { buildDirectKey, formatChatWithMembers } from './helper';
import { chatRepository } from './repository';
import type {
    AddChatMembersInput,
    ChatEntity,
    ChatMemberEntity,
    ChatRepository,
    ChatService,
    ChatWithMembers,
    CreateDirectChatInput,
    CreateGroupChatInput,
    CreateOrGetChatResult,
    RemoveChatMemberInput,
    UpdateGroupChatInput,
} from './types';

const ensureUsersActive = async (db: CoreServices['db'], repo: ChatRepository, userIds: string[]): Promise<void> => {
    const uniqueIds = Array.from(new Set(userIds));
    const activeIds = await repo.findActiveUserIds(db, uniqueIds);
    if (activeIds.length !== uniqueIds.length) {
        const activeSet = new Set(activeIds);
        const missingIds = uniqueIds.filter((id) => !activeSet.has(id));
        throw new NotFoundError(`One or more users do not exist or are inactive: ${missingIds.join(', ')}`, {
            key: CHAT_ERROR_KEYS.INVALID_MEMBERS,
            details: { missingUserIds: missingIds },
        });
    }
};

const ensureChatAndMember = async (
    db: CoreServices['db'],
    repo: ChatRepository,
    chatId: string,
    userId: string,
): Promise<{ chat: ChatEntity; member: ChatMemberEntity }> => {
    const member = await repo.findMember(db, chatId, userId);
    if (!member) {
        const chat = await repo.findById(db, chatId);
        if (!chat) {
            throw new NotFoundError('Chat not found', { key: CHAT_ERROR_KEYS.NOT_FOUND });
        }
        throw new NotAuthorizedError('You are not a member of this chat', {
            key: CHAT_ERROR_KEYS.NOT_A_MEMBER,
        });
    }

    const chat = await repo.findById(db, chatId);
    if (!chat) {
        throw new NotFoundError('Chat not found', { key: CHAT_ERROR_KEYS.NOT_FOUND });
    }

    return { chat, member };
};

const ensureGroupAdmin = async (
    db: CoreServices['db'],
    repo: ChatRepository,
    chatId: string,
    userId: string,
): Promise<ChatEntity> => {
    const { chat, member } = await ensureChatAndMember(db, repo, chatId, userId);
    if (chat.type !== CHAT_TYPE_GROUP) {
        throw new BadRequestError('This operation is only supported for group chats', {
            key: CHAT_ERROR_KEYS.NOT_GROUP_CHAT,
        });
    }
    if (member.role !== CHAT_ROLE_ADMIN) {
        throw new NotAuthorizedError('Only group admins can perform this action', {
            key: CHAT_ERROR_KEYS.ADMIN_REQUIRED,
        });
    }
    return chat;
};

export const createChatService = (repo: ChatRepository = chatRepository): ChatService => ({
    async createOrGetDirectChat({
        services,
        args,
    }: {
        services: CoreServices;
        args: CreateDirectChatInput & { currentUser: PublicUser };
    }): Promise<CreateOrGetChatResult> {
        const { userAId, userBId, currentUser } = args;

        if (userAId === userBId) {
            throw new BadRequestError('Cannot create a direct chat with the same user', {
                key: CHAT_ERROR_KEYS.SELF_CHAT_NOT_ALLOWED,
            });
        }

        if (currentUser.id !== userAId && currentUser.id !== userBId) {
            throw new NotAuthorizedError('Authenticated user must be one of the chat participants', {
                key: CHAT_ERROR_KEYS.FORBIDDEN,
            });
        }

        await ensureUsersActive(services.db, repo, [userAId, userBId]);

        const directKey = buildDirectKey(userAId, userBId);
        const { chat, members, created } = await repo.createDirectChat(services.db, {
            directKey,
            userAId,
            userBId,
            createdBy: currentUser.id,
        });

        return {
            chatId: chat.id,
            created,
            chat: formatChatWithMembers(chat, members),
        };
    },

    async createGroupChat({
        services,
        args,
    }: {
        services: CoreServices;
        args: CreateGroupChatInput & { currentUser: PublicUser };
    }): Promise<ChatWithMembers> {
        const allMemberIds = Array.from(new Set([args.currentUser.id, ...args.memberIds]));
        if (allMemberIds.length < 2) {
            throw new BadRequestError('Group chat requires at least 2 distinct members', {
                key: CHAT_ERROR_KEYS.INVALID_MEMBERS,
            });
        }

        await ensureUsersActive(services.db, repo, allMemberIds);

        const { chat, members } = await repo.createGroupChat(services.db, {
            name: args.name.trim(),
            memberIds: allMemberIds,
            createdBy: args.currentUser.id,
        });

        return formatChatWithMembers(chat, members);
    },

    async getChatById({
        services,
        args,
    }: {
        services: CoreServices;
        args: { chatId: string; currentUser: PublicUser };
    }): Promise<ChatWithMembers> {
        const { chat } = await ensureChatAndMember(services.db, repo, args.chatId, args.currentUser.id);
        const members = await repo.findMembersByChatId(services.db, chat.id);
        return formatChatWithMembers(chat, members);
    },

    async listUserChats({
        services,
        args,
    }: {
        services: CoreServices;
        args: { userId: string; currentUser: PublicUser };
    }): Promise<ChatWithMembers[]> {
        if (args.currentUser.id !== args.userId) {
            throw new NotAuthorizedError('You can only list your own chats', {
                key: CHAT_ERROR_KEYS.FORBIDDEN,
            });
        }

        const rows = await repo.listChatsByUserId(services.db, args.userId);
        return rows.map(({ chat, members }) => formatChatWithMembers(chat, members));
    },

    async updateGroupChat({
        services,
        args,
    }: {
        services: CoreServices;
        args: UpdateGroupChatInput & { currentUser: PublicUser };
    }): Promise<ChatWithMembers> {
        await ensureGroupAdmin(services.db, repo, args.chatId, args.currentUser.id);

        const updated = await repo.updateName(services.db, args.chatId, args.name.trim());
        if (!updated) {
            throw new NotFoundError('Chat not found', { key: CHAT_ERROR_KEYS.NOT_FOUND });
        }

        const members = await repo.findMembersByChatId(services.db, updated.id);
        return formatChatWithMembers(updated, members);
    },

    async addMembers({
        services,
        args,
    }: {
        services: CoreServices;
        args: AddChatMembersInput & { currentUser: PublicUser };
    }): Promise<ChatWithMembers> {
        const chat = await ensureGroupAdmin(services.db, repo, args.chatId, args.currentUser.id);
        const uniqueMemberIds = Array.from(new Set(args.memberIds));
        await ensureUsersActive(services.db, repo, uniqueMemberIds);

        const members = await repo.addMembers(services.db, chat.id, uniqueMemberIds);
        const refreshedChat = (await repo.findById(services.db, chat.id)) ?? chat;
        return formatChatWithMembers(refreshedChat, members);
    },

    async removeMember({
        services,
        args,
    }: {
        services: CoreServices;
        args: RemoveChatMemberInput & { currentUser: PublicUser };
    }): Promise<ChatWithMembers> {
        const { chat, member: actor } = await ensureChatAndMember(services.db, repo, args.chatId, args.currentUser.id);
        if (chat.type !== CHAT_TYPE_GROUP) {
            throw new BadRequestError('This operation is only supported for group chats', {
                key: CHAT_ERROR_KEYS.NOT_GROUP_CHAT,
            });
        }

        const isSelfLeave = args.userId === args.currentUser.id;
        if (!isSelfLeave && actor.role !== CHAT_ROLE_ADMIN) {
            throw new NotAuthorizedError('Only group admins can remove other members', {
                key: CHAT_ERROR_KEYS.ADMIN_REQUIRED,
            });
        }

        const removed = await repo.removeMember(services.db, chat.id, args.userId);
        if (!removed) {
            throw new NotFoundError('Target user is not a member of this chat', {
                key: CHAT_ERROR_KEYS.NOT_A_MEMBER,
            });
        }

        const members = await repo.findMembersByChatId(services.db, chat.id);
        const refreshedChat = (await repo.findById(services.db, chat.id)) ?? chat;
        return formatChatWithMembers(refreshedChat, members);
    },
});

export const chatService = createChatService();

export const useChatService = () => ({
    chatService,
});
