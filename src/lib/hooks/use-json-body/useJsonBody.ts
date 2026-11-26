import { isFunction, tryit } from 'radash';
import zod, { ZodError, ZodObject, ZodRawShape, ZodTypeAny } from 'zod';
import { BadRequestError } from '../../core';
import type { NextFunc, Props } from '../../core';

const isZodError = (err: unknown): err is ZodError =>
    typeof err === 'object' && err !== null && Array.isArray((err as ZodError).issues);

const formatZodDetails = (err: ZodError) =>
    err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
    }));

const normalizeArrayFields = (body: unknown): unknown => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return body;
    }

    const record = body as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        const value = record[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const subKeys = Object.keys(value);
            if (subKeys.length > 0 && subKeys.every((k) => /^\d+$/.test(k))) {
                record[key] = Object.values(value);
            }
        }
    }
    return record;
};

export const withJsonBody = async <TOut extends Record<string, unknown>>(
    func: NextFunc<Props<TOut>>,
    model: ZodTypeAny,
    props: Props,
    fieldName?: string,
): Promise<unknown> => {
    const normalizedBody = normalizeArrayFields(props.request.body ?? {});
    const [zerr, parsed] = await tryit((val: unknown) => model.parseAsync(val))(normalizedBody);

    if (zerr) {
        if (!isZodError(zerr)) {
            const msg = zerr instanceof Error ? zerr.message : 'Invalid JSON payload';
            throw new BadRequestError(`JSON body validation failed: ${msg}`, {
                key: 'err.json-body.parsing',
                cause: zerr,
            });
        }
        const summary = zerr.issues
            .map((e) => `${e.path.length > 0 ? e.path.join('.') : 'body'}: ${e.message.toLowerCase()}`)
            .join(', ');
        throw new BadRequestError(`JSON body validation failed: ${summary}`, {
            key: 'err.json-body.failed',
            cause: zerr,
            details: formatZodDetails(zerr),
        });
    }

    const extraArgs = fieldName ? { [fieldName]: parsed } : (parsed as Record<string, unknown>);
    return await func({
        ...props,
        args: {
            ...props.args,
            ...extraArgs,
        } as TOut,
    });
};

export const useJsonBody =
    <TRawShape extends ZodRawShape>(shapeMaker: ZodObject<TRawShape> | ((z: typeof zod) => TRawShape)) =>
    (func: NextFunc<Props<ZodObject<TRawShape>['_output']>>): NextFunc<Props> => {
        const model = isFunction(shapeMaker) ? zod.object(shapeMaker(zod)) : shapeMaker;
        return (props: Props) => withJsonBody(func as NextFunc<Props<ZodObject<TRawShape>['_output']>>, model, props);
    };

export const useJsonArrayBody =
    <TField extends string, TShape extends ZodTypeAny>(
        name: TField,
        shapeMaker: zod.ZodArray<TShape> | ((z: typeof zod) => TShape),
    ) =>
    (func: NextFunc<Props<{ [K in TField]: zod.ZodArray<TShape>['_output'] }>>): NextFunc<Props> => {
        const model = isFunction(shapeMaker) ? zod.array(shapeMaker(zod)) : shapeMaker;
        return (props: Props) =>
            withJsonBody(
                func as NextFunc<Props<{ [K in TField]: zod.ZodArray<TShape>['_output'] }>>,
                model,
                props,
                name,
            );
    };
