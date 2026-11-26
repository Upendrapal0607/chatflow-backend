import type { Timestamp } from 'firebase-admin/firestore';
import type { LastSeenDocument, MessageDocument, ReadReceiptDocument } from './schema';
import type { PublicLastSeen, PublicMessage, PublicReadReceipt } from './types';

type TimestampLike = Timestamp | Date | string | null | undefined;

export const serializeTimestamp = (value: TimestampLike): string | null => {
    if (!value) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    return null;
};

export const toPublicMessage = (doc: MessageDocument): PublicMessage => {
    const serializedReadBy: Record<string, string> = {};
    if (doc.readBy) {
        for (const [userId, ts] of Object.entries(doc.readBy)) {
            const iso = serializeTimestamp(ts);
            if (iso) {
                serializedReadBy[userId] = iso;
            }
        }
    }

    return {
        id: doc.id,
        chatId: doc.chatId,
        senderId: doc.senderId,
        text: doc.isDeleted ? '' : doc.text,
        type: doc.type,
        readBy: serializedReadBy,
        isEdited: Boolean(doc.isEdited),
        editedAt: serializeTimestamp(doc.editedAt),
        isDeleted: Boolean(doc.isDeleted),
        deletedAt: serializeTimestamp(doc.deletedAt),
        createdAt: serializeTimestamp(doc.createdAt) ?? new Date(0).toISOString(),
        updatedAt: serializeTimestamp(doc.updatedAt) ?? new Date(0).toISOString(),
    };
};

export const toPublicReadReceipt = (doc: ReadReceiptDocument): PublicReadReceipt => ({
    userId: doc.userId,
    messageId: doc.messageId,
    chatId: doc.chatId,
    readAt: serializeTimestamp(doc.readAt) ?? new Date(0).toISOString(),
});

export const toPublicLastSeen = (doc: LastSeenDocument): PublicLastSeen => ({
    userId: doc.userId,
    chatId: doc.chatId,
    messageId: doc.messageId,
    updatedAt: serializeTimestamp(doc.updatedAt) ?? new Date(0).toISOString(),
});
