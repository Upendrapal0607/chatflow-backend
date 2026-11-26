import type { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
    DEFAULT_MESSAGES_LIMIT,
    FIRESTORE_COLLECTIONS,
    MAX_MESSAGES_LIMIT,
    MESSAGE_TYPES,
    MessageType,
} from './constants';

/**
 * Firestore path: chats/{chatId}/messages/{messageId}
 */
export interface MessageDocument {
    id: string;
    chatId: string;
    senderId: string;
    text: string;
    type: MessageType;
    readBy: Record<string, Timestamp | Date>;
    isEdited: boolean;
    editedAt: Timestamp | Date | null;
    isDeleted: boolean;
    deletedAt: Timestamp | Date | null;
    createdAt: Timestamp | Date;
    updatedAt: Timestamp | Date;
}

/**
 * Firestore path: chats/{chatId}/messages/{messageId}/readReceipts/{userId}
 */
export interface ReadReceiptDocument {
    userId: string;
    messageId: string;
    chatId: string;
    readAt: Timestamp | Date;
}

/**
 * Firestore path: chats/{chatId}/lastSeen/{userId}
 */
export interface LastSeenDocument {
    userId: string;
    chatId: string;
    messageId: string;
    updatedAt: Timestamp | Date;
}

export const getMessagesCollectionPath = (chatId: string): string =>
    `${FIRESTORE_COLLECTIONS.CHATS}/${chatId}/${FIRESTORE_COLLECTIONS.MESSAGES}`;

export const getReadReceiptsCollectionPath = (chatId: string, messageId: string): string =>
    `${getMessagesCollectionPath(chatId)}/${messageId}/${FIRESTORE_COLLECTIONS.READ_RECEIPTS}`;

export const getLastSeenCollectionPath = (chatId: string): string =>
    `${FIRESTORE_COLLECTIONS.CHATS}/${chatId}/${FIRESTORE_COLLECTIONS.LAST_SEEN}`;

export const sendMessageValidator = (zod: typeof z) => ({
    senderId: zod.string().uuid('senderId must be a valid UUID'),
    text: zod.string().trim().min(1, 'Message text cannot be empty').max(4000),
    type: zod.enum(MESSAGE_TYPES).optional().default('text'),
});

export const editMessageValidator = (zod: typeof z) => ({
    text: zod.string().trim().min(1, 'Message text cannot be empty').max(4000),
});

export const getMessagesQueryValidator = (zod: typeof z) => ({
    limit: zod.coerce.number().int().min(1).max(MAX_MESSAGES_LIMIT).default(DEFAULT_MESSAGES_LIMIT),
    before: zod.string().trim().min(1).optional(),
    order: zod.enum(['asc', 'desc']).optional().default('asc'),
});

export const markMessageReadValidator = (zod: typeof z) => ({
    userId: zod.string().uuid('userId must be a valid UUID'),
});

export const updateLastSeenValidator = (zod: typeof z) => ({
    userId: zod.string().uuid('userId must be a valid UUID'),
    messageId: zod.string().trim().min(1, 'messageId is required'),
});

export const messageIdParamValidator = (zod: typeof z) => ({
    chatId: zod.string().uuid('chatId must be a valid UUID'),
    messageId: zod.string().trim().min(1, 'messageId is required'),
});
