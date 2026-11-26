export const USER_TABLE = 'users' as const;

export const USER_STATUS_ACTIVE = 'active' as const;
export const USER_STATUS_INACTIVE = 'inactive' as const;
export const USER_STATUS_SUSPENDED = 'suspended' as const;

export const USER_STATUSES = [
    USER_STATUS_ACTIVE,
    USER_STATUS_INACTIVE,
    USER_STATUS_SUSPENDED,
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_ERROR_KEYS = {
    EMAIL_TAKEN: 'err.user.email-taken',
    USERNAME_TAKEN: 'err.user.username-taken',
    INVALID_CREDENTIALS: 'err.user.invalid-credentials',
    NOT_FOUND: 'err.user.not-found',
    ACCOUNT_INACTIVE: 'err.user.account-inactive',
    CREATE_FAILED: 'err.user.create-failed',
    UPDATE_FAILED: 'err.user.update-failed',
} as const;
