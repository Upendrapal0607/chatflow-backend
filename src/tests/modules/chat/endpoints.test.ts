import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { config, signJwt } from '../../../core';
import type { ChatEntity, ChatMemberEntity } from '../../../modules/chat/types';
import type { LastSeenDocument, MessageDocument, ReadReceiptDocument } from '../../../modules/message/schema';
import type { UserEntity } from '../../../modules/user/types';

const userAId = '11111111-1111-4111-8111-111111111111';
const userBId = '22222222-2222-4222-8222-222222222222';
const userCId = '33333333-3333-4333-8333-333333333333';

const mockUsers = new Map<string, UserEntity>();
const mockChats = new Map<string, ChatEntity>();
const mockMembers = new Map<string, ChatMemberEntity[]>();
const mockMessages = new Map<string, MessageDocument[]>();
const mockReceipts = new Map<string, ReadReceiptDocument>();
const mockLastSeen = new Map<string, LastSeenDocument[]>();

let chatSeq = 0;
let msgSeq = 0;

const seedUsers = () => {
    const now = new Date();
    for (const [id, name] of [
        [userAId, 'Alice'],
        [userBId, 'Bob'],
        [userCId, 'Charlie'],
    ] as const) {
        mockUsers.set(id, {
            id,
            name,
            email: `${name.toLowerCase()}@example.com`,
            username: name.toLowerCase(),
            passwordHash: 'hash',
            avatarUrl: null,
            status: 'active',
            lastActiveAt: null,
            createdAt: now,
            updatedAt: now,
        });
    }
};

const mockDb = {
    ping: jest.fn().mockResolvedValue(true),
    query: jest.fn(),
    pool: {},
    orm: {
        select: () => ({
            from: () => ({
                where: (cond: any) => ({
                    limit: async () => {
                        const targetId = cond?.right ?? cond?.queryChunks?.find?.((c: any) => typeof c === 'string');
                        const matched = targetId && mockUsers.get(targetId);
                        if (matched) {
                            return [matched];
                        }
                        const first = Array.from(mockUsers.values())[0];
                        return first ? [first] : [];
                    },
                }),
            }),
        }),
    },
};

const mockFirestore = {
    ping: jest.fn().mockResolvedValue(true),
    db: {},
};

jest.mock('../../../core/database', () => ({
    makeDatabase: () => mockDb,
    disconnectDatabase: jest.fn(),
}));

jest.mock('../../../core/firestore', () => ({
    makeFirestore: () => mockFirestore,
    disconnectFirestore: jest.fn(),
}));

jest.mock('../../../core/hooks/useAuth', () => {
    const actual = jest.requireActual('../../../core/hooks/useAuth');
    return actual;
});

jest.mock('../../../modules/chat/repository', () => ({
    chatRepository: {
        findById: async (_db: unknown, chatId: string) => mockChats.get(chatId) ?? null,
        findByDirectKey: async (_db: unknown, key: string) =>
            Array.from(mockChats.values()).find((c) => c.directKey === key) ?? null,
        findMembersByChatId: async (_db: unknown, chatId: string) => mockMembers.get(chatId) ?? [],
        findMember: async (_db: unknown, chatId: string, userId: string) =>
            (mockMembers.get(chatId) ?? []).find((m) => m.userId === userId) ?? null,
        findActiveUserIds: async (_db: unknown, userIds: string[]) =>
            userIds.filter((id) => mockUsers.get(id)?.status === 'active'),
        createDirectChat: async (
            _db: unknown,
            params: { directKey: string; userAId: string; userBId: string; createdBy: string },
        ) => {
            const existing = Array.from(mockChats.values()).find((c) => c.directKey === params.directKey);
            if (existing) {
                return { chat: existing, members: mockMembers.get(existing.id) ?? [], created: false };
            }
            chatSeq += 1;
            const id = `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${chatSeq}`;
            const now = new Date();
            const chat: ChatEntity = {
                id,
                type: 'direct',
                directKey: params.directKey,
                name: null,
                createdBy: params.createdBy,
                createdAt: now,
                updatedAt: now,
            };
            const members: ChatMemberEntity[] = [
                { id: `m-${id}-a`, chatId: id, userId: params.userAId, role: 'member', joinedAt: now },
                { id: `m-${id}-b`, chatId: id, userId: params.userBId, role: 'member', joinedAt: now },
            ];
            mockChats.set(id, chat);
            mockMembers.set(id, members);
            return { chat, members, created: true };
        },
        createGroupChat: async (_db: unknown, params: { name: string; memberIds: string[]; createdBy: string }) => {
            chatSeq += 1;
            const id = `bbbbbbbb-bbbb-4bbb-8bbb-00000000000${chatSeq}`;
            const now = new Date();
            const chat: ChatEntity = {
                id,
                type: 'group',
                directKey: null,
                name: params.name,
                createdBy: params.createdBy,
                createdAt: now,
                updatedAt: now,
            };
            const members: ChatMemberEntity[] = params.memberIds.map((uid) => ({
                id: `m-${id}-${uid}`,
                chatId: id,
                userId: uid,
                role: uid === params.createdBy ? 'admin' : 'member',
                joinedAt: now,
            }));
            mockChats.set(id, chat);
            mockMembers.set(id, members);
            return { chat, members };
        },
        listChatsByUserId: async (_db: unknown, userId: string) => {
            const result: Array<{ chat: ChatEntity; members: ChatMemberEntity[] }> = [];
            for (const [cid, chat] of mockChats.entries()) {
                const members = mockMembers.get(cid) ?? [];
                if (members.some((m) => m.userId === userId)) {
                    result.push({ chat, members });
                }
            }
            return result;
        },
        updateName: async (_db: unknown, chatId: string, name: string) => {
            const existing = mockChats.get(chatId);
            if (!existing) {
                return null;
            }
            const updated: ChatEntity = { ...existing, name, updatedAt: new Date() };
            mockChats.set(chatId, updated);
            return updated;
        },
        addMembers: async (_db: unknown, chatId: string, userIds: string[]) => {
            const current = mockMembers.get(chatId) ?? [];
            const existingIds = new Set(current.map((m) => m.userId));
            const now = new Date();
            for (const uid of userIds) {
                if (!existingIds.has(uid)) {
                    current.push({ id: `m-${chatId}-${uid}`, chatId, userId: uid, role: 'member', joinedAt: now });
                }
            }
            mockMembers.set(chatId, current);
            return current;
        },
        removeMember: async (_db: unknown, chatId: string, userId: string) => {
            const current = mockMembers.get(chatId) ?? [];
            const next = current.filter((m) => m.userId !== userId);
            if (next.length === current.length) {
                return false;
            }
            mockMembers.set(chatId, next);
            return true;
        },
        touchUpdatedAt: async (_db: unknown, chatId: string) => {
            const existing = mockChats.get(chatId);
            if (existing) {
                mockChats.set(chatId, { ...existing, updatedAt: new Date() });
            }
        },
    },
}));

jest.mock('../../../modules/message/repository', () => ({
    messageRepository: {
        createMessage: async (_fs: unknown, params: { chatId: string; senderId: string; text: string; type: any }) => {
            msgSeq += 1;
            const now = new Date(Date.now() + msgSeq);
            const doc: MessageDocument = {
                id: `msg-${msgSeq}`,
                chatId: params.chatId,
                senderId: params.senderId,
                text: params.text,
                type: params.type,
                readBy: { [params.senderId]: now },
                isEdited: false,
                editedAt: null,
                isDeleted: false,
                deletedAt: null,
                createdAt: now,
                updatedAt: now,
            };
            const list = mockMessages.get(params.chatId) ?? [];
            list.push(doc);
            mockMessages.set(params.chatId, list);
            return doc;
        },
        findMessageById: async (_fs: unknown, chatId: string, messageId: string) =>
            (mockMessages.get(chatId) ?? []).find((m) => m.id === messageId) ?? null,
        getMessages: async (_fs: unknown, params: { chatId: string; limit: number; order?: 'asc' | 'desc' }) => {
            const list = [...(mockMessages.get(params.chatId) ?? [])].slice(-params.limit);
            return params.order === 'desc' ? list.reverse() : list;
        },
        markMessageRead: async (_fs: unknown, params: { chatId: string; messageId: string; userId: string }) => {
            const now = new Date();
            const list = mockMessages.get(params.chatId) ?? [];
            const msg = list.find((m) => m.id === params.messageId);
            if (msg) {
                msg.readBy[params.userId] = now;
                msg.updatedAt = now;
            }
            const receipt: ReadReceiptDocument = {
                userId: params.userId,
                messageId: params.messageId,
                chatId: params.chatId,
                readAt: now,
            };
            mockReceipts.set(`${params.chatId}:${params.messageId}:${params.userId}`, receipt);
            return receipt;
        },
        updateLastSeen: async (_fs: unknown, params: { chatId: string; userId: string; messageId: string }) => {
            const now = new Date();
            const doc: LastSeenDocument = {
                userId: params.userId,
                chatId: params.chatId,
                messageId: params.messageId,
                updatedAt: now,
            };
            const existing = (mockLastSeen.get(params.chatId) ?? []).filter((d) => d.userId !== params.userId);
            existing.push(doc);
            mockLastSeen.set(params.chatId, existing);
            return doc;
        },
        getLastSeenByChat: async (_fs: unknown, chatId: string) => mockLastSeen.get(chatId) ?? [],
        editMessage: async (_fs: unknown, params: { chatId: string; messageId: string; text: string }) => {
            const now = new Date();
            const list = mockMessages.get(params.chatId) ?? [];
            const msg = list.find((m) => m.id === params.messageId);
            if (!msg) {
                throw new Error('Missing message');
            }
            msg.text = params.text;
            msg.isEdited = true;
            msg.editedAt = now;
            msg.updatedAt = now;
            return msg;
        },
        softDeleteMessage: async (_fs: unknown, params: { chatId: string; messageId: string }) => {
            const now = new Date();
            const list = mockMessages.get(params.chatId) ?? [];
            const msg = list.find((m) => m.id === params.messageId);
            if (!msg) {
                throw new Error('Missing message');
            }
            msg.text = '';
            msg.isDeleted = true;
            msg.deletedAt = now;
            msg.updatedAt = now;
            return msg;
        },
    },
}));

import { createApp } from '../../../app';

async function invokeApp(
    app: ReturnType<typeof createApp>,
    opts: {
        method: string;
        url: string;
        body?: Record<string, unknown>;
        headers?: Record<string, string>;
    },
): Promise<{ status: number; body: any }> {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.method = opts.method;
    req.url = opts.url;
    req.headers = {
        'content-type': 'application/json',
        ...(opts.headers ?? {}),
    };

    if (opts.body !== undefined) {
        const raw = Buffer.from(JSON.stringify(opts.body));
        req.headers['content-length'] = String(raw.length);
        req.push(raw);
    }
    req.push(null);

    const res = new ServerResponse(req);
    const ctx = app.createContext(req, res);
    if (opts.body !== undefined) {
        (ctx.request as any).body = opts.body;
    }

    const runStack = (idx: number): Promise<void> => {
        const fn = app.middleware[idx];
        if (!fn) {
            return Promise.resolve();
        }
        return Promise.resolve(fn(ctx, () => runStack(idx + 1)));
    };

    await runStack(0);
    return { status: ctx.status, body: ctx.body };
}

describe('Chat & Message HTTP endpoints (core + bonus)', () => {
    const app = createApp();
    let tokenA: string;

    beforeAll(() => {
        config.jwt.secret = 'test-jwt-secret-key-at-least-32-chars-long';
        tokenA = signJwt({ userId: userAId, email: 'alice@example.com' });
    });

    beforeEach(() => {
        mockUsers.clear();
        mockChats.clear();
        mockMembers.clear();
        mockMessages.clear();
        mockReceipts.clear();
        mockLastSeen.clear();
        chatSeq = 0;
        msgSeq = 0;
        seedUsers();
    });

    it('supports full 1:1 chat flow: create/get -> send -> list -> read -> lastseen -> user chats -> edit/delete', async () => {
        // 1. Create or Get Chat (first call creates)
        const createRes = await invokeApp(app, {
            method: 'POST',
            url: '/chat/create',
            headers: { authorization: `Bearer ${tokenA}` },
            body: { userAId, userBId },
        });
        expect(createRes.status).toBe(201);
        const createdChatId = createRes.body.data.chatId;
        expect(createdChatId).toBeTruthy();

        // Calling again returns existing chatId
        const getExistingRes = await invokeApp(app, {
            method: 'POST',
            url: '/chat/create',
            headers: { authorization: `Bearer ${tokenA}` },
            body: { userAId: userBId, userBId: userAId },
        });
        expect(getExistingRes.status).toBe(200);
        expect(getExistingRes.body.data.chatId).toBe(createdChatId);

        // 2. Send Messages
        const send1 = await invokeApp(app, {
            method: 'POST',
            url: `/chat/${createdChatId}/message/send`,
            headers: { authorization: `Bearer ${tokenA}` },
            body: { senderId: userAId, text: 'Hello Bob!' },
        });
        expect(send1.status).toBe(201);
        const messageId = send1.body.data.message.id;

        await invokeApp(app, {
            method: 'POST',
            url: `/chat/${createdChatId}/message/send`,
            headers: { authorization: `Bearer ${tokenA}` },
            body: { senderId: userAId, text: 'How are you?' },
        });

        // 3. Get Messages ordered by timestamp
        const listRes = await invokeApp(app, {
            method: 'GET',
            url: `/chat/${createdChatId}/messages?limit=50`,
            headers: { authorization: `Bearer ${tokenA}` },
        });
        expect(listRes.status).toBe(200);
        expect(listRes.body.data.messages).toHaveLength(2);
        expect(listRes.body.data.messages[0].text).toBe('Hello Bob!');
        expect(listRes.body.data.messages[1].text).toBe('How are you?');

        // 4. Mark Message Read
        const readRes = await invokeApp(app, {
            method: 'POST',
            url: `/chat/${createdChatId}/message/${messageId}/read`,
            headers: { authorization: `Bearer ${tokenA}` },
            body: { userId: userAId },
        });
        expect(readRes.status).toBe(200);
        expect(readRes.body.data.receipt.messageId).toBe(messageId);

        // 5. Update Last Seen
        const lastSeenRes = await invokeApp(app, {
            method: 'POST',
            url: `/chat/${createdChatId}/lastseen`,
            headers: { authorization: `Bearer ${tokenA}` },
            body: { userId: userAId, messageId },
        });
        expect(lastSeenRes.status).toBe(200);
        expect(lastSeenRes.body.data.lastSeen.messageId).toBe(messageId);

        // 6. List User Chats
        const userChatsRes = await invokeApp(app, {
            method: 'GET',
            url: `/user/${userAId}/chats`,
            headers: { authorization: `Bearer ${tokenA}` },
        });
        expect(userChatsRes.status).toBe(200);
        expect(userChatsRes.body.data.chats).toHaveLength(1);
        expect(userChatsRes.body.data.chats[0].memberIds).toEqual([userAId, userBId]);

        // Bonus: Edit Message
        const editRes = await invokeApp(app, {
            method: 'PATCH',
            url: `/chat/${createdChatId}/message/${messageId}`,
            headers: { authorization: `Bearer ${tokenA}` },
            body: { text: 'Hello Bob (edited)!' },
        });
        expect(editRes.status).toBe(200);
        expect(editRes.body.data.message.isEdited).toBe(true);
        expect(editRes.body.data.message.text).toBe('Hello Bob (edited)!');

        // Bonus: Delete Message
        const deleteRes = await invokeApp(app, {
            method: 'DELETE',
            url: `/chat/${createdChatId}/message/${messageId}`,
            headers: { authorization: `Bearer ${tokenA}` },
        });
        expect(deleteRes.status).toBe(200);
        expect(deleteRes.body.data.message.isDeleted).toBe(true);
        expect(deleteRes.body.data.message.text).toBe('');
    });

    it('supports bonus group chat creation, rename, add member, and remove member', async () => {
        const groupRes = await invokeApp(app, {
            method: 'POST',
            url: '/chat/group/create',
            headers: { authorization: `Bearer ${tokenA}` },
            body: { name: 'Engineering', memberIds: [userBId] },
        });
        expect(groupRes.status).toBe(201);
        const groupId = groupRes.body.data.chatId;
        expect(groupRes.body.data.chat.memberIds).toEqual([userAId, userBId]);

        const renameRes = await invokeApp(app, {
            method: 'PATCH',
            url: `/chat/${groupId}`,
            headers: { authorization: `Bearer ${tokenA}` },
            body: { name: 'Core Engineering' },
        });
        expect(renameRes.status).toBe(200);
        expect(renameRes.body.data.chat.name).toBe('Core Engineering');

        const addRes = await invokeApp(app, {
            method: 'POST',
            url: `/chat/${groupId}/members`,
            headers: { authorization: `Bearer ${tokenA}` },
            body: { memberIds: [userCId] },
        });
        expect(addRes.status).toBe(200);
        expect(addRes.body.data.chat.memberIds).toEqual([userAId, userBId, userCId]);

        const removeRes = await invokeApp(app, {
            method: 'DELETE',
            url: `/chat/${groupId}/members/${userCId}`,
            headers: { authorization: `Bearer ${tokenA}` },
        });
        expect(removeRes.status).toBe(200);
        expect(removeRes.body.data.chat.memberIds).toEqual([userAId, userBId]);
    });
});
