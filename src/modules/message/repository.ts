import { Timestamp } from 'firebase-admin/firestore';
import type { FirestoreClient } from '../../core';
import type { MessageType } from './constants';
import {
    getLastSeenCollectionPath,
    getMessagesCollectionPath,
    getReadReceiptsCollectionPath,
    type LastSeenDocument,
    type MessageDocument,
    type ReadReceiptDocument,
} from './schema';
import type { MessageRepository } from './types';

export const messageRepository: MessageRepository = {
    async createMessage(
        firestore: FirestoreClient,
        params: { chatId: string; senderId: string; text: string; type: MessageType },
    ): Promise<MessageDocument> {
        const colRef = firestore.db.collection(getMessagesCollectionPath(params.chatId));
        const docRef = colRef.doc();
        const now = Timestamp.now();

        const payload: MessageDocument = {
            id: docRef.id,
            chatId: params.chatId,
            senderId: params.senderId,
            text: params.text,
            type: params.type,
            readBy: {
                [params.senderId]: now,
            },
            isEdited: false,
            editedAt: null,
            isDeleted: false,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        await docRef.set(payload);
        return payload;
    },

    async findMessageById(
        firestore: FirestoreClient,
        chatId: string,
        messageId: string,
    ): Promise<MessageDocument | null> {
        const docSnap = await firestore.db.collection(getMessagesCollectionPath(chatId)).doc(messageId).get();
        if (!docSnap.exists) {
            return null;
        }
        return docSnap.data() as MessageDocument;
    },

    async getMessages(
        firestore: FirestoreClient,
        params: { chatId: string; limit: number; before?: string; order?: 'asc' | 'desc' },
    ): Promise<MessageDocument[]> {
        const colRef = firestore.db.collection(getMessagesCollectionPath(params.chatId));
        let query = colRef.orderBy('createdAt', 'desc').limit(params.limit);

        if (params.before) {
            const cursorSnap = await colRef.doc(params.before).get();
            if (cursorSnap.exists) {
                query = query.startAfter(cursorSnap);
            }
        }

        const snapshot = await query.get();
        const docs = snapshot.docs.map((d) => d.data() as MessageDocument);
        return params.order === 'desc' ? docs : docs.reverse();
    },

    async markMessageRead(
        firestore: FirestoreClient,
        params: { chatId: string; messageId: string; userId: string },
    ): Promise<ReadReceiptDocument> {
        const now = Timestamp.now();
        const msgRef = firestore.db.collection(getMessagesCollectionPath(params.chatId)).doc(params.messageId);
        const receiptRef = firestore.db
            .collection(getReadReceiptsCollectionPath(params.chatId, params.messageId))
            .doc(params.userId);

        const receiptDoc: ReadReceiptDocument = {
            userId: params.userId,
            messageId: params.messageId,
            chatId: params.chatId,
            readAt: now,
        };

        const batch = firestore.db.batch();
        batch.update(msgRef, {
            [`readBy.${params.userId}`]: now,
            updatedAt: now,
        });
        batch.set(receiptRef, receiptDoc, { merge: true });
        await batch.commit();

        return receiptDoc;
    },

    async updateLastSeen(
        firestore: FirestoreClient,
        params: { chatId: string; userId: string; messageId: string },
    ): Promise<LastSeenDocument> {
        const now = Timestamp.now();
        const docRef = firestore.db.collection(getLastSeenCollectionPath(params.chatId)).doc(params.userId);

        const lastSeenDoc: LastSeenDocument = {
            userId: params.userId,
            chatId: params.chatId,
            messageId: params.messageId,
            updatedAt: now,
        };

        await docRef.set(lastSeenDoc, { merge: true });
        return lastSeenDoc;
    },

    async getLastSeenByChat(firestore: FirestoreClient, chatId: string): Promise<LastSeenDocument[]> {
        const snapshot = await firestore.db.collection(getLastSeenCollectionPath(chatId)).get();
        return snapshot.docs.map((d) => d.data() as LastSeenDocument);
    },

    async editMessage(
        firestore: FirestoreClient,
        params: { chatId: string; messageId: string; text: string },
    ): Promise<MessageDocument> {
        const now = Timestamp.now();
        const docRef = firestore.db.collection(getMessagesCollectionPath(params.chatId)).doc(params.messageId);

        await docRef.update({
            text: params.text,
            isEdited: true,
            editedAt: now,
            updatedAt: now,
        });

        const updatedSnap = await docRef.get();
        return updatedSnap.data() as MessageDocument;
    },

    async softDeleteMessage(
        firestore: FirestoreClient,
        params: { chatId: string; messageId: string },
    ): Promise<MessageDocument> {
        const now = Timestamp.now();
        const docRef = firestore.db.collection(getMessagesCollectionPath(params.chatId)).doc(params.messageId);

        await docRef.update({
            text: '',
            isDeleted: true,
            deletedAt: now,
            updatedAt: now,
        });

        const updatedSnap = await docRef.get();
        return updatedSnap.data() as MessageDocument;
    },
};
