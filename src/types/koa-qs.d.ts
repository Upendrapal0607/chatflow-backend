declare module 'koa-qs' {
    import type Koa from 'koa';

    interface KoaQsOptions {
        arrayLimit?: number;
        parameterLimit?: number;
        depth?: number;
        strictNullHandling?: boolean;
    }

    function koaQs(app: Koa, mode?: 'extended' | 'strict' | 'first', options?: KoaQsOptions): Koa;
    export = koaQs;
}
