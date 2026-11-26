import {
    AppError,
    BadRequestError,
    ConflictError,
    InternalServerError,
    NotAuthenticatedError,
    NotAuthorizedError,
    NotFoundError,
    res,
    response,
    responseFromError,
    responseFromResult,
} from '../../../lib/core';

describe('lib/core error and response formatting', () => {
    it('builds standard success response from object result', () => {
        const result = responseFromResult({ data: { id: '123' } });
        expect(result.status).toBe(200);
        expect(result.body).toEqual({
            statusCode: 200,
            success: true,
            data: { id: '123' },
        });
    });

    it('builds custom status response via res()', () => {
        const result = res(201, { data: { created: true } });
        expect(result.status).toBe(201);
        expect(result.body).toEqual({
            statusCode: 201,
            success: true,
            data: { created: true },
        });
    });

    it('maps AppError subclasses to expected status codes and error bodies', () => {
        const cases: Array<[AppError, number]> = [
            [new BadRequestError('Bad input', { key: 'err.bad', details: [{ path: 'email' }] }), 400],
            [new NotAuthenticatedError('Auth required', { key: 'err.auth' }), 401],
            [new NotAuthorizedError('Forbidden', { key: 'err.forbidden' }), 403],
            [new NotFoundError('Missing', { key: 'err.missing' }), 404],
            [new ConflictError('Conflict', { key: 'err.conflict' }), 409],
            [new InternalServerError('Boom', { key: 'err.boom' }), 500],
        ];

        for (const [err, expectedStatus] of cases) {
            const out = responseFromError(err);
            expect(out.status).toBe(expectedStatus);
            expect(out.body).toEqual({
                statusCode: expectedStatus,
                success: false,
                error: {
                    message: err.message,
                    key: err.key,
                    ...(err.details !== undefined ? { details: err.details } : {}),
                },
            });
        }
    });

    it('hides unexpected non-AppError details behind generic 500 response', () => {
        const out = response(new Error('Sensitive DB stack'), null);
        expect(out.status).toBe(500);
        expect(out.body).toEqual({
            statusCode: 500,
            success: false,
            error: {
                message: 'Internal Server Error',
                key: 'err.internal',
            },
        });
    });
});
