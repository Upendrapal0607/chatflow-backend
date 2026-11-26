import type Koa from 'koa';
import { isFunction, tryit } from 'radash';
import { AppError, props, response } from '../../core';
import type { NextFunc, Props, Request, Response } from '../../core';

export type KoaFramework = {
    ctx: Koa.Context;
    next: Koa.Next;
};

export type UseKoaOptions = {
    onUnhandledError?: (error: unknown, ctx: Koa.Context) => void;
};

type KoaContextWithExtras = Koa.Context & {
    params?: Record<string, string>;
    request: Koa.Request & {
        body?: unknown;
        files?: unknown;
    };
};

const makeRequest = (ctx: KoaContextWithExtras): Request => ({
    url: ctx.originalUrl,
    path: ctx.path,
    files: ctx.request.files,
    method: ctx.method,
    ip: ctx.ip,
    startedAt: Date.now(),
    protocol: ctx.request.protocol,
    httpVersion: ctx.req.httpVersion,
    headers: ctx.headers,
    body: ctx.request.body ?? null,
    query: { ...ctx.query },
    params: { ...(ctx.params ?? {}) },
});

const setResponse = (ctx: Koa.Context, resObj: Response): void => {
    ctx.status = resObj.status;
    for (const [key, val] of Object.entries(resObj.headers)) {
        ctx.set(key, val);
    }
    ctx.body = resObj.body;
};

async function withKoa(
    func: NextFunc<Props> | Promise<NextFunc<Props>>,
    options: UseKoaOptions,
    ctx: Koa.Context,
    next: Koa.Next,
): Promise<Response> {
    const [error, result] = await tryit(async () => {
        const resolvedFunc = isFunction(func) ? func : await func;
        return await resolvedFunc({
            ...props(),
            request: makeRequest(ctx as KoaContextWithExtras),
            framework: {
                ctx,
                next,
            },
        });
    })();

    if (error && !(error instanceof AppError)) {
        if (options.onUnhandledError) {
            options.onUnhandledError(error, ctx);
        } else {
            const errMsg = error instanceof Error ? error.stack ?? error.message : String(error);
            process.stderr.write(`[UnhandledError] ${ctx.method} ${ctx.path}: ${errMsg}\n`);
        }
    }

    const finalResponse = response(error, result);
    setResponse(ctx, finalResponse);
    return finalResponse;
}

export const useKoa =
    (options: UseKoaOptions = {}) =>
    (func: NextFunc<Props> | Promise<NextFunc<Props>>): Koa.Middleware =>
    async (ctx: Koa.Context, next: Koa.Next) => {
        await withKoa(func, options, ctx, next);
    };
