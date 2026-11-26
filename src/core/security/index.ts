import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config';
import { InternalServerError, NotAuthenticatedError } from '../../lib/core';

export interface JwtTokenPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}

const ensureJwtSecret = (): string => {
    if (!config.jwt.secret) {
        throw new InternalServerError('JWT_SECRET is not configured', {
            key: 'err.security.jwt-secret-missing',
        });
    }
    return config.jwt.secret;
};

export const signJwt = (
    payload: Omit<JwtTokenPayload, 'iat' | 'exp'>,
    expiresIn: SignOptions['expiresIn'] = config.jwt.expiresIn as SignOptions['expiresIn'],
): string => {
    const secret = ensureJwtSecret();
    return jwt.sign(payload, secret, {
        algorithm: 'HS256',
        expiresIn,
    });
};

export const verifyJwt = (token: string): JwtTokenPayload => {
    const secret = ensureJwtSecret();
    try {
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
        if (typeof decoded === 'string' || !decoded || typeof decoded.userId !== 'string') {
            throw new NotAuthenticatedError('Invalid authentication token payload', {
                key: 'err.auth.invalid-token',
            });
        }
        return decoded as JwtTokenPayload;
    } catch (err) {
        if (err instanceof NotAuthenticatedError) {
            throw err;
        }
        throw new NotAuthenticatedError('Invalid or expired authentication token', {
            key: 'err.auth.invalid-token',
            cause: err,
        });
    }
};

export const hashPassword = async (plainPassword: string): Promise<string> => {
    return await bcrypt.hash(plainPassword, config.bcrypt.saltRounds);
};

export const comparePassword = async (plainPassword: string, passwordHash: string): Promise<boolean> => {
    return await bcrypt.compare(plainPassword, passwordHash);
};
