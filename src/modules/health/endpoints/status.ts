import { config, CoreServices, useCoreServices } from '../../../core';
import { compose, res, type Endpoint, type Props } from '../../../lib/core';
import { useKoa, useLogging, useServices } from '../../../lib/hooks';

export const healthStatusHandler = async ({ services }: Props<Record<string, unknown>, CoreServices>) => {
    const [pgOk, firestoreOk] = await Promise.all([
        services.db.ping().catch(() => false),
        services.firestore.ping().catch(() => false),
    ]);

    const healthy = pgOk && firestoreOk;
    return res(healthy ? 200 : 503, {
        data: {
            status: healthy ? 'ok' : 'degraded',
            environment: config.env,
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            services: {
                postgresql: pgOk ? 'connected' : 'disconnected',
                firestore: firestoreOk ? 'connected' : 'disconnected',
            },
        },
    });
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
