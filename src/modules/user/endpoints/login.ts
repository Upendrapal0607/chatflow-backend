import { CoreServices, useCoreServices } from '../../../core';
import { compose, type Endpoint, type Props } from '../../../lib/core';
import { useJsonBody, useKoa, useLogging, useServices } from '../../../lib/hooks';
import { loginUserValidator } from '../schema';
import { useUserService } from '../service';
import type { LoginUserInput, UserService } from '../types';

export const loginHandler = async ({
    services,
    args,
}: Props<LoginUserInput, CoreServices & { userService: UserService }>) => {
    const result = await services.userService.login({ services, args });
    return { data: result };
};

export const endpoint: Endpoint = {
    handler: compose(
        useKoa(),
        useServices({
            ...useCoreServices(),
            ...useUserService(),
        }),
        useLogging(),
        useJsonBody(loginUserValidator),
        loginHandler,
    ),
    config: {
        method: 'POST',
        path: '/user/login',
    },
};
