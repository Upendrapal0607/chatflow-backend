import { eq } from 'drizzle-orm';
import { InternalServerError, NotAuthenticatedError, NotAuthorizedError } from '../../lib/core';
import type { NextFunc, Props } from '../../lib/core';
import { USER_STATUS_ACTIVE } from '../../modules/user/constants';
import { toPublicUser } from '../../modules/user/helper';
import { usersTable } from '../../modules/user/schema';
import type { PublicUser } from '../../modules/user/types';
import type { DatabaseClient } from '../database';
import { JwtTokenPayload, verifyJwt } from '../security';

export interface AuthContext {
    userId: string;
    tokenPayload: JwtTokenPayload;
}

export interface AuthenticatedProps<
    TArgs extends Record<string, unknown> = Record<string, unknown>,
    TServices extends Record<string, unknown> = Record<string, unknown>,
> extends Props<TArgs & { currentUser: PublicUser }, TServices, AuthContext> {}

const extractBearerToken = (authorizationHeader: string | string[] | undefined): string => {
    const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
    if (!header || !header.startsWith('Bearer ')) {
        throw new NotAuthenticatedError('Missing or invalid Authorization header', {
            key: 'err.auth.token-missing',
        });
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        throw new NotAuthenticatedError('Authentication token is empty', {
            key: 'err.auth.token-empty',
        });
    }
    return token;
};

const withJwtAuth = async <
    TArgs extends Record<string, unknown>,
    TServices extends { db?: DatabaseClient },
>(
    func: NextFunc<AuthenticatedProps<TArgs, TServices>>,
    props: Props<TArgs, TServices>,
): Promise<unknown> => {
    const token = extractBearerToken(props.request.headers.authorization);
    const decoded = verifyJwt(token);

    const db = props.services.db;
    if (!db) {
        throw new InternalServerError('Database service is required for authentication', {
            key: 'err.auth.db-unavailable',
        });
    }

    const rows = await db.orm.select().from(usersTable).where(eq(usersTable.id, decoded.userId)).limit(1);
    const userRow = rows[0];

    if (!userRow) {
        throw new NotAuthenticatedError('Authenticated user no longer exists', {
            key: 'err.auth.user-not-found',
        });
    }

    if (userRow.status !== USER_STATUS_ACTIVE) {
        throw new NotAuthorizedError('User account is not active', {
            key: 'err.auth.user-inactive',
        });
    }

    const currentUser = toPublicUser(userRow);

    return await func({
        ...props,
        auth: {
            userId: currentUser.id,
            tokenPayload: decoded,
        },
        args: {
            ...props.args,
            currentUser,
        },
    });
};

export const useAuth =
    <
        TArgs extends Record<string, unknown> = Record<string, unknown>,
        TServices extends { db?: DatabaseClient } = { db?: DatabaseClient },
    >() =>
    (func: NextFunc<AuthenticatedProps<TArgs, TServices>>): NextFunc<Props<TArgs, TServices>> =>
    (props: Props<TArgs, TServices>) =>
        withJwtAuth(func, props);
