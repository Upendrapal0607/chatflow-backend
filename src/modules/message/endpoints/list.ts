import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useKoa, useLogging, usePathParams, useQueryString, useServices } from '../../../lib/hooks';
import { chatIdParamValidator } from '../../chat/schema';
import { getMessagesQueryValidator } from '../schema';
import { useMessageService } from '../service';
import type { GetMessagesInput, MessageService } from '../types';

export const listMessagesHandler = async ({
    services,
    args,
}: AuthenticatedProps<GetMessagesInput, CoreServices & { messageService: MessageService }>) => {
    const result = await services.messageService.getMessages({ services, args });
    return {
        data: result,
    };
};

export const endpoint: Endpoint = {
    handler: compose(
        useKoa(),
        useServices({
            ...useCoreServices(),
            ...useMessageService(),
        }),
        useLogging(),
        useAuth(),
        usePathParams(chatIdParamValidator),
        useQueryString(getMessagesQueryValidator),
        listMessagesHandler,
    ),
    config: {
        method: 'GET',
        path: '/chat/:chatId/messages',
    },
};
