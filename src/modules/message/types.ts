import type { CoreServices, FirestoreClient } from '../../core';
import type { PublicUser } from '../user/types';
import type { MessageType } from './constants';
import type { LastSeenDocument, MessageDocument, ReadReceiptDocument } from './schema';

export interface PublicMessage {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    type: MessageType;
    readBy: Record<string, string>;
    isEdited: boolean;
    editedAt: string | null;
    isDeleted: boolean;
    deletedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PublicReadReceipt {
    userId: string;
    messageId: string;
    chatId: string;
    readAt: string;
}

export interface PublicLastSeen {
    userId: string;
    chatId: string;
    messageId: string;
    updatedAt: string;
}

export interface SendMessageInput {
    chatId: string;
    senderId: string;
    text: string;
    type?: MessageType;
}

export interface GetMessagesInput {
    chatId: string;
    limit: number;
    before?: string;
    order?: 'asc' | 'desc';
}

export interface MarkMessageReadInput {
    chatId: string;
    messageId: string;
    userId: string;
}

export interface UpdateLastSeenInput {
    chatId: string;
    userId: string;
    messageId: string;
}

export interface EditMessageInput {
    chatId: string;
    messageId: string;
    text: string;
}

export interface DeleteMessageInput {
    chatId: string;
    messageId: string;
}

export interface MessageRepository {
    createMessage: (
        firestore: FirestoreClient,
        params: { chatId: string; senderId: string; text: string; type: MessageType },
    ) => Promise<MessageDocument>;
    findMessageById: (
        firestore: FirestoreClient,
        chatId: string,
        messageId: string,
    ) => Promise<MessageDocument | null>;
    getMessages: (
        firestore: FirestoreClient,
        params: { chatId: string; limit: number; before?: string; order?: 'asc' | 'desc' },
    ) => Promise<MessageDocument[]>;
    markMessageRead: (
        firestore: FirestoreClient,
        params: { chatId: string; messageId: string; userId: string },
    ) => Promise<ReadReceiptDocument>;
    updateLastSeen: (
        firestore: FirestoreClient,
        params: { chatId: string; userId: string; messageId: string },
    ) => Promise<LastSeenDocument>;
    getLastSeenByChat: (firestore: FirestoreClient, chatId: string) => Promise<LastSeenDocument[]>;
    editMessage: (
        firestore: FirestoreClient,
        params: { chatId: string; messageId: string; text: string },
    ) => Promise<MessageDocument>;
    softDeleteMessage: (
        firestore: FirestoreClient,
        params: { chatId: string; messageId: string },
    ) => Promise<MessageDocument>;
}

export interface MessageService {
    sendMessage: (params: {
        services: CoreServices;
        args: SendMessageInput & { currentUser: PublicUser };
    }) => Promise<PublicMessage>;
    getMessages: (params: {
        services: CoreServices;
        args: GetMessagesInput & { currentUser: PublicUser };
    }) => Promise<{ messages: PublicMessage[]; lastSeen: Record<string, PublicLastSeen> }>;
    markMessageRead: (params: {
        services: CoreServices;
        args: MarkMessageReadInput & { currentUser: PublicUser };
    }) => Promise<PublicReadReceipt>;
    updateLastSeen: (params: {
        services: CoreServices;
        args: UpdateLastSeenInput & { currentUser: PublicUser };
    }) => Promise<PublicLastSeen>;
    editMessage: (params: {
        services: CoreServices;
        args: EditMessageInput & { currentUser: PublicUser };
    }) => Promise<PublicMessage>;
    deleteMessage: (params: {
        services: CoreServices;
        args: DeleteMessageInput & { currentUser: PublicUser };
    }) => Promise<PublicMessage>;
}
