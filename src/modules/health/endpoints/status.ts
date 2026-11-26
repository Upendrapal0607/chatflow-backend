import { config, CoreServices, useCoreServices } from '../../../core';
import { compose } from '../../../lib/core';
import type { Endpoint, Props } from '../../../lib/core';
import { useKoa, useLogging, useServices } from '../../../lib/hooks';

export const healthStatusHandler = async ({ services }: Props<Record<string, unknown>, CoreServices>) => {
    const [pgOk, firestoreOk] = await Promise.all([
        services.db.ping().catch(() => false),
        services.firestore.ping().catch(() => false),
    ]);

    return {
        data: {
            status: 'ok',
            environment: config.env,
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            services: {
                postgresql: pgOk ? 'connected' : 'disconnected',
                firestore: firestoreOk ? 'connected' : 'disconnected',
            },
        },
    };
};

export const endpoint: Endpoint = {
    handler: compose(
        useKoa(),
        useServices({
            ...useCoreServices(),
        }),
        useLogging(),
        healthStatusHandler,
    ),
    config: {
        method: 'GET',
        path: '/health/status',
    },
};
