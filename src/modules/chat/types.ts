import type { CoreServices } from '../../core';
import type { PublicUser } from '../user/types';
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
}

export interface UpdateGroupChatInput {
    chatId: string;
    name: string;
}

export interface AddChatMembersInput {
    chatId: string;
    memberIds: string[];
}

export interface RemoveChatMemberInput {
    chatId: string;
    userId: string;
}

export interface ChatMemberSummary {
    userId: string;
    role: ChatMemberRole;
    joinedAt: Date;
}

export interface ChatWithMembers {
    chatId: string;
    type: ChatType;
    name: string | null;
    createdBy: string | null;
    memberIds: string[];
    members: ChatMemberSummary[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateOrGetChatResult {
    chatId: string;
    created: boolean;
    chat: ChatWithMembers;
}

export interface ChatRepository {
    findById: (db: CoreServices['db'], chatId: string) => Promise<ChatEntity | null>;
    findByDirectKey: (db: CoreServices['db'], directKey: string) => Promise<ChatEntity | null>;
    findMembersByChatId: (db: CoreServices['db'], chatId: string) => Promise<ChatMemberEntity[]>;
    findMember: (db: CoreServices['db'], chatId: string, userId: string) => Promise<ChatMemberEntity | null>;
    findActiveUserIds: (db: CoreServices['db'], userIds: string[]) => Promise<string[]>;
    createDirectChat: (
        db: CoreServices['db'],
        params: { directKey: string; userAId: string; userBId: string; createdBy: string },
    ) => Promise<{ chat: ChatEntity; members: ChatMemberEntity[]; created: boolean }>;
    createGroupChat: (
        db: CoreServices['db'],
        params: { name: string; memberIds: string[]; createdBy: string },
    ) => Promise<{ chat: ChatEntity; members: ChatMemberEntity[] }>;
    listChatsByUserId: (
        db: CoreServices['db'],
        userId: string,
    ) => Promise<Array<{ chat: ChatEntity; members: ChatMemberEntity[] }>>;
    updateName: (db: CoreServices['db'], chatId: string, name: string) => Promise<ChatEntity | null>;
    addMembers: (db: CoreServices['db'], chatId: string, userIds: string[]) => Promise<ChatMemberEntity[]>;
    removeMember: (db: CoreServices['db'], chatId: string, userId: string) => Promise<boolean>;
    touchUpdatedAt: (db: CoreServices['db'], chatId: string) => Promise<void>;
}

export interface ChatService {
    createOrGetDirectChat: (params: {
        services: CoreServices;
        args: CreateDirectChatInput & { currentUser: PublicUser };
    }) => Promise<CreateOrGetChatResult>;
    createGroupChat: (params: {
        services: CoreServices;
        args: CreateGroupChatInput & { currentUser: PublicUser };
    }) => Promise<ChatWithMembers>;
    getChatById: (params: {
        services: CoreServices;
        args: { chatId: string; currentUser: PublicUser };
    }) => Promise<ChatWithMembers>;
    listUserChats: (params: {
        services: CoreServices;
        args: { userId: string; currentUser: PublicUser };
    }) => Promise<ChatWithMembers[]>;
    updateGroupChat: (params: {
        services: CoreServices;
        args: UpdateGroupChatInput & { currentUser: PublicUser };
    }) => Promise<ChatWithMembers>;
    addMembers: (params: {
        services: CoreServices;
        args: AddChatMembersInput & { currentUser: PublicUser };
    }) => Promise<ChatWithMembers>;
    removeMember: (params: {
        services: CoreServices;
        args: RemoveChatMemberInput & { currentUser: PublicUser };
    }) => Promise<ChatWithMembers>;
}
