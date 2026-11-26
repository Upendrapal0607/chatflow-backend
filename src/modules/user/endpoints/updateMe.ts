import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, useServices } from '../../../lib/hooks';
import { updateUserValidator } from '../schema';
import { useUserService } from '../service';
import type { UpdateUserInput, UserService } from '../types';

export const updateMeHandler = async ({
    services,
    args,
}: AuthenticatedProps<UpdateUserInput, CoreServices & { userService: UserService }>) => {
    const user = await services.userService.updateProfile({ services, args });
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
        useJsonBody(updateUserValidator),
        updateMeHandler,
    ),
    config: {
        method: 'PATCH',
        path: '/user/me',
    },
};
