export const FIRESTORE_COLLECTIONS = {
    CHATS: 'chats',
    MESSAGES: 'messages',
    READ_RECEIPTS: 'readReceipts',
    LAST_SEEN: 'lastSeen',
} as const;

export const MESSAGE_TYPE_TEXT = 'text' as const;
export const MESSAGE_TYPE_SYSTEM = 'system' as const;
export const MESSAGE_TYPES = [MESSAGE_TYPE_TEXT, MESSAGE_TYPE_SYSTEM] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export const DEFAULT_MESSAGES_LIMIT = 50;
export const MAX_MESSAGES_LIMIT = 100;

export const MESSAGE_ERROR_KEYS = {
    NOT_FOUND: 'err.message.not-found',
    SEND_FAILED: 'err.message.send-failed',
    FORBIDDEN: 'err.message.forbidden',
    ALREADY_DELETED: 'err.message.already-deleted',
    SENDER_MISMATCH: 'err.message.sender-mismatch',
    USER_MISMATCH: 'err.message.user-mismatch',
} as const;
