import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { userIdParamValidator } from '../schema';
import { useUserService } from '../service';
import type { UserService } from '../types';

export const getUserByIdHandler = async ({
    services,
    args,
}: AuthenticatedProps<{ userId: string }, CoreServices & { userService: UserService }>) => {
    const user = await services.userService.getById({
        services,
        args: { userId: args.userId },
    });
    return { data: { user } };
};

export const endpoint: Endpoint = {
    handler: compose(
        useKoa(),
        useServices({
            ...useCoreServices(),
            ...useUserService(),
        }),
        useLogging(),
        useAuth(),
        usePathParams(userIdParamValidator),
        getUserByIdHandler,
    ),
    config: {
        method: 'GET',
        path: '/user/:userId',
    },
};
