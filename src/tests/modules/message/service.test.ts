import { BadRequestError, NotAuthorizedError, NotFoundError } from '../../../lib/core';
import type { ChatRepository } from '../../../modules/chat/types';
import { createMessageService } from '../../../modules/message/service';
import type { MessageDocument } from '../../../modules/message/schema';
import type { MessageRepository } from '../../../modules/message/types';
import type { PublicUser } from '../../../modules/user/types';

const userAId = '11111111-1111-4111-8111-111111111111';
const userBId = '22222222-2222-4222-8222-222222222222';
const chatId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const msgId = 'msg-1';

const makePublicUser = (id: string): PublicUser => ({
    id,
    name: 'User',
    email: `${id}@example.com`,
    username: null,
    avatarUrl: null,
    status: 'active',
    lastActiveAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
});

const makeMsgDoc = (overrides: Partial<MessageDocument> = {}): MessageDocument => ({
    id: msgId,
    chatId,
    senderId: userAId,
    text: 'Hello world',
    type: 'text',
    readBy: { [userAId]: new Date('2026-01-01T00:00:00Z') },
    isEdited: false,
    editedAt: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
});

const makeServices = () => ({
    db: {} as any,
    firestore: {} as any,
    logger: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        captureError: jest.fn(),
    },
});

const makeChatRepo = (isMember = true): ChatRepository => ({
    findById: jest.fn().mockResolvedValue({
        id: chatId,
        type: 'direct',
        directKey: `${userAId}:${userBId}`,
        name: null,
        createdBy: userAId,
        createdAt: new Date(),
        updatedAt: new Date(),
    }),
    findByDirectKey: jest.fn(),
    findMembersByChatId: jest.fn(),
    findMember: jest.fn().mockResolvedValue(isMember ? { id: 'm1', chatId, userId: userAId, role: 'member', joinedAt: new Date() } : null),
    findActiveUserIds: jest.fn(),
    createDirectChat: jest.fn(),
    createGroupChat: jest.fn(),
    listChatsByUserId: jest.fn(),
    updateName: jest.fn(),
    addMembers: jest.fn(),
    removeMember: jest.fn(),
    touchUpdatedAt: jest.fn().mockResolvedValue(undefined),
});

const makeMsgRepo = (overrides: Partial<MessageRepository> = {}): MessageRepository => ({
    createMessage: jest.fn().mockResolvedValue(makeMsgDoc()),
    findMessageById: jest.fn().mockResolvedValue(makeMsgDoc()),
    getMessages: jest.fn().mockResolvedValue([makeMsgDoc()]),
    markMessageRead: jest.fn().mockResolvedValue({
        userId: userBId,
        messageId: msgId,
        chatId,
        readAt: new Date('2026-01-01T00:01:00Z'),
    }),
    updateLastSeen: jest.fn().mockResolvedValue({
        userId: userBId,
        chatId,
        messageId: msgId,
        updatedAt: new Date('2026-01-01T00:02:00Z'),
    }),
    getLastSeenByChat: jest.fn().mockResolvedValue([
        { userId: userBId, chatId, messageId: msgId, updatedAt: new Date('2026-01-01T00:02:00Z') },
    ]),
    editMessage: jest.fn().mockResolvedValue(makeMsgDoc({ text: 'Edited', isEdited: true, editedAt: new Date() })),
    softDeleteMessage: jest.fn().mockResolvedValue(makeMsgDoc({ text: '', isDeleted: true, deletedAt: new Date() })),
    ...overrides,
});

describe('modules/message/service', () => {
    it('sends a message and touches chat updatedAt', async () => {
        const chatRepo = makeChatRepo(true);
        const msgRepo = makeMsgRepo();
        const service = createMessageService(msgRepo, chatRepo);

        const message = await service.sendMessage({
            services: makeServices(),
            args: { chatId, senderId: userAId, text: 'Hello world', currentUser: makePublicUser(userAId) },
        });

        expect(message.id).toBe(msgId);
        expect(message.text).toBe('Hello world');
        expect(chatRepo.touchUpdatedAt).toHaveBeenCalledWith(expect.anything(), chatId);
    });

    it('rejects sendMessage when senderId does not match authenticated user', async () => {
        const service = createMessageService(makeMsgRepo(), makeChatRepo(true));

        await expect(
            service.sendMessage({
                services: makeServices(),
                args: { chatId, senderId: userBId, text: 'Spoofed', currentUser: makePublicUser(userAId) },
            }),
        ).rejects.toBeInstanceOf(NotAuthorizedError);
    });

    it('rejects getMessages when user is not a member of the chat', async () => {
        const service = createMessageService(makeMsgRepo(), makeChatRepo(false));

        await expect(
            service.getMessages({
                services: makeServices(),
                args: { chatId, limit: 50, currentUser: makePublicUser(userAId) },
            }),
        ).rejects.toBeInstanceOf(NotAuthorizedError);
    });

    it('marks message read and updates last seen when message exists', async () => {
        const service = createMessageService(makeMsgRepo(), makeChatRepo(true));

        const receipt = await service.markMessageRead({
            services: makeServices(),
            args: { chatId, messageId: msgId, userId: userBId, currentUser: makePublicUser(userBId) },
        });
        expect(receipt.messageId).toBe(msgId);

        const lastSeen = await service.updateLastSeen({
            services: makeServices(),
            args: { chatId, messageId: msgId, userId: userBId, currentUser: makePublicUser(userBId) },
        });
        expect(lastSeen.messageId).toBe(msgId);
    });

    it('throws NotFoundError when marking read on non-existent message', async () => {
        const msgRepo = makeMsgRepo({ findMessageById: jest.fn().mockResolvedValue(null) });
        const service = createMessageService(msgRepo, makeChatRepo(true));

        await expect(
            service.markMessageRead({
                services: makeServices(),
                args: { chatId, messageId: 'missing', userId: userBId, currentUser: makePublicUser(userBId) },
            }),
        ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('enforces sender ownership on edit/delete and blocks editing deleted messages', async () => {
        const msgRepo = makeMsgRepo();
        const service = createMessageService(msgRepo, makeChatRepo(true));

        await expect(
            service.editMessage({
                services: makeServices(),
                args: { chatId, messageId: msgId, text: 'Hack', currentUser: makePublicUser(userBId) },
            }),
        ).rejects.toBeInstanceOf(NotAuthorizedError);

        const deletedMsgRepo = makeMsgRepo({
            findMessageById: jest.fn().mockResolvedValue(makeMsgDoc({ isDeleted: true })),
        });
        const deletedService = createMessageService(deletedMsgRepo, makeChatRepo(true));

        await expect(
            deletedService.editMessage({
                services: makeServices(),
                args: { chatId, messageId: msgId, text: 'After delete', currentUser: makePublicUser(userAId) },
            }),
        ).rejects.toBeInstanceOf(BadRequestError);
    });
});
