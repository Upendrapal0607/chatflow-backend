import { CoreServices, useAuth, useCoreServices } from '../../../core';
import type { AuthenticatedProps } from '../../../core/hooks';
import { compose, type Endpoint } from '../../../lib/core';
import { useKoa, useLogging, usePathParams, useServices } from '../../../lib/hooks';
import { chatIdParamValidator } from '../schema';
import { useChatService } from '../service';
import type { ChatService } from '../types';

export const getChatByIdHandler = async ({
    services,
    args,
}: AuthenticatedProps<{ chatId: string }, CoreServices & { chatService: ChatService }>) => {
    const chat = await services.chatService.getChatById({ services, args });
    return {
        data: { chat },
    };
};

export const endpoint: Endpoint = {
    handler: compose(
        useKoa(),
        useServices({
            ...useCoreServices(),
            ...useChatService(),
        }),
        useLogging(),
        useAuth(),
        usePathParams(chatIdParamValidator),
        getChatByIdHandler,
    ),
    config: {
        method: 'GET',
        path: '/chat/:chatId',
    },
};
