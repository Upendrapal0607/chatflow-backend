import { CoreServices, useCoreServices } from '../../../core';
import { compose, res, type Endpoint, type Props } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, useServices } from '../../../lib/hooks';
import { registerUserValidator } from '../schema';
import { useUserService } from '../service';
import type { RegisterUserInput, UserService } from '../types';

export const registerHandler = async ({
    services,
    args,
}: Props<RegisterUserInput, CoreServices & { userService: UserService }>) => {
    const result = await services.userService.register({ services, args });
    return res(201, { data: result });
};

export const endpoint: Endpoint = {
    handler: compose(
        useKoa(),
        useServices({
            ...useCoreServices(),
            ...useUserService(),
        }),
        useLogging(),
        useJsonBody(registerUserValidator),
        registerHandler,
    ),
    config: {
        method: 'POST',
        path: '/user/register',
    },
};
