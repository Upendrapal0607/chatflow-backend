import type Router from '@koa/router';
import type { Endpoint } from '../../lib/core';

const addRoutes = (router: Router, endpoints: Endpoint[]): Router => {
    for (const endpoint of endpoints) {
        const method = endpoint.config.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
        router[method](endpoint.config.path, endpoint.handler);
    }
    return router;
};

export default addRoutes;
