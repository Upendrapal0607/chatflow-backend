import { BadRequestError, props } from '../../../lib/core';
import { useJsonBody } from '../../../lib/hooks';

describe('lib/hooks/useJsonBody', () => {
    it('validates body with Zod and merges parsed fields into args', async () => {
        const handler = useJsonBody((z) => ({
            name: z.string().min(2),
            age: z.number().int().positive(),
        }))(async ({ args }) => ({ data: args }));

        const initialProps = {
            ...props(),
            request: {
                ...props().request,
                body: { name: 'Alice', age: 28, extraIgnored: true },
            },
        };

        const result = (await handler(initialProps)) as { data: { name: string; age: number } };
        expect(result.data).toEqual({ name: 'Alice', age: 28 });
    });

    it('throws BadRequestError with validation details when body is invalid', async () => {
        const handler = useJsonBody((z) => ({
            email: z.string().email(),
        }))(async ({ args }) => ({ data: args }));

        const initialProps = {
            ...props(),
            request: {
                ...props().request,
                body: { email: 'not-an-email' },
            },
        };

        await expect(handler(initialProps)).rejects.toBeInstanceOf(BadRequestError);
        try {
            await handler(initialProps);
        } catch (err) {
            const badReq = err as BadRequestError;
            expect(badReq.status).toBe(400);
            expect(badReq.key).toBe('err.json-body.failed');
            expect(Array.isArray(badReq.details)).toBe(true);
        }
    });
});
