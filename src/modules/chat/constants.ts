export const CHATS_TABLE = 'chats' as const;
export const CHAT_MEMBERS_TABLE = 'chat_members' as const;

export const CHAT_TYPE_DIRECT = 'direct' as const;
export const CHAT_TYPE_GROUP = 'group' as const;
export const CHAT_TYPES = [CHAT_TYPE_DIRECT, CHAT_TYPE_GROUP] as const;

export const CHAT_ROLE_MEMBER = 'member' as const;
export const CHAT_ROLE_ADMIN = 'admin' as const;
export const CHAT_MEMBER_ROLES = [CHAT_ROLE_MEMBER, CHAT_ROLE_ADMIN] as const;

export type ChatType = (typeof CHAT_TYPES)[number];
export type ChatMemberRole = (typeof CHAT_MEMBER_ROLES)[number];

export const CHAT_ERROR_KEYS = {
    NOT_FOUND: 'err.chat.not-found',
    INVALID_MEMBERS: 'err.chat.invalid-members',
    SELF_CHAT_NOT_ALLOWED: 'err.chat.self-chat-not-allowed',
    NOT_A_MEMBER: 'err.chat.not-a-member',
    ADMIN_REQUIRED: 'err.chat.admin-required',
    NOT_GROUP_CHAT: 'err.chat.not-group-chat',
    FORBIDDEN: 'err.chat.forbidden',
} as const;
