import { isFunction, tryit } from 'radash';
import zod, { ZodError, ZodObject, ZodRawShape } from 'zod';
import { BadRequestError, type NextFunc, type Props } from '../../core';

const isZodError = (err: unknown): err is ZodError =>
    typeof err === 'object' && err !== null && Array.isArray((err as ZodError).issues);

export const withHeaders = async <TOut extends Record<string, unknown>>(
    func: NextFunc<Props<TOut>>,
    model: ZodObject<ZodRawShape>,
    props: Props,
): Promise<unknown> => {
    const [zerr, parsed] = await tryit((val: unknown) => model.parseAsync(val))(props.request.headers);

    if (zerr) {
        if (!isZodError(zerr)) {
            const msg = zerr instanceof Error ? zerr.message : 'Parse error';
            throw new BadRequestError(`Header validation failed: ${msg}`, {
                key: 'err.headers.parsing',
                cause: zerr,
            });
        }
        const summary = zerr.issues.map((e) => `${e.path.join('.')}: ${e.message.toLowerCase()}`).join(', ');
        throw new BadRequestError(`Header validation failed: ${summary}`, {
            key: 'err.headers.failed',
            cause: zerr,
            details: zerr.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code })),
        });
    }

    return await func({
        ...props,
        args: {
            ...props.args,
            ...(parsed as Record<string, unknown>),
        } as TOut,
    });
};

export const useHeaders =
    <TRawShape extends ZodRawShape>(shapeMaker: ZodObject<TRawShape> | ((z: typeof zod) => TRawShape)) =>
    (func: NextFunc<Props<ZodObject<TRawShape>['_output']>>): NextFunc<Props> => {
        const model = isFunction(shapeMaker) ? zod.object(shapeMaker(zod)) : shapeMaker;
        return (props: Props) => withHeaders(func as NextFunc<Props<ZodObject<TRawShape>['_output']>>, model, props);
    };
