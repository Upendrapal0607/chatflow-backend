import type Koa from 'koa';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type SerializableJson =
    | string
    | number
    | boolean
    | null
    | undefined
    | Date
    | SerializableJson[]
    | { [key: string]: SerializableJson };

export type Request = {
    url: string;
    path: string;
    method: string;
    ip: string;
    startedAt: number;
    httpVersion: string;
    protocol: string;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, unknown>;
    params: Record<string, string>;
    body: unknown;
    files?: unknown;
};

export type PaginationMeta = {
    page: number;
    limit: number;
    total: number;
    count: number;
};

export type ErrorBody = {
    message: string;
    key: string;
    details?: unknown;
};

export type ResponseBody = {
    statusCode: number;
    success: boolean;
    data?: unknown;
    meta?: Record<string, unknown>;
    error?: ErrorBody;
    pagination?: PaginationMeta;
};

export type Response = {
    type: '@response';
    headers: Record<string, string | string[]>;
    status: number;
    body: ResponseBody;
};

export type Props<
    TArgs extends Record<string, unknown> = Record<string, unknown>,
    TServices extends Record<string, unknown> = Record<string, unknown>,
    TAuth extends Record<string, unknown> = Record<string, unknown>,
    TRequest extends Request = Request,
    TFramework extends Record<string, unknown> = Record<string, unknown>,
> = {
    auth: TAuth;
    args: TArgs;
    services: TServices;
    request: TRequest;
    response: Response;
    framework: TFramework;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NextFunc<TProps extends Props<any, any, any, any, any> = Props, TResult = unknown> = (
    props: TProps,
) => Promise<TResult>;

export type Hook<TIn = unknown, TOut = unknown> = (fn: TIn) => TOut;

export type Endpoint = {
    handler: Koa.Middleware;
    config: {
        method: HttpMethod;
        path: string;
    };
};
