import 'dotenv/config';

import Router from '@koa/router';
import Koa from 'koa';
import koaBody from 'koa-body';
import koaQs from 'koa-qs';
import {
    addRoutes,
    config,
    disconnectDatabase,
    disconnectFirestore,
    registerShutdown,
    runPreflight,
    useLogger,
} from './core';
import { responseFromError } from './lib/core';
import endpoints from './modules/endpoints';

const logger = useLogger({ component: 'app' });

export function createApp(): Koa {
    const app = new Koa();
    const router = new Router();

    koaQs(app, 'extended', {
        arrayLimit: 100,
        parameterLimit: 1000,
    });

    // Root-level error boundary for errors thrown outside hook-composed handlers (e.g., body parsing)
    app.use(async (ctx, next) => {
        try {
            await next();
        } catch (err) {
            const errRes = responseFromError(err);
            ctx.status = errRes.status;
            ctx.body = errRes.body;
            logger.captureError(err, { method: ctx.method, path: ctx.path });
        }
    });

    addRoutes(router, endpoints);

    app.use(
        koaBody({
            multipart: true,
            urlencoded: true,
        }),
    )
        .use(router.routes())
        .use(router.allowedMethods());

    return app;
}

async function bootstrap(): Promise<void> {
    await runPreflight();

    const app = createApp();
    const server = app.listen(config.port, () => {
        logger.info(`ChatFlow Backend listening on port ${config.port} (env=${config.env})`);
    });

    registerShutdown(() => {
        logger.info('Shutting down ChatFlow Backend...');
        server.close((closeErr) => {
            if (closeErr) {
                logger.captureError(closeErr, { phase: 'server.close' });
            }
            Promise.all([disconnectDatabase(), disconnectFirestore()])
                .catch((err) => logger.captureError(err, { phase: 'disconnect' }))
                .finally(() => process.exit(0));
        });
    });
}

if (require.main === module) {
    bootstrap().catch((err) => {
        logger.captureError(err, { phase: 'bootstrap' });
        process.exit(1);
    });
}
