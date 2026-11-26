import type { CoreServices } from '../../core';
import { BadRequestError, NotAuthorizedError, NotFoundError } from '../../lib/core';
import { CHAT_ERROR_KEYS } from '../chat/constants';
import { chatRepository } from '../chat/repository';
import type { ChatRepository } from '../chat/types';
import type { PublicUser } from '../user/types';
import { MESSAGE_ERROR_KEYS, MESSAGE_TYPE_TEXT } from './constants';
import { toPublicLastSeen, toPublicMessage, toPublicReadReceipt } from './helper';
import { messageRepository } from './repository';
import type { MessageDocument } from './schema';
import type {
    DeleteMessageInput,
    EditMessageInput,
    GetMessagesInput,
    MarkMessageReadInput,
    MessageRepository,
    MessageService,
    PublicLastSeen,
    PublicMessage,
    PublicReadReceipt,
    SendMessageInput,
    UpdateLastSeenInput,
} from './types';

const ensureChatMember = async (
    db: CoreServices['db'],
    chatRepo: ChatRepository,
    chatId: string,
    userId: string,
): Promise<void> => {
    const member = await chatRepo.findMember(db, chatId, userId);
    if (member) {
        return;
    }
    const chat = await chatRepo.findById(db, chatId);
    if (!chat) {
        throw new NotFoundError('Chat not found', { key: CHAT_ERROR_KEYS.NOT_FOUND });
    }
    throw new NotAuthorizedError('You are not a member of this chat', {
        key: CHAT_ERROR_KEYS.NOT_A_MEMBER,
    });
};

const ensureMemberAndMessage = async (
    services: CoreServices,
    chatRepo: ChatRepository,
    msgRepo: MessageRepository,
    chatId: string,
    userId: string,
    messageId: string,
): Promise<MessageDocument> => {
    const [member, msg] = await Promise.all([
        chatRepo.findMember(services.db, chatId, userId),
        msgRepo.findMessageById(services.firestore, chatId, messageId),
    ]);

    if (!member) {
        const chat = await chatRepo.findById(services.db, chatId);
        if (!chat) {
            throw new NotFoundError('Chat not found', { key: CHAT_ERROR_KEYS.NOT_FOUND });
        }
        throw new NotAuthorizedError('You are not a member of this chat', {
            key: CHAT_ERROR_KEYS.NOT_A_MEMBER,
        });
    }
    if (!msg) {
        throw new NotFoundError('Message not found', { key: MESSAGE_ERROR_KEYS.NOT_FOUND });
    }
    return msg;
};

const ensureMessageOwner = (msg: MessageDocument, userId: string): void => {
    if (msg.senderId !== userId) {
        throw new NotAuthorizedError('Only the message sender can modify this message', {
            key: MESSAGE_ERROR_KEYS.FORBIDDEN,
        });
    }
};

export const createMessageService = (
    msgRepo: MessageRepository = messageRepository,
    chatRepo: ChatRepository = chatRepository,
): MessageService => ({
    async sendMessage({
        services,
        args,
    }: {
        services: CoreServices;
        args: SendMessageInput & { currentUser: PublicUser };
    }): Promise<PublicMessage> {
        if (args.senderId !== args.currentUser.id) {
            throw new NotAuthorizedError('senderId must match the authenticated user', {
                key: MESSAGE_ERROR_KEYS.SENDER_MISMATCH,
            });
        }

        await ensureChatMember(services.db, chatRepo, args.chatId, args.senderId);

        const created = await msgRepo.createMessage(services.firestore, {
            chatId: args.chatId,
            senderId: args.senderId,
            text: args.text,
            type: args.type ?? MESSAGE_TYPE_TEXT,
        });

        await chatRepo.touchUpdatedAt(services.db, args.chatId).catch((err) => {
            services.logger.warn('Failed to update chat updatedAt timestamp', {
                chatId: args.chatId,
                error: err instanceof Error ? err.message : String(err),
            });
        });

        return toPublicMessage(created);
    },

    async getMessages({
        services,
        args,
    }: {
        services: CoreServices;
        args: GetMessagesInput & { currentUser: PublicUser };
    }): Promise<{ messages: PublicMessage[]; lastSeen: Record<string, PublicLastSeen> }> {
        await ensureChatMember(services.db, chatRepo, args.chatId, args.currentUser.id);

        const [messageDocs, lastSeenDocs] = await Promise.all([
            msgRepo.getMessages(services.firestore, {
                chatId: args.chatId,
                limit: args.limit,
                before: args.before,
                order: args.order,
            }),
            msgRepo.getLastSeenByChat(services.firestore, args.chatId),
        ]);

        const lastSeen: Record<string, PublicLastSeen> = {};
        for (const doc of lastSeenDocs) {
            lastSeen[doc.userId] = toPublicLastSeen(doc);
        }

        return {
            messages: messageDocs.map(toPublicMessage),
            lastSeen,
        };
    },

    async markMessageRead({
        services,
        args,
    }: {
        services: CoreServices;
        args: MarkMessageReadInput & { currentUser: PublicUser };
    }): Promise<PublicReadReceipt> {
        if (args.userId !== args.currentUser.id) {
            throw new NotAuthorizedError('userId must match the authenticated user', {
                key: MESSAGE_ERROR_KEYS.USER_MISMATCH,
            });
        }

        await ensureMemberAndMessage(services, chatRepo, msgRepo, args.chatId, args.userId, args.messageId);

        const receipt = await msgRepo.markMessageRead(services.firestore, {
            chatId: args.chatId,
            messageId: args.messageId,
            userId: args.userId,
        });

        return toPublicReadReceipt(receipt);
    },

    async updateLastSeen({
        services,
        args,
    }: {
        services: CoreServices;
        args: UpdateLastSeenInput & { currentUser: PublicUser };
    }): Promise<PublicLastSeen> {
        if (args.userId !== args.currentUser.id) {
            throw new NotAuthorizedError('userId must match the authenticated user', {
                key: MESSAGE_ERROR_KEYS.USER_MISMATCH,
            });
        }

        await ensureMemberAndMessage(services, chatRepo, msgRepo, args.chatId, args.userId, args.messageId);

        const lastSeen = await msgRepo.updateLastSeen(services.firestore, {
            chatId: args.chatId,
            userId: args.userId,
            messageId: args.messageId,
        });

        return toPublicLastSeen(lastSeen);
    },

    async editMessage({
        services,
        args,
    }: {
        services: CoreServices;
        args: EditMessageInput & { currentUser: PublicUser };
    }): Promise<PublicMessage> {
        const existing = await ensureMemberAndMessage(
            services,
            chatRepo,
            msgRepo,
            args.chatId,
            args.currentUser.id,
            args.messageId,
        );
        ensureMessageOwner(existing, args.currentUser.id);

        if (existing.isDeleted) {
            throw new BadRequestError('Cannot edit a deleted message', {
                key: MESSAGE_ERROR_KEYS.ALREADY_DELETED,
            });
        }

        const updated = await msgRepo.editMessage(services.firestore, {
            chatId: args.chatId,
            messageId: args.messageId,
            text: args.text,
        });

        return toPublicMessage(updated);
    },

    async deleteMessage({
        services,
        args,
    }: {
        services: CoreServices;
        args: DeleteMessageInput & { currentUser: PublicUser };
    }): Promise<PublicMessage> {
        const existing = await ensureMemberAndMessage(
            services,
            chatRepo,
            msgRepo,
            args.chatId,
            args.currentUser.id,
            args.messageId,
        );
        ensureMessageOwner(existing, args.currentUser.id);

        if (existing.isDeleted) {
            return toPublicMessage(existing);
        }

        const deleted = await msgRepo.softDeleteMessage(services.firestore, {
            chatId: args.chatId,
            messageId: args.messageId,
        });

        return toPublicMessage(deleted);
    },
});

export const messageService = createMessageService();

export const useMessageService = () => ({
    messageService,
});
