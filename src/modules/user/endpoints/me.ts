import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useKoa, useLogging, useServices } from '../../../lib/hooks';

export const meHandler = ({ args }: AuthenticatedProps<Record<string, unknown>, CoreServices>) => {
    return Promise.resolve({
        data: {
            user: args.currentUser,
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
        useAuth(),
        meHandler,
    ),
    config: {
        method: 'GET',
        path: '/user/me',
    },
};
