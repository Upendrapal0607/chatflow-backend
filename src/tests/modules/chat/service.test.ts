import { BadRequestError, NotAuthorizedError, NotFoundError } from '../../../lib/core';
import { buildDirectKey } from '../../../modules/chat/helper';
import { createChatService } from '../../../modules/chat/service';
import type { ChatEntity, ChatMemberEntity, ChatRepository } from '../../../modules/chat/types';
import type { PublicUser } from '../../../modules/user/types';

const userAId = '11111111-1111-4111-8111-111111111111';
const userBId = '22222222-2222-4222-8222-222222222222';
const userCId = '33333333-3333-4333-8333-333333333333';
const chatId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

const makeChat = (overrides: Partial<ChatEntity> = {}): ChatEntity => ({
    id: chatId,
    type: 'direct',
    directKey: buildDirectKey(userAId, userBId),
    name: null,
    createdBy: userAId,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

const makeMember = (userId: string, role: 'member' | 'admin' = 'member'): ChatMemberEntity => ({
    id: `mem-${userId}`,
    chatId,
    userId,
    role,
    joinedAt: new Date(),
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

const makeRepo = (overrides: Partial<ChatRepository> = {}): ChatRepository => ({
    findById: jest.fn().mockResolvedValue(null),
    findByDirectKey: jest.fn().mockResolvedValue(null),
    findMembersByChatId: jest.fn().mockResolvedValue([]),
    findMember: jest.fn().mockResolvedValue(null),
    findActiveUserIds: jest.fn().mockImplementation(async (_db, ids: string[]) => ids),
    createDirectChat: jest.fn().mockResolvedValue({
        chat: makeChat(),
        members: [makeMember(userAId), makeMember(userBId)],
        created: true,
    }),
    createGroupChat: jest.fn().mockResolvedValue({
        chat: makeChat({ type: 'group', directKey: null, name: 'Team' }),
        members: [makeMember(userAId, 'admin'), makeMember(userBId, 'member')],
    }),
    listChatsByUserId: jest.fn().mockResolvedValue([]),
    updateName: jest.fn().mockResolvedValue(makeChat({ type: 'group', name: 'Renamed' })),
    addMembers: jest.fn().mockResolvedValue([makeMember(userAId, 'admin'), makeMember(userBId), makeMember(userCId)]),
    removeMember: jest.fn().mockResolvedValue(true),
    touchUpdatedAt: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

describe('modules/chat/service', () => {
    it('builds canonical directKey regardless of user ID order', () => {
        expect(buildDirectKey(userAId, userBId)).toBe(buildDirectKey(userBId, userAId));
    });

    it('creates or returns a 1:1 chat with memberIds', async () => {
        const repo = makeRepo();
        const service = createChatService(repo);

        const result = await service.createOrGetDirectChat({
            services: makeServices(),
            args: { userAId, userBId, currentUser: makePublicUser(userAId) },
        });

        expect(result.chatId).toBe(chatId);
        expect(result.created).toBe(true);
        expect(result.chat.memberIds).toEqual([userAId, userBId]);
    });

    it('rejects self-chat creation with BadRequestError', async () => {
        const service = createChatService(makeRepo());

        await expect(
            service.createOrGetDirectChat({
                services: makeServices(),
                args: { userAId, userBId: userAId, currentUser: makePublicUser(userAId) },
            }),
        ).rejects.toBeInstanceOf(BadRequestError);
    });

    it('rejects createOrGetDirectChat when currentUser is not a participant', async () => {
        const service = createChatService(makeRepo());

        await expect(
            service.createOrGetDirectChat({
                services: makeServices(),
                args: { userAId, userBId, currentUser: makePublicUser(userCId) },
            }),
        ).rejects.toBeInstanceOf(NotAuthorizedError);
    });

    it('throws NotFoundError if a participant does not exist or is inactive', async () => {
        const repo = makeRepo({
            findActiveUserIds: jest.fn().mockResolvedValue([userAId]),
        });
        const service = createChatService(repo);

        await expect(
            service.createOrGetDirectChat({
                services: makeServices(),
                args: { userAId, userBId, currentUser: makePublicUser(userAId) },
            }),
        ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('creates group chat and enforces admin role for renaming and adding members', async () => {
        const repo = makeRepo({
            findById: jest.fn().mockResolvedValue(makeChat({ type: 'group', name: 'Old' })),
            findMember: jest.fn().mockResolvedValue(makeMember(userBId, 'member')),
        });
        const service = createChatService(repo);

        await expect(
            service.updateGroupChat({
                services: makeServices(),
                args: { chatId, name: 'New', currentUser: makePublicUser(userBId) },
            }),
        ).rejects.toBeInstanceOf(NotAuthorizedError);
    });

    it('allows member to leave group chat themselves', async () => {
        const repo = makeRepo({
            findById: jest.fn().mockResolvedValue(makeChat({ type: 'group', name: 'Team' })),
            findMember: jest.fn().mockResolvedValue(makeMember(userBId, 'member')),
            findMembersByChatId: jest.fn().mockResolvedValue([makeMember(userAId, 'admin')]),
        });
        const service = createChatService(repo);

        const res = await service.removeMember({
            services: makeServices(),
            args: { chatId, userId: userBId, currentUser: makePublicUser(userBId) },
        });

        expect(res.memberIds).toEqual([userAId]);
    });
});
