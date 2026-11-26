declare module '@koa/router' {
    import type Koa from 'koa';

    class Router {
        get(path: string, ...middleware: Koa.Middleware[]): this;
        post(path: string, ...middleware: Koa.Middleware[]): this;
        put(path: string, ...middleware: Koa.Middleware[]): this;
        patch(path: string, ...middleware: Koa.Middleware[]): this;
        delete(path: string, ...middleware: Koa.Middleware[]): this;
        routes(): Koa.Middleware;
        allowedMethods(): Koa.Middleware;
    }

    export = Router;
}
