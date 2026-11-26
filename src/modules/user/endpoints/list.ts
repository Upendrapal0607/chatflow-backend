import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useKoa, useLogging, useQueryString, useServices } from '../../../lib/hooks';
import { listUsersQueryValidator } from '../schema';
import { useUserService } from '../service';
import type { ListUsersInput, UserService } from '../types';

export const listUsersHandler = async ({
    services,
    args,
}: AuthenticatedProps<ListUsersInput, CoreServices & { userService: UserService }>) => {
    const { users, pagination } = await services.userService.list({ services, args });
    return {
        data: { users },
        pagination,
    };
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
        useQueryString(listUsersQueryValidator),
        listUsersHandler,
    ),
    config: {
        method: 'GET',
        path: '/users',
    },
};
