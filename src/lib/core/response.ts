import { isNumber } from 'radash';
import { AppError } from './error';
import type { Response, ResponseBody } from './types';

export const isResponse = (resValue: unknown): resValue is Response => {
    return typeof resValue === 'object' && resValue !== null && (resValue as Response).type === '@response';
};

export const defaultResponse: Response = {
    type: '@response',
    status: 200,
    headers: {},
    body: {
        statusCode: 200,
        success: true,
    },
};

export const responseFromResult = (result: unknown): Response => {
    if (isResponse(result)) {
        return result;
    }

    if (result === null || result === undefined) {
        return defaultResponse;
    }

    if (typeof result === 'object' && !Array.isArray(result)) {
        return {
            ...defaultResponse,
            body: {
                statusCode: 200,
                success: true,
                ...(result as Record<string, unknown>),
            },
        };
    }

    return {
        ...defaultResponse,
        body: {
            statusCode: 200,
            success: true,
            data: result,
        },
    };
};

export const responseFromError = (error: unknown): Response => {
    if (isResponse(error)) {
        return error;
    }

    const build = (status: number, message: string, key: string, details?: unknown): Response => ({
        ...defaultResponse,
        status,
        body: {
            statusCode: status,
            success: false,
            error: {
                message,
                key,
                ...(details !== undefined ? { details } : {}),
            },
        },
    });

    if (error instanceof AppError) {
        return build(error.status, error.message, error.key, error.details);
    }

    return build(500, 'Internal Server Error', 'err.internal');
};

export const response = (error: unknown, result: unknown): Response => {
    return error ? responseFromError(error) : responseFromResult(result);
};

export function res(): Response;
export function res(body: Partial<ResponseBody> & Record<string, unknown>): Response;
export function res(status: number): Response;
export function res(status: number, body: Partial<ResponseBody> & Record<string, unknown>): Response;
export function res(
    statusOrBody?: number | (Partial<ResponseBody> & Record<string, unknown>),
    body?: Partial<ResponseBody> & Record<string, unknown>,
): Response {
    if (statusOrBody === undefined && body === undefined) {
        return defaultResponse;
    }

    const status = isNumber(statusOrBody) ? statusOrBody : 200;
    const rawBody = body ?? (isNumber(statusOrBody) ? {} : statusOrBody ?? {});

    return {
        ...defaultResponse,
        status,
        body: {
            statusCode: status,
            success: status < 400,
            ...rawBody,
        },
    };
}
